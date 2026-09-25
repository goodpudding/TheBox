/**
 * Sync Zeffy campaigns → class session checkout URLs + membership catalog.
 *
 * Env:
 *   ZEFFY_API_KEY              required for a live pull (never commit this)
 *   ZEFFY_WEBHOOK_SECRET       optional; webhook receiver
 *   ZEFFY_API_BASE             optional override (default https://api.zeffy.com/api/v1)
 *   DATA_PROVIDER=prisma       recommended to persist members + products
 *   DATABASE_URL               required when persisting
 *
 * Usage:
 *   npm run sync:zeffy
 *   npm run sync:zeffy -- --dry-run
 *
 * Without ZEFFY_API_KEY, exits 0 after printing setup instructions (safe for CI).
 *
 * Read-only against Zeffy. Does not create charges, payouts, or write to Zeffy.
 *
 * Membership programs in Zeffy are ticketing campaigns with category
 * MembershipV2 (or "membership"). GET /campaigns/:id returns rates = types.
 * Who is a member is inferred from succeeded payments on those campaigns —
 * the Contacts API has no membership flag.
 */
import { PrismaClient } from "@prisma/client";
import { listAllZeffyCampaigns, listAllZeffyPayments } from "../src/lib/zeffy/client";
import { getZeffyApiKey } from "../src/lib/zeffy/config";
import { syncClassUrlsFromCampaigns } from "../src/lib/zeffy/apply-payment";
import {
  fetchZeffyMembershipCatalog,
  isMembershipCampaign,
  isMembershipPayment,
} from "../src/lib/zeffy/memberships";
import type { MembershipProduct } from "../src/lib/data/types";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const SETUP_HELP = `Zeffy sync is ready to connect.

This is read-only. It never takes charges or talks to payouts.

1. In Zeffy: Settings → Integrations → generate an API key
   (Lamplab / test orgs work; Discover Burien access is not required)
2. Optional webhook → URL: https://YOUR_DOMAIN/api/zeffy/webhook
   Copy the signing secret into ZEFFY_WEBHOOK_SECRET
3. Set env (never commit the values):
   ZEFFY_API_KEY=...
   ZEFFY_WEBHOOK_SECRET=...          # optional, for /api/zeffy/webhook
   ZEFFY_API_BASE=https://api.zeffy.com/api/v1   # optional override
   DATA_PROVIDER=prisma              # persist catalog + member roster
   DATABASE_URL=...
4. Memberships: publish the membership campaign in Zeffy (status active)
   with at least one rate. Draft campaigns and campaigns with no rates are skipped.
5. Classes: Admin → Classes: paste each event's Campaign ID into "Zeffy campaign ID"
6. Re-run: npm run sync:zeffy
   Dry-run (print mapping, no writes): npm run sync:zeffy -- --dry-run

Join (/join) also reads GET /api/memberships when ZEFFY_API_KEY is set and
falls back to fixture memberships when it is not.

Docs: https://www.zeffy.com/api/docs
Help: https://support.zeffy.com/get-started-with-the-zeffy-api-yourg
`;

