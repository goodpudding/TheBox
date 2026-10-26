import { describe, expect, it } from "vitest";
import { kioskPinPolicyError } from "./pin-policy";

describe("kiosk PIN policy", () => {
  it("rejects non-digits, the wrong length, and trivial PINs", () => {
    expect(kioskPinPolicyError("12ab")).toMatch(/4–6 digits/);
    expect(kioskPinPolicyError("123")).toMatch(/4–6 digits/);
    expect(kioskPinPolicyError("1234567")).toMatch(/4–6 digits/);
    expect(kioskPinPolicyError("0000")).toMatch(/obvious/);
    expect(kioskPinPolicyError("1234")).toMatch(/obvious/);
    expect(kioskPinPolicyError("1111")).toMatch(/obvious/);
    expect(kioskPinPolicyError("123456")).toMatch(/obvious/);
  });

  it("accepts 4821", () => {
    expect(kioskPinPolicyError("4821")).toBeNull();
    expect(kioskPinPolicyError("48 21")).toBeNull();
  });
});
