/**
 * Zeffy public API shapes we care about for ticketing + webhooks.
 * Docs: https://www.zeffy.com/api/docs
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
  contact_id?: string | null;
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
  occurrences?: Array<{
    id: string;
    start: number;
    end: number;
    is_archived: boolean;
  }>;
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
        | "no_campaign_match"
        | "no_email"
        | "no_member"
        | "class_full"
        | "unsupported_event";
      detail?: string;
    };
