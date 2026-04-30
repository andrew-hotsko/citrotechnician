import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/prisma";
import { uploadToMediaBucket } from "@/lib/storage";
import { ServiceReport, type ServiceReportInput } from "./service-report";

/**
 * Pull everything the PDF template needs for a given job, then render.
 * Returns the file bytes; caller decides where to store them.
 */
export async function renderServiceReportForJob(
  jobId: string,
): Promise<Buffer> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, deletedAt: null },
    include: {
      property: {
        include: {
          customer: { select: { name: true, email: true, phone: true } },
        },
      },
      completedBy: { select: { name: true } },
      checklistItems: {
        orderBy: { order: "asc" },
        select: { label: true, completed: true },
      },
      photos: { select: { category: true, url: true }, orderBy: { uploadedAt: "asc" } },
    },
  });
  if (!job) throw new Error("Job not found");
  if (!job.completedAt) throw new Error("Job hasn't been completed yet");

  const photosByCategory = {
    BEFORE: [] as string[],
    DURING: [] as string[],
    AFTER: [] as string[],
    ISSUE: [] as string[],
  };
  for (const p of job.photos) {
    photosByCategory[p.category].push(p.url);
  }

  const input: ServiceReportInput = {
    jobNumber: job.jobNumber,
    completedAt: job.completedAt,
    product: job.product,
    contractValue: job.contractValue ? Number(job.contractValue) : null,
    property: {
      name: job.property.name,
      address: job.property.address,
      city: job.property.city,
      state: job.property.state,
      zip: job.property.zip,
    },
    customer: {
      name: job.property.customer.name,
      email: job.property.customer.email,
      phone: job.property.customer.phone,
    },
    technician: job.completedBy ? { name: job.completedBy.name } : null,
    checklist: job.checklistItems.map((c) => ({
      label: c.label,
      completed: c.completed,
    })),
    photos: photosByCategory,
    signatureUrl: job.customerSignature,
    techNotes: job.techNotes,
  };

  const doc = React.createElement(ServiceReport, { data: input });
  // @react-pdf's renderToBuffer types accept DocumentProps, but React.createElement
  // returns a generic ReactElement. Safe cast — the template IS a Document.
  return (await renderToBuffer(
    doc as unknown as Parameters<typeof renderToBuffer>[0],
  )) as Buffer;
}

/**
 * Render, upload to Supabase Storage, and record the ServiceReport row.
 * Idempotent per job: incrementing version, keeps old versions accessible
 * in Storage (at service-reports/{jobId}-v{n}.pdf).
 */
export async function generateServiceReportForJob(jobId: string): Promise<{
  url: string;
  version: number;
}> {
  const buffer = await renderServiceReportForJob(jobId);

  const existing = await prisma.serviceReport.findFirst({
    where: { jobId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (existing?.version ?? 0) + 1;

  const path = `service-reports/${jobId}-v${version}.pdf`;
  const blob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
  const url = await uploadToMediaBucket(path, blob, "application/pdf");

  await prisma.serviceReport.create({
    data: { jobId, pdfUrl: url, version },
  });

  return { url, version };
}
