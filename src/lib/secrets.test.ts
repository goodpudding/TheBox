import { beforeEach, describe, expect, it, vi } from "vitest";
import { configuredSecret, secretsMatch } from "./secrets";

describe("secretsMatch", () => {
  it("matches equal strings and rejects everything else", () => {
    expect(secretsMatch("abc123", "abc123")).toBe(true);
    expect(secretsMatch("abc123", "abc124")).toBe(false);
    expect(secretsMatch("abc", "abc123")).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch(null, "abc")).toBe(false);
    expect(secretsMatch("abc", undefined)).toBe(false);
  });
});

describe("configuredSecret", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the dev placeholder only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DISPLAY_TOKEN", "");
    expect(configuredSecret("DISPLAY_TOKEN", "dev-display-token-change-me")).toBe(
      "dev-display-token-change-me",
    );
    vi.stubEnv("NODE_ENV", "production");
    expect(configuredSecret("DISPLAY_TOKEN", "dev-display-token-change-me")).toBe("");
  });

  it("treats the published placeholder as unset on the live site", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISPLAY_TOKEN", "dev-display-token-change-me");
    expect(configuredSecret("DISPLAY_TOKEN", "dev-display-token-change-me")).toBe("");
    vi.stubEnv("DISPLAY_TOKEN", " a-real-long-random-token ");
    expect(configuredSecret("DISPLAY_TOKEN", "dev-display-token-change-me")).toBe(
      "a-real-long-random-token",
    );
  });
});

describe("reader secret", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects the documented dev secret in production even if it was deployed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("READER_SHARED_SECRET", "dev-reader-secret-change-me");
    const { readerSecretIsValid } = await import("./access-api");
    expect(readerSecretIsValid("dev-reader-secret-change-me")).toBe(false);
  });

  it("accepts the real secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("READER_SHARED_SECRET", "real-reader-secret");
    const { readerSecretIsValid } = await import("./access-api");
    expect(readerSecretIsValid("real-reader-secret")).toBe(true);
    expect(readerSecretIsValid("real-reader-secreT")).toBe(false);
    expect(readerSecretIsValid(null)).toBe(false);
  });
});
