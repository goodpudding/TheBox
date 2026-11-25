import { prisma } from "@/lib/db";

/**
 * Ends memberships that came from a redemption code and have run out.
 *
 * A member who pays through Zeffy has no end date; their payments keep them
 * active. A redeemed code gives a membership until `membershipEndsAt`, and
 * nothing else on the site would ever end it. The hourly cron calls this.
 * The tier and the date stay on the row so staff can see what ended.
 *
 * Each member is changed with a write that only lands if their end date is
 * still the one that was read, so someone who redeemed another code in the
 * same minute is left alone. Never throws.
 */
export async function lapseEndedMemberships(now = Date.now()): Promise<number> {
  try {
    const ended = await prisma.user.findMany({
      where: { status: "active", membershipEndsAt: { lt: new Date(now) } },
      select: { id: true, tier: true, membershipEndsAt: true },
    });
    let lapsed = 0;
    for (const user of ended) {
      if (!user.membershipEndsAt) continue;
      const { count } = await prisma.user.updateMany({
        where: {
          id: user.id,
          status: "active",
          membershipEndsAt: user.membershipEndsAt,
        },
        data: { status: "lapsed", shopAccess: false },
      });
      if (count !== 1) continue;
      lapsed += 1;
      await prisma.auditEvent.create({
        data: {
          id: `audit_${crypto.randomUUID().slice(0, 8)}`,
          action: "membership_lapsed",
          actorId: null,
          subjectUserId: user.id,
          entityType: "User",
          entityId: user.id,
          metadata: JSON.stringify({
            tier: user.tier,
            endedAt: user.membershipEndsAt.toISOString(),
          }),
          occurredAt: new Date(now),
        },
      });
    }
    return lapsed;
  } catch (err) {
    console.error("membership lapse", err);
    return 0;
  }
}
