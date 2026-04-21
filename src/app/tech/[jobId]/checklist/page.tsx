import { loadTechJob } from "@/lib/tech-job";
import { ChecklistClient } from "./checklist-client";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { job } = await loadTechJob(jobId);

  return (
    <div className="px-4 py-4 max-w-md mx-auto pb-24">
      <h2 className="text-[18px] font-semibold tracking-tight">
        Pre-job checklist
      </h2>
      <p className="text-[12px] text-neutral-500 mt-0.5">
        {job.property.name} · {job.jobNumber}
      </p>

      {job.checklistItems.length === 0 ? (
        <p className="mt-8 text-[13px] text-neutral-500">
          No checklist items configured for this product.
        </p>
      ) : (
        <ChecklistClient
          items={job.checklistItems.map((i) => ({
            id: i.id,
            label: i.label,
            completed: i.completed,
          }))}
          locked={job.stage === "COMPLETED"}
        />
      )}
    </div>
  );
}
