/**
 * One-shot: wipe all customer/property/job data + import rows from a master
 * template xlsx. Preserves Users + ChecklistTemplates + SalesforceSync history.
 *
 * Run:
 *   npx tsx scripts/import/wipe-and-import-master.ts \
 *     "C:/Users/Andre/Downloads/CitroTechnician-Master-Template (2).xlsx"
 *
 * Reads each row, defaults blank Product to SYSTEM (per ops decision),
 * routes Install Date and Last service date through the same parsing rules
 * the /settings/import flow uses, geocodes the address, and creates
 * Customer + Property + Job rows in one transaction per row.
 *
 * REQUIRES: GOOGLE_MAPS_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) in
 * .env.local — geocoding hits Google's API once per row.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  parseDate,
  parseMoney,
  parseProduct,
  parseRegion,
  inferRegionFromZip,
} from "../../src/lib/csv-import";
import { maintenanceReminderScheduleFor } from "../../src/lib/reminder-schedule";

// Geocoder — Nominatim (OpenStreetMap), no key required.
// We use OSM here because the user's Google Maps key is referer-restricted
// (browser-only) and server-side calls get 403'd. Nominatim's usage policy
// is 1 req/sec max with a clear User-Agent identifying the application.
//
// For the live /settings/import path the server uses src/lib/geocode.ts
// (Google) with whatever server-side key is set in production env.

type Geocoded = { latitude: number; longitude: number; formattedAddress: string };
type GeocodeResult = { ok: true; value: Geocoded } | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NOMINATIM_HEADERS = {
  "User-Agent":
    "CitroTechnician master-import script (https://github.com/andrew-hotsko/citrotechnician)",
  "Accept-Language": "en",
};

async function nominatimQuery(
  params: Record<string, string>,
): Promise<GeocodeResult> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: NOMINATIM_HEADERS,
    });
    if (!res.ok) return { ok: false, error: `Nominatim HTTP ${res.status}` };
    const json = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!json.length) return { ok: false, error: "no results" };
    const top = json[0];
    return {
      ok: true,
      value: {
        latitude: Number(top.lat),
        longitude: Number(top.lon),
        formattedAddress: top.display_name,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "geocode fetch failed",
    };
  }
}

async function geocodeAddressNominatim(
  street: string,
  city: string,
  state: string,
  zip?: string,
): Promise<GeocodeResult> {
  // Pass 1: structured search (street/city/state/zip).
  const structured: Record<string, string> = { street };
  if (city)  structured.city = city;
  if (state) structured.state = state;
  if (zip)   structured.postalcode = zip;
  let r = await nominatimQuery(structured);
  if (r.ok) return r;

  // Pass 2: free-form q with full address joined.
  await sleep(1100);
  const q = [street, city, state, zip].filter(Boolean).join(", ");
  r = await nominatimQuery({ q });
  if (r.ok) return r;

  // Pass 3: free-form, drop the street number (helps with rural roads
  // that OSM has on the road but not at the exact address).
  await sleep(1100);
  const streetNoNum = street.replace(/^\d+\s*/, "");
  if (streetNoNum && streetNoNum !== street) {
    const q3 = [streetNoNum, city, state].filter(Boolean).join(", ");
    r = await nominatimQuery({ q: q3 });
    if (r.ok) return { ok: true, value: { ...r.value, formattedAddress: r.value.formattedAddress + " (street-only)" } };
  }

  // Pass 4: city + state + zip centroid. Imprecise but ALWAYS lands the
  // property somewhere reasonable so the row imports. The team can drag the
  // pin to the right spot via the property edit dialog.
  await sleep(1100);
  const cityParams: Record<string, string> = {};
  if (city)  cityParams.city = city;
  if (state) cityParams.state = state;
  if (zip)   cityParams.postalcode = zip;
  if (Object.keys(cityParams).length) {
    r = await nominatimQuery(cityParams);
    if (r.ok) return { ok: true, value: { ...r.value, formattedAddress: r.value.formattedAddress + " (city centroid - REVIEW)" } };
  }

  // Pass 5: zip-only centroid. Catches rows where the city/state combo is
  // wrong (e.g. "Incline Village, CA" — that town is in NV) but the ZIP
  // is right. Last-ditch before bailing.
  if (zip) {
    await sleep(1100);
    r = await nominatimQuery({ postalcode: zip });
    if (r.ok) return { ok: true, value: { ...r.value, formattedAddress: r.value.formattedAddress + " (ZIP centroid - REVIEW)" } };
  }

  return { ok: false, error: "no results (5 fallback queries)" };
}

