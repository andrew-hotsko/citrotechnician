import { loadTechJob } from "@/lib/tech-job";
import { PhotosClient } from "./photos-client";

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { job } = await loadTechJob(jobId);

  const photosByCategory = {
    BEFORE: job.photos.filter((p) => p.category === "BEFORE"),
    DURING: job.photos.filter((p) => p.category === "DURING"),
    AFTER: job.photos.filter((p) => p.category === "AFTER"),
    ISSUE: job.photos.filter((p) => p.category === "ISSUE"),
  };

  return (
    <div className="px-4 py-4 max-w-md mx-auto pb-24">
      <h2 className="text-[18px] font-semibold tracking-tight">Photos</h2>
      <p className="text-[12px] text-neutral-500 mt-0.5">
        {job.property.name} · {job.jobNumber}
      </p>

      <PhotosClient
        jobId={job.id}
        photos={{
          BEFORE: photosByCategory.BEFORE.map((p) => ({ id: p.id, url: p.url })),
          DURING: photosByCategory.DURING.map((p) => ({ id: p.id, url: p.url })),
          AFTER: photosByCategory.AFTER.map((p) => ({ id: p.id, url: p.url })),
          ISSUE: photosByCategory.ISSUE.map((p) => ({ id: p.id, url: p.url })),
        }}
        locked={job.stage === "COMPLETED"}
      />
    </div>
  );
}
