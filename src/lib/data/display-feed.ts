import type {
  Booking,
  Certification,
  ClassSession,
  DisplayConfig,
  LearningModule,
  Machine,
  MachineFloorStatus,
  MaintenanceBlock,
  MembershipProduct,
  NameDisplayMode,
  PromoSlide,
  Reservation,
  UsageSession,
  User,
} from "./types";
import type {
  DisplayFeed,
  DisplayMachineStatus,
  DisplayMembershipTier,
} from "./provider";

const TZ = "America/Los_Angeles";

/** Opening hours [openHour, closeHour) in America/Los_Angeles. 0 = Sunday. */
export const DISPLAY_OPENING_HOURS: Record<number, [number, number]> = {
  0: [11, 17],
  1: [16, 20],
  2: [16, 20],
  3: [15, 20],
  4: [11, 20],
  5: [11, 20],
  6: [11, 18],
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SEAT_STATUSES = new Set(["booked", "awaiting_payment", "attended"]);

export function laParts(iso: string | Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  dateKey: string;
} {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    year,
    month,
    day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday!] ?? 0,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function formatHourLabel(hour: number): string {
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h12}:00 ${ampm}`;
}

export function formatDisplayName(
  user: Pick<User, "firstName" | "lastName"> | null | undefined,
  mode: NameDisplayMode,
): string {
  if (!user || mode === "none") return "";
  if (mode === "first") return user.firstName;
  const initial = user.lastName?.trim().charAt(0);
  return initial ? `${user.firstName} ${initial}.` : user.firstName;
}

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function bookedCount(
  bookings: Booking[],
  classSessionId: string,
): number {
  return bookings.filter(
    (b) => b.classSessionId === classSessionId && SEAT_STATUSES.has(b.status),
  ).length;
}

export function buildMachineStatuses(input: {
  machines: Machine[];
  usageSessions: UsageSession[];
  reservations: Reservation[];
  maintenanceBlocks: MaintenanceBlock[];
  users: User[];
  nameDisplayMode: NameDisplayMode;
  now: Date;
}): DisplayMachineStatus[] {
  const nowMs = input.now.getTime();
  const todayKey = laParts(input.now).dateKey;

  return input.machines
    .filter((m) => m.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((machine) => {
      const maint = input.maintenanceBlocks.find(
        (b) =>
          b.machineId === machine.id &&
          new Date(b.startsAt).getTime() <= nowMs &&
          new Date(b.endsAt).getTime() > nowMs,
      );
      if (maint) {
        return {
          id: machine.id,
          name: machine.name,
          area: machine.area,
          status: "maintenance" as MachineFloorStatus,
        };
      }

      const open = input.usageSessions.find(
        (s) => s.machineId === machine.id && !s.endedAt,
      );
      if (open) {
        const user = input.users.find((u) => u.id === open.userId);
        const displayName = formatDisplayName(user, input.nameDisplayMode);
        return {
          id: machine.id,
          name: machine.name,
          area: machine.area,
          status: "in_use" as MachineFloorStatus,
          since: open.startedAt,
          displayName: displayName || undefined,
        };
      }

      const nextRes = input.reservations
        .filter(
          (r) =>
            r.machineId === machine.id &&
            r.status === "booked" &&
            new Date(r.startsAt).getTime() > nowMs &&
            laParts(r.startsAt).dateKey === todayKey,
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )[0];

      if (nextRes) {
        return {
          id: machine.id,
          name: machine.name,
          area: machine.area,
          status: "reserved" as MachineFloorStatus,
          reservedAt: nextRes.startsAt,
        };
      }

      return {
        id: machine.id,
        name: machine.name,
        area: machine.area,
        status: "available" as MachineFloorStatus,
      };
    });
}

export function buildDisplayFeed(input: {
  now?: Date;
  machines: Machine[];
  usageSessions: UsageSession[];
  reservations: Reservation[];
  maintenanceBlocks: MaintenanceBlock[];
  classSessions: ClassSession[];
  bookings: Booking[];
  users: User[];
  certifications: Certification[];
  learningModules: LearningModule[];
  membershipProducts: MembershipProduct[];
  promoSlides: PromoSlide[];
  displayConfig: DisplayConfig;
}): DisplayFeed {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const parts = laParts(now);
  const [openHour, closeHour] = DISPLAY_OPENING_HOURS[parts.weekday] ?? [
    11, 17,
  ];
  const isOpen = parts.hour >= openHour && parts.hour < closeHour;
  const hoursLabel = `${DAY_NAMES[parts.weekday]} ${formatHourLabel(openHour)} – ${formatHourLabel(closeHour)}`;

  const mode = input.displayConfig.nameDisplayMode;
  const todayKey = parts.dateKey;
  const weekEnd = new Date(now.getTime() + 7 * 24 * 3600_000);

  const published = input.classSessions.filter((c) => c.published);

  const todaySessions = published
    .filter((c) => laParts(c.startsAt).dateKey === todayKey)
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .map((c) => {
      const seats = bookedCount(input.bookings, c.id);
      return {
        id: c.id,
        title: c.title,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        location: c.location,
        category: c.category,
        capacity: c.capacity,
        spotsRemaining: Math.max(0, c.capacity - seats),
      };
    });

  const todayReservations = input.reservations
    .filter(
      (r) =>
        r.status === "booked" && laParts(r.startsAt).dateKey === todayKey,
    )
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .map((r) => {
      const machine = input.machines.find((m) => m.id === r.machineId);
      const user = input.users.find((u) => u.id === r.userId);
      return {
        machineId: r.machineId,
        machineName: machine?.name ?? r.machineId,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        displayName: formatDisplayName(user, mode),
      };
    });

  const upcoming = published
    .filter((c) => {
      const t = new Date(c.startsAt).getTime();
      return t >= now.getTime() && t <= weekEnd.getTime();
    })
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .map((c) => {
      const seats = bookedCount(input.bookings, c.id);
      const bookingUrl = c.zeffyUrl?.trim()
        ? c.zeffyUrl
        : `${siteBase()}/classes/${c.id}`;
      return {
        id: c.id,
        title: c.title,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        location: c.location,
        category: c.category,
        spotsRemaining: Math.max(0, c.capacity - seats),
        bookingUrl,
      };
    });

  const checkoffs = published
    .filter(
      (c) =>
        c.category === "certification_checkoff" &&
        new Date(c.startsAt).getTime() >= now.getTime() &&
        new Date(c.startsAt).getTime() <= weekEnd.getTime(),
    )
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .map((c) => {
      const seats = bookedCount(input.bookings, c.id);
      return {
        id: c.id,
        title: c.title,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        location: c.location,
        spotsRemaining: Math.max(0, c.capacity - seats),
      };
    });

  const onlineCerts = input.learningModules
    .filter((m) => m.published)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => {
      const cert = input.certifications.find((c) => c.id === m.certificationId);
      return {
        certificationId: m.certificationId,
        name: cert?.name ?? m.title,
        moduleSlug: m.slug,
      };
    });

  const nowMs = now.getTime();
  const promos = input.promoSlides
    .filter(
      (p) =>
        p.active &&
        !p.deletedAt &&
        new Date(p.startsAt).getTime() <= nowMs &&
        new Date(p.endsAt).getTime() > nowMs,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const membership: DisplayMembershipTier = {
    joinUrl: `${siteBase()}/join`,
    products: input.membershipProducts
      .filter((p) => p.visibleOnJoin && p.joinable && !p.isAddOn)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({
        id: p.id,
        name: p.name,
        tier: p.tier,
        priceCents: p.priceCents,
        billingInterval: p.billingInterval,
        summary: p.summary,
      })),
  };

  return {
    now: nowIso,
    hours: {
      label: hoursLabel,
      openHour,
      closeHour,
    },
    isOpen,
    todaySessions,
    todayReservations,
    machines: buildMachineStatuses({
      machines: input.machines,
      usageSessions: input.usageSessions,
      reservations: input.reservations,
      maintenanceBlocks: input.maintenanceBlocks,
      users: input.users,
      nameDisplayMode: mode,
      now,
    }),
    upcoming,
    checkoffs,
    onlineCerts,
    promos,
    membership,
    config: structuredClone(input.displayConfig),
  };
}
