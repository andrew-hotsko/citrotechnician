"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/job-helpers";
import { TechAvatar } from "@/components/tech-avatar";
import type { JobStage, Region } from "@/generated/prisma/enums";

type Tech = {
  id: string;
  name: string;
  initials: string | null;
  color: string | null;
};

const REGIONS: { value: Region; label: string }[] = [
  { value: "NORCAL", label: "NorCal" },
  { value: "SOCAL", label: "SoCal" },
];

export function JobsFilters({ techs }: { techs: Tech[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const [query, setQuery] = useState(params.get("q") ?? "");

  // Debounced URL update on search typing.
  useEffect(() => {
    const t = setTimeout(() => {
      const current = params.get("q") ?? "";
      if (query === current) return;
      const next = new URLSearchParams(params);
      if (query) next.set("q", query);
      else next.delete("q");
      start(() => router.replace(`?${next.toString()}`));
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const stageList = (params.get("stage") ?? "").split(",").filter(Boolean) as JobStage[];
  const regionList = (params.get("region") ?? "").split(",").filter(Boolean) as Region[];
  const techList = (params.get("tech") ?? "").split(",").filter(Boolean);
  const cycleList = (params.get("cycle") ?? "").split(",").filter(Boolean);
  const dueRange = params.get("due") ?? "";

  function toggle(
    key: "stage" | "region" | "tech" | "cycle",
    value: string,
    current: string[],
  ) {
    const set = new Set(current);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    const next = new URLSearchParams(params);
    if (set.size) next.set(key, [...set].join(","));
    else next.delete(key);
    start(() => router.replace(`?${next.toString()}`));
  }

  function setDue(value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== dueRange) next.set("due", value);
    else next.delete("due");
    start(() => router.replace(`?${next.toString()}`));
  }

  function clearAll() {
    setQuery("");
    start(() => router.replace("?"));
  }

  const activeCount =
    stageList.length +
    regionList.length +
    techList.length +
    cycleList.length +
    (dueRange ? 1 : 0) +
    (query ? 1 : 0);

  return (
    <div
      className={cn(
        "space-y-2 transition-opacity",
        pending && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job number, property, customer, address…"
            className="w-full h-8 pl-8 pr-3 text-[13px] rounded-md border border-neutral-200 bg-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400"
          />
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-medium text-neutral-600 hover:text-neutral-900"
          >
            <X className="h-3 w-3" />
            Clear ({activeCount})
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterGroup label="Due">
          <FilterPill
            active={dueRange === "overdue"}
            onClick={() => setDue("overdue")}
          >
            Overdue
          </FilterPill>
          <FilterPill
            active={dueRange === "this_week"}
            onClick={() => setDue("this_week")}
          >
            This week
          </FilterPill>
          <FilterPill
            active={dueRange === "this_month"}
            onClick={() => setDue("this_month")}
          >
            This month
          </FilterPill>
          <FilterPill
            active={dueRange === "next_30"}
            onClick={() => setDue("next_30")}
          >
            Next 30d
          </FilterPill>
          <FilterPill
            active={dueRange === "next_90"}
            onClick={() => setDue("next_90")}
          >
            Next 90d
          </FilterPill>
          <FilterPill
            active={dueRange === "this_quarter"}
            onClick={() => setDue("this_quarter")}
          >
            This quarter
          </FilterPill>
          <FilterPill
            active={dueRange === "this_year"}
            onClick={() => setDue("this_year")}
          >
            This year
          </FilterPill>
        </FilterGroup>
        <span className="h-4 w-px bg-neutral-200 mx-1" />
        <FilterGroup label="Cycle">
          <FilterPill
            active={cycleList.includes("install")}
            onClick={() => toggle("cycle", "install", cycleList)}
          >
            Install
          </FilterPill>
          <FilterPill
            active={cycleList.includes("year1")}
            onClick={() => toggle("cycle", "year1", cycleList)}
          >
            Year 1
          </FilterPill>
          <FilterPill
            active={cycleList.includes("year2")}
            onClick={() => toggle("cycle", "year2", cycleList)}
          >
            Year 2
          </FilterPill>
          <FilterPill
            active={cycleList.includes("year3plus")}
            onClick={() => toggle("cycle", "year3plus", cycleList)}
          >
            Year 3+
          </FilterPill>
          <FilterPill
            active={cycleList.includes("final")}
            onClick={() => toggle("cycle", "final", cycleList)}
          >
            Final
          </FilterPill>
        </FilterGroup>
        <span className="h-4 w-px bg-neutral-200 mx-1" />
        <FilterGroup label="Stage">
          {STAGE_ORDER.map((s) => (
            <FilterPill
              key={s}
              active={stageList.includes(s)}
              onClick={() => toggle("stage", s, stageList)}
            >
              {STAGE_LABEL[s]}
            </FilterPill>
          ))}
        </FilterGroup>
        <span className="h-4 w-px bg-neutral-200 mx-1" />
        <FilterGroup label="Region">
          {REGIONS.map((r) => (
            <FilterPill
              key={r.value}
              active={regionList.includes(r.value)}
              onClick={() => toggle("region", r.value, regionList)}
            >
              {r.label}
            </FilterPill>
          ))}
        </FilterGroup>
        <span className="h-4 w-px bg-neutral-200 mx-1" />
        <FilterGroup label="Tech">
          <FilterPill
            active={techList.includes("unassigned")}
            onClick={() => toggle("tech", "unassigned", techList)}
          >
            Unassigned
          </FilterPill>
          {techs.map((t) => (
            <FilterPill
              key={t.id}
              active={techList.includes(t.id)}
              onClick={() => toggle("tech", t.id, techList)}
            >
              <TechAvatar tech={t} size="sm" className="mr-1" />
              {t.name.split(" ")[0]}
            </FilterPill>
          ))}
        </FilterGroup>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mr-0.5">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center h-6 px-2 rounded-md text-[11px] font-medium transition-colors",
        active
          ? "bg-neutral-900 text-white hover:bg-neutral-800"
          : "bg-white border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:border-neutral-300",
      )}
    >
      {children}
    </button>
  );
}
