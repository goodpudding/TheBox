import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { quoteMachineJob } from "@/lib/credits";
import { mapMachineRow, mapUserRow } from "./mappers";

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export type RecordedEquipmentJob = {
  id: string;
  machineId: string;
  machineName: string;
  filamentGrams: number | null;
  sheets: number | null;
  runtimeSeconds: number | null;
  billedCents: number | null;
  billed: boolean;
  unlimited: boolean;
  note: string | null;
  completedAt: string | null;
  status: string;
  quoteNote: string | null;
};

async function payerFor(userId: string) {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const user = mapUserRow(row);
  return {
    tier: user.tier,
    shopAccess: user.shopAccess,
    status: user.status,
  };
}

/**
 * Record a sent job and debit the wallet. Desk login is not a job.
 */
export async function recordEquipmentJob(input: {
  userId: string;
  machineId: string;
  workstationId?: string | null;
  workstationSessionId?: string | null;
  filamentGrams?: number | null;
  filamentCentsPerKg?: number;
  sheets?: number | null;
  prints?: number | null;
  runtimeSeconds?: number | null;
  source?: string;
  note?: string | null;
}): Promise<RecordedEquipmentJob> {
  const machineRow = await prisma.machine.findUnique({
    where: { id: input.machineId },
  });
  if (!machineRow || machineRow.deletedAt) {
    const error = new Error("Unknown machine");
    (error as Error & { status: number }).status = 404;
    throw error;
  }
  const machine = mapMachineRow(machineRow);
  const payer = await payerFor(input.userId);
  const prints = input.prints ?? input.sheets ?? null;
  const quote = quoteMachineJob({
    machine,
    payer,
    filamentGrams: input.filamentGrams,
    filamentCentsPerKg: input.filamentCentsPerKg,
    runtimeSeconds: input.runtimeSeconds,
    prints,
  });

  if (quote.mode === "per_gram") {
    if (!input.filamentGrams || input.filamentGrams <= 0) {
      const error = new Error("filamentGrams is required to send a 3D job");
      (error as Error & { status: number }).status = 400;
      throw error;
    }
  } else if (quote.mode === "hourly_job") {
    if (!input.runtimeSeconds || input.runtimeSeconds <= 0) {
      const error = new Error("estimated run time is required to send this job");
      (error as Error & { status: number }).status = 400;
      throw error;
    }
  } else if (quote.mode === "per_print") {
    if (!prints || prints <= 0) {
      const error = new Error("print count is required");
      (error as Error & { status: number }).status = 400;
      throw error;
    }
  }

  const now = new Date();
  const note = input.note ?? quote.note;
  const billedCents = quote.billedCents;

  const job = await prisma.equipmentJob.create({
    data: {
      id: newId("job"),
      userId: input.userId,
      machineId: machine.id,
      workstationId: input.workstationId ?? null,
      workstationSessionId: input.workstationSessionId ?? null,
      source: input.source ?? "manual",
      status: "completed",
      filamentGrams: input.filamentGrams ?? null,
      sheets: prints,
      runtimeSeconds: input.runtimeSeconds ?? null,
      billedCents,
      note,
      startedAt: now,
      completedAt: now,
    },
  });

  if (billedCents > 0) {
    await prisma.creditLedgerEntry.create({
      data: {
        id: newId("cl"),
        userId: input.userId,
        kind: "machine",
        amountCents: -billedCents,
        equipmentJobId: job.id,
        note,
        occurredAt: now,
      },
    });
  }

  return {
    id: job.id,
    machineId: machine.id,
    machineName: machine.name,
    filamentGrams: input.filamentGrams ?? null,
    sheets: prints,
    runtimeSeconds: input.runtimeSeconds ?? null,
    billedCents,
    billed: billedCents > 0,
    unlimited: quote.unlimited,
    note,
    completedAt: now.toISOString(),
    status: "completed",
    quoteNote: quote.note,
  };
}

export async function refundEquipmentJob(input: {
  jobId: string;
  actorId: string;
}): Promise<RecordedEquipmentJob> {
  const job = await prisma.equipmentJob.findUnique({
    where: { id: input.jobId },
    include: { machine: true, creditLedgerEntries: true },
  });
  if (!job || job.deletedAt) {
    const error = new Error("Unknown job");
    (error as Error & { status: number }).status = 404;
    throw error;
  }
  if (job.status === "refunded") {
    const error = new Error("Job already refunded");
    (error as Error & { status: number }).status = 409;
    throw error;
  }
  const already = job.creditLedgerEntries.some((e) => e.kind === "machine_refund");
  if (already) {
    const error = new Error("Job already refunded");
    (error as Error & { status: number }).status = 409;
    throw error;
  }
  const debit = job.creditLedgerEntries.find(
    (e) => e.kind === "machine" && e.amountCents < 0,
  );
  const refundCents = debit ? -debit.amountCents : job.billedCents ?? 0;
  const now = new Date();
  if (refundCents > 0) {
    await prisma.creditLedgerEntry.create({
      data: {
        id: newId("cl"),
        userId: job.userId,
        kind: "machine_refund",
        amountCents: refundCents,
        equipmentJobId: job.id,
        actorId: input.actorId,
        note: `Refund · failed job · ${job.machine.name}`,
        occurredAt: now,
      },
    });
  }
  const updated = await prisma.equipmentJob.update({
    where: { id: job.id },
    data: { status: "refunded" },
  });
  return {
    id: updated.id,
    machineId: job.machineId,
    machineName: job.machine.name,
    filamentGrams: job.filamentGrams,
    sheets: job.sheets,
    runtimeSeconds: job.runtimeSeconds,
    billedCents: job.billedCents,
    billed: false,
    unlimited: false,
    note: updated.note,
    completedAt: updated.completedAt?.toISOString() ?? null,
    status: "refunded",
    quoteNote: null,
  };
}

export async function listUserJobs(
  userId: string,
  take = 12,
): Promise<RecordedEquipmentJob[]> {
  const rows = await prisma.equipmentJob.findMany({
    where: { userId, deletedAt: null },
    include: { machine: true },
    orderBy: { completedAt: "desc" },
    take,
  });
  return rows.map((job) => ({
    id: job.id,
    machineId: job.machineId,
    machineName: job.machine.name,
    filamentGrams: job.filamentGrams,
    sheets: job.sheets,
    runtimeSeconds: job.runtimeSeconds,
    billedCents: job.billedCents,
    billed: (job.billedCents ?? 0) > 0 && job.status !== "refunded",
    unlimited: false,
    note: job.note,
    completedAt: job.completedAt?.toISOString() ?? null,
    status: job.status,
    quoteNote: job.note,
  }));
}
