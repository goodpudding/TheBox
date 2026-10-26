import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyCalendarOps,
  buildCalendarEvent,
  calendarIdForPrice,
  planCalendarOps,
  signServiceAccountJwt,
  type CalendarSession,
} from "@/lib/sync/google-calendar";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function session(partial: Partial<CalendarSession> = {}): CalendarSession {
  return {
    id: "class_1",
    title: "Lathe",
    startsAt: "2026-11-02T18:00:00.000Z",
    endsAt: "2026-11-02T20:00:00.000Z",
    priceCents: 3500,
    capacity: 6,
    zeffyUrl: "https://www.zeffy.com/en-US/ticketing/lathe",
    location: "The Box",
    source: "zeffy",
    googleEventId: null,
    googleCalendarId: null,
    cancelledAt: null,
    ...partial,
  };
}

const ids = { classes: "classes-cal", community: "community-cal" };

describe("google calendar", () => {
  it("signs an RS256 service-account JWT", async () => {
    const jwt = await signServiceAccountJwt(
      {
        client_email: "sync@example.iam.gserviceaccount.com",
        private_key: privateKey,
        private_key_id: "key-1",
      },
      1_700_000_000,
    );
    const [header, payload, signature] = jwt.split(".");
    const decodedHeader = JSON.parse(Buffer.from(header, "base64url").toString());
    expect(decodedHeader.alg).toBe("RS256");
    expect(decodedHeader.kid).toBe("key-1");
    const body = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(body.scope).toBe("https://www.googleapis.com/auth/calendar.events");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("builds create, patch, and delete requests and skips csv rows", () => {
    const ops = planCalendarOps(
      [
        session(),
        session({
          id: "class_2",
          priceCents: 0,
          source: "admin",
          googleEventId: "evt_2",
          googleCalendarId: "community-cal",
        }),
        session({ id: "class_3", googleEventId: "evt_3", cancelledAt: "2026-11-01T00:00:00.000Z" }),
        session({ id: "class_csv", source: "csv" }),
      ],
      ids,
    );
    expect(ops.map((op) => op.kind)).toEqual(["create", "patch", "delete"]);
    const create = ops[0];
    expect(create?.kind).toBe("create");
    if (create?.kind === "create") {
      expect(create.calendarId).toBe("classes-cal");
      expect(create.body.extendedProperties.private.theboxSessionId).toBe("class_1");
      expect(create.body.start.timeZone).toBe("America/Los_Angeles");
      expect(create.body.description).toContain("Register: https://www.zeffy.com");
    }
    expect(calendarIdForPrice(0, ids)).toBe("community-cal");
    expect(buildCalendarEvent(session()).summary).toBe("Lathe");
  });

  it("continues after one event fails", async () => {
    const ops = planCalendarOps(
      [session({ id: "a" }), session({ id: "b", priceCents: 0 })],
      ids,
    );
    const result = await applyCalendarOps(ops, async (op) => {
      if (op.sessionId === "a") throw new Error("boom");
      return { id: "evt_b" };
    });
    expect(result.created).toBe(1);
    expect(result.errors).toEqual(["a: boom"]);
  });
});
