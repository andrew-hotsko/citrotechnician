import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Round-trippable CSV export of every active job. The column order matches
 * the import template plus a few backup-only columns (cycle position,
 * stage) so re-importing this file would recreate the same job set.
 *
 * Notes that DO NOT round-trip on reimport (this is a backup, not a
 * full DB snapshot — for that, use Supabase's automated backups):
 *   - Office notes, tech notes, deferral reason
 *   - Photos + signatures (stored in Supabase Storage)
 *   - Activity log + communications history
 *   - Service report PDFs
 *   - Tech assignments
 *
 * Auth: ADMIN or OPS_MANAGER only — same gate as the import flow.
 */
function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

const PRODUCT_OUT: Record<string, string> = {
  SYSTEM: "System",
  SPRAY: "Spray",
  MFB_31: "System",
  MFB_34: "System",
  MFB_35_FM: "Spray",
};

const REGION_OUT: Record<string, string> = {
  NORCAL: "NORCAL",
  SOCAL: "SOCAL",
  OTHER: "OTHER",
};

const COLUMNS = [
  "Job number",
  "Customer",
  "Property",
  "Address",
  "City",
  "State",
  "ZIP",
  "Product",
  "Sq ft",
  "Contract value",
  "Last service date",
  "Due date",
  "Interval (months)",
  "Customer email",
  "Customer phone",
  "Region",
  "Cycle index",
  "Cycles planned",
  "Stage",
  "Assigned tech",
] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const jobs = await prisma.job.findMany({
    where: { deletedAt: null },
    include: {
      property: { include: { customer: true } },
      assignedTech: { select: { name: true } },
    },
    orderBy: [{ jobNumber: "asc" }],
  });

  const lines = [COLUMNS.map(csvEscape).join(",")];

  for (const j of jobs) {
    const row = [
      j.jobNumber,
      j.property.customer.name,
      j.property.name,
      j.property.address,
      j.property.city,
      j.property.state,
      j.property.zip ?? "",
      PRODUCT_OUT[j.product] ?? j.product,
      j.sqftTreated,
      j.contractValue ? Number(j.contractValue) : "",
      isoDate(j.lastServiceDate),
      isoDate(j.dueDate),
      j.maintenanceIntervalMonths,
      j.property.customer.email ?? "",
      j.property.customer.phone ?? "",
      REGION_OUT[j.property.region] ?? j.property.region,
      j.cycleIndex,
      j.cyclesPlanned,
      j.stage,
      j.assignedTech?.name ?? "",
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  // BOM so Excel reads UTF-8 correctly
  const csv = "\uFEFF" + lines.join("\n") + "\n";
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="citrotech-backup-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
