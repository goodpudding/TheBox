/**
 * Response headers for every page and API route (next.config.ts).
 * Static files are served by Cloudflare's asset binding and never reach the
 * Worker, so public/_headers repeats them. A test keeps the two in step.
 */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The admin display preview frames /display from the same origin.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), microphone=(), payment=(), usb=()",
  },
];

/**
 * Stored photos are untrusted bytes. Served alone they get no script, no
 * network and no same-origin access, even if a file slips past the type check.
 */
export const PHOTO_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/**
 * Rules for next.config.ts. Config headers win over headers a route sets
 * itself, and a later rule wins over an earlier one, so the photo rule comes
 * last to keep its stricter policy.
 */
export function headerRules(): {
  source: string;
  headers: { key: string; value: string }[];
}[] {
  return [
    { source: "/:path*", headers: SECURITY_HEADERS },
    {
      source: "/api/inventory/photos/:id*",
      headers: [{ key: "Content-Security-Policy", value: PHOTO_CSP }],
    },
  ];
}
