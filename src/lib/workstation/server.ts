import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { evaluateMachineAccess } from "@/lib/data/access";
import {
  billingFor,
  deskChargeHint,
  machineBillingMode,
} from "@/lib/credits";
import { isStaffRole } from "@/lib/data/access";
import type { User } from "@/lib/data/types";
import {
  mapMachineRow,
  mapUserCertRow,
  mapUserRow,
  mapWaiverRow,
} from "./mappers";
import { hashKioskPin, isValidPinShape, verifyKioskPin } from "./pin";
import {
  clearPinAttempts,
  forgetPinAttemptsBefore,
  hasPinFailures,
  isPinAttemptLocked,
  PIN_LOCK_MESSAGE,
  PIN_MISMATCH_MESSAGE,
  recordFailedPinAttempt,
} from "@/lib/workstation/pin-attempts";
import {
  readPinThrottle,
  recordPinFailure,
  recordPinSuccess,
} from "./pin-throttle";
import {
  clearWorkstationCookie,
  generateSessionToken,
  hashSessionToken,
  readWorkstationToken,
  setWorkstationCookie,
} from "./session";

export type EndedBy = "logout" | "idle" | "staff" | "replaced";

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export async function lookupWorkstation(idOrDevice: string) {
  const ws = await prisma.workstation.findFirst({
    where: {
      deletedAt: null,
      OR: [{ id: idOrDevice }, { deviceId: idOrDevice }],
    },
    include: { billedMachine: true },
  });
  return ws;
}

export async function getOpenSessionByToken(token: string) {
  const tokenHash = hashSessionToken(token);
  return prisma.workstationSession.findFirst({
    where: { tokenHash, endedAt: null, deletedAt: null },
    include: {
      user: true,
      workstation: { include: { billedMachine: true } },
    },
  });
}

export async function getWorkstationActor(request?: Request) {
  const token = await readWorkstationToken(request);
  if (!token) return null;
  const session = await getOpenSessionByToken(token);
  if (!session) return null;
  return {
    token,
    session,
    user: mapUserRow(session.user),
    workstation: session.workstation,
  };
}

export async function requireWorkstationActor(request?: Request) {
  const actor = await getWorkstationActor(request);
  if (!actor) {
    const error = new Error("Not signed in at this workstation");
    (error as Error & { status: number }).status = 401;
    throw error;
  }
  return actor;
}

export async function isStaffRequest(request: Request): Promise<User | null> {
  const actor = await getWorkstationActor(request);
  if (actor && isStaffRole(actor.user)) return actor.user;

  const session = await auth();
  if (session?.user?.id) {
    const row = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (row) {
      const user = mapUserRow(row);
      if (isStaffRole(user)) return user;
    }
  }

  const demo =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (demo) {
    const id = request.headers.get("x-box-user-id");
    if (id) {
      const row = await prisma.user.findUnique({ where: { id } });
      if (row) {
        const user = mapUserRow(row);
        if (isStaffRole(user)) return user;
      }
    }
  }
  return null;
}

/** Magic-link session, or the dev switch-user header outside production. */
export async function memberActorId(request: Request): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;
  const demo =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (!demo) return null;
  return request.headers.get("x-box-user-id");
}

