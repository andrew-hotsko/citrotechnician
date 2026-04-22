"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Loader2 } from "lucide-react";
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
import { logCommunication } from "@/app/actions/communications";
import type {
  CommunicationChannel,
  CommunicationDirection,
} from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const CHANNELS: { value: CommunicationChannel; label: string }[] = [
  { value: "PHONE", label: "Call" },
  { value: "EMAIL", label: "Email" },
  { value: "TEXT", label: "Text" },
  { value: "IN_PERSON", label: "In-person" },
  { value: "OTHER", label: "Other" },
];

const DIRECTIONS: { value: CommunicationDirection; label: string }[] = [
  { value: "OUTBOUND", label: "Outbound (we reached out)" },
  { value: "INBOUND", label: "Inbound (they reached us)" },
];

export function LogCommunicationDialog({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [channel, setChannel] = useState<CommunicationChannel>("PHONE");
  const [direction, setDirection] =
    useState<CommunicationDirection>("OUTBOUND");
  const [summary, setSummary] = useState("");

  function reset() {
    setChannel("PHONE");
    setDirection("OUTBOUND");
    setSummary("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) {
      toast.error("Summary is required");
      return;
    }
    start(async () => {
      try {
        await logCommunication({
          jobId,
          channel,
          direction,
          summary: summary.trim(),
        });
        toast.success("Communication logged");
        reset();
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
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
      <DialogTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50">
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Log call / email
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Log a communication</DialogTitle>
          <DialogDescription>
            Record a call, email, or visit tied to this job. Shows up in the
            job&apos;s comms history and in the activity feed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-neutral-700">
              Channel
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => {
                const selected = channel === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannel(c.value)}
                    className={cn(
                      "h-8 px-3 rounded-md border text-[12px] font-medium transition-all",
                      selected
                        ? "border-neutral-900 bg-neutral-900 text-white shadow-elev-1"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-neutral-700">
              Direction
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DIRECTIONS.map((d) => {
                const selected = direction === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDirection(d.value)}
                    className={cn(
                      "h-9 px-3 rounded-md border text-[12px] font-medium transition-all text-left",
                      selected
                        ? "border-neutral-900 bg-neutral-900 text-white shadow-elev-1"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <div className="text-[11px] font-medium text-neutral-700 mb-1.5">
              What happened?
            </div>
            <textarea
              autoFocus
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Left voicemail for Bob. Mentioned Tuesday window. Asked him to call back."
              className="block w-full px-3 py-2 text-[13px] border border-neutral-200 bg-white rounded-md placeholder:text-neutral-400 transition-all focus:outline-none focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/8 resize-y"
            />
          </label>

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="inline-flex items-center h-9 px-3 rounded-md border border-neutral-200 bg-white text-[13px] font-medium transition-colors hover:bg-neutral-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !summary.trim()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-neutral-900 text-white text-[13px] font-medium transition-all hover:bg-neutral-800 disabled:opacity-60 shadow-elev-1"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Logging
                </>
              ) : (
                "Log it"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
