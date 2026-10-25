import { describe, expect, it } from "vitest";
import {
  DEMO_KIOSK_PIN,
  hashKioskPin,
  isValidPinShape,
  verifyKioskPin,
} from "./pin";

describe("kiosk PIN", () => {
  it("accepts 4–8 digits", () => {
    expect(isValidPinShape("2468")).toBe(true);
    expect(isValidPinShape("12345678")).toBe(true);
    expect(isValidPinShape("12")).toBe(false);
    expect(isValidPinShape("abcd")).toBe(false);
  });

  it("verifies a hash and rejects a wrong PIN", async () => {
    const hash = await hashKioskPin(DEMO_KIOSK_PIN);
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(await verifyKioskPin(DEMO_KIOSK_PIN, hash)).toBe(true);
    expect(await verifyKioskPin("0000", hash)).toBe(false);
    expect(await verifyKioskPin(DEMO_KIOSK_PIN, null)).toBe(false);
  });
});
