"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { JobListItem } from "@/lib/jobs-query";
import type { JobStage } from "@/generated/prisma/enums";
import {
  STAGE_LABEL,
  STAGE_ORDER,
  STAGE_TONE,
  formatDueIn,
  urgencyFor,
  URGENCY_TONE,
} from "@/lib/job-helpers";
import { Phone, Mail } from "lucide-react";
import { RegionBadge, ProductBadge } from "@/components/badges";
import { TechAvatar } from "@/components/tech-avatar";
import { updateJobStage } from "@/app/actions/jobs";

export function PipelineBoard({
  jobs,
  canEdit,
}: {
  jobs: JobListItem[];
  canEdit: boolean;
}) {
  const [optimistic, setOptimistic] = useState<Record<string, JobStage>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Apply any in-flight optimistic overrides.
  const effectiveJobs = useMemo(
    () =>
      jobs.map((j) =>
        optimistic[j.id] ? { ...j, stage: optimistic[j.id] } : j,
      ),
    [jobs, optimistic],
  );

  const byStage = useMemo(() => {
    const map: Record<JobStage, JobListItem[]> = {
      UPCOMING: [], OUTREACH: [], CONFIRMED: [], SCHEDULED: [],
      IN_PROGRESS: [], COMPLETED: [], DEFERRED: [],
    };
    for (const j of effectiveJobs) map[j.stage].push(j);
    return map;
  }, [effectiveJobs]);

  const activeJob = activeId
    ? effectiveJobs.find((j) => j.id === activeId)
    : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const jobId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const newStage = overId as JobStage;
    const job = effectiveJobs.find((j) => j.id === jobId);
    if (!job || job.stage === newStage) return;

    setOptimistic((p) => ({ ...p, [jobId]: newStage }));
    try {
      await updateJobStage(jobId, newStage);
      toast.success(`Moved to ${STAGE_LABEL[newStage]}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update stage");
      setOptimistic((p) => {
        const next = { ...p };
        delete next[jobId];
        return next;
      });
    }
  }

  return (
    <DndContext
      id="pipeline-dnd"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6">
        {STAGE_ORDER.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            jobs={byStage[stage]}
            canEdit={canEdit}
          />
        ))}
      </div>
      <DragOverlay>
        {activeJob ? <JobCard job={activeJob} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  jobs,
  canEdit,
}: {
  stage: JobStage;
  jobs: JobListItem[];
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !canEdit });
  const tone = STAGE_TONE[stage];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 flex flex-col rounded-lg bg-neutral-100/60 p-2 transition-colors",
        isOver && canEdit && "bg-neutral-200/80 ring-1 ring-neutral-300",
      )}
    >
      <div className="flex items-center justify-between px-1 py-1 mb-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
          <span className="text-[11px] font-semibold tracking-tight text-neutral-800">
            {STAGE_LABEL[stage]}
          </span>
        </div>
        <span className="text-[10px] tabular-nums font-medium text-neutral-500 bg-white border border-neutral-200 rounded px-1.5 py-0.5">
          {jobs.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 min-h-[120px]">
        {jobs.length === 0 ? (
          <div className="text-[11px] text-neutral-400 text-center py-6">
            {canEdit ? "Drop here" : "—"}
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard key={job.id} job={job} canEdit={canEdit} />
          ))
        )}
      </div>
    </div>
  );
}

function JobCard({
  job,
  canEdit = false,
  dragging = false,
}: {
  job: JobListItem;
  canEdit?: boolean;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    disabled: !canEdit || dragging,
  });

  const urgency = urgencyFor(job.dueDate);

  return (
    <div
      ref={setNodeRef}
      {...(canEdit && !dragging ? { ...listeners, ...attributes } : {})}
      className={cn(
        "group block rounded-lg border border-neutral-200 bg-white p-2.5 transition-shadow duration-150 ease-standard hover:shadow-elev-1",
        canEdit && !dragging && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        dragging && "shadow-elev-3 rotate-1 cursor-grabbing",
      )}
    >
      <Link
        href={`/jobs/${job.id}`}
        onClick={(e) => {
          // Don't navigate when finishing a drag on the card.
          if (isDragging) e.preventDefault();
        }}
        draggable={false}
        className="block"
      >
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="font-mono text-[10px] font-medium text-neutral-500">
            {job.jobNumber}
          </span>
          <RegionBadge region={job.property.region} />
        </div>
        <div className="text-[13px] font-medium tracking-tight text-neutral-900 truncate">
          {job.property.name}
        </div>
        <div className="text-[11px] text-neutral-500 truncate mt-0.5">
          {job.property.city}
        </div>
        <div className="flex items-center justify-between mt-2 gap-1">
          <ProductBadge product={job.product} />
          <span
            className={cn(
              "inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium",
              URGENCY_TONE[urgency],
            )}
          >
            {formatDueIn(job.dueDate)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1.5 gap-1">
          <ContactQuickActions
            phone={job.property.customer.phone}
            email={job.property.customer.email}
          />
          <TechAvatar tech={job.assignedTech} size="sm" />
        </div>
      </Link>
    </div>
  );
}

/**
 * Inline phone + email affordances on a job card. Click-to-call (tel:) on
 * mobile and click-to-email (mailto:) everywhere — without forcing the ops
 * manager to drill into the job detail first. Muted and compact so the
 * card stays scannable.
 */
function ContactQuickActions({
  phone,
  email,
}: {
  phone: string | null;
  email: string | null;
}) {
  if (!phone && !email) {
    return <span className="text-[10px] text-neutral-400">—</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {phone ? (
        <a
          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 h-5 px-1.5 rounded border border-neutral-200 bg-white text-[10px] font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 transition-colors"
          title={phone}
          aria-label={`Call ${phone}`}
        >
          <Phone className="h-2.5 w-2.5" />
          <span className="tabular-nums">{formatPhoneShort(phone)}</span>
        </a>
      ) : null}
      {email ? (
        <a
          href={`mailto:${email}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center h-5 w-5 rounded border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 transition-colors"
          title={email}
          aria-label={`Email ${email}`}
        >
          <Mail className="h-2.5 w-2.5" />
        </a>
      ) : null}
    </div>
  );
}

/**
 * Compact formatter so the card has room for the number next to the icon.
 * Strips +1 country code, drops separators, and returns NNN-NNNN. The full
 * original string is still shown in the tooltip for verification.
 */
function formatPhoneShort(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^1/, ""); // drop leading "1"
  if (digits.length === 10) {
    // 10-digit US: XXX-XXXX (drop area code for space; full # in tooltip)
    return `${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw; // unknown format: show as-is
}
