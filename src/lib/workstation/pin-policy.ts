const TRIVIAL_PINS = new Set(["0000", "1234", "1111", "123456"]);

function normalizePin(pin: string): string {
  return pin.replace(/\s+/g, "");
}

/** Null when the PIN is 4–6 digits and not a blocked trivial value. */
export function kioskPinPolicyError(pin: string): string | null {
  const normalized = normalizePin(pin);
  if (!/^\d{4,6}$/.test(normalized)) {
    return "PIN must be 4–6 digits.";
  }
  if (TRIVIAL_PINS.has(normalized)) {
    return "Choose a less obvious PIN.";
  }
  return null;
}

/** Six-digit temporary PINs read aloud as two groups of three. */
export function formatShopPin(pin: string): string {
  const digits = normalizePin(pin);
  if (digits.length === 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return digits;
}
