import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPENING_HOURS, openingHoursLines } from "@/lib/opening-hours";
import { createMockDataProvider } from "./mock-provider";
import { RPC_RULES, handleDataRpc } from "./rpc-policy";

const time = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Los_Angeles",
  hour: "2-digit",
  minute: "2-digit",
});
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" });

type Provider = ReturnType<typeof createMockDataProvider>;

async function bookable(provider: Provider, day: string): Promise<string[]> {
  const slots = await provider.getMachineAvailability("m-bambu-a1", day, day);
  return slots
    .filter((s) => s.reason !== "closed" && s.reason !== "past")
    .filter((s) => date.format(new Date(s.startsAt)) === day)
    .map((s) => time.format(new Date(s.startsAt)));
}

function at(moment: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(moment));
}

async function actors() {
  const all = await createMockDataProvider().adminListMembers();
  return {
    staff: all.find((u) => u.role === "staff")!,
    member: all.find((u) => u.role === "member" && u.status === "active")!,
  };
}

/** The default week with Monday open 10:30 to 2:30 and Sunday closed. */
function newWeek() {
  const week = DEFAULT_OPENING_HOURS.map((d) => (d ? { ...d } : null));
  week[1] = { open: 10 * 60 + 30, close: 14 * 60 + 30 };
  week[0] = null;
  return week;
}

describe("opening hours staff set in Admin → Settings", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("start as the default week, and anyone can read them", async () => {
    expect(await createMockDataProvider().getOpeningHours()).toEqual(DEFAULT_OPENING_HOURS);
    expect(RPC_RULES.getOpeningHours.access).toBe("public");
  });

  it("change the lobby display, the hours a machine can be reserved in and the public list together", async () => {
    at("2026-11-21T09:00:00-08:00");
    const { staff } = await actors();
    const provider = createMockDataProvider(staff.id);
    // Before: Monday shut, Sunday 11 to 4.
    expect(await bookable(provider, "2026-11-23")).toEqual([]);
    expect((await bookable(provider, "2026-11-22"))[0]).toBe("11:00");

    await provider.adminSaveOpeningHours(newWeek());

    // The public list.
    const lines = openingHoursLines(await provider.getOpeningHours());
    expect(lines[0]).toBe("Sunday Closed");
    expect(lines[1]).toBe("Monday 10:30 AM – 2:30 PM");

    // Reservations.
    const monday = await bookable(provider, "2026-11-23");
    expect([monday[0], monday.at(-1)]).toEqual(["10:30", "14:00"]);
    expect(await bookable(provider, "2026-11-22")).toEqual([]);
    await expect(
      provider.reserve({
        userId: staff.id,
        createdById: staff.id,
        machineId: "m-bambu-a1",
        startsAt: new Date("2026-11-23T14:00:00-08:00").toISOString(),
        endsAt: new Date("2026-11-23T15:00:00-08:00").toISOString(),
      }),
    ).rejects.toThrow("Reservation is outside opening hours");

    // The lobby display, on that Monday.
    at("2026-11-23T10:29:00-08:00");
    expect((await provider.getDisplayFeed()).isOpen).toBe(false);
    at("2026-11-23T10:30:00-08:00");
    const open = await provider.getDisplayFeed();
    expect(open.isOpen).toBe(true);
    expect(open.hours).toMatchObject({
      label: "Monday 10:30 AM – 2:30 PM",
      closed: false,
      openMinute: 630,
      closeMinute: 870,
    });
    at("2026-11-23T14:30:00-08:00");
    expect((await provider.getDisplayFeed()).isOpen).toBe(false);
    at("2026-11-22T12:00:00-08:00");
    const sunday = await provider.getDisplayFeed();
    expect(sunday.isOpen).toBe(false);
    expect(sunday.hours).toMatchObject({ label: "Sunday · Closed", closed: true });
  });

  it("refuse a week that makes no sense and keep the old one", async () => {
    const { staff } = await actors();
    const provider = createMockDataProvider(staff.id);
    const bad = newWeek();
    bad[2] = { open: 20 * 60, close: 13 * 60 };
    await expect(provider.adminSaveOpeningHours(bad)).rejects.toThrow(/Tuesday closes before it opens/);
    expect(await provider.getOpeningHours()).toEqual(DEFAULT_OPENING_HOURS);
  });

  it("record who changed which day", async () => {
    const { staff } = await actors();
    const provider = createMockDataProvider(staff.id);
    await provider.adminSaveOpeningHours(newWeek());
    const event = (await provider.adminListAuditEvents()).find(
      (e) => e.action === "opening_hours_changed",
    )!;
    expect(event.actorId).toBe(staff.id);
    expect(event.metadata).toEqual({
      Sunday: { from: "11:00 AM – 4:00 PM", to: "Closed" },
      Monday: { from: "Closed", to: "10:30 AM – 2:30 PM" },
    });
    // Saving the same week again changes nothing and records nothing.
    await provider.adminSaveOpeningHours(newWeek());
    expect(
      (await provider.adminListAuditEvents()).filter((e) => e.action === "opening_hours_changed"),
    ).toHaveLength(1);
  });

  it("are staff only to change", async () => {
    const { member, staff } = await actors();
    const provider = createMockDataProvider(member.id);
    const refused = await handleDataRpc({
      method: "adminSaveOpeningHours",
      args: [newWeek()],
      sessionUser: member,
      provider,
    });
    expect(refused).toMatchObject({ status: 403, body: { ok: false, error: "Staff only" } });
    const anonymous = await handleDataRpc({
      method: "adminSaveOpeningHours",
      args: [newWeek()],
      sessionUser: null,
      provider,
    });
    expect(anonymous.status).toBe(401);
    expect(await provider.getOpeningHours()).toEqual(DEFAULT_OPENING_HOURS);

    const allowed = await handleDataRpc({
      method: "adminSaveOpeningHours",
      args: [newWeek()],
      sessionUser: staff,
      provider: createMockDataProvider(staff.id),
    });
    expect(allowed).toMatchObject({ status: 200, body: { ok: true } });
  });
});