async function geocodeBatch(
  addresses: { key: string; street: string; city: string; state: string; zip?: string }[],
): Promise<Record<string, GeocodeResult>> {
  const results: Record<string, GeocodeResult> = {};
  // Sequential + 1100ms delay per Nominatim usage policy.
  for (const a of addresses) {
    results[a.key] = await geocodeAddressNominatim(a.street, a.city, a.state, a.zip);
    await sleep(1100);
  }
  return results;
}

// ---------------------------------------------------------------------------
// DB connection — same pattern as prisma/seed.ts.

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set in .env.local");
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ---------------------------------------------------------------------------
// Read the xlsx into typed rows.

type RawRow = {
  rowNumber: number;
  customerName: string;
  propertyName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  product: "SYSTEM" | "SPRAY";
  contractValue: number | null;
  installDate: Date | null;
  lastServiceDate: Date | null;
  intervalMonths: number;
  customerEmail: string | null;
  customerPhone: string | null;
  region: "NORCAL" | "SOCAL" | "OTHER";
  cycleIndex: number;
  cyclesPlanned: number;
  officeNotes: string | null;
};

function cellToString(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && "richText" in v) {
    return (v.richText as { text: string }[]).map((r) => r.text).join("").trim();
  }
  if (typeof v === "object" && "text" in v) {
    return String((v as { text: unknown }).text ?? "").trim();
  }
  if (typeof v === "object" && "result" in v) {
    return cellToString((v as { result: ExcelJS.CellValue }).result);
  }
  return String(v).trim();
}

function cellToDate(v: ExcelJS.CellValue): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "object" && "result" in v) {
    return cellToDate((v as { result: ExcelJS.CellValue }).result);
  }
  return parseDate(cellToString(v));
}

