"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { TechAvatar } from "@/components/tech-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  updateUserRole,
  setUserActive,
  updateTechDisplay,
} from "@/app/actions/team";
import type { Role } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  initials: string | null;
  color: string | null;
  createdAt: Date;
  supabaseUserId: string | null;
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  OPS_MANAGER: "Ops Manager",
  TECH: "Tech",
  VIEWER: "Viewer",
};

const ROLE_HINT: Record<Role, string> = {
  ADMIN: "Full access \u2014 team, settings, everything",
  OPS_MANAGER: "Runs the pipeline, schedules techs, imports data",
  TECH: "Field use only \u2014 mobile flow, today's jobs",
  VIEWER: "Read-only across the office side",
};

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
  "#6366f1", "#f97316", "#14b8a6", "#a855f7",
];

export function TeamList({
  users,
  currentUserId,
}: {
  users: Member[];
  currentUserId: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="grid grid-cols-[1.2fr_1fr_auto_auto] items-center gap-3 px-4 py-2 border-b border-neutral-100 bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
        <div>Member</div>
        <div>Role</div>
        <div>Status</div>
        <div className="sr-only">Actions</div>
      </div>

      <ul className="divide-y divide-neutral-100">
        {users.map((u) => (
          <MemberRow
            key={u.id}
            member={u}
            isSelf={u.id === currentUserId}
          />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [optimistic, apply] = useOptimistic<Member, Partial<Member>>(
    member,
    (state, patch) => ({ ...state, ...patch }),
  );
  const [pending, start] = useTransition();

  function changeRole(nextRole: Role) {
    if (nextRole === optimistic.role) return;
    start(async () => {
      apply({ role: nextRole });
      try {
        await updateUserRole(member.id, nextRole);
        toast.success(`${member.name} \u2192 ${ROLE_LABEL[nextRole]}`);
      } catch (err) {
        apply({ role: member.role });
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function toggleActive() {
    const nextActive = !optimistic.active;
    start(async () => {
      apply({ active: nextActive });
      try {
        await setUserActive(member.id, nextActive);
        toast.success(nextActive ? "Activated" : "Deactivated");
      } catch (err) {
        apply({ active: member.active });
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function commitDisplay(patch: { initials?: string; color?: string }) {
    start(async () => {
      apply(patch as Partial<Member>);
      try {
        await updateTechDisplay(member.id, patch);
      } catch (err) {
        apply({
          initials: member.initials,
          color: member.color,
        });
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const unlinked = !optimistic.supabaseUserId;
  const isTech = optimistic.role === "TECH" || optimistic.role === "ADMIN";

  return (
    <li className="grid grid-cols-[1.2fr_1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50/60">
      {/* Member */}
      <div className="flex items-center gap-3 min-w-0">
        <TechAvatar
          tech={{
            name: optimistic.name,
            initials: optimistic.initials,
            color: optimistic.color,
          }}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "text-[13px] font-medium truncate",
                !optimistic.active && "text-neutral-400",
              )}
            >
              {optimistic.name}
            </div>
            {isSelf && (
              <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-400">
                You
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500 truncate">
            {optimistic.email}
          </div>
        </div>
      </div>

      {/* Role */}
      <div>
        <RolePicker
          value={optimistic.role}
          onChange={changeRole}
          disabled={pending || !optimistic.active}
        />
      </div>

      {/* Status */}
      <div>
        {unlinked ? (
          <span className="inline-flex items-center h-6 rounded-md bg-neutral-100 px-2 text-[10px] font-medium text-neutral-500">
            Unlinked
          </span>
        ) : optimistic.active ? (
          <span className="inline-flex items-center h-6 rounded-md bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center h-6 rounded-md bg-neutral-100 px-2 text-[10px] font-medium text-neutral-500">
            Inactive
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {isTech && (
          <ColorEditor
            currentColor={optimistic.color}
            currentInitials={optimistic.initials}
            name={optimistic.name}
            disabled={pending}
            onChange={commitDisplay}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending || isSelf}
            className={cn(
              "inline-flex items-center h-8 w-8 justify-center rounded-md text-neutral-500 transition-colors",
              pending || isSelf
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-neutral-100 hover:text-neutral-900",
            )}
            aria-label="More actions"
            title={isSelf ? "Can't modify your own status" : undefined}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" aria-hidden>
                <circle cx="3" cy="8" r="1.4" fill="currentColor" />
                <circle cx="8" cy="8" r="1.4" fill="currentColor" />
                <circle cx="13" cy="8" r="1.4" fill="currentColor" />
              </svg>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
              Status
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={toggleActive}>
              {optimistic.active ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
              Joined
            </DropdownMenuLabel>
            <DropdownMenuItem disabled className="text-[11px] text-neutral-500">
              {formatDistanceToNow(new Date(optimistic.createdAt), {
                addSuffix: true,
              })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (next: Role) => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-neutral-200 bg-white text-[12px] font-medium transition-colors",
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:border-neutral-300",
        )}
      >
        {ROLE_LABEL[value]}
        <svg className="h-3 w-3 opacity-60" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {(["ADMIN", "OPS_MANAGER", "TECH", "VIEWER"] as Role[]).map((r) => (
          <DropdownMenuItem
            key={r}
            onClick={() => onChange(r)}
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <div className="flex items-center gap-2 w-full">
              <span className="text-[12px] font-medium">{ROLE_LABEL[r]}</span>
              {r === value && (
                <Check className="h-3 w-3 text-emerald-600 ml-auto" />
              )}
            </div>
            <span className="text-[10px] text-neutral-500">
              {ROLE_HINT[r]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColorEditor({
  currentColor,
  currentInitials,
  name,
  disabled,
  onChange,
}: {
  currentColor: string | null;
  currentInitials: string | null;
  name: string;
  disabled: boolean;
  onChange: (patch: { initials?: string; color?: string }) => void;
}) {
  const [initialsDraft, setInitialsDraft] = useState(currentInitials ?? "");
  const [open, setOpen] = useState(false);

  function pickColor(c: string) {
    onChange({ color: c });
  }

  function saveInitials() {
    const trimmed = initialsDraft.trim().toUpperCase();
    if (trimmed === (currentInitials ?? "").toUpperCase()) return;
    onChange({ initials: trimmed });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "inline-flex items-center h-8 w-8 justify-center rounded-md text-neutral-500 transition-colors",
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-neutral-100 hover:text-neutral-900",
        )}
        aria-label={`Edit display for ${name}`}
        title="Avatar color and initials"
      >
        <Palette className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
          Avatar color
        </DropdownMenuLabel>
        <div className="px-2 pb-2 grid grid-cols-6 gap-1.5">
          {PRESET_COLORS.map((c) => {
            const selected = currentColor?.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => pickColor(c)}
                aria-label={`Set color ${c}`}
                className={cn(
                  "h-7 w-7 rounded-full transition-transform hover:scale-110",
                  selected && "ring-2 ring-offset-1 ring-neutral-900",
                )}
                style={{ backgroundColor: c }}
              />
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
          Initials
        </DropdownMenuLabel>
        <div className="px-2 pb-2">
          <input
            type="text"
            maxLength={3}
            value={initialsDraft}
            onChange={(e) => setInitialsDraft(e.target.value.toUpperCase())}
            onBlur={saveInitials}
            placeholder="MR"
            className="w-full h-7 px-2 text-[12px] rounded-md border border-neutral-200 bg-white font-mono uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400"
          />
          <p className="mt-1 text-[10px] text-neutral-500">
            Up to 3 characters. Saves on blur.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
