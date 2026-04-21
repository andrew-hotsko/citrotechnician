import type { JobListItem } from "@/lib/jobs-query";
import { urgencyFor } from "@/lib/job-helpers";

export type PinTone =
  | "overdue"
  | "dueSoon"
  | "dueLater"
  | "upcoming"
  | "scheduled"
  | "confirmed"
  | "inProgress"
  | "completed"
  | "deferred";

export const PIN_TONE_LABEL: Record<PinTone, string> = {
  overdue: "Overdue",
  dueSoon: "Due < 30 days",
  dueLater: "Due < 90 days",
  upcoming: "Upcoming",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  inProgress: "In progress",
  completed: "Completed",
  deferred: "Deferred",
};

export const PIN_TONE_COLOR: Record<PinTone, string> = {
  overdue:    "#ef4444", // red-500
  dueSoon:    "#f59e0b", // amber-500
  dueLater:   "#f97316", // orange-500
  upcoming:   "#a3a3a3", // neutral-400
  scheduled:  "#3b82f6", // blue-500
  confirmed:  "#10b981", // emerald-500
  inProgress: "#8b5cf6", // violet-500
  completed:  "#737373", // neutral-500
  deferred:   "#dc2626", // red-600 (deeper)
};

export function pinToneForJob(job: JobListItem): PinTone {
  switch (job.stage) {
    case "COMPLETED": return "completed";
    case "DEFERRED": return "deferred";
    case "IN_PROGRESS": return "inProgress";
    case "SCHEDULED": return "scheduled";
    case "CONFIRMED": return "confirmed";
    case "UPCOMING":
    case "OUTREACH": {
      const u = urgencyFor(job.dueDate);
      if (u === "overdue") return "overdue";
      if (u === "soon") return "dueSoon";
      if (u === "upcoming") return "dueLater";
      return "upcoming";
    }
  }
}
