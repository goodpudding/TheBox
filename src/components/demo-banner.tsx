export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  return (
    <div className="bg-brown text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <p className="font-display text-sm font-medium">
          <span className="mr-2 inline-block rounded-sm bg-primary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brown">
            Demo
          </span>
          Preview only — mock data, not the live membership site.
        </p>
        <p className="font-display text-xs text-white/65">
          Use the bar at the bottom to switch sample members.
        </p>
      </div>
    </div>
  );
}
