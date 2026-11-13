import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "./security-headers";

const byKey = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));

describe("security headers", () => {
  it("stops MIME sniffing and cross-site framing", () => {
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(byKey["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
  });

  it("keeps the kiosk token out of cross-site referrers", () => {
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("asks browsers to stay on HTTPS without pinning subdomains", () => {
    expect(byKey["Strict-Transport-Security"]).toMatch(/^max-age=\d+$/);
  });

  it("static files served by Cloudflare carry the same headers", () => {
    const file = readFileSync(path.join(process.cwd(), "public/_headers"), "utf8");
    for (const { key, value } of SECURITY_HEADERS) {
      expect(file, key).toContain(`${key}: ${value}`);
    }
  });
});
