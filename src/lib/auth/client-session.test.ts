import { describe, expect, it } from "vitest";
import { toClientSession } from "./client-session";

const EXPIRES = new Date("2026-12-13T18:30:00.000Z");

/**
 * What Auth.js hands the session callback with the database strategy: the
 * Session row with the whole User row attached as `user`.
 */
function adapterSession() {
  return {
    id: "cm-session-row-id",
    sessionToken: "4b4359ae-0000-4000-8000-secret-token",
    userId: "u-maya",
    expires: EXPIRES,
    user: {
      id: "u-maya",
      email: "maya.chen@example.com",
      emailVerified: new Date("2026-11-13T18:30:00.000Z"),
      image: null,
      displayName: "Maya Chen",
      phone: "206-555-0101",
      role: "member",
      status: "active",
      notes: "staff-only note",
      emergencyContactPhone: "206-555-0102",
      kioskPinHash: "scrypt$not-for-the-browser",
    },
  };
}

const dbUser = {
  id: "u-maya",
  email: "maya.chen@example.com",
  displayName: "Maya Chen",
  role: "member",
  status: "active",
  phone: "206-555-0101",
  notes: "staff-only note",
  kioskPinHash: "scrypt$not-for-the-browser",
};

describe("toClientSession", () => {
  it("returns only the user fields the app uses, plus expires", () => {
    expect(toClientSession(adapterSession(), dbUser)).toEqual({
      user: {
        id: "u-maya",
        name: "Maya Chen",
        email: "maya.chen@example.com",
        role: "member",
        status: "active",
      },
      expires: "2026-12-13T18:30:00.000Z",
    });
  });

  it("does not hand the session token or the session row to the browser", () => {
    const result = toClientSession(adapterSession(), dbUser);
    expect(result).not.toHaveProperty("sessionToken");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("id");
    expect(JSON.stringify(result)).not.toContain("4b4359ae");
    expect(JSON.stringify(result)).not.toContain("cm-session-row-id");
  });

  it("does not hand private member columns to the browser", () => {
    const body = JSON.stringify(toClientSession(adapterSession(), dbUser));
    expect(body).not.toContain("kioskPinHash");
    expect(body).not.toContain("scrypt$");
    expect(body).not.toContain("206-555");
    expect(body).not.toContain("staff-only note");
  });

  it("does not change the object it was given", () => {
    const input = adapterSession();
    toClientSession(input, dbUser);
    expect(input).toEqual(adapterSession());
  });

  it("keeps the signed-in user's id when the member row is missing", () => {
    expect(toClientSession(adapterSession(), null)).toEqual({
      user: { id: "u-maya", email: "maya.chen@example.com" },
      expires: "2026-12-13T18:30:00.000Z",
    });
  });
});
