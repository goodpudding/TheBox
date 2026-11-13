import { describe, expect, it } from "vitest";
import { normalizeSignInEmail } from "./sign-in-email";

describe("normalizeSignInEmail", () => {
  it("keeps a plain address, in the lower case Auth.js stores", () => {
    for (const [typed, stored] of [
      ["pat@example.com", "pat@example.com"],
      ["  Pat.Smith@Example.COM ", "pat.smith@example.com"],
      ["pat+news@example.com", "pat+news@example.com"],
      ["o'brien_99@mail.example.co.uk", "o'brien_99@mail.example.co.uk"],
      ["josé@bücher.example", "josé@bücher.example"],
      ["dev@localhost", "dev@localhost"],
      // Full-width letters fold to plain ones before the check, as in Auth.js.
      ["ｐａｔ@example.com", "pat@example.com"],
    ]) {
      expect(normalizeSignInEmail(typed), typed).toBe(stored);
    }
  });

  it("refuses anything a mail service could read as a different or a second address", () => {
    for (const typed of [
      "Pat <pat@example.com>",
      "<pat@example.com>",
      "x,pat@example.com",
      "x;pat@example.com",
      "(note)pat@example.com",
      "pat@example.com (note)",
      "pat@example.com,sam@example.org",
      '"pat"@example.com',
      "pat@sam@example.com",
      "pat＠example.com@example.org",
      "pat @example.com",
      "pat​@example.com",
      "pat@example.com.",
      "pat@.example.com",
      "pat@[203.0.113.9]",
      "pat@",
      "@example.com",
      "pat",
      "",
      `${"p".repeat(250)}@example.com`,
    ]) {
      expect(() => normalizeSignInEmail(typed), typed).toThrow("Invalid email address format.");
    }
  });

  it("refuses a body field that is not text", () => {
    for (const value of [undefined, null, 7, ["pat@example.com"], { email: "pat@example.com" }]) {
      expect(() => normalizeSignInEmail(value as unknown as string)).toThrow();
    }
  });
});
