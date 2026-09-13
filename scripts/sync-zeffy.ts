/**
 * Sync Zeffy campaigns → class session checkout URLs.
 *
 * Env:
 *   ZEFFY_API_KEY
 *   DATA_PROVIDER=prisma (recommended) + DATABASE_URL
 *
 * Usage: npm run sync:zeffy
 *
 * Without ZEFFY_API_KEY, exits 0 after printing setup instructions (safe for CI).
 *
 * When you get Zeffy access:
 * 1. Settings → Integrations → create API key + webhook signing secret
 * 2. Set ZEFFY_API_KEY and ZEFFY_WEBHOOK_SECRET on Vercel
 * 3. Point webhook URL to https://<your-host>/api/zeffy/webhook
 * 4. On each class, paste the Zeffy Campaign ID (Admin → Classes)
 * 5. Run `npm run sync:zeffy` to fill Register links from campaign URLs
 */
import { PrismaClient } from "@prisma/client";
import { listAllZeffyCampaigns } from "../src/lib/zeffy/client";
import { getZeffyApiKey } from "../src/lib/zeffy/config";
import { syncClassUrlsFromCampaigns } from "../src/lib/zeffy/apply-payment";

const prisma = new PrismaClient();

async function main() {
  if (!getZeffyApiKey()) {
    console.log(`Zeffy sync is ready to connect.

1. In Zeffy: Settings → Integrations → generate an API key
2. Also create a webhook → URL: https://YOUR_DOMAIN/api/zeffy/webhook
   Copy the signing secret into ZEFFY_WEBHOOK_SECRET
3. Set env:
   ZEFFY_API_KEY=...
   ZEFFY_WEBHOOK_SECRET=...
4. Admin → Classes: paste each event's Campaign ID into "Zeffy campaign ID"
5. Re-run: npm run sync:zeffy

Docs: https://support.zeffy.com/get-started-with-the-zeffy-api-yourg
`);
    return;
  }

  const campaigns = await listAllZeffyCampaigns();
  const ticketing = campaigns.filter(
    (c) => c.type === "ticketing" && !c.is_archived && c.url,
  );

  console.log(
    `Fetched ${campaigns.length} campaigns (${ticketing.length} active ticketing with URL).`,
  );

  const classes = await prisma.classSession.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, zeffyCampaignId: true, zeffyUrl: true },
  });

  const linked = classes.filter((c) => c.zeffyCampaignId);
  const updates = syncClassUrlsFromCampaigns({
    classes: linked,
    campaigns: ticketing.map((c) => ({ id: c.id, url: c.url })),
  });

  for (const u of updates) {
    await prisma.classSession.update({
      where: { id: u.classId },
      data: { zeffyUrl: u.zeffyUrl },
    });
    console.log(`Updated ${u.classId} → ${u.zeffyUrl}`);
  }

  const unmatchedCampaigns = ticketing.filter(
    (c) => !classes.some((cl) => cl.zeffyCampaignId === c.id),
  );
  if (unmatchedCampaigns.length) {
    console.log("\nTicketing campaigns with no class link yet:");
    for (const c of unmatchedCampaigns.slice(0, 20)) {
      console.log(`  ${c.id}  ${c.title}  ${c.url}`);
    }
    if (unmatchedCampaigns.length > 20) {
      console.log(`  …and ${unmatchedCampaigns.length - 20} more`);
    }
  }

  const missingUrl = linked.filter((c) => !c.zeffyCampaignId);
  void missingUrl;

  console.log(
    `\nDone. Updated ${updates.length} class URL(s). Linked classes: ${linked.length}.`,
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
