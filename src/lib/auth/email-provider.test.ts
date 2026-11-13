import { createServer, type Server } from "node:net";
import type { AddressInfo } from "node:net";
import type { EmailConfig } from "next-auth/providers/email";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emailProvider } from "./email-provider";

const LINK =
  "http://localhost:3000/api/auth/callback/email?callbackUrl=%2Faccount&token=abc123&email=pat%40example.com";

type Received = { from: string; to: string[]; data: string };

/** The smallest SMTP server that accepts one plain message, like Mailpit does. */
async function startSmtpSink() {
  const received: Received[] = [];
  let connections = 0;
  const server: Server = createServer((socket) => {
    connections += 1;
    let buffer = "";
    let inData = false;
    let current: Received = { from: "", to: [], data: "" };
    socket.write("220 localhost ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end < 0) return;
          current.data = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          received.push(current);
          current = { from: "", to: [], data: "" };
          socket.write("250 OK\r\n");
          continue;
        }
        const eol = buffer.indexOf("\r\n");
        if (eol < 0) return;
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        const command = line.toUpperCase();
        if (command.startsWith("MAIL FROM:")) current.from = line.slice(10);
        if (command.startsWith("RCPT TO:")) current.to.push(line.slice(8));
        if (command === "DATA") {
          inData = true;
          socket.write("354 Go ahead\r\n");
        } else if (command === "QUIT") {
          socket.end("221 Bye\r\n");
        } else {
          socket.write("250 OK\r\n");
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `smtp://127.0.0.1:${port}`,
    received,
    connections: () => connections,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Undo quoted-printable so a long sign-in link can be matched as one string. */
function decodeQuotedPrintable(body: string): string {
  return body
    .replace(/=\r\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_m, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/** Auth.js merges a provider's defaults with the options it was built with. */
function resolved(provider: EmailConfig): EmailConfig {
  return { ...provider, ...provider.options } as EmailConfig;
}

function send(provider: EmailConfig, identifier: string) {
  const config = resolved(provider);
  return config.sendVerificationRequest({
    identifier,
    url: LINK,
    expires: new Date(0),
    provider: config,
    token: "abc123",
    theme: {},
    request: new Request("http://localhost:3000/api/auth/signin/email"),
  });
}

describe("sign-in email provider", () => {
  let sink: Awaited<ReturnType<typeof startSmtpSink>> | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await sink?.close();
    sink = undefined;
  });

  it("sends through Resend over HTTPS when a Resend key is set", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = emailProvider({
      AUTH_RESEND_KEY: "re_test_key",
      AUTH_EMAIL_FROM: "The Box <hello@example.org>",
    });

    // The login page calls signIn("email") whichever transport is active.
    expect(resolved(provider)).toMatchObject({ id: "email", type: "email" });
    await send(provider, "pat@example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer re_test_key");
    const body = JSON.parse(String(init.body));
    expect(body.to).toBe("pat@example.com");
    expect(body.from).toBe("The Box <hello@example.org>");
    expect(body.text).toContain(LINK);
  });

  it("delivers the sign-in link over SMTP in local development", async () => {
    sink = await startSmtpSink();
    const provider = emailProvider({
      AUTH_EMAIL_SERVER: sink.url,
      AUTH_EMAIL_FROM: "The Box <hello@example.org>",
    });

    expect(resolved(provider)).toMatchObject({ id: "email", type: "email" });
    await send(provider, "pat@example.com");

    expect(sink.received).toHaveLength(1);
    const [message] = sink.received;
    expect(message.from).toContain("<hello@example.org>");
    expect(message.to).toEqual([expect.stringContaining("<pat@example.com>")]);
    expect(decodeQuotedPrintable(message.data)).toContain(LINK);
  });

  it("refuses to send in production without a Resend key instead of trying SMTP", async () => {
    sink = await startSmtpSink();
    vi.stubEnv("NODE_ENV", "production");
    const provider = emailProvider({ AUTH_EMAIL_SERVER: sink.url });

    // Building the provider must not throw: `next build` runs without the key.
    expect(resolved(provider).id).toBe("email");
    await expect(send(provider, "pat@example.com")).rejects.toThrow(/AUTH_RESEND_KEY/);
    expect(sink.connections()).toBe(0);
  });
});
