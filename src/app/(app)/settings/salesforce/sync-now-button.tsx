"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { manualSync } from "@/app/actions/salesforce";

export function SyncNowButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function go() {
    start(async () => {
      try {
        const r = await manualSync();
        if (r.status === "FAILED") {
          toast.error("Sync failed", {
            description: r.errors[0]?.reason ?? "See history below.",
          });
        } else if (r.status === "PARTIAL") {
          toast.warning(
            `Synced with ${r.errors.length} row error${r.errors.length === 1 ? "" : "s"}`,
            {
              description: `${r.jobsCreated} job${r.jobsCreated === 1 ? "" : "s"}, ${r.customersCreated} new customer${r.customersCreated === 1 ? "" : "s"}.`,
            },
          );
        } else {
          toast.success("Sync complete", {
            description:
              r.opportunitiesSeen === 0
                ? "No new closed-won opportunities since last sync."
                : `${r.jobsCreated} job${r.jobsCreated === 1 ? "" : "s"}, ${r.customersCreated} new customer${r.customersCreated === 1 ? "" : "s"}.`,
          });
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium transition-all hover:bg-neutral-800 shadow-elev-1 disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Syncing
        </>
      ) : (
        <>
          <RefreshCcw className="h-3.5 w-3.5" />
          Sync now
        </>
      )}
    </button>
  );
}
