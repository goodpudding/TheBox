import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  ok: "bg-primary/15 text-brown",
  warn: "bg-accent/20 text-brown",
  danger: "bg-accent/30 text-brown",
  muted: "bg-border/80 text-secondary",
  info: "bg-brown/10 text-brown",
};

export function StatusPill({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
