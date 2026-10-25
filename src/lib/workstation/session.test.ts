import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "./session";

describe("workstation tokens", () => {
  it("hashes tokens without storing plaintext equality", () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(64);
    const hash = hashSessionToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hash);
    expect(hashSessionToken(`${token}x`)).not.toBe(hash);
  });
});