async function readRows(xlsxPath: string): Promise<RawRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet("Data");
  if (!ws) throw new Error('Workbook has no "Data" sheet');

  // Build header → column index map.
  const headerRow = ws.getRow(1);
  const colByHeader = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const label = cellToString(cell.value).replace(/\s*\*\s*$/, "").toLowerCase().trim();
    colByHeader.set(label, colNumber);
  });

  function colOf(...candidates: string[]): number | undefined {
    for (const c of candidates) {
      const idx = colByHeader.get(c.toLowerCase());
      if (idx) return idx;
    }
    return undefined;
  }

  const COL = {
    customer:        colOf("customer"),
    property:        colOf("property"),
    address:         colOf("address"),
    city:            colOf("city"),
    state:           colOf("state"),
    zip:             colOf("zip"),
    installDate:     colOf("install date"),
    product:         colOf("product"),
    contractValue:   colOf("contract value"),
    lastServiceDate: colOf("last service date"),
    intervalMonths:  colOf("interval (months)", "interval"),
    customerEmail:   colOf("customer email", "email"),
    customerPhone:   colOf("customer phone", "phone"),
    region:          colOf("region"),
    cycleIndex:      colOf("cycle index"),
    cyclesPlanned:   colOf("cycles planned"),
    officeNotes:     colOf("office notes", "notes"),
  };

  for (const [k, v] of Object.entries(COL)) {
    if (!v && k !== "installDate" && k !== "contractValue" && k !== "officeNotes" && k !== "customerEmail" && k !== "customerPhone" && k !== "region") {
      // Required columns missing.
      console.warn(`  ! Column not found: ${k}`);
    }
  }

  const rows: RawRow[] = [];
  const rowCount = ws.actualRowCount;
  for (let r = 2; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const customer = cellToString(row.getCell(COL.customer ?? 1).value);
    if (!customer) continue;

    const addressRaw = cellToString(row.getCell(COL.address ?? 3).value);
    const cityRaw    = cellToString(row.getCell(COL.city    ?? 4).value);
    if (!addressRaw && !cityRaw) continue;

    const productStr = cellToString(row.getCell(COL.product ?? 0).value);
    const product = productStr ? (parseProduct(productStr) ?? "SYSTEM") : "SYSTEM";

    const stateRaw = cellToString(row.getCell(COL.state ?? 0).value).toUpperCase();
    const state    = stateRaw || "CA";

    const zip = cellToString(row.getCell(COL.zip ?? 0).value);

    const installDate     = COL.installDate     ? cellToDate(row.getCell(COL.installDate).value)     : null;
    const lastServiceDate = COL.lastServiceDate ? cellToDate(row.getCell(COL.lastServiceDate).value) : null;

    const contractStr = COL.contractValue ? cellToString(row.getCell(COL.contractValue).value) : "";
    const contractValue = contractStr ? parseMoney(contractStr) : null;

    const intervalStr = COL.intervalMonths ? cellToString(row.getCell(COL.intervalMonths).value) : "";
    const intervalMonths = intervalStr ? Math.max(1, parseInt(intervalStr, 10) || 12) : 12;

    const regionStr = COL.region ? cellToString(row.getCell(COL.region).value) : "";
    const parsedRegion = regionStr ? parseRegion(regionStr) : null;
    const region: "NORCAL" | "SOCAL" | "OTHER" =
      parsedRegion ??
      (state === "CA" ? (inferRegionFromZip(zip) ?? "OTHER") : "OTHER");

    const cycleStr = COL.cycleIndex ? cellToString(row.getCell(COL.cycleIndex).value) : "";
    const cycleIndex = Math.max(0, parseInt(cycleStr, 10) || 0);

    const plannedStr = COL.cyclesPlanned ? cellToString(row.getCell(COL.cyclesPlanned).value) : "";
    const cyclesPlanned = Math.max(cycleIndex, parseInt(plannedStr, 10) || 2);

    const email = COL.customerEmail ? cellToString(row.getCell(COL.customerEmail).value) : "";
    const phone = COL.customerPhone ? cellToString(row.getCell(COL.customerPhone).value) : "";
    const notes = COL.officeNotes ? cellToString(row.getCell(COL.officeNotes).value) : "";

    rows.push({
      rowNumber: r,
      customerName: customer,
      propertyName: cellToString(row.getCell(COL.property ?? 2).value) || addressRaw,
      address: addressRaw,
      city: cityRaw,
      state,
      zip,
      product,
      contractValue: contractValue ?? null,
      installDate,
      lastServiceDate,
      intervalMonths,
      customerEmail: email || null,
      customerPhone: phone || null,
      region,
      cycleIndex,
      cyclesPlanned,
      officeNotes: notes || null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Wipe.

async function wipe(): Promise<void> {
  console.log("\n[wipe] Removing all customer / property / job data...");
  await prisma.$transaction(
    async (tx) => {
      // Break Job self-references so deleteMany works in any order.
      await tx.job.updateMany({ data: { parentJobId: null } });
      // Non-cascading FKs we have to clear by hand.
      await tx.document.deleteMany({});
      await tx.serviceReport.deleteMany({});
      await tx.activityLog.deleteMany({});
      await tx.task.deleteMany({});
      // Job → cascades ChecklistItem, Photo, MaintenanceReminder, CommunicationLog.
      const jobsDeleted = await tx.job.deleteMany({});
      const propsDeleted = await tx.property.deleteMany({});
      const custsDeleted = await tx.customer.deleteMany({});
      console.log(
        `  jobs=${jobsDeleted.count}  properties=${propsDeleted.count}  customers=${custsDeleted.count}`,
      );
    },
    { timeout: 60_000 },
  );
}

// ---------------------------------------------------------------------------
// Insert.

async function nextJobNumber(): Promise<string> {
  const latest = await prisma.job.findFirst({
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });
  const match = latest?.jobNumber.match(/^CT-(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `CT-${String(next).padStart(4, "0")}`;
}

async function importRows(rows: RawRow[]): Promise<void> {
  console.log(`\n[geocode] Geocoding ${rows.length} addresses...`);
  const geo = await geocodeBatch(
    rows.map((r) => ({
      key: String(r.rowNumber),
      street: r.address,
      city: r.city,
      state: r.state,
      zip: r.zip || undefined,
    })),
  );

  console.log(`\n[insert] Creating rows...`);
  let created = 0;
  let skipped = 0;
  const errors: { rowNumber: number; reason: string }[] = [];

  for (const r of rows) {
    const g = geo[String(r.rowNumber)];
    if (!g || !g.ok) {
      const reason = g && !g.ok ? g.error : "no geocode result";
      errors.push({ rowNumber: r.rowNumber, reason: `geocode failed: ${reason}` });
      skipped++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.upsert({
          where: { salesforceId: `import:${r.customerName}` },
          update: {
            email: r.customerEmail ?? undefined,
            phone: r.customerPhone ?? undefined,
          },
          create: {
            salesforceId: `import:${r.customerName}`,
            name: r.customerName,
            email: r.customerEmail ?? undefined,
            phone: r.customerPhone ?? undefined,
          },
        });

        const property = await tx.property.create({
          data: {
            customerId: customer.id,
            name: r.propertyName,
            address: r.address,
            city: r.city,
            state: r.state,
            zip: r.zip || undefined,
            latitude: g.value.latitude,
            longitude: g.value.longitude,
            region: r.region,
          },
        });

        // For cycle-0 rows where Last service date is blank but Install date
        // is filled, treat the install date as the effective lastServiceDate.
        const effectiveLast =
          r.lastServiceDate ??
          (r.cycleIndex === 0 ? r.installDate : null);

        const interval = r.intervalMonths;
        const dueDate = effectiveLast
          ? (() => {
              const d = new Date(effectiveLast);
              d.setMonth(d.getMonth() + interval);
              return d;
            })()
          : (() => {
              const d = new Date();
              d.setDate(d.getDate() + 90);
              return d;
            })();

        const tpl = await tx.checklistTemplate.findUnique({
          where: { product: r.product },
          include: { items: { orderBy: { order: "asc" } } },
        });

        const jobNumber = await nextJobNumber();

        const job = await tx.job.create({
          data: {
            jobNumber,
            propertyId: property.id,
            stage: dueDate < new Date() ? "OUTREACH" : "UPCOMING",
            type: r.cycleIndex === 0 ? "INITIAL_APPLICATION" : "MAINTENANCE",
            product: r.product,
            contractValue: r.contractValue ?? undefined,
            lastServiceDate: effectiveLast ?? undefined,
            dueDate,
            maintenanceIntervalMonths: interval,
            cycleIndex: r.cycleIndex,
            cyclesPlanned: r.cyclesPlanned,
            officeNotes: r.officeNotes ?? undefined,
            checklistItems: tpl
              ? { create: tpl.items.map((i) => ({ label: i.label, order: i.order })) }
              : undefined,
          },
        });

        await tx.maintenanceReminder.createMany({
          data: maintenanceReminderScheduleFor(job.id, dueDate),
        });
      });
      created++;
    } catch (err) {
      errors.push({
        rowNumber: r.rowNumber,
        reason: err instanceof Error ? err.message : "unknown insert error",
      });
      skipped++;
    }
  }

  console.log(`\n[done] created=${created}  skipped=${skipped}`);
  if (errors.length) {
    console.log("\n[errors]");
    for (const e of errors) {
      console.log(`  row ${e.rowNumber}: ${e.reason}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main.

(async () => {
  const xlsxPath = process.argv[2];
  if (!xlsxPath) {
    console.error(
      'Usage: npx tsx scripts/import/wipe-and-import-master.ts "<xlsx-path>"',
    );
    process.exit(1);
  }
  const abs = path.resolve(xlsxPath);
  console.log(`[read] ${abs}`);
  const rows = await readRows(abs);
  console.log(`  parsed ${rows.length} data rows`);

  await wipe();
  await importRows(rows);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
