import Link from "next/link";
import { AlertTriangle, ListChecks, Camera, PenTool, MapPin, Phone, FileText } from "lucide-react";
import { loadTechJob } from "@/lib/tech-job";
import { StepButton } from "@/components/tech/step-button";
import { StageBadge, ProductBadge, RegionBadge } from "@/components/badges";
import { CompleteJobButton } from "./complete-button";

export default async function TechJobBrief({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { job } = await loadTechJob(jobId);

  const doneCount = job.checklistItems.filter((i) => i.completed).length;
  const totalCount = job.checklistItems.length;
  const checklistComplete = totalCount > 0 && doneCount === totalCount;

  const beforePhotos = job.photos.filter((p) => p.category === "BEFORE").length;
  const afterPhotos = job.photos.filter((p) => p.category === "AFTER").length;
  const photosComplete = beforePhotos >= 2 && afterPhotos >= 2;

  const signatureComplete = Boolean(job.customerSignature);

  const canComplete = signatureComplete;
  const alreadyCompleted = job.stage === "COMPLETED";

  const mapUrl = `https://maps.apple.com/?daddr=${encodeURIComponent(
    `${job.property.address}, ${job.property.city}, ${job.property.state} ${job.property.zip ?? ""}`,
  )}`;

  const hasWarning = job.property.accessNotes || job.property.siteNotes;

  return (
    <div className="px-4 py-4 max-w-md mx-auto pb-24">
      {/* Brief card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-mono text-[11px] text-neutral-500">
            {job.jobNumber}
          </span>
          <div className="flex items-center gap-1">
            <RegionBadge region={job.property.region} />
            <ProductBadge product={job.product} />
          </div>
        </div>
        <h1 className="text-[18px] font-semibold tracking-tight">
          {job.property.name}
        </h1>
        <p className="text-[13px] text-neutral-600 mt-0.5">
          {job.property.address}, {job.property.city}, {job.property.state}
        </p>
        <div className="mt-3 flex items-center">
          <StageBadge stage={job.stage} />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <a
            href={mapUrl}
            className="flex items-center justify-center gap-1.5 h-10 rounded-md bg-neutral-900 text-white text-[13px] font-medium active:bg-neutral-800"
          >
            <MapPin className="h-3.5 w-3.5" />
            Directions
          </a>
          {job.property.customer.phone ? (
            <a
              href={`tel:${job.property.customer.phone}`}
              className="flex items-center justify-center gap-1.5 h-10 rounded-md border border-neutral-200 bg-white text-neutral-900 text-[13px] font-medium active:bg-neutral-50"
            >
              <Phone className="h-3.5 w-3.5" />
              Call customer
            </a>
          ) : (
            <div className="flex items-center justify-center h-10 rounded-md border border-neutral-200 bg-neutral-50 text-neutral-400 text-[13px]">
              No phone on file
            </div>
          )}
        </div>
      </div>

      {/* Warning banner */}
      {hasWarning && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-amber-900">
                Read before arriving
              </p>
              {job.property.accessNotes && (
                <p className="text-[12px] text-amber-900 mt-1">
                  <span className="font-medium">Access:</span>{" "}
                  {job.property.accessNotes}
                </p>
              )}
              {job.property.siteNotes && (
                <p className="text-[12px] text-amber-900 mt-1">
                  <span className="font-medium">Site:</span>{" "}
                  {job.property.siteNotes}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step buttons */}
      <div className="mt-4 space-y-2">
        <StepButton
          href={`/tech/${job.id}/checklist`}
          label="Pre-job checklist"
          progress={
            totalCount === 0
              ? "No items"
              : `${doneCount} of ${totalCount} done`
          }
          complete={checklistComplete}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <StepButton
          href={`/tech/${job.id}/photos`}
          label="Photos"
          progress={
            photosComplete
              ? `${beforePhotos} before · ${afterPhotos} after`
              : `${beforePhotos}/2 before · ${afterPhotos}/2 after`
          }
          complete={photosComplete}
          icon={<Camera className="h-5 w-5" />}
        />
        <StepButton
          href={`/tech/${job.id}/signature`}
          label="Customer signature"
          progress={signatureComplete ? "Captured" : "Not captured yet"}
          complete={signatureComplete}
          icon={<PenTool className="h-5 w-5" />}
        />
      </div>

      {/* Complete */}
      <div className="mt-6">
        {alreadyCompleted ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-[13px] font-semibold text-emerald-900">
              Job completed
            </p>
            {job.serviceReports[0] ? (
              <a
                href={job.serviceReports[0].pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 mt-3 h-9 px-3 rounded-md bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-700"
              >
                <FileText className="h-3.5 w-3.5" />
                Download service report
              </a>
            ) : (
              <p className="text-[11px] text-emerald-800 mt-2">
                PDF service report is generating\u2026
              </p>
            )}
            <div className="mt-3">
              <Link
                href="/tech"
                className="text-[12px] text-emerald-800 underline"
              >
                Back to today
              </Link>
            </div>
          </div>
        ) : (
          <CompleteJobButton jobId={job.id} disabled={!canComplete} />
        )}
        {!canComplete && !alreadyCompleted && (
          <p className="text-[11px] text-neutral-500 text-center mt-2">
            Capture customer signature to complete
          </p>
        )}
      </div>
    </div>
  );
}
