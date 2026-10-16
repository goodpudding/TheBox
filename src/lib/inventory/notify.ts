import type { InventoryArea, User } from "@/lib/data/types";

/** v1 issue notice: SMTP when AUTH_EMAIL_SERVER is set, otherwise log. */
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
  const subject = `[The Box] Issue reported: ${input.assetTag} ${input.itemName}`;
  const body = [
    `${input.reporterName} reported ${input.issueType} on ${input.assetTag} (${input.itemName}).`,
    input.area ? `Area: ${input.area.name}` : "Area: not sure",
    input.note ? `Note: ${input.note}` : null,
    `Open: /inventory/${input.assetTag}`,
  ]
    .filter(Boolean)
    .join("\n");

  const server = process.env.AUTH_EMAIL_SERVER?.trim();
  const from =
    process.env.AUTH_EMAIL_FROM?.trim() ||
    "The Box <thebox@discoverburien.org>";

  if (!server || to.length === 0) {
    console.info("[inventory] issue notice", { to, subject, body });
    return;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport(server);
    await transporter.sendMail({
      from,
      to: to.join(", "),
      subject,
      text: body,
    });
  } catch (err) {
    console.warn("[inventory] issue email failed", err);
  }
}