async function persistMembershipCatalog(products: MembershipProduct[]) {
  if (!products.length) {
    console.log(
      "No published Zeffy membership rates — leaving fixture membership products in place.",
    );
    return;
  }

  const now = new Date();
  for (const p of products) {
    await prisma.membershipProduct.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        tier: p.tier,
        name: p.name,
        summary: p.summary,
        priceCents: p.priceCents,
        billingInterval: p.billingInterval,
        annualPriceCents: p.annualPriceCents ?? null,
        shopAccess: p.shopAccess,
        phase: p.phase,
        visibleOnJoin: p.visibleOnJoin,
        joinable: p.joinable,
        highlight: Boolean(p.highlight),
        sortOrder: p.sortOrder,
        isAddOn: Boolean(p.isAddOn),
        cappedSeats: p.cappedSeats ?? null,
        zeffyCampaignId: p.zeffyCampaignId ?? null,
        zeffyRateId: p.zeffyRateId ?? null,
        zeffyUrl: p.zeffyUrl ?? null,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        name: p.name,
        summary: p.summary,
        priceCents: p.priceCents,
        billingInterval: p.billingInterval,
        shopAccess: p.shopAccess,
        visibleOnJoin: p.visibleOnJoin,
        joinable: p.joinable,
        highlight: Boolean(p.highlight),
        sortOrder: p.sortOrder,
        isAddOn: Boolean(p.isAddOn),
        cappedSeats: p.cappedSeats ?? null,
        zeffyCampaignId: p.zeffyCampaignId ?? null,
        zeffyRateId: p.zeffyRateId ?? null,
        zeffyUrl: p.zeffyUrl ?? null,
        deletedAt: null,
      },
    });
    console.log(
      `  product ${p.id}  ${p.name}  ${p.priceCents}¢  ${p.zeffyUrl ?? ""}`,
    );
  }

  const keepIds = products.map((p) => p.id);
  const hidden = await prisma.membershipProduct.updateMany({
    where: {
      joinable: true,
      zeffyCampaignId: null,
      id: { notIn: keepIds },
    },
    data: { visibleOnJoin: false },
  });
  if (hidden.count) {
    console.log(
      `  hid ${hidden.count} fixture joinable product(s) so /join shows Zeffy types.`,
    );
  }

  const primaryUrl = products.find((p) => p.zeffyUrl)?.zeffyUrl;
  if (primaryUrl) {
    await prisma.orgSettings.updateMany({
      data: { paymentUrl: primaryUrl },
    });
    console.log(`  org paymentUrl → ${primaryUrl}`);
  }
}

async function syncMembersFromPayments(
  products: MembershipProduct[],
): Promise<void> {
  const { extractBuyerEmail } = await import("../src/lib/zeffy/apply-payment");
  const payments = await listAllZeffyPayments();
  const membershipPayments = payments.filter(
    (p) =>
      isMembershipPayment(p) &&
      (p.status === "succeeded" || p.status === "completed"),
  );
  console.log(
    `Payments: ${payments.length} total, ${membershipPayments.length} succeeded membership.`,
  );

  if (!membershipPayments.length) {
    console.log(
      "No membership payments yet — the Contacts API has no membership flag, so the roster stays empty until someone pays in Zeffy.",
    );
    return;
  }

  let appliedCount = 0;
  let createdCount = 0;
  for (const payment of membershipPayments) {
    const email = extractBuyerEmail(payment);
    if (!email) continue;
    const rateId = payment.items?.find((i) => i.rate_id)?.rate_id ?? null;
    const product =
      products.find(
        (p) =>
          p.zeffyCampaignId === payment.campaign_id &&
          (!rateId || p.zeffyRateId === rateId),
      ) ??
      products.find((p) => p.zeffyCampaignId === payment.campaign_id);
    const tier = product?.tier ?? "maker";
    const shopAccess = product?.shopAccess ?? true;
    const billingInterval = product?.billingInterval ?? "monthly";
    const firstName = payment.buyer.first_name?.trim() ?? "";
    const lastName = payment.buyer.last_name?.trim() ?? "";
    const displayName =
      `${firstName} ${lastName}`.trim() || email.split("@")[0] || "Member";

    if (dryRun) {
      console.log(
        `  [dry-run] would upsert member ${email} as ${tier} (${payment.id})`,
      );
      appliedCount += 1;
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        firstName,
        lastName,
        displayName,
        role: "member",
        status: "active",
        tier,
        billingInterval,
        shopAccess,
        profileComplete: false,
      },
      update: {
        status: "active",
        tier,
        shopAccess,
        billingInterval,
      },
    });
    if (!existing) createdCount += 1;
    appliedCount += 1;

    await prisma.auditEvent.upsert({
      where: { id: `audit-zeffy-${payment.id}` },
      create: {
        id: `audit-zeffy-${payment.id}`,
        action: "membership_applied_zeffy",
        actorId: "system:zeffy",
        entityType: "User",
        entityId: email,
        metadata: JSON.stringify({
          paymentId: payment.id,
          created: !existing,
          tier,
        }),
        occurredAt: new Date(),
      },
      update: {
        metadata: JSON.stringify({
          paymentId: payment.id,
          created: !existing,
          tier,
        }),
      },
    });
  }

  console.log(
    `Members: ${appliedCount} membership payment(s) ${dryRun ? "would be applied" : "applied"} (${createdCount} new).`,
  );
}

