"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
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
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  STAGE_TONE,
  formatDueIn,
  urgencyFor,
  URGENCY_TONE,
} from "@/lib/job-helpers";
import { TechAvatar } from "@/components/tech-avatar";
import { RegionBadge, ProductBadge } from "@/components/badges";
import { scheduleJob } from "@/app/actions/schedule";
import type { JobStage, Region, Product } from "@/generated/prisma/enums";

type Tech = {
  id: string;
  name: string;
  initials: string | null;
  color: string | null;
};

type ScheduledJob = {
  id: string;
  jobNumber: string;
  stage: JobStage;
  product: Product;
  propertyName: string;
  propertyCity: string;
  propertyRegion: Region;
  dueDate: string;
  scheduledDate: string; // ISO
  assignedTechId: string | null;
};

type UnscheduledJob = {
  id: string;
  jobNumber: string;
  stage: JobStage;
  product: Product;
  propertyName: string;
  propertyCity: string;
  propertyRegion: Region;
  dueDate: string;
  assignedTech: Tech | null;
};

export function CalendarView({
  weekStartISO,
  weekEndISO,
  techs,
  scheduled,
  unscheduled,
  canEdit,
}: {
  weekStartISO: string;
  weekEndISO: string;
  techs: Tech[];
  scheduled: ScheduledJob[];
  unscheduled: UnscheduledJob[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const weekStart = useMemo(() => parseISO(weekStartISO), [weekStartISO]);
  const weekEnd = useMemo(() => parseISO(weekEndISO), [weekEndISO]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Optimistic overrides for move operations.
  const [optimistic, setOptimistic] = useState<
    Record<string, { scheduledDate: string; assignedTechId: string }>
  >({});

  const effectiveScheduled = useMemo(
    () =>
      scheduled.map((j) =>
        optimistic[j.id]
          ? {
              ...j,
              scheduledDate: optimistic[j.id].scheduledDate,
              assignedTechId: optimistic[j.id].assignedTechId,
            }
          : j,
      ),
    [scheduled, optimistic],
  );

  const effectiveUnscheduled = useMemo(
    () => unscheduled.filter((j) => !optimistic[j.id]),
    [unscheduled, optimistic],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  function gotoWeek(next: Date) {
    const params = new URLSearchParams(searchParams);
    params.set("week", format(next, "yyyy-MM-dd"));
    router.replace(`?${params.toString()}`);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const jobId = String(e.active.id);
    const dropId = e.over?.id;
    if (!dropId) return;
    const parts = String(dropId).split("|");
    if (parts.length !== 3 || parts[0] !== "cell") return;
    const techId = parts[1];
    const dateISO = parts[2];

    const job =
      scheduled.find((j) => j.id === jobId) ||
      unscheduled.find((j) => j.id === jobId);
    if (!job) return;

    setOptimistic((prev) => ({
      ...prev,
      [jobId]: { scheduledDate: dateISO, assignedTechId: techId },
    }));

    try {
      await scheduleJob(jobId, {
        date: dateISO,
        techId: techId || null,
      });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to schedule");
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  const activeJob = activeId
    ? effectiveScheduled.find((j) => j.id === activeId) ||
      effectiveUnscheduled.find((j) => j.id === activeId) ||
      null
    : null;

  const weekLabel =
    format(weekStart, "MMM d") +
    " – " +
    format(weekEnd, weekStart.getMonth() === weekEnd.getMonth() ? "d, yyyy" : "MMM d, yyyy");

  return (
    <DndContext
      id="calendar-dnd"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-[calc(100vh-56px)]">
        {/* Calendar pane */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-5 py-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Calendar</h1>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {weekLabel}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => gotoWeek(addWeeks(weekStart, -1))}
                className="h-8 w-8 grid place-items-center rounded-md text-neutral-600 hover:bg-neutral-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => gotoWeek(startOfDay(new Date()))}
                className="h-8 px-2.5 rounded-md border border-neutral-200 text-[12px] font-medium text-neutral-700 hover:border-neutral-300"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => gotoWeek(addWeeks(weekStart, 1))}
                className="h-8 w-8 grid place-items-center rounded-md text-neutral-600 hover:bg-neutral-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-[900px] grid grid-cols-[120px_repeat(7,minmax(0,1fr))] border-b border-neutral-200">
              {/* Day header row */}
              <div className="border-r border-neutral-200 bg-neutral-50" />
              {days.map((d) => (
                <DayHeader key={d.toISOString()} date={d} />
              ))}

              {/* Tech swim lanes */}
              {techs.map((tech) => (
                <SwimLane
                  key={tech.id}
                  tech={tech}
                  days={days}
                  scheduledJobs={effectiveScheduled.filter(
                    (j) => j.assignedTechId === tech.id,
                  )}
                  canEdit={canEdit}
                />
              ))}

              {/* Unassigned lane — optional, shows jobs scheduled without a tech */}
              {effectiveScheduled.some((j) => !j.assignedTechId) && (
                <SwimLane
                  tech={null}
                  days={days}
                  scheduledJobs={effectiveScheduled.filter(
                    (j) => !j.assignedTechId,
                  )}
                  canEdit={canEdit}
                />
              )}
            </div>
          </div>
        </div>

        {/* Unscheduled sidebar */}
        <aside className="w-72 shrink-0 border-l border-neutral-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-200">
            <h2 className="text-[13px] font-semibold tracking-tight">
              Unscheduled
            </h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {effectiveUnscheduled.length} jobs ready to schedule
              {canEdit && " · drag onto a day"}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {effectiveUnscheduled.length === 0 ? (
              <p className="p-4 text-[12px] text-neutral-500 text-center">
                All active jobs are scheduled.
              </p>
            ) : (
              effectiveUnscheduled.map((j) => (
                <UnscheduledCard key={j.id} job={j} canEdit={canEdit} />
              ))
            )}
          </div>
        </aside>
      </div>

      <DragOverlay>
        {activeJob ? (
          <div className="rounded-md border border-neutral-300 bg-white shadow-lg p-2 max-w-[220px]">
            <div className="text-[11px] font-mono text-neutral-500">
              {activeJob.jobNumber}
            </div>
            <div className="text-[12px] font-medium truncate">
              {activeJob.propertyName}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DayHeader({ date }: { date: Date }) {
  const isToday = isSameDay(date, new Date());
  return (
    <div
      className={cn(
        "border-r border-neutral-200 bg-neutral-50 px-2 py-2 text-center",
        isToday && "bg-orange-50",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
        {format(date, "EEE")}
      </div>
      <div
        className={cn(
          "text-[14px] tabular-nums mt-0.5",
          isToday ? "font-semibold text-orange-700" : "text-neutral-700",
        )}
      >
        {format(date, "MMM d")}
      </div>
    </div>
  );
}

function SwimLane({
  tech,
  days,
  scheduledJobs,
  canEdit,
}: {
  tech: Tech | null;
  days: Date[];
  scheduledJobs: ScheduledJob[];
  canEdit: boolean;
}) {
  return (
    <>
      <div className="border-r border-t border-neutral-200 bg-neutral-50 px-3 py-3 flex items-center gap-2">
        <TechAvatar tech={tech} size="sm" />
        <span className="text-[12px] font-medium text-neutral-700 truncate">
          {tech?.name ?? "Unassigned"}
        </span>
      </div>
      {days.map((d) => {
        const cellJobs = scheduledJobs.filter((j) =>
          isSameDay(parseISO(j.scheduledDate), d),
        );
        return (
          <DayCell
            key={d.toISOString() + (tech?.id ?? "none")}
            date={d}
            techId={tech?.id ?? ""}
            jobs={cellJobs}
            canEdit={canEdit}
          />
        );
      })}
    </>
  );
}

function DayCell({
  date,
  techId,
  jobs,
  canEdit,
}: {
  date: Date;
  techId: string;
  jobs: ScheduledJob[];
  canEdit: boolean;
}) {
  const dateISO = startOfDay(date).toISOString();
  const { setNodeRef, isOver } = useDroppable({
    id: `cell|${techId}|${dateISO}`,
    disabled: !canEdit,
  });
  const conflict = jobs.length > 1;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-r border-t border-neutral-200 p-1.5 min-h-[110px] relative transition-colors",
        isOver && "bg-orange-50/60 ring-1 ring-inset ring-orange-300",
      )}
    >
      {conflict && (
        <div className="absolute top-1 right-1">
          <span
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-semibold"
            title={`${jobs.length} jobs on this day`}
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {jobs.length}
          </span>
        </div>
      )}
      <div className="space-y-1">
        {jobs.map((j) => (
          <ScheduledBlock key={j.id} job={j} canEdit={canEdit} />
        ))}
      </div>
    </div>
  );
}

function ScheduledBlock({
  job,
  canEdit,
}: {
  job: ScheduledJob;
  canEdit: boolean;
}) {
  const tone = STAGE_TONE[job.stage];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    disabled: !canEdit,
  });

  return (
    <div ref={setNodeRef} {...(canEdit ? { ...listeners, ...attributes } : {})}>
      <Link
        href={`/jobs/${job.id}`}
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
        draggable={false}
        className={cn(
          "block rounded-md border px-1.5 py-1 transition-colors",
          tone.chip,
          canEdit && "cursor-grab active:cursor-grabbing",
          isDragging && "opacity-40",
        )}
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tone.dot)} />
          <span className="text-[10px] font-mono text-current/70 truncate">
            {job.jobNumber}
          </span>
        </div>
        <div className="text-[11px] font-medium leading-tight mt-0.5 truncate">
          {job.propertyName}
        </div>
      </Link>
    </div>
  );
}

function UnscheduledCard({
  job,
  canEdit,
}: {
  job: UnscheduledJob;
  canEdit: boolean;
}) {
  const urgency = urgencyFor(job.dueDate);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      {...(canEdit ? { ...listeners, ...attributes } : {})}
      className={cn(
        "block rounded-md border border-neutral-200 bg-white p-2 transition-all",
        canEdit && "hover:border-neutral-300 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono text-[10px] text-neutral-500">
          {job.jobNumber}
        </span>
        <div className="flex items-center gap-1">
          <RegionBadge region={job.propertyRegion} />
        </div>
      </div>
      <Link
        href={`/jobs/${job.id}`}
        draggable={false}
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
        className="block"
      >
        <div className="text-[12px] font-medium tracking-tight truncate">
          {job.propertyName}
        </div>
        <div className="text-[11px] text-neutral-500 truncate mt-0.5">
          {job.propertyCity}
        </div>
      </Link>
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
      <div className="flex items-center justify-end mt-1.5">
        <TechAvatar tech={job.assignedTech} size="sm" />
      </div>
    </div>
  );
}
