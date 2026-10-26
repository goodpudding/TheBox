import type {
  ItemCondition,
  ItemEventType,
  ItemStatus,
  PhotoKind,
  ReviewStatus,
} from "@/lib/data/types";

export const CONDITION_CARDS: {
  value: ItemCondition;
  label: string;
  description: string;
}[] = [
  { value: "NEW", label: "New", description: "New or like new" },
  { value: "GOOD", label: "Good", description: "Works well, normal wear" },
  { value: "FAIR", label: "Fair", description: "Works, shows heavy wear" },
  {
    value: "NEEDS_REPAIR",
    label: "Needs repair",
    description: "Usable with issues, or not usable until fixed",
  },
  { value: "BROKEN", label: "Broken", description: "Not working / parts only" },
];

export const STATUS_LABELS: Record<ItemStatus, string> = {
  ACTIVE: "Active",
  IN_REPAIR: "In repair",
  OUT_ON_LOAN: "Out on loan",
  MISSING: "Missing",
  RETIRED: "Retired",
};

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  FRONT: "Front",
  SIDE: "Side profile",
  SERIAL: "Serial / label",
  OTHER: "Extra",
};

export const EVENT_LABELS: Record<ItemEventType, string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONDITION_CHANGED: "Condition changed",
  STATUS_CHANGED: "Status changed",
  MOVED: "Moved",
  PHOTO_ADDED: "Photo added",
  ISSUE_REPORTED: "Issue reported",
  LABEL_PRINTED: "Label printed",
  RETIRED: "Retired",
};

export function conditionLabel(value: ItemCondition): string {
  return CONDITION_CARDS.find((c) => c.value === value)?.label ?? value;
}
