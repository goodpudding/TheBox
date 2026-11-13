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
