/** Live mode uses the signed-in session and D1. Demo mode stays on fixtures. */
export function isLiveDataMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_DATA_MODE === "live" &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  );
}
