import { prisma } from "@/lib/db";
import { AREA_LABEL, mapUserCertRow, mapUserRow, parseJsonArray } from "./mappers";
import {
  billingPayload,
  evaluateLaunchAccess,
  walletBalanceCents,
} from "./server";
import { listUserJobs } from "./jobs";

export async function memberMePayload(input: {
  userId: string;
  session: {
    id: string;
    workstationId: string;
    billedMachineId: string;
    startedAt: Date;
  };
  workstation: {
    id: string;
    name: string;
    deviceId: string;
    location: string;
    idleLockMinutes: number;
    idleLogoutMinutes: number;
    billedMachine: {
      id: string;
      name: string;
      area: string;
      hourlyRateCents: number | null;
    };
  };
}) {
  const [userRow, certRows, certCatalog, reservations, settings, balance, jobs] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: input.userId } }),
      prisma.userCertification.findMany({
        where: { userId: input.userId, deletedAt: null },
        include: { certification: true },
      }),
      prisma.certification.findMany({
        where: { active: true, deletedAt: null },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.reservation.findMany({
        where: {
          userId: input.userId,
          status: "booked",
          endsAt: { gte: new Date() },
          deletedAt: null,
        },
        include: { machine: true },
        orderBy: { startsAt: "asc" },
        take: 8,
      }),
      prisma.orgSettings.findUnique({ where: { id: "default" } }),
      walletBalanceCents(input.userId),
      listUserJobs(input.userId),
    ]);
  const user = mapUserRow(userRow);
  const waiver = await prisma.waiverSignature.findFirst({
    where: {
      userId: user.id,
      version: settings?.currentWaiverVersion ?? "",
      deletedAt: null,
    },
  });
  const billing = billingPayload(input.workstation.billedMachine);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      status: user.status,
      tier: user.tier,
      shopAccess: user.shopAccess,
      role: user.role,
    },
    waiverCurrent: Boolean(waiver),
    certifications: certRows.map((row) => ({
      id: row.certificationId,
      name: row.certification.name,
      status: mapUserCertRow(row).status,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    })),
    catalogCerts: certCatalog.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
    })),
    creditBalanceCents: balance,
    reservations: reservations.map((r) => ({
      id: r.id,
      machineId: r.machineId,
      machineName: r.machine.name,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      status: r.status,
    })),
    jobs,
    mustChangePin: userRow.kioskPinMustChange,
    session: {
      id: input.session.id,
      workstationId: input.session.workstationId,
      workstationName: input.workstation.name,
      deviceId: input.workstation.deviceId,
      location: input.workstation.location,
      startedAt: input.session.startedAt.toISOString(),
      idleLockMinutes: input.workstation.idleLockMinutes,
      idleLogoutMinutes: input.workstation.idleLogoutMinutes,
      billedMachineId: input.session.billedMachineId,
      billing,
      creditBalanceCents: balance,
    },
    honorLock: false,
    billedSession: false,
  };
}

export async function workstationConfigPayload(workstationId: string) {
  const ws = await prisma.workstation.findFirst({
    where: {
      deletedAt: null,
      OR: [{ id: workstationId }, { deviceId: workstationId }],
    },
    include: { billedMachine: true },
  });
  if (!ws) return null;
  const [machines, maps] = await Promise.all([
    prisma.machine.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.machineSoftwareMap.findMany({
      where: {
        active: true,
        deletedAt: null,
        OR: [{ workstationId: ws.id }, { workstationId: null }],
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  const billing = billingPayload(ws.billedMachine);
  return {
    workstation: {
      id: ws.id,
      name: ws.name,
      deviceId: ws.deviceId,
      location: ws.location,
      idleLockMinutes: ws.idleLockMinutes,
      idleLogoutMinutes: ws.idleLogoutMinutes,
      billedMachineId: ws.billedMachineId,
      billing,
    },
    equipment: machines
      .filter((m) => m.active)
      .map((m) => {
        const software =
          maps.find((s) => s.machineId === m.id && s.workstationId === ws.id) ??
          maps.find((s) => s.machineId === m.id && s.workstationId == null) ??
          null;
        return {
          machineId: m.id,
          name: m.name,
          area: m.area,
          areaLabel: AREA_LABEL[m.area as keyof typeof AREA_LABEL] ?? m.area,
          locationLabel: m.locationLabel,
          reservationRequired: m.reservationRequired,
          requiredCertificationIds: parseJsonArray(m.requiredCertificationIds),
          software: software
            ? {
                id: software.id,
                displayName: software.displayName,
                exeName: software.exeName,
                exePath: software.exePath,
              }
            : null,
        };
      }),
    generalSoftware: maps
      .filter((s) => !s.machineId)
      .map((s) => ({
        id: s.id,
        displayName: s.displayName,
        exeName: s.exeName,
        exePath: s.exePath,
      })),
  };
}

export async function equipmentAccessForUser(
  userId: string,
  machineIds: string[],
) {
  const userRow = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const user = mapUserRow(userRow);
  const results: Record<
    string,
    { allow: boolean; reason: string; certified: boolean }
  > = {};
  for (const machineId of machineIds) {
    const access = await evaluateLaunchAccess({ user, machineId });
    results[machineId] = {
      allow: access.allow,
      reason: access.reason,
      certified: access.reason !== "cert_missing" && access.reason !== "cert_expired" && access.reason !== "cert_revoked",
    };
    if (access.allow) results[machineId].certified = true;
    if (access.reason === "ok") results[machineId].certified = true;
  }
  return results;
}
