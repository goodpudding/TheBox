import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  formatCode,
  generateCode,
  normalizeCode,
} from "./redemption-code";

describe("redemption code text", () => {
  it("has no characters that are mistaken for each other", () => {
    for (const ch of "01ILO") expect(CODE_ALPHABET).not.toContain(ch);
    expect(new Set(CODE_ALPHABET).size).toBe(CODE_ALPHABET.length);
  });

  it("is too long to guess: at least 60 bits", () => {
    expect(CODE_LENGTH * Math.log2(CODE_ALPHABET.length)).toBeGreaterThanOrEqual(60);
  });

  it("makes a different code every time, from the alphabet only", () => {
    const made = new Set(Array.from({ length: 500 }, () => generateCode()));
    expect(made.size).toBe(500);
    for (const code of made) {
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true);
    }
  });

  it("uses every character about as often as the others", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      for (const ch of generateCode()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    const expected = (4000 * CODE_LENGTH) / CODE_ALPHABET.length;
    for (const ch of CODE_ALPHABET) {
      expect(counts.get(ch) ?? 0).toBeGreaterThan(expected * 0.8);
      expect(counts.get(ch) ?? 0).toBeLessThan(expected * 1.2);
    }
  });

  it("is shown in groups and read back however it is typed", () => {
    const code = generateCode();
    const shown = formatCode(code);
    expect(shown).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(normalizeCode(shown)).toBe(code);
    expect(normalizeCode(` ${shown.toLowerCase().replace(/-/g, " ")} `)).toBe(code);
    expect(normalizeCode(code.toLowerCase())).toBe(code);
  });

  it("reads nothing out of text that cannot be a code", () => {
    expect(normalizeCode("")).toBe("");
    expect(normalizeCode("   ")).toBe("");
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode("x".repeat(500)).length).toBeLessThanOrEqual(64);
  });
});
