"use client";

import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  X,
  ArrowRight,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { JobStageSelect } from "@/components/job-stage-select";
import { JobTechSelect } from "@/components/job-tech-select";
import { TechAvatar } from "@/components/tech-avatar";
import { RegionBadge, ProductBadge } from "@/components/badges";
import {
  formatDate,
  formatDueIn,
  urgencyFor,
  URGENCY_TONE,
} from "@/lib/job-helpers";
import type { JobListItem } from "@/lib/jobs-query";

type Tech = {
  id: string;
  name: string;
  initials: string | null;
  color: string | null;
};

/**
 * Quick-view slideover for a job. Opens from the right, covers ~400px,
 * click-away or ESC closes. Shows the essentials (stage, tech, contact,
 * dates, money) plus inline edits for the most-touched controls
 * (stage + tech). Anything else is behind the "Open full details" link.
 *
 * Data comes from the already-fetched JobListItem, so opening is
 * instant — no loading state, no network fetch.
 */
export function JobQuickView({
  job,
  techs,
  canEdit,
  open,
  onOpenChange,
}: {
  job: JobListItem | null;
  techs: Tech[];
  canEdit: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!job) return null;

  const urgency = urgencyFor(job.dueDate);
  const address = `${job.property.address}, ${job.property.city}, ${job.property.state}${job.property.zip ? ` ${job.property.zip}` : ""}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed right-0 top-0 bottom-0 z-50 w-full sm:max-w-[440px] bg-white shadow-elev-3 outline-none",
            "data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right",
            "duration-150 overflow-y-auto",
          )}
        >
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-neutral-200 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] min-w-0">
                <span className="font-mono font-medium text-neutral-500 shrink-0">
                  {job.jobNumber}
                </span>
                <span className="text-neutral-300">·</span>
                <RegionBadge region={job.property.region} />
                <ProductBadge product={job.product} />
              </div>
              <DialogPrimitive.Close
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Title className="text-[16px] font-semibold tracking-tight mt-1.5 truncate">
              {job.property.name}
            </DialogPrimitive.Title>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-700 mt-0.5"
              title="Open in Google Maps"
            >
              <MapPin className="h-3 w-3" />
              <span className="truncate">{address}</span>
            </a>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* Inline edits */}
            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <JobStageSelect jobId={job.id} current={job.stage} />
              ) : null}
              {canEdit ? (
                <JobTechSelect
                  jobId={job.id}
                  current={job.assignedTech}
                  techs={techs}
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium",
                  URGENCY_TONE[urgency],
                )}
              >
                {formatDueIn(job.dueDate)}
              </span>
            </div>

            {/* Customer */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-2">
                Customer
              </div>
              <div className="text-[13px] font-medium text-neutral-900">
                {job.property.customer.name}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {job.property.customer.phone ? (
                  <a
                    href={`tel:${job.property.customer.phone.replace(/[^+\d]/g, "")}`}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-neutral-200 bg-white text-[12px] text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    {job.property.customer.phone}
                  </a>
                ) : null}
                {job.property.customer.email ? (
                  <a
                    href={`mailto:${job.property.customer.email}`}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-neutral-200 bg-white text-[12px] text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition-colors max-w-full truncate"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{job.property.customer.email}</span>
                  </a>
                ) : null}
                {!job.property.customer.phone && !job.property.customer.email ? (
                  <span className="text-[12px] text-neutral-400 italic">
                    No contact info on file
                  </span>
                ) : null}
              </div>
            </div>

            {/* Key facts */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-2">
                Service
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
                <Fact
                  icon={CalendarIcon}
                  label="Due date"
                  value={formatDate(job.dueDate)}
                />
                <Fact
                  icon={Clock}
                  label="Last service"
                  value={formatDate(job.lastServiceDate)}
                />
                <Fact
                  icon={CalendarIcon}
                  label="Scheduled"
                  value={
                    job.scheduledDate ? formatDate(job.scheduledDate) : "—"
                  }
                />
                <Fact
                  icon={Clock}
                  label="Interval"
                  value={`${job.maintenanceIntervalMonths} months`}
                />
              </dl>
            </div>

            {/* Current tech assignment, shown when read-only (admin gets the
                dropdown above instead). Matches the compact pattern the
                rest of the app uses. */}
            {!canEdit && (
              <div className="flex items-center gap-2 text-[12px]">
                <TechAvatar tech={job.assignedTech} size="sm" />
                <span className="text-neutral-700">
                  {job.assignedTech?.name ?? "Unassigned"}
                </span>
              </div>
            )}
          </div>

          {/* Footer — full details link */}
          <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-5 py-3">
            <Link
              href={`/jobs/${job.id}`}
              className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-md bg-neutral-900 text-white text-[13px] font-medium transition-colors hover:bg-neutral-800 shadow-elev-1"
              onClick={() => onOpenChange(false)}
            >
              Open full details
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <p className="text-[10px] text-center text-neutral-400 mt-1.5">
              Notes, photos, activity log, and checklist live on the full
              page.
            </p>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5 flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="text-neutral-900 font-medium tabular-nums truncate">
        {value}
      </dd>
    </div>
  );
}
