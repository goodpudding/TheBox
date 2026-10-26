/**
 * Production builds talk to the signed-in session and the database.
 * Local `next dev` stays on fixtures unless NEXT_PUBLIC_DATA_MODE=live.
 * NEXT_PUBLIC_DEMO_MODE keeps a production build on fixtures.
 */
export function isLiveDataMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return false;
  if (process.env.NEXT_PUBLIC_DATA_MODE === "mock") return false;
  if (process.env.NEXT_PUBLIC_DATA_MODE === "live") return true;
  return process.env.NODE_ENV === "production";
}
