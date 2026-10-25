import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { evaluateMachineAccess } from "@/lib/data/access";
import {
  billingFor,
  workstationBillingMode,
  workstationTimeDebitCents,
  workstationTimeDebitNote,
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

async function debitWorkstationSession(session: {
  id: string;
  userId: string;
  billedMachineId: string;
  startedAt: Date;
  endedAt: Date | null;
}) {
  if (!session.endedAt) return null;
  const existing = await prisma.creditLedgerEntry.findUnique({
    where: { workstationSessionId: session.id },
  });
  if (existing) return existing;
  const machineRow = await prisma.machine.findUnique({
    where: { id: session.billedMachineId },
  });
  if (!machineRow) return null;
  const machine = mapMachineRow(machineRow);
  const startedAt = session.startedAt.toISOString();
  const endedAt = session.endedAt.toISOString();
  const debit = workstationTimeDebitCents(machine, startedAt, endedAt);
  if (debit <= 0) return null;
  return prisma.creditLedgerEntry.create({
    data: {
      id: newId("cl"),
      userId: session.userId,
      kind: "machine",
      amountCents: -debit,
      workstationSessionId: session.id,
      note: workstationTimeDebitNote(machine, startedAt, endedAt),
      occurredAt: session.endedAt,
    },
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
  const ended = await prisma.workstationSession.update({
    where: { id: input.sessionId },
    data: { endedAt: new Date(), endedBy: input.endedBy },
  });
  await debitWorkstationSession(ended);
  return ended;
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

export async function authenticatePin(email: string, pin: string) {
  if (!isValidPinShape(pin)) {
    const error = new Error("PIN must be 4–8 digits");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  const normalized = email.trim().toLowerCase();
  const userRow = await prisma.user.findFirst({
    where: { email: normalized, deletedAt: null },
  });
  if (!userRow || !(await verifyKioskPin(pin, userRow.kioskPinHash))) {
    const error = new Error("Email or PIN did not match");
    (error as Error & { status: number }).status = 401;
    throw error;
  }
  return userRow;
}

export async function loginWithPin(input: {
  workstationId: string;
  email: string;
  pin: string;
}) {
  const userRow = await authenticatePin(input.email, input.pin);
  return startWorkstationSession({
    workstationId: input.workstationId,
    userId: userRow.id,
  });
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
  const mode = workstationBillingMode(machine);
  return {
    machineId: machine.id,
    machineName: machine.name,
    area: machine.area,
    mode,
    hourlyRateCents: billing.hourlyRateCents,
    setupFeeCents: billing.setupFeeCents,
    sessionUnit: billing.sessionUnit,
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