async function overlappingReservation(
  userId: string,
  machineId: string,
  now = new Date(),
): Promise<boolean> {
  const hit = await prisma.reservation.findFirst({
    where: {
      userId,
      machineId,
      status: "booked",
      startsAt: { lte: now },
      endsAt: { gte: now },
      deletedAt: null,
    },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function evaluateLaunchAccess(input: {
  user: User;
  machineId: string;
}) {
  const [machineRow, certRows, waiverRows, settings] = await Promise.all([
    prisma.machine.findUnique({ where: { id: input.machineId } }),
    prisma.userCertification.findMany({
      where: { userId: input.user.id, deletedAt: null },
    }),
    prisma.waiverSignature.findMany({
      where: { userId: input.user.id, deletedAt: null },
    }),
    prisma.orgSettings.findUnique({ where: { id: "default" } }),
  ]);
  const machine = machineRow ? mapMachineRow(machineRow) : null;
  const hasOverlappingReservation = machine
    ? await overlappingReservation(input.user.id, machine.id)
    : false;
  return evaluateMachineAccess({
    user: input.user,
    badge: null,
    machine,
    userCertifications: certRows.map(mapUserCertRow),
    waiverSignatures: waiverRows.map(mapWaiverRow),
    currentWaiverVersion: settings?.currentWaiverVersion ?? "",
    hasOverlappingReservation,
    skipBadge: true,
  });
}

export async function endWorkstationSession(input: {
  sessionId: string;
  endedBy: EndedBy;
}) {
  const open = await prisma.workstationSession.findUnique({
    where: { id: input.sessionId },
  });
  if (!open || open.endedAt) return open;
  return prisma.workstationSession.update({
    where: { id: input.sessionId },
    data: { endedAt: new Date(), endedBy: input.endedBy },
  });
}

export async function startWorkstationSession(input: {
  workstationId: string;
  userId: string;
}) {
  const workstation = await lookupWorkstation(input.workstationId);
  if (!workstation || !workstation.active) {
    const error = new Error("Unknown or inactive workstation");
    (error as Error & { status: number }).status = 404;
    throw error;
  }
  const open = await prisma.workstationSession.findMany({
    where: { workstationId: workstation.id, endedAt: null },
  });
  for (const session of open) {
    await endWorkstationSession({
      sessionId: session.id,
      endedBy: "replaced",
    });
  }
  const token = generateSessionToken();
  const row = await prisma.workstationSession.create({
    data: {
      id: newId("wss"),
      workstationId: workstation.id,
      userId: input.userId,
      tokenHash: hashSessionToken(token),
      billedMachineId: workstation.billedMachineId,
      startedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });
  await prisma.workstation.update({
    where: { id: workstation.id },
    data: { lastSeenAt: new Date() },
  });
  await setWorkstationCookie(token);
  return { token, session: row, workstation };
}

function statusError(message: string, status: number): Error {
  const error = new Error(message);
  (error as Error & { status: number }).status = status;
  return error;
}

/**
 * Check an email + PIN pair under the attempt limit. Every route that takes
 * a PIN goes through here: desk login, phone approval, and desk unlock.
 * `scope` is the workstation id, or the route name when there is no desk.
 * Unknown email and wrong PIN give the same 401.
 */
export async function verifyPinLogin(input: {
  email: string;
  pin: string;
  scope: string;
}) {
  const email = input.email.trim().toLowerCase();
  const recorded = await readPinThrottle(email);
  if (recorded.clearedAt != null) {
    forgetPinAttemptsBefore(input.scope, email, recorded.clearedAt);
  }
  if (isPinAttemptLocked(input.scope, email) || recorded.locked) {
    throw statusError(PIN_LOCK_MESSAGE, 429);
  }
  const userRow = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  const matched =
    isValidPinShape(input.pin) &&
    Boolean(userRow && (await verifyKioskPin(input.pin, userRow.kioskPinHash)));
  if (!matched || !userRow) {
    recordFailedPinAttempt(input.scope, email);
    await recordPinFailure({
      email,
      userId: userRow?.id ?? null,
      entityId: input.scope,
    });
    throw statusError(PIN_MISMATCH_MESSAGE, 401);
  }
  // The database knows about wrong PINs on other routes and other Workers.
  // This process only knows its own, and is the fallback when the read fails.
  if (recorded.pendingFailures || hasPinFailures(input.scope, email)) {
    await recordPinSuccess({ email, userId: userRow.id, entityId: input.scope });
  }
  clearPinAttempts(input.scope, email);
  return userRow;
}

/** Email + PIN on the phone-approval page, where there is no desk session. */
export async function authenticatePin(email: string, pin: string) {
  return verifyPinLogin({ email, pin, scope: "qr-approve" });
}

export async function loginWithPin(input: {
  workstationId: string;
  email: string;
  pin: string;
}) {
  const workstation = await lookupWorkstation(input.workstationId);
  if (!workstation || !workstation.active) {
    throw statusError("Unknown or inactive workstation", 404);
  }
  const userRow = await verifyPinLogin({
    email: input.email,
    pin: input.pin,
    scope: workstation.id,
  });
  const started = await startWorkstationSession({
    workstationId: workstation.id,
    userId: userRow.id,
  });
  return {
    ...started,
    mustChangePin: userRow.kioskPinMustChange,
  };
}

export async function logoutCurrent(request?: Request, endedBy: EndedBy = "logout") {
  const actor = await getWorkstationActor(request);
  if (actor) {
    await endWorkstationSession({
      sessionId: actor.session.id,
      endedBy,
    });
  }
  await clearWorkstationCookie();
}

export async function startQrChallenge(workstationId: string) {
  const workstation = await lookupWorkstation(workstationId);
  if (!workstation || !workstation.active) {
    const error = new Error("Unknown or inactive workstation");
    (error as Error & { status: number }).status = 404;
    throw error;
  }
  const userCode = String(randomInt(100000, 999999));
  const row = await prisma.workstationLoginChallenge.create({
    data: {
      id: newId("wqc"),
      workstationId: workstation.id,
      userCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  return { challenge: row, workstation };
}

export async function approveQrChallenge(input: {
  challengeId: string;
  userId: string;
}) {
  const row = await prisma.workstationLoginChallenge.findUnique({
    where: { id: input.challengeId },
  });
  if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) {
    const error = new Error("This QR code expired. Start again at the desk.");
    (error as Error & { status: number }).status = 410;
    throw error;
  }
  return prisma.workstationLoginChallenge.update({
    where: { id: row.id },
    data: { approvedUserId: input.userId },
  });
}

export async function consumeQrChallenge(challengeId: string) {
  const row = await prisma.workstationLoginChallenge.findUnique({
    where: { id: challengeId },
  });
  if (!row) return { status: "missing" as const };
  if (row.expiresAt.getTime() < Date.now()) {
    return { status: "expired" as const };
  }
  if (!row.approvedUserId) return { status: "pending" as const };
  if (row.consumedAt) return { status: "consumed" as const };
  const started = await startWorkstationSession({
    workstationId: row.workstationId,
    userId: row.approvedUserId,
  });
  await prisma.workstationLoginChallenge.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  return { status: "approved" as const, ...started };
}

export async function walletBalanceCents(userId: string): Promise<number> {
  const entries = await prisma.creditLedgerEntry.findMany({
    where: { userId, deletedAt: null },
    select: { amountCents: true },
  });
  return entries.reduce((sum, e) => sum + e.amountCents, 0);
}

export function billingPayload(machineRow: {
  id: string;
  name: string;
  area: string;
  hourlyRateCents: number | null;
}) {
  const machine = mapMachineRow({
    ...machineRow,
    requiredCertificationIds: "[]",
    readerKey: "",
    active: true,
    reservationRecommended: false,
    reservationRequired: false,
    attendedOperationRequired: false,
    locationLabel: "",
    gettingStartedVideoUrl: null,
    maxReservationHours: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
  const billing = billingFor(machine);
  const mode = machineBillingMode(machine);
  return {
    machineId: machine.id,
    machineName: machine.name,
    area: machine.area,
    mode,
    hourlyRateCents: billing.hourlyRateCents,
    nonmemberHourlyCents: billing.nonmemberHourlyCents,
    setupFeeCents: billing.setupFeeCents,
    sessionUnit: billing.sessionUnit,
    gramRateCents: billing.gramRateCents,
    minimumCents: billing.minimumCents,
    deskLoginBills: false as const,
    hint: deskChargeHint({
      id: machine.id,
      name: machine.name,
      area: machine.area,
    }),
  };
}

export async function seedDemoPinIfMissing(userId: string, pin: string) {
  const row = await prisma.user.findUnique({ where: { id: userId } });
  if (!row || row.kioskPinHash) return;
  await prisma.user.update({
    where: { id: userId },
    data: { kioskPinHash: await hashKioskPin(pin) },
  });
}

export { hashKioskPin };