async function main() {
  if (!getZeffyApiKey()) {
    console.log(SETUP_HELP);
    return;
  }

  if (dryRun) {
    console.log("Dry-run: fetching from Zeffy, no database writes.\n");
  }

  const campaigns = await listAllZeffyCampaigns();
  const membershipCampaigns = campaigns.filter(isMembershipCampaign);
  const ticketing = campaigns.filter(
    (c) =>
      c.type === "ticketing" &&
      !c.is_archived &&
      c.url &&
      !isMembershipCampaign(c),
  );

  console.log(
    `Fetched ${campaigns.length} campaigns (${membershipCampaigns.length} membership, ${ticketing.length} active event ticketing with URL).`,
  );

  const catalog = await fetchZeffyMembershipCatalog();
  console.log("\nMembership catalog:");
  for (const c of catalog.campaigns) {
    console.log(
      `  ${c.status.padEnd(8)} ${c.id}  ${c.title}  rates=${c.rateCount}  ${c.url ?? ""}`,
    );
  }
  if (catalog.skipped.length) {
    console.log("Skipped:");
    for (const s of catalog.skipped) {
      console.log(`  ${s.id}  ${s.title}  (${s.reason})`);
    }
  }
  console.log(
    `Joinable Zeffy products: ${catalog.products.length}. Primary URL: ${catalog.primaryUrl ?? "(none)"}`,
  );
  for (const p of catalog.products) {
    console.log(
      `  ${p.name}  ${p.tier}  ${p.priceCents}¢/${p.billingInterval}  rate=${p.zeffyRateId}`,
    );
  }

  if (!dryRun) {
    try {
      await persistMembershipCatalog(catalog.products);
    } catch (err) {
      console.log(
        "Could not persist membership products (set DATA_PROVIDER=prisma and DATABASE_URL). Catalog still prints above.",
      );
      console.log(err instanceof Error ? err.message : err);
    }
  }

  try {
    await syncMembersFromPayments(catalog.products);
  } catch (err) {
    console.log(
      "Member roster sync skipped (payments/contacts read failed or no database).",
    );
    console.log(err instanceof Error ? err.message : err);
  }

  const classes = await prisma.classSession.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, zeffyCampaignId: true, zeffyUrl: true },
  }).catch(() => []);

  const linked = classes.filter((c) => c.zeffyCampaignId);
  const updates = syncClassUrlsFromCampaigns({
    classes: linked,
    campaigns: ticketing.map((c) => ({ id: c.id, url: c.url })),
  });

  if (!dryRun) {
    for (const u of updates) {
      await prisma.classSession.update({
        where: { id: u.classId },
        data: { zeffyUrl: u.zeffyUrl },
      });
      console.log(`Updated class ${u.classId} → ${u.zeffyUrl}`);
    }
  } else if (updates.length) {
    console.log(`Dry-run would update ${updates.length} class URL(s).`);
  }

  const unmatchedCampaigns = ticketing.filter(
    (c) => !classes.some((cl) => cl.zeffyCampaignId === c.id),
  );
  if (unmatchedCampaigns.length) {
    console.log("\nEvent ticketing campaigns with no class link yet:");
    for (const c of unmatchedCampaigns.slice(0, 20)) {
      console.log(`  ${c.id}  ${c.title}  ${c.url}`);
    }
    if (unmatchedCampaigns.length > 20) {
      console.log(`  …and ${unmatchedCampaigns.length - 20} more`);
    }
  }

  console.log(
    `\nDone. Membership products: ${catalog.products.length}. Class URL updates: ${updates.length}. Linked classes: ${linked.length}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
