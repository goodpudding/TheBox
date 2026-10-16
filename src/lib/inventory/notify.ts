import type { InventoryArea, User } from "@/lib/data/types";

/**
 * v1 issue notice. Keep this module client-safe (no nodemailer) so the mock
 * provider can call it from the browser. SMTP can be wired from a Route Handler later.
 */
export async function notifyStewardsOfIssue(input: {
  itemName: string;
  assetTag: string;
  area: InventoryArea | null;
  stewards: Pick<User, "email" | "displayName">[];
  reporterName: string;
  issueType: string;
  note?: string | null;
}): Promise<void> {
  const to = input.stewards.map((s) => s.email).filter(Boolean);
  console.info("[inventory] issue notice", {
    to,
    assetTag: input.assetTag,
    itemName: input.itemName,
    area: input.area?.name ?? null,
    reporterName: input.reporterName,
    issueType: input.issueType,
    note: input.note ?? null,
  });
}
