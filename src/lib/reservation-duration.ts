/**
 * The reservation length, in slots, to show for the picked start time.
 * `maxContiguous` is how many open slots follow that start (0 when no start
 * is picked). A length that no longer fits drops to an hour, or to whatever
 * is left when less than an hour is open.
 */
export function fitDurationSlots(current: number, maxContiguous: number): number {
  if (maxContiguous <= 0) return current;
  if (current > maxContiguous) return Math.min(2, maxContiguous);
  return Math.max(1, current);
}
