"use client";

import { useState, useTransition } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTeamMember } from "@/app/actions/team";
import type { Role } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  OPS_MANAGER: "Ops Manager",
  TECH: "Tech",
  VIEWER: "Viewer",
};

const ROLE_HINT: Record<Role, string> = {
  ADMIN: "Full access — team, settings, everything",
  OPS_MANAGER: "Runs the pipeline, schedules techs, imports data",
  TECH: "Field use only — mobile flow, today's jobs",
  VIEWER: "Read-only across the office side",
};

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
  "#6366f1", "#f97316", "#14b8a6", "#a855f7",
];

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("TECH");
  const [color, setColor] = useState<string>("#3b82f6");

  function reset() {
    setName("");
    setEmail("");
    setRole("TECH");
    setColor("#3b82f6");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await createTeamMember({
          name,
          email,
          role,
          color: role === "TECH" ? color : undefined,
        });
        toast.success(`Invited ${name}`, {
          description: `They'll appear as Unlinked until they sign in with ${email}.`,
        });
        reset();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't invite");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) setOpen(v);
      }}
    >
      <DialogTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium transition-all hover:bg-neutral-800 shadow-elev-1">
        <UserPlus className="h-3.5 w-3.5" />
        Invite member
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            They&apos;ll sign in with Google using this email. Once they do,
            they&apos;re linked automatically — no invite email or password to
            reset.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          <Field label="Full name">
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dana Nguyen"
              className="block w-full h-9 px-3 text-[13px] border border-neutral-200 bg-white rounded-md placeholder:text-neutral-400 transition-all focus:outline-none focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/8"
            />
          </Field>

          <Field label="Work email">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dana@citrotech.com"
              className="block w-full h-9 px-3 text-[13px] border border-neutral-200 bg-white rounded-md placeholder:text-neutral-400 transition-all focus:outline-none focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/8"
            />
          </Field>

          <Field label="Role">
            <div className="grid grid-cols-2 gap-1.5">
              {(["TECH", "OPS_MANAGER", "ADMIN", "VIEWER"] as Role[]).map(
                (r) => {
                  const selected = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-all",
                        selected
                          ? "border-neutral-900 bg-neutral-900 text-white shadow-elev-1"
                          : "border-neutral-200 bg-white hover:border-neutral-300",
                      )}
                    >
                      <span className="text-[12px] font-medium">
                        {ROLE_LABEL[r]}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] leading-snug",
                          selected ? "text-white/70" : "text-neutral-500",
                        )}
                      >
                        {ROLE_HINT[r]}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </Field>

          {role === "TECH" && (
            <Field label="Avatar color">
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => {
                  const selected = color.toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
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
            </Field>
          )}

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="inline-flex items-center h-8 px-3 rounded-md border border-neutral-200 bg-white text-[12px] font-medium transition-colors hover:bg-neutral-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim() || !email.trim()}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium transition-all hover:bg-neutral-800 disabled:opacity-60 shadow-elev-1"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Inviting
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  Send invite
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-medium text-neutral-600 mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}
