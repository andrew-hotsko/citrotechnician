import { JobStage, Region, Product } from "@/generated/prisma/enums";

export const STAGE_LABEL: Record<JobStage, string> = {
  UPCOMING: "Upcoming",
  OUTREACH: "Outreach",
  CONFIRMED: "Confirmed",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DEFERRED: "Deferred",
};

export const STAGE_ORDER: JobStage[] = [
  "UPCOMING",
  "OUTREACH",
  "CONFIRMED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "DEFERRED",
];

/**
 * Tailwind utility classes for each stage. The `chip` variant is the
 * Housecall/Pipedrive-style filled status pill used on tables and cards —
 * bolder than the previous pastel so the stage reads at a glance. `dot` is
 * the small swatch used next to the chip or on column headers. `ring` is
 * for selection / focus states (kept for consumers).
 */
export const STAGE_TONE: Record<
  JobStage,
  { dot: string; chip: string; ring: string }
> = {
  UPCOMING:    { dot: "bg-neutral-400", chip: "bg-neutral-100 text-neutral-800 ring-1 ring-inset ring-neutral-200/60", ring: "ring-neutral-200" },
  OUTREACH:    { dot: "bg-amber-500",   chip: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200/60",       ring: "ring-amber-200" },
  CONFIRMED:   { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200/60", ring: "ring-emerald-200" },
  SCHEDULED:   { dot: "bg-blue-500",    chip: "bg-blue-100 text-blue-900 ring-1 ring-inset ring-blue-200/60",          ring: "ring-blue-200" },
  IN_PROGRESS: { dot: "bg-violet-500",  chip: "bg-violet-100 text-violet-900 ring-1 ring-inset ring-violet-200/60",    ring: "ring-violet-200" },
  COMPLETED:   { dot: "bg-emerald-600", chip: "bg-neutral-900 text-white",                                              ring: "ring-neutral-300" },
  DEFERRED:    { dot: "bg-red-500",     chip: "bg-red-100 text-red-900 ring-1 ring-inset ring-red-200/60",             ring: "ring-red-200" },
};

export const REGION_LABEL: Record<Region, string> = {
  NORCAL: "NorCal",
  SOCAL: "SoCal",
  OTHER: "Other",
};

export const PRODUCT_LABEL: Record<Product, string> = {
  MFB_31: "MFB-31",
  MFB_34: "MFB-34",
  MFB_35_FM: "MFB-35-FM",
};

// ---- Formatters -----------------------------------------------------------

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** Visual urgency of a due date — controls colouring on cards/tables. */
export type Urgency = "overdue" | "soon" | "upcoming" | "distant" | "none";

export function urgencyFor(dueDate: Date | string | null | undefined): Urgency {
  const days = daysUntil(dueDate);
  if (days === null) return "none";
  if (days < 0) return "overdue";
  if (days <= 30) return "soon";
  if (days <= 90) return "upcoming";
  return "distant";
}

export const URGENCY_TONE: Record<Urgency, string> = {
  overdue:  "text-red-600 bg-red-50",
  soon:     "text-amber-700 bg-amber-50",
  upcoming: "text-neutral-700 bg-neutral-50",
  distant:  "text-neutral-500 bg-neutral-50",
  none:     "text-neutral-400",
};

export function formatDueIn(dueDate: Date | string | null | undefined): string {
  const days = daysUntil(dueDate);
  if (days === null) return "No due date";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

export function formatJobNumber(num: string): string {
  return num.toUpperCase();
}
