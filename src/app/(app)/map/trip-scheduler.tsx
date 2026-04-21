"use client";

import { useState, useTransition } from "react";
import { Loader2, Route, X } from "lucide-react";
import { scheduleTrip } from "@/app/actions/schedule";
import { TechAvatar } from "@/components/tech-avatar";
import { RegionBadge, ProductBadge } from "@/components/badges";
import { cn } from "@/lib/utils";
import type { JobStage, Region, Product } from "@/generated/prisma/enums";

type TripPin = {
  id: string;
  jobNumber: string;
  propertyName: string;
  propertyCity: string;
  propertyRegion: Region;
  product: Product;
  stage: JobStage;
};

type Tech = {
  id: string;
  name: string;
  initials: string | null;
  color: string | null;
};

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // yyyy-mm-dd for input[type=date]
  return d.toISOString().slice(0, 10);
}

export function TripScheduler({
  pins,
  techs,
  onClose,
  onScheduled,
}: {
  pins: TripPin[];
  techs: Tech[];
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [techId, setTechId] = useState(techs[0]?.id ?? "");
  const [startDate, setStartDate] = useState(todayISO());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function schedule() {
    if (!techId) {
      setError("Pick a tech");
      return;
    }
    setError(null);
    start(async () => {
      try {
        const result = await scheduleTrip(
          pins.map((p) => p.id),
          { techId, startDate },
        );
        if (result.ok) onScheduled();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to schedule");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 uppercase tracking-wider font-medium">
              <Route className="h-3 w-3" />
              Plan trip
            </div>
            <h2 className="text-[15px] font-semibold tracking-tight mt-0.5">
              Schedule {pins.length}-stop trip
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-md grid place-items-center text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Stops list */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">
              Stops (in order)
            </label>
            <ul className="space-y-1.5">
              {pins.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white text-[10px] font-semibold shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">
                      {p.propertyName}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">
                      {p.propertyCity} · {p.jobNumber}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <RegionBadge region={p.propertyRegion} />
                    <ProductBadge product={p.product} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech picker */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">
              Tech
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {techs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTechId(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 h-8 text-[12px] transition-colors",
                    techId === t.id
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                  )}
                >
                  <TechAvatar tech={t} size="sm" />
                  <span className="truncate">{t.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Start date */}
          <div>
            <label
              htmlFor="trip-start"
              className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2"
            >
              Start date
            </label>
            <input
              id="trip-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 px-2.5 text-[13px] rounded-md border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400"
            />
            <p className="text-[11px] text-neutral-500 mt-1.5">
              Each stop is scheduled one day after the previous (
              {pins.length} days total). Adjust individual dates on the calendar
              after scheduling.
            </p>
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-9 px-3 rounded-md text-[13px] font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={schedule}
            disabled={pending || !techId}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-[13px] font-semibold text-white transition-colors",
              pending || !techId
                ? "bg-orange-400 cursor-wait"
                : "bg-orange-600 hover:bg-orange-500",
            )}
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Scheduling…
              </>
            ) : (
              `Schedule ${pins.length} ${pins.length === 1 ? "stop" : "stops"}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
