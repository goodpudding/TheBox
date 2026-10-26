/**
 * Zeffy public API shapes we care about for ticketing, memberships, and webhooks.
 * Docs: https://www.zeffy.com/api/docs
 *
 * Campaign `type` is only `donation_form` | `ticketing`. Membership programs
 * show up as ticketing campaigns whose `category` is `MembershipV2` (or
 * `membership`). Rates on GET /campaigns/:id are the membership types.
 */

export type ZeffyCampaignType = "donation_form" | "ticketing";

export interface ZeffyBuyer {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  is_corporate?: boolean;
  company_name?: string | null;
}

export interface ZeffyPaymentItem {
  id: string;
  type: "donation" | "ticket" | "additional_donation";
  amount: number;
  currency: string;
  rate_id?: string | null;
  rate_title?: string | null;
  recurrence_interval?: string | null;
  parent_rate_id?: string | null;
  contact_id?: string | null;
}

export interface ZeffyRecurring {
  is_recurring: boolean;
  status: string | null;
  interval?: string | null;
  subscription_id?: string | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
}

export interface ZeffyPayment {
  id: string;
  object: "payment";
  created: number;
  amount: number;
  currency: string;
  status: string;
  campaign_id: string;
  campaign_type: string;
  campaign_category?: string;
  occurrence_id?: string | null;
  buyer: ZeffyBuyer;
  items?: ZeffyPaymentItem[];
  description?: string | null;
  recurring?: ZeffyRecurring | null;
  contact?: string | null;
}

export interface ZeffyRate {
  id: string;
  object?: "rate";
  title: string;
  description?: string | null;
  amount: number;
  currency: string;
  is_pay_what_you_can?: boolean;
  is_add_on?: boolean;
  parent_rate_id?: string | null;
  seats?: number | null;
  maximum_to_buy?: number | null;
}

export interface ZeffyCampaign {
  id: string;
  object: "campaign";
  type: ZeffyCampaignType;
  category: string;
  status: string;
  title: string;
  description: string;
  url: string | null;
  is_archived: boolean;
  start_date: number | null;
  end_date: number | null;
  currency?: string;
  occurrences?: Array<{
    id: string;
    start: number;
    end: number;
    is_archived: boolean;
  }>;
  /** Present on GET /campaigns/:id (not the list endpoint). */
  rates?: ZeffyRate[];
}

export interface ZeffyContact {
  id: string;
  object: "contact";
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number?: string | null;
  total_contribution?: number;
  donation_count?: number;
}

export interface ZeffyListResponse<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export type ZeffyWebhookEventType =
  | "payment.completed"
  | "payment.created"
  | "payment.updated"
  | "payment.deleted"
  | "contact.created"
  | "contact.updated"
  | "contact.deleted";

export interface ZeffyWebhookEnvelope {
  id: string;
  type: ZeffyWebhookEventType;
  version: number;
  dispatchedAt: string;
  data: ZeffyPayment | { id: string } | Record<string, unknown>;
}

export type ZeffyApplyResult =
  | {
      status: "applied";
      bookingId: string;
      classSessionId: string;
      userId: string;
      created: boolean;
    }
  | {
      status: "duplicate";
      bookingId: string;
    }
  | {
      status: "ignored";
      reason:
        | "not_ticketing"
        | "not_membership"
        | "no_campaign_match"
        | "no_email"
        | "no_member"
        | "class_full"
        | "unsupported_event";
      detail?: string;
    };

export type ZeffyMembershipApplyResult =
  | {
      status: "applied";
      userId: string;
      created: boolean;
      tier: string;
    }
  | {
      status: "duplicate";
      userId: string;
    }
  | {
      status: "ignored";
      reason:
        | "not_membership"
        | "no_email"
        | "no_member"
        | "no_product_match"
        | "unsupported_event";
      detail?: string;
    };
