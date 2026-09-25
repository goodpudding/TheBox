import { describe, expect, it } from "vitest";
import type { MembershipProduct, User } from "@/lib/data/types";
import { applyZeffyMembershipToStore } from "./apply-membership";
import {
  catalogFromMembershipCampaigns,
  inferMembershipTier,
  isMembershipCampaign,
  isMembershipPayment,
  mapRateToMembershipProduct,
  stripHtml,
} from "./memberships";
import type { ZeffyCampaign, ZeffyPayment } from "./types";

const lampCampaign: ZeffyCampaign = {
  id: "744f4e91-be80-4beb-b16b-53971e7ef0f6",
  object: "campaign",
  type: "ticketing",
  category: "MembershipV2",
  status: "active",
  title: "Lamp Community Lab's Memberships",
  description: "",
  url: "https://www.zeffy.com/ticketing/lamp-community-labs-memberships",
  is_archived: false,
  start_date: null,
  end_date: null,
  currency: "usd",
  rates: [
    {
      id: "664f497d-641a-4193-9089-8e8923d7f3fd",
      title: "Membership",
      description: "",
      amount: 4000,
      currency: "usd",
      is_add_on: false,
      seats: null,
    },
  ],
};

describe("Zeffy membership catalog", () => {
  it("treats MembershipV2 ticketing campaigns as memberships", () => {
    expect(isMembershipCampaign(lampCampaign)).toBe(true);
    expect(
      isMembershipCampaign({ type: "ticketing", category: "event" }),
    ).toBe(false);
    expect(
      isMembershipPayment({
        campaign_category: "MembershipV2",
      } as ZeffyPayment),
    ).toBe(true);
  });

  it("maps a generic $40 Membership rate onto Maker", () => {
    const product = mapRateToMembershipProduct({
      campaign: lampCampaign,
      rate: lampCampaign.rates![0],
      sortOrder: 10,
      highlight: true,
      nowIso: "2026-09-25T00:00:00.000Z",
    });
    expect(product).toMatchObject({
      id: "mp-zeffy-664f497d-641a-4193-9089-8e8923d7f3fd",
      name: "Lamp Community Lab's Memberships",
      tier: "maker",
      priceCents: 4000,
      billingInterval: "monthly",
      joinable: true,
      visibleOnJoin: true,
      shopAccess: true,
      creditGrantCents: 0,
      zeffyCampaignId: lampCampaign.id,
      zeffyRateId: "664f497d-641a-4193-9089-8e8923d7f3fd",
      zeffyUrl: lampCampaign.url,
    });
  });

  it("skips drafts and campaigns with no rates", () => {
    const draft: ZeffyCampaign = {
      ...lampCampaign,
      id: "draft-1",
      title: "Memberships Plus",
      status: "draft",
      description: "<p>Plus $50 worth of machine credit</p>",
      rates: [],
    };
    const catalog = catalogFromMembershipCampaigns([lampCampaign, draft]);
    expect(catalog.products).toHaveLength(1);
    expect(catalog.skipped).toEqual([
      {
        id: "draft-1",
        title: "Memberships Plus",
        reason: "status:draft",
      },
    ]);
    expect(catalog.primaryUrl).toBe(lampCampaign.url);
  });

  it("strips HTML from Zeffy descriptions", () => {
    expect(stripHtml("<p>Plus $50 worth of machine credit</p>")).toBe(
      "Plus $50 worth of machine credit",
    );
    expect(
      stripHtml(
        'LXCL:<ul class="lxcl-ul"><li><span>$50 of machine credits</span></li></ul>',
      ),
    ).toBe("$50 of machine credits");
  });

  it("infers community from the rate name", () => {
    expect(inferMembershipTier("Community rate", 2000)).toBe("community");
    expect(inferMembershipTier("Student", 2000)).toBe("community");
    expect(inferMembershipTier("Membership Plus", 7500)).toBe("maker_pro");
  });

  it("grants $50 credits on Membership Plus, not on Maker or Student", () => {
    const plus = mapRateToMembershipProduct({
      campaign: {
        ...lampCampaign,
        id: "plus-camp",
        title: "Memberships Plus",
        description: "<p>Plus $50 worth of machine credit</p>",
        url: "https://www.zeffy.com/ticketing/lamp-community-labs-memberships-plus",
        rates: [
          {
            id: "plus-rate",
            title: "Membership Plus",
            description: "<p>$50 of machine credits</p>",
            amount: 7500,
            currency: "usd",
            is_add_on: false,
            seats: null,
          },
        ],
      },
      rate: {
        id: "plus-rate",
        title: "Membership Plus",
        description: "<p>$50 of machine credits</p>",
        amount: 7500,
        currency: "usd",
        is_add_on: false,
        seats: null,
      },
      sortOrder: 10,
      highlight: true,
      nowIso: "2026-09-25T00:00:00.000Z",
    });
    expect(plus.tier).toBe("maker_pro");
    expect(plus.creditGrantCents).toBe(5000);

    const student = mapRateToMembershipProduct({
      campaign: {
        ...lampCampaign,
        id: "plus-camp",
        title: "Memberships Plus",
        rates: [
          {
            id: "stu-rate",
            title: "Student",
            description: "",
            amount: 2000,
            currency: "usd",
            is_add_on: false,
            seats: null,
          },
        ],
      },
      rate: {
        id: "stu-rate",
        title: "Student",
        description: "",
        amount: 2000,
        currency: "usd",
        is_add_on: false,
        seats: null,
      },
      sortOrder: 20,
      highlight: false,
      nowIso: "2026-09-25T00:00:00.000Z",
    });
    expect(student.tier).toBe("community");
    expect(student.creditGrantCents).toBe(0);
  });
});

