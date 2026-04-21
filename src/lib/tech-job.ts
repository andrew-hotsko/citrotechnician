import "server-only";
import { notFound, forbidden } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

/**
 * Load a job for the tech flow, with checklist, photos, and assignment.
 * Enforces that the calling user is the assigned tech (admins can view any).
 */
export async function loadTechJob(jobId: string) {
  const user = await requireUser();

  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      property: {
        include: {
          customer: { select: { name: true, phone: true, email: true } },
        },
      },
      assignedTech: {
        select: { id: true, name: true, initials: true, color: true },
      },
      checklistItems: { orderBy: { order: "asc" } },
      photos: { orderBy: { uploadedAt: "asc" } },
      serviceReports: {
        orderBy: { version: "desc" },
        take: 1,
        select: { pdfUrl: true, version: true, generatedAt: true },
      },
    },
  });
  if (!job) notFound();

  if (user.role !== "ADMIN" && job.assignedTechId !== user.id) {
    forbidden();
  }

  return { user, job };
}

export type TechJobDetail = Awaited<ReturnType<typeof loadTechJob>>["job"];
