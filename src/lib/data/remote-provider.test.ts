import { describe, expect, it, vi, afterEach } from "vitest";
import { createRemoteDataProvider, SIGNED_OUT_EVENT } from "./remote-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RemoteDataProvider", () => {
  it("posts the method name and args", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, result: { orgName: "The Box" } }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = createRemoteDataProvider();
    const result = await provider.getSettings();
    expect(result).toMatchObject({ orgName: "The Box" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      method: "getSettings",
      args: [],
    });
    expect(init.credentials).toBe("same-origin");
  });

  it("rethrows domain errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, error: "rates missing" }), {
            status: 200,
          }),
      ),
    );
    const provider = createRemoteDataProvider();
    await expect(provider.getSettings()).rejects.toThrow("rates missing");
  });

  it("emits thebox:signed-out on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, error: "Sign in required" }), {
            status: 401,
          }),
      ),
    );
    const heard: string[] = [];
    vi.stubGlobal("window", {
      dispatchEvent(event: Event) {
        heard.push(event.type);
        return true;
      },
    });
    const provider = createRemoteDataProvider();
    await expect(provider.getUsage("u1")).rejects.toThrow("Sign in required");
    expect(heard).toEqual([SIGNED_OUT_EVENT]);
  });
});
