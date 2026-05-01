import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Headers match the master-template shape (csv-import.ts FIELD_ORDER, plus
// helper columns the team uses to track the maintenance chain). When the team
// downloads this and re-uploads, the importer ignores helper columns it
// doesn't recognise.
type ColSpec = {
  header: string;
  key: string;
  width: number;
  date?: boolean;
  money?: boolean;
};

const COLUMNS: ColSpec[] = [
  { header: "Customer",            key: "customerName",     width: 28 },
  { header: "Property",            key: "propertyName",     width: 28 },
  { header: "Address",             key: "address",          width: 32 },
  { header: "City",                key: "city",             width: 18 },
  { header: "State",               key: "state",            width: 7  },
  { header: "ZIP",                 key: "zip",              width: 9  },
  { header: "Product",             key: "product",          width: 11 },
  { header: "Contract value",      key: "contractValue",    width: 14, money: true },
  { header: "Install date",        key: "installDate",      width: 13, date: true },
  { header: "Year 1 inspection",   key: "year1Date",        width: 14, date: true },
  { header: "Year 2 inspection",   key: "year2Date",        width: 14, date: true },
  { header: "Year 3 inspection",   key: "year3Date",        width: 14, date: true },
  { header: "Last service date",   key: "lastServiceDate",  width: 14, date: true },
  { header: "Interval (months)",   key: "intervalMonths",   width: 9  },
  { header: "Customer email",      key: "customerEmail",    width: 28 },
  { header: "Customer phone",      key: "customerPhone",    width: 16 },
  { header: "Region",              key: "region",           width: 9  },
  { header: "Cycle index",         key: "cycleIndex",       width: 7  },
  { header: "Cycles planned",      key: "cyclesPlanned",    width: 8  },
  { header: "Annuals remaining",   key: "annualsRemaining", width: 10 },
  { header: "Stage",               key: "stage",            width: 12 },
  { header: "Job number",          key: "jobNumber",        width: 11 },
  { header: "Office notes",        key: "officeNotes",      width: 50 },
];

type ChainJob = {
  cycleIndex: number;
  type: string;
  lastServiceDate: Date | null;
  completedAt: Date | null;
};

/** Pick the date for a given cycleIndex from a property's job chain. */
function dateForCycle(jobs: ChainJob[], cycleIndex: number): Date | null {
  const j = jobs.find((x) => x.cycleIndex === cycleIndex);
  if (!j) return null;
  return j.completedAt ?? j.lastServiceDate ?? null;
}

const REGION_OUT: Record<string, string> = {
  NORCAL: "NORCAL",
  SOCAL: "SOCAL",
  OTHER: "OTHER",
};
const PRODUCT_OUT: Record<string, string> = {
  SYSTEM: "System",
  SPRAY: "Spray",
  MFB_31: "System",
  MFB_34: "System",
  MFB_35_FM: "Spray",
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Pull every active property + its full job chain in one round-trip.
  // We render one row per property, picking the most-recent (latest cycle
  // index) job to surface as "current" + walking the chain for Y1/Y2/Y3.
  const properties = await prisma.property.findMany({
    where: { deletedAt: null },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      jobs: {
        where: { deletedAt: null },
        orderBy: { cycleIndex: "asc" },
        select: {
          cycleIndex: true,
          cyclesPlanned: true,
          type: true,
          stage: true,
          product: true,
          contractValue: true,
          lastServiceDate: true,
          completedAt: true,
          maintenanceIntervalMonths: true,
          jobNumber: true,
          officeNotes: true,
        },
      },
    },
    orderBy: [{ customer: { name: "asc" } }, { name: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "CitroTechnician";
  wb.created = new Date();

  const ws = wb.addWorksheet("Data", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  // Style header row.
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D3557" }, // navy
    };
  });

  for (const p of properties) {
    // The "current" job = highest cycleIndex (or the only job if just one).
    const current = p.jobs.length
      ? p.jobs.reduce((acc, j) => (j.cycleIndex >= acc.cycleIndex ? j : acc))
      : null;

    // Cycle 0 is the install. Surface its date in the Install Date column.
    const installDate = dateForCycle(p.jobs, 0);
    const year1Date   = dateForCycle(p.jobs, 1);
    const year2Date   = dateForCycle(p.jobs, 2);
    const year3Date   = dateForCycle(p.jobs, 3);

    const currentLast =
      current?.completedAt ?? current?.lastServiceDate ?? null;

    const cyclesPlanned = current?.cyclesPlanned ?? 2;
    const cycleIndex    = current?.cycleIndex ?? 0;
    const annualsRemaining = Math.max(0, cyclesPlanned - cycleIndex);

    const row = ws.addRow({
      customerName: p.customer.name,
      propertyName: p.name,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip ?? "",
      product: current ? (PRODUCT_OUT[current.product] ?? current.product) : "",
      contractValue: current?.contractValue ? Number(current.contractValue) : null,
      installDate,
      year1Date,
      year2Date,
      year3Date,
      lastServiceDate: currentLast,
      intervalMonths: current?.maintenanceIntervalMonths ?? 12,
      customerEmail: p.customer.email ?? "",
      customerPhone: p.customer.phone ?? "",
      region: REGION_OUT[p.region] ?? p.region,
      cycleIndex,
      cyclesPlanned,
      annualsRemaining,
      stage: current?.stage ?? "",
      jobNumber: current?.jobNumber ?? "",
      officeNotes: current?.officeNotes ?? "",
    });

    // Apply per-column number formats by walking COLUMNS in order.
    COLUMNS.forEach((spec, idx) => {
      const cell = row.getCell(idx + 1);
      if (spec.date) {
        cell.numFmt = "yyyy-mm-dd";
      } else if (spec.money) {
        cell.numFmt = '"$"#,##0;("$"#,##0);-';
      }
    });
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: Math.max(2, properties.length + 1), column: COLUMNS.length },
  };

  const buf = await wb.xlsx.writeBuffer();
  const ts = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="citrotech-master-${ts}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
