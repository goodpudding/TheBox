import { NextRequest, NextResponse } from "next/server";
import { createServerDataProvider } from "@/lib/data/factory";
import { prisma } from "@/lib/db";
import { applyZeffyWebhookPayment } from "@/lib/zeffy/provider-bridge";
import {
  getZeffyWebhookSecret,
  isZeffyWebhookConfigured,
} from "@/lib/zeffy/config";
import type {
  ZeffyPayment,
  ZeffyWebhookEnvelope,
} from "@/lib/zeffy/types";
import { verifyZeffySignature } from "@/lib/zeffy/verify";

export const runtime = "nodejs";

async function recordEvent(input: {
  id: string;
  type: string;
  paymentId: string | null;
  status: string;
  detail?: string;
  payloadJson: string;
}) {
  try {
    await prisma.zeffyWebhookEvent.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        type: input.type,
        paymentId: input.paymentId,
        status: input.status,
        detail: input.detail ?? null,
        payloadJson: input.payloadJson,
        processedAt: new Date(),
      },
      update: {
        status: input.status,
        detail: input.detail ?? null,
        processedAt: new Date(),
      },
    });
  } catch {
    // Mock/no-DB deploys still accept the webhook; logging is best-effort.
  }
}

export async function POST(request: NextRequest) {
  if (!isZeffyWebhookConfigured()) {
    return NextResponse.json(
      {
        error:
          "Zeffy webhook is not configured. Set ZEFFY_WEBHOOK_SECRET in the environment.",
      },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("zeffy-signature");
  const verified = verifyZeffySignature(
    rawBody,
    signature,
    getZeffyWebhookSecret()!,
  );
  if (!verified.ok) {
    return NextResponse.json(
      { error: "Invalid signature", reason: verified.reason },
      { status: 401 },
    );
  }

  let envelope: ZeffyWebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as ZeffyWebhookEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!envelope?.id || !envelope?.type) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  // Idempotent replay: already processed this delivery id.
  try {
    const prior = await prisma.zeffyWebhookEvent.findUnique({
      where: { id: envelope.id },
    });
    if (prior?.status === "applied" || prior?.status === "ignored") {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        status: prior.status,
      });
    }
  } catch {
    // ignore lookup failures in mock
  }

  if (envelope.type !== "payment.completed") {
    await recordEvent({
      id: envelope.id,
      type: envelope.type,
      paymentId: null,
      status: "ignored",
      detail: "unsupported_event",
      payloadJson: rawBody,
    });
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const payment = envelope.data as ZeffyPayment;
  if (!payment?.id || !payment?.campaign_id) {
    return NextResponse.json({ error: "Missing payment data" }, { status: 400 });
  }

  const provider = await createServerDataProvider(null);
  const applied = await applyZeffyWebhookPayment(
    provider,
    payment,
    envelope.dispatchedAt,
  );

  const status =
    applied.result.status === "applied" || applied.result.status === "duplicate"
      ? applied.result.status === "duplicate"
        ? "duplicate"
        : "applied"
      : "ignored";
  let detail: string | undefined;
  if (applied.result.status === "ignored") {
    detail = applied.result.reason;
  } else if (applied.kind === "ticket") {
    detail = applied.result.bookingId;
  } else {
    detail = applied.result.userId;
  }

  await recordEvent({
    id: envelope.id,
    type: envelope.type,
    paymentId: payment.id,
    status,
    detail,
    payloadJson: rawBody,
  });

  return NextResponse.json({ ok: true, kind: applied.kind, result: applied.result });
}
