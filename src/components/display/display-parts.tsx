import type { CSSProperties, ReactNode } from "react";

/**
 * Pieces every lobby display slide is built from. Sizes are in vw and vh so a
 * slide fills any 16:9 screen the same way, and no text is under 1.3vw: the
 * screen is read from across a room or through a window.
 */

const TZ = "America/Los_Angeles";

/** "1:00 PM" */
export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "Tue Nov 24" */
export function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(new Date(iso))
    .replace(",", "");
}

/** "Tuesday, December 15" */
export function longDayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/** The date block on a row: ["TUE", "Dec 15"]. */
export function dateBlock(iso: string): [weekday: string, day: string] {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
  }).format(date);
  return [weekday.toUpperCase(), day];
}

/**
 * "6:00 – 8:00 PM", or "11:00 AM – 1:30 PM" across noon. Just the start when
 * the end is missing or not after it.
 */
export function timeRangeLabel(startIso: string, endIso: string): string {
  const start = timeLabel(startIso);
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) return start;
  const end = timeLabel(endIso);
  const half = (label: string) => label.slice(-2);
  return half(start) === half(end)
    ? `${start.slice(0, -3)} – ${end}`
    : `${start} – ${end}`;
}

/** "$65", or "$12.50" when there are cents. */
export function priceLabel(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function spotsLabel(spots: number): string {
  if (spots <= 0) return "Full";
  return `${spots} spot${spots === 1 ? "" : "s"} left`;
}

export type Tone = "coral" | "teal" | "gold";

const TONES: readonly Tone[] = ["coral", "teal", "gold"];

const TONE_BAR: Record<Tone, string> = {
  coral: "bg-display-coral",
  teal: "bg-display-teal",
  gold: "bg-display-gold",
};

/** Rows take the accent colours in turn. */
export function toneAt(index: number): Tone {
  return TONES[index % TONES.length]!;
}

/**
 * One screenful out of a longer list. The display cannot scroll, so a long
 * list is shown a page at a time, moving on each time the rotation comes
 * round. Pages are as even as they can be: 17 items at 9 a page is 9 and 8.
 */
export function pageOf<T>(
  items: T[],
  perPage: number,
  turn: number,
): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const size = Math.ceil(items.length / pages);
  const page = ((turn % pages) + pages) % pages;
  return { items: items.slice(page * size, (page + 1) * size), page, pages };
}

export function PageNote({ page, pages }: { page: number; pages: number }) {
  if (pages <= 1) return null;
  return (
    <p className="shrink-0 text-[1.3vw] font-semibold text-display-muted">
      {page + 1} of {pages}
    </p>
  );
}

export function SlideHeading({
  lead,
  accent,
  sub,
  aside,
}: {
  lead: string;
  /** Last word or words, in coral. */
  accent?: string;
  sub?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-[2vw]">
      <div className="min-w-0">
        <h1 className="truncate text-[4.4vw] font-extrabold leading-[1.05] text-display-ink">
          {lead}
          {accent ? (
            <>
              {" "}
              <span className="text-display-coral">{accent}</span>
            </>
          ) : null}
        </h1>
        {sub ? (
          <p className="mt-[0.8vh] truncate text-[1.6vw] text-display-muted">
            {sub}
          </p>
        ) : null}
      </div>
      {aside}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="shrink-0 truncate text-[1.3vw] font-extrabold uppercase tracking-[0.16em] text-display-gold">
      {children}
    </h2>
  );
}

/** A list that always divides its height into `rows` equal rows. */
export function SlideRows({
  rows,
  className = "",
  children,
}: {
  rows: number;
  className?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };
  return (
    <ul className={`grid min-h-0 flex-1 ${className}`} style={style}>
      {children}
    </ul>
  );
}

export function SlideRow({
  tone,
  title,
  meta,
  tag,
  aside,
}: {
  tone: Tone;
  title: string;
  meta?: ReactNode;
  /** Small line above the title. */
  tag?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <li className="flex min-h-0 items-center gap-[1.2vw] overflow-hidden border-b-2 border-display-rule last:border-b-0">
      <span
        className={`h-[62%] w-[0.7vw] shrink-0 rounded-full ${TONE_BAR[tone]}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {tag ? (
          <p className="truncate text-[1.3vw] font-extrabold uppercase tracking-[0.14em] text-display-muted">
            {tag}
          </p>
        ) : null}
        <p className="truncate text-[2.1vw] font-bold leading-[1.15] text-display-ink">
          {title}
        </p>
        {meta ? (
          <p className="mt-[0.2vh] truncate text-[1.35vw] text-display-muted">
            {meta}
          </p>
        ) : null}
      </div>
      {aside}
    </li>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="max-w-full justify-self-start truncate rounded-full border-2 border-display-rule bg-white/70 px-[1vw] py-[0.5vh] text-[1.3vw] font-semibold leading-[1.4] text-display-ink">
      {children}
    </span>
  );
}

/**
 * Up to `max` chips, two to a row. A longer list ends in "+N more" so the
 * block never grows past its rows: the display cannot scroll.
 */
export function ChipGrid({ labels, max }: { labels: string[]; max: number }) {
  const shown = labels.length > max ? labels.slice(0, max - 1) : labels;
  const hidden = labels.length - shown.length;
  // A short list gets the full width, so a long label is not cut off beside
  // an empty column. It still fits: half as many chips, one to a row.
  const oneColumn = labels.length <= max / 2;
  return (
    <div
      className={`grid gap-x-[0.8vw] gap-y-[1vh] ${
        oneColumn ? "grid-cols-1" : "grid-cols-2"
      }`}
    >
      {shown.map((label, i) => (
        <Chip key={`${i}-${label}`}>{label}</Chip>
      ))}
      {hidden > 0 ? <Chip>+{hidden} more</Chip> : null}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-[1.5vw] text-display-muted">{children}</p>;
}
