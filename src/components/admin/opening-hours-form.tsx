"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import {
  DAY_NAMES,
  DEFAULT_OPENING_HOURS,
  OPENING_STEP_MINUTES,
  dayHoursLabel,
  timeLabel,
  type DayHours,
  type OpeningHours,
} from "@/lib/opening-hours";

/** Every time a day can open or close at: midnight to midnight in half hours. */
const TIMES = Array.from(
  { length: (24 * 60) / OPENING_STEP_MINUTES + 1 },
  (_, i) => i * OPENING_STEP_MINUTES,
);

const selectClass =
  "h-11 w-full rounded-full border border-border bg-surface px-3 text-charcoal disabled:opacity-50";

/**
 * The week the shop is open. The lobby display's "Open now", the hours a
 * machine can be reserved in and the hours on the Join page all follow what
 * is saved here.
 */
export function OpeningHoursForm() {
  const { provider, revision, bump } = useData();
  const [week, setWeek] = useState<OpeningHours | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // True from the first change until it is saved. The page reloads its data
  // whenever anything on it is saved (the rates form, the shop details), and
  // that must not throw away hours staff are halfway through changing.
  const editing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void provider.getOpeningHours().then((next) => {
      if (!cancelled && !editing.current) setWeek(next);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  function setDay(weekday: number, day: DayHours) {
    editing.current = true;
    setWeek((current) =>
      current ? current.map((d, i) => (i === weekday ? day : d)) : current,
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!week) return;
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      setWeek(await provider.adminSaveOpeningHours(week));
      editing.current = false;
      setMessage("Opening hours saved.");
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  if (!week) return null;

  return (
    <section className="mt-16 max-w-xl border-t border-border pt-10">
      <h2 className="font-display text-xl font-semibold text-brown">Opening hours</h2>
      <p className="mt-2 text-sm text-secondary">
        The lobby display, the hours machines can be reserved in and the hours on the
        Join page all follow these. For a one-off closure, add a note on the Hours page
        under Admin → Content.
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-5">
        <AdminNotice message={message} error={error} />
        {DAY_NAMES.map((name, weekday) => {
          const day = week[weekday] ?? null;
          // What a closed day opens with when staff untick "Closed".
          const fallback = DEFAULT_OPENING_HOURS[weekday] ?? { open: 13 * 60, close: 20 * 60 };
          return (
            <fieldset key={name} className="rounded-2xl border border-border px-4 py-3">
              <legend className="px-1 font-display text-sm font-semibold text-brown">
                {name}
                <span className="ml-2 font-normal text-secondary">{dayHoursLabel(day)}</span>
              </legend>
              <label className="flex items-center gap-3 text-charcoal">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={day === null}
                  onChange={(e) => setDay(weekday, e.target.checked ? null : { ...fallback })}
                />
                Closed
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm text-secondary">
                  <span>Opens</span>
                  <select
                    aria-label={`${name} opens`}
                    className={selectClass}
                    disabled={day === null}
                    value={day?.open ?? fallback.open}
                    onChange={(e) =>
                      setDay(weekday, {
                        open: Number(e.target.value),
                        close: day?.close ?? fallback.close,
                      })
                    }
                  >
                    {TIMES.slice(0, -1).map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {timeLabel(minutes)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-secondary">
                  <span>Closes</span>
                  <select
                    aria-label={`${name} closes`}
                    className={selectClass}
                    disabled={day === null}
                    value={day?.close ?? fallback.close}
                    onChange={(e) =>
                      setDay(weekday, {
                        open: day?.open ?? fallback.open,
                        close: Number(e.target.value),
                      })
                    }
                  >
                    {TIMES.slice(1).map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes === 24 * 60 ? "Midnight" : timeLabel(minutes)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>
          );
        })}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save opening hours"}
        </Button>
      </form>
    </section>
  );
}
