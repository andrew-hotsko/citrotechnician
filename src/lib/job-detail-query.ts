import { prisma } from "@/lib/prisma";

export async function getJobDetail(id: string) {
  return prisma.job.findFirst({
    where: { id, deletedAt: null },
    include: {
      property: {
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      },
      assignedTech: {
        select: { id: true, name: true, initials: true, color: true },
      },
      completedBy: {
        select: { id: true, name: true, initials: true, color: true },
      },
      checklistItems: { orderBy: { order: "asc" } },
      photos: { orderBy: { uploadedAt: "desc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          user: { select: { id: true, name: true, initials: true, color: true } },
        },
      },
      parentJob: {
        select: { id: true, jobNumber: true, completedAt: true, stage: true },
      },
      childJobs: {
        select: {
          id: true,
          jobNumber: true,
          dueDate: true,
          stage: true,
          scheduledDate: true,
        },
        orderBy: { dueDate: "asc" },
      },
      communications: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { name: true, initials: true, color: true } },
        },
      },
      serviceReports: {
        orderBy: { version: "desc" },
        select: { id: true, pdfUrl: true, version: true, generatedAt: true },
      },
    },
  });
}

export type JobDetail = NonNullable<
  Awaited<ReturnType<typeof getJobDetail>>
>;