describe("applyZeffyMembershipToStore", () => {
  function membershipPayment(
    overrides: Partial<ZeffyPayment> = {},
  ): ZeffyPayment {
    return {
      id: "pay-mem-1",
      object: "payment",
      created: 1_700_000_000,
      amount: 4000,
      currency: "usd",
      status: "succeeded",
      campaign_id: lampCampaign.id,
      campaign_type: "ticketing",
      campaign_category: "MembershipV2",
      buyer: {
        email: "maya.chen@example.com",
        first_name: "Maya",
        last_name: "Chen",
      },
      items: [
        {
          id: "i1",
          type: "ticket",
          amount: 4000,
          currency: "usd",
          rate_id: lampCampaign.rates![0].id,
          rate_title: "Membership",
        },
      ],
      ...overrides,
    };
  }

  function makeMemberStore(seed?: { users?: User[]; products?: MembershipProduct[] }) {
    const users: User[] = seed?.users ?? [
      {
        id: "u-maya",
        email: "maya.chen@example.com",
        firstName: "Maya",
        lastName: "Chen",
        displayName: "Maya Chen",
        role: "member",
        status: "pending",
        tier: null,
        shopAccess: false,
        isTeacher: false,
        profileComplete: true,
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      },
    ];
    const products: MembershipProduct[] = seed?.products ?? [
      mapRateToMembershipProduct({
        campaign: lampCampaign,
        rate: lampCampaign.rates![0],
        sortOrder: 10,
        highlight: true,
        nowIso: "2026-09-25T00:00:00.000Z",
      }),
    ];
    const applied = new Map<string, string>();

    return {
      users,
      findAppliedPayment: (paymentId: string) => {
        const userId = applied.get(paymentId);
        return userId ? { userId } : null;
      },
      findUserByEmail: (email: string) =>
        users.find((u) => u.email.toLowerCase() === email) ?? null,
      findProductByCampaignAndRate: (campaignId: string, rateId?: string | null) =>
        products.find(
          (p) =>
            p.zeffyCampaignId === campaignId &&
            (!rateId || p.zeffyRateId === rateId),
        ) ?? null,
      upsertMemberFromZeffy: (input: {
        email: string;
        paymentId: string;
        tier: User["tier"];
        shopAccess: boolean;
        createIfMissing: boolean;
        firstName: string;
        lastName: string;
        paidAt: string;
        billingInterval: User["billingInterval"];
      }) => {
        let user = users.find((u) => u.email.toLowerCase() === input.email);
        if (!user) {
          if (!input.createIfMissing) return null;
          user = {
            id: "u-new",
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: `${input.firstName} ${input.lastName}`.trim(),
            role: "member",
            status: "active",
            tier: input.tier,
            shopAccess: input.shopAccess,
            isTeacher: false,
            profileComplete: false,
            createdAt: input.paidAt,
            updatedAt: input.paidAt,
          };
          users.push(user);
        } else {
          user.status = "active";
          user.tier = input.tier;
          user.shopAccess = input.shopAccess;
        }
        applied.set(input.paymentId, user.id);
        return user;
      },
    };
  }

  it("activates a matching member and sets Maker", () => {
    const store = makeMemberStore();
    const result = applyZeffyMembershipToStore(membershipPayment(), store);
    expect(result).toMatchObject({
      status: "applied",
      created: false,
      tier: "maker",
      userId: "u-maya",
    });
    expect(store.users[0]?.status).toBe("active");
    expect(store.users[0]?.tier).toBe("maker");
    expect(store.users[0]?.shopAccess).toBe(true);
  });

  it("is idempotent on payment id", () => {
    const store = makeMemberStore();
    applyZeffyMembershipToStore(membershipPayment(), store);
    const second = applyZeffyMembershipToStore(membershipPayment(), store);
    expect(second.status).toBe("duplicate");
  });

  it("ignores unknown emails unless createIfMissing", () => {
    const store = makeMemberStore({ users: [] });
    const ignored = applyZeffyMembershipToStore(membershipPayment(), store);
    expect(ignored).toMatchObject({ status: "ignored", reason: "no_member" });
    const created = applyZeffyMembershipToStore(membershipPayment(), store, {
      createIfMissing: true,
    });
    expect(created).toMatchObject({
      status: "applied",
      created: true,
      userId: "u-new",
    });
  });
});
