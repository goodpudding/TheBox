import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_LENGTH,
  hashPassword,
  passwordHashIsCurrent,
  passwordPolicyError,
  verifyPassword,
} from "./password";

const GOOD = "plywood-otter-42";

describe("passwordPolicyError", () => {
  it("accepts a passphrase and anything long enough that is not obvious", () => {
    expect(passwordPolicyError(GOOD)).toBeNull();
    expect(passwordPolicyError("four words and spaces")).toBeNull();
    expect(passwordPolicyError("пароль-для-мастерской")).toBeNull();
  });

  it("refuses short, missing and over-long passwords", () => {
    expect(passwordPolicyError("short1234")).toMatch(/at least 10/);
    expect(passwordPolicyError("")).toMatch(/at least 10/);
    expect(passwordPolicyError(undefined)).toBe("Enter a password.");
    expect(passwordPolicyError(12345678901)).toBe("Enter a password.");
    expect(passwordPolicyError("a1".repeat(MAX_PASSWORD_LENGTH))).toMatch(/at most 200/);
  });

  it("refuses the passwords tried first by anyone guessing", () => {
    for (const weak of ["1234567890", "Password123", "QWERTYUIOP", "aaaaaaaaaaaa", "abababababab"]) {
      expect(passwordPolicyError(weak), weak).toMatch(/too easy to guess/);
    }
  });

  it("refuses a password built on the member's own email", () => {
    expect(passwordPolicyError("maya.chen@example.com", "Maya.Chen@example.com")).toMatch(
      /does not contain your email/,
    );
    expect(passwordPolicyError("maya.chen-2026", "maya.chen@example.com")).toMatch(
      /does not contain your email/,
    );
    // A two-letter name is in half the dictionary; it is not held against anyone.
    expect(passwordPolicyError("joinery-bench-7", "jo@example.com")).toBeNull();
  });
});

describe("hashPassword and verifyPassword", () => {
  it("checks the password it hashed and no other", async () => {
    const hash = await hashPassword(GOOD);
    expect(hash).toMatch(/^scrypt:16384:8:1:[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(await verifyPassword(GOOD, hash)).toBe(true);
    expect(await verifyPassword(`${GOOD} `, hash)).toBe(false);
    expect(await verifyPassword(GOOD.toUpperCase(), hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts, so the same password never stores the same way twice", async () => {
    expect(await hashPassword(GOOD)).not.toBe(await hashPassword(GOOD));
  });

  it("treats two ways of typing the same characters as one password", async () => {
    // "é" as one character, and as "e" followed by a combining accent.
    const hash = await hashPassword("café-workbench");
    expect(await verifyPassword("café-workbench", hash)).toBe(true);
  });

  it("still checks a hash made with other settings, and says it is out of date", async () => {
    const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
    const key = scryptSync(GOOD, salt, 32, { N: 4096, r: 8, p: 1 });
    const old = `scrypt:4096:8:1:${salt.toString("hex")}:${key.toString("hex")}`;
    expect(await verifyPassword(GOOD, old)).toBe(true);
    expect(await verifyPassword("something-else-1", old)).toBe(false);
    expect(passwordHashIsCurrent(old)).toBe(false);
    expect(passwordHashIsCurrent(await hashPassword(GOOD))).toBe(true);
  });

  it("answers false, without doing the work, for a hash it cannot read", async () => {
    const real = await hashPassword(GOOD);
    const [, , , , salt, key] = real.split(":");
    const damaged = [
      null,
      undefined,
      "",
      "plaintext",
      // The shop PIN's format: a PIN hash must never pass for a password.
      `scrypt:${salt}:${key}`,
      `bcrypt:16384:8:1:${salt}:${key}`,
      // Settings that would take minutes or more memory than a Worker has.
      `scrypt:1073741824:8:1:${salt}:${key}`,
      `scrypt:16384:999:1:${salt}:${key}`,
      `scrypt:16384:8:99:${salt}:${key}`,
      `scrypt:1000:8:1:${salt}:${key}`,
      `scrypt:0:8:1:${salt}:${key}`,
      `scrypt:16384:8:1:zz:${key}`,
      `scrypt:16384:8:1:${salt}:abcd`,
      `${real}:extra`,
    ];
    const started = Date.now();
    for (const hash of damaged) {
      expect(await verifyPassword(GOOD, hash), String(hash)).toBe(false);
      expect(passwordHashIsCurrent(String(hash))).toBe(false);
    }
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("refuses to hash-check megabytes of input", async () => {
    const hash = await hashPassword(GOOD);
    expect(await verifyPassword("x".repeat(4 * MAX_PASSWORD_LENGTH + 1), hash)).toBe(false);
  });
});
