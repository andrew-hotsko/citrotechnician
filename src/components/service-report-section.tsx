"use client";

import { useTransition } from "react";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { regenerateServiceReport } from "@/app/actions/tech";
import { formatDate } from "@/lib/job-helpers";

type Report = {
  id: string;
  pdfUrl: string;
  version: number;
  generatedAt: Date | string;
};

export function ServiceReportSection({
  jobId,
  reports,
  canRegenerate,
  jobCompleted,
}: {
  jobId: string;
  reports: Report[];
  canRegenerate: boolean;
  jobCompleted: boolean;
}) {
  const [pending, start] = useTransition();
  const latest = reports[0];

  function regenerate() {
    start(async () => {
      try {
        const result = await regenerateServiceReport(jobId);
        if (result.ok) {
          toast.success(`Regenerated service report (v${result.version})`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to regenerate");
      }
    });
  }

  if (!jobCompleted) return null;

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[13px] font-semibold tracking-tight">
          Service report
        </h2>
        {latest && (
          <span className="text-[11px] text-neutral-500">
            v{latest.version} · generated {formatDate(latest.generatedAt)}
          </span>
        )}
      </div>

      {latest ? (
        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <div className="h-8 w-8 rounded-md bg-neutral-100 grid place-items-center shrink-0">
            <FileText className="h-4 w-4 text-neutral-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">
              Service report v{latest.version}
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              Generated {formatDate(latest.generatedAt)} · branded PDF
            </div>
          </div>
          <a
            href={latest.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium hover:bg-neutral-800"
          >
            Open PDF
          </a>
          {canRegenerate && (
            <button
              type="button"
              onClick={regenerate}
              disabled={pending}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 hover:border-neutral-300 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Re-render the PDF with current data"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Regenerate
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3">
          <div className="h-8 w-8 rounded-md bg-amber-100 grid place-items-center shrink-0">
            <FileText className="h-4 w-4 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-amber-900">
              No PDF report on file
            </div>
            <div className="text-[11px] text-amber-800 mt-0.5">
              The automatic generation didn&apos;t succeed when this job was
              completed.{" "}
              {canRegenerate
                ? "Click Regenerate to try again now."
                : "Ask an admin to regenerate."}
            </div>
          </div>
          {canRegenerate && (
            <button
              type="button"
              onClick={regenerate}
              disabled={pending}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating…
                </>
              ) : (
                <>Generate now</>
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
