import { describe, expect, it } from "vitest";
import { clientSession } from "./session-shape";

/** What Auth.js hands the session callback when sessions live in the database. */
const adapterSession = {
  id: "sess-1",
  sessionToken: "the-cookie-value",
  userId: "u-1",
  expires: "2030-01-01T00:00:00.000Z",
  user: {
    id: "u-1",
    email: "old@example.com",
    name: null,
    notes: "Staff only: owes $40",
    kioskPinHash: "scrypt$abc",
    emergencyContactPhone: "555-0100",
  },
};

const dbUser = {
  id: "u-1",
  email: "maya@example.com",
  displayName: "Maya Chen",
  role: "member",
  status: "active",
  notes: "Staff only: owes $40",
  kioskPinHash: "scrypt$abc",
};

describe("clientSession", () => {
  it("returns only what the browser needs", () => {
    const out = clientSession(adapterSession, "u-1", dbUser);
    expect(out).toEqual({
      expires: "2030-01-01T00:00:00.000Z",
      user: {
        id: "u-1",
        name: "Maya Chen",
        email: "maya@example.com",
        role: "member",
        status: "active",
      },
    });
  });

  it("never passes on the session cookie, staff notes or the PIN hash", () => {
    const text = JSON.stringify(clientSession(adapterSession, "u-1", dbUser));
    expect(text).not.toContain("the-cookie-value");
    expect(text).not.toContain("owes $40");
    expect(text).not.toContain("scrypt$abc");
    expect(text).not.toContain("555-0100");
  });

  it("still names the member when their row cannot be read", () => {
    const out = clientSession(adapterSession, "u-1", null);
    expect(out.user).toEqual({ id: "u-1", name: null, email: "old@example.com" });
  });
});
