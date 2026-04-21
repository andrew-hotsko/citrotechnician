"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TechAvatar } from "@/components/tech-avatar";
import { updateJobAssignment } from "@/app/actions/jobs";
import { cn } from "@/lib/utils";

type Tech = {
  id: string;
  name: string;
  initials: string | null;
  color: string | null;
};

export function JobTechSelect({
  jobId,
  current,
  techs,
  disabled = false,
}: {
  jobId: string;
  current: Tech | null;
  techs: Tech[];
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();

  function select(techId: string | null) {
    start(async () => {
      try {
        await updateJobAssignment(jobId, techId);
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Failed to assign");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 bg-white transition-opacity",
          (disabled || pending) && "opacity-60 cursor-not-allowed",
          !disabled && !pending && "hover:border-neutral-300",
        )}
      >
        <TechAvatar tech={current} size="sm" />
        <span>{current?.name ?? "Unassigned"}</span>
        {!disabled && <ChevronDown className="h-3 w-3 opacity-60" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        <DropdownMenuItem
          onClick={() => select(null)}
          className="text-[12px] gap-2"
        >
          <TechAvatar tech={null} size="sm" />
          Unassigned
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {techs.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => select(t.id)}
            className="text-[12px] gap-2"
          >
            <TechAvatar tech={t} size="sm" />
            {t.name}
            {t.id === current?.id && (
              <span className="ml-auto text-[10px] text-neutral-400">
                current
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
