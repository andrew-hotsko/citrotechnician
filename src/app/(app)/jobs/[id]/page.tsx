import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getJobDetail } from "@/lib/job-detail-query";
import { listTechs } from "@/lib/jobs-query";
import { JobDetailContent } from "@/components/job-detail-content";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, job, techs] = await Promise.all([
    getCurrentUser(),
    getJobDetail(id),
    listTechs(),
  ]);

  if (!job) notFound();

  const canEdit =
    user?.role === "ADMIN" || user?.role === "OPS_MANAGER";

  return (
    <div>
      <div className="max-w-5xl mx-auto px-6 pt-4">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-900"
        >
          <ChevronLeft className="h-3 w-3" />
          All jobs
        </Link>
      </div>
      <JobDetailContent
        job={job}
        techs={techs}
        canEdit={canEdit}
        userRole={user?.role}
        layout="page"
      />
    </div>
  );
}
