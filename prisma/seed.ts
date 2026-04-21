import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------- Techs -----------------------------------------------------------

const techs = [
  { email: "mike.rivera@citrotech.com", name: "Mike Rivera", initials: "MR", color: "#3b82f6" },
  { email: "carlos.mendoza@citrotech.com", name: "Carlos Mendoza", initials: "CM", color: "#8b5cf6" },
  { email: "dave.thompson@citrotech.com", name: "Dave Thompson", initials: "DT", color: "#10b981" },
] as const;

// ---------- Checklist templates --------------------------------------------

const templates = {
  MFB_31: {
    name: "MFB-31 Standard Application",
    items: [
      "Confirm property boundaries and access",
      "Check weather and wind conditions",
      "Inspect equipment and PPE",
      "Mix product to spec (MFB-31)",
      "Document untreated baseline photos",
      "Apply to designated perimeter zones",
      "Inspect coverage and touch up gaps",
      "Document post-application photos",
      "Customer walk-through and signature",
    ],
  },
  MFB_34: {
    name: "MFB-34 Standard Application",
    items: [
      "Confirm property boundaries and access",
      "Check weather and wind conditions",
      "Inspect equipment and PPE",
      "Mix product to spec (MFB-34)",
      "Document untreated baseline photos",
      "Apply to structure and vegetation interface",
      "Apply to outbuildings and secondary structures",
      "Inspect coverage and touch up gaps",
      "Document post-application photos",
      "Customer walk-through and signature",
    ],
  },
  MFB_35_FM: {
    name: "MFB-35-FM Commercial Application",
    items: [
      "Confirm property boundaries and access",
      "Check weather and wind conditions",
      "Inspect equipment and PPE",
      "Mix product to spec (MFB-35-FM)",
      "Document untreated baseline photos",
      "Apply to primary perimeter zones",
      "Apply to defensible space buffer",
      "Apply to any outbuildings in scope",
      "Inspect coverage and touch up gaps",
      "Document post-application photos",
      "Customer walk-through and signature",
      "Submit fire-marshal documentation packet",
    ],
  },
} as const;

// ---------- Seed jobs -------------------------------------------------------

type Stage = "UPCOMING" | "OUTREACH" | "CONFIRMED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "DEFERRED";
type Prod = "MFB_31" | "MFB_34" | "MFB_35_FM";

type JobSeed = {
  seedKey: string;
  customer: string;
  property: string;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  region: "NORCAL" | "SOCAL";
  sqft: number;
  product: Prod;
  stage: Stage;
  type?: "INITIAL_APPLICATION" | "MAINTENANCE" | "ONE_OFF";
  assignTo?: string;
  contractValue: number;
  dueInDays: number;
  lastServiceDaysAgo?: number;
  intervalMonths?: number;
};

const JOBS: JobSeed[] = [
  // ---- NorCal ----
  {
    seedKey: "01", customer: "Redwood Estates HOA", property: "Redwood Estates HOA",
    address: "4100 Oak Hollow Dr", city: "Folsom", zip: "95630",
    lat: 38.6789, lng: -121.1764, region: "NORCAL",
    sqft: 24000, product: "MFB_34", stage: "SCHEDULED",
    assignTo: "mike.rivera@citrotech.com", contractValue: 18200, dueInDays: 18,
    lastServiceDaysAgo: 340, intervalMonths: 12,
  },
  {
    seedKey: "02", customer: "Granite Bay Vineyard LLC", property: "Granite Bay Vineyard",
    address: "8920 Douglas Blvd", city: "Granite Bay", zip: "95746",
    lat: 38.7635, lng: -121.1644, region: "NORCAL",
    sqft: 42000, product: "MFB_35_FM", stage: "OUTREACH",
    contractValue: 34500, dueInDays: 42,
    lastServiceDaysAgo: 318, intervalMonths: 12,
  },
  {
    seedKey: "03", customer: "Sierra Ridge Owner", property: "Sierra Ridge Residential",
    address: "2510 Mother Lode Dr", city: "Placerville", zip: "95667",
    lat: 38.7296, lng: -120.7985, region: "NORCAL",
    sqft: 9800, product: "MFB_31", stage: "CONFIRMED",
    assignTo: "carlos.mendoza@citrotech.com", contractValue: 8900, dueInDays: 12,
    lastServiceDaysAgo: 353, intervalMonths: 12,
  },
  {
    seedKey: "04", customer: "Oak Valley Partners", property: "Oak Valley Ranch",
    address: "14220 Lincoln Way", city: "Auburn", zip: "95603",
    lat: 38.8958, lng: -121.0813, region: "NORCAL",
    sqft: 31000, product: "MFB_34", stage: "UPCOMING",
    contractValue: 22400, dueInDays: 75,
    lastServiceDaysAgo: 290, intervalMonths: 12,
  },
  {
    seedKey: "05", customer: "Paradise Pines Community", property: "Paradise Pines Community",
    address: "5900 Pentz Rd", city: "Paradise", zip: "95969",
    lat: 39.7596, lng: -121.6219, region: "NORCAL",
    sqft: 58000, product: "MFB_35_FM", stage: "COMPLETED",
    assignTo: "dave.thompson@citrotech.com", contractValue: 41200,
    dueInDays: 365 - 42, lastServiceDaysAgo: 42, intervalMonths: 12,
  },
  {
    seedKey: "06", customer: "Tahoe Woodland HOA", property: "Tahoe Woodland Estates",
    address: "3200 Pinnacle Dr", city: "South Lake Tahoe", zip: "96150",
    lat: 38.9399, lng: -119.9772, region: "NORCAL",
    sqft: 36500, product: "MFB_34", stage: "SCHEDULED",
    assignTo: "mike.rivera@citrotech.com", contractValue: 27800, dueInDays: 5,
    lastServiceDaysAgo: 360, intervalMonths: 12,
  },
  {
    seedKey: "07", customer: "Napa Valley Winery Estate", property: "Napa Valley Winery",
    address: "1201 Silverado Trail", city: "Napa", zip: "94558",
    lat: 38.3047, lng: -122.2855, region: "NORCAL",
    sqft: 48000, product: "MFB_35_FM", stage: "DEFERRED",
    contractValue: 38600, dueInDays: -14,
    lastServiceDaysAgo: 379, intervalMonths: 12,
  },
  {
    seedKey: "08", customer: "Alamo Hills Owner", property: "Alamo Hills Residence",
    address: "2150 Ramona Rd", city: "Alamo", zip: "94507",
    lat: 37.8543, lng: -121.9905, region: "NORCAL",
    sqft: 7600, product: "MFB_31", stage: "OUTREACH",
    contractValue: 7400, dueInDays: 38,
    lastServiceDaysAgo: 322, intervalMonths: 12,
  },
  {
    seedKey: "09", customer: "Carmel Coast Owner", property: "Carmel Coast Villa",
    address: "26400 Scenic Rd", city: "Carmel-by-the-Sea", zip: "93923",
    lat: 36.5493, lng: -121.9235, region: "NORCAL",
    sqft: 6200, product: "MFB_31", stage: "IN_PROGRESS",
    assignTo: "carlos.mendoza@citrotech.com", contractValue: 6200, dueInDays: 0,
    lastServiceDaysAgo: 365, intervalMonths: 12,
  },
  // ---- SoCal ----
  {
    seedKey: "10", customer: "La Jolla Shores Owner", property: "La Jolla Shores Villa",
    address: "8100 Camino Del Oro", city: "La Jolla", zip: "92037",
    lat: 32.8542, lng: -117.2589, region: "SOCAL",
    sqft: 8900, product: "MFB_31", stage: "CONFIRMED",
    assignTo: "dave.thompson@citrotech.com", contractValue: 9100, dueInDays: 22,
    lastServiceDaysAgo: 343, intervalMonths: 12,
  },
  {
    seedKey: "11", customer: "Oceanside Bluffs HOA", property: "Oceanside Bluffs HOA",
    address: "320 Vista Del Mar Way", city: "Oceanside", zip: "92054",
    lat: 33.1959, lng: -117.3795, region: "SOCAL",
    sqft: 22000, product: "MFB_34", stage: "OUTREACH",
    contractValue: 17600, dueInDays: 51,
    lastServiceDaysAgo: 309, intervalMonths: 12,
  },
  {
    seedKey: "12", customer: "Malibu Canyon Estate Owner", property: "Malibu Canyon Estate",
    address: "24540 Piuma Rd", city: "Malibu", zip: "90265",
    lat: 34.0819, lng: -118.6924, region: "SOCAL",
    sqft: 14500, product: "MFB_34", stage: "UPCOMING",
    contractValue: 13900, dueInDays: 88,
    lastServiceDaysAgo: 277, intervalMonths: 12,
  },
  {
    seedKey: "13", customer: "Pasadena Hillside Owner", property: "Pasadena Hillside Home",
    address: "1180 Rubio Canyon Rd", city: "Altadena", zip: "91001",
    lat: 34.1899, lng: -118.1253, region: "SOCAL",
    sqft: 8200, product: "MFB_31", stage: "SCHEDULED",
    assignTo: "dave.thompson@citrotech.com", contractValue: 8100, dueInDays: 9,
    lastServiceDaysAgo: 356, intervalMonths: 12,
  },
  {
    seedKey: "14", customer: "Rancho Santa Fe Ranch LLC", property: "Rancho Santa Fe Ranch",
    address: "6100 Avenida Cobre", city: "Rancho Santa Fe", zip: "92067",
    lat: 33.0202, lng: -117.2036, region: "SOCAL",
    sqft: 39000, product: "MFB_35_FM", stage: "COMPLETED",
    assignTo: "carlos.mendoza@citrotech.com", contractValue: 31400,
    dueInDays: 365 - 20, lastServiceDaysAgo: 20, intervalMonths: 12,
  },
  {
    seedKey: "15", customer: "Coronado Island Owner", property: "Coronado Island Residence",
    address: "1100 Ocean Blvd", city: "Coronado", zip: "92118",
    lat: 32.6859, lng: -117.1831, region: "SOCAL",
    sqft: 5400, product: "MFB_31", stage: "UPCOMING",
    contractValue: 5800, dueInDays: 120,
    lastServiceDaysAgo: 245, intervalMonths: 12,
  },
  {
    seedKey: "16", customer: "Escondido Vineyard Estate LLC", property: "Escondido Vineyard Estate",
    address: "2250 Harmony Grove Rd", city: "Escondido", zip: "92029",
    lat: 33.1048, lng: -117.1089, region: "SOCAL",
    sqft: 27000, product: "MFB_35_FM", stage: "OUTREACH",
    contractValue: 22100, dueInDays: 55,
    lastServiceDaysAgo: 305, intervalMonths: 12,
  },
  {
    seedKey: "17", customer: "Laguna Beach Owner", property: "Laguna Beach Residence",
    address: "1400 Catalina St", city: "Laguna Beach", zip: "92651",
    lat: 33.5437, lng: -117.7946, region: "SOCAL",
    sqft: 6800, product: "MFB_31", stage: "SCHEDULED",
    assignTo: "mike.rivera@citrotech.com", contractValue: 7200, dueInDays: 16,
    lastServiceDaysAgo: 349, intervalMonths: 12,
  },
  {
    seedKey: "18", customer: "Topanga Ridge HOA", property: "Topanga Ridge HOA",
    address: "22000 Old Topanga Canyon Rd", city: "Topanga", zip: "90290",
    lat: 34.0948, lng: -118.6014, region: "SOCAL",
    sqft: 19500, product: "MFB_34", stage: "UPCOMING",
    contractValue: 15400, dueInDays: 64,
    lastServiceDaysAgo: 301, intervalMonths: 12,
  },
];

async function main() {
  console.log("Seeding CitroTech Jobs…");

  // Techs
  for (const t of techs) {
    await prisma.user.upsert({
      where: { email: t.email },
      update: { name: t.name, initials: t.initials, color: t.color, role: "TECH" },
      create: { email: t.email, name: t.name, initials: t.initials, color: t.color, role: "TECH" },
    });
  }
  console.log(`  ✓ ${techs.length} techs`);

  // Checklist templates (+ items)
  for (const [product, tpl] of Object.entries(templates) as [Prod, typeof templates.MFB_31][]) {
    const existing = await prisma.checklistTemplate.findUnique({ where: { product } });
    if (existing) {
      await prisma.checklistTemplateItem.deleteMany({ where: { templateId: existing.id } });
      await prisma.checklistTemplate.update({
        where: { id: existing.id },
        data: {
          name: tpl.name,
          items: { create: tpl.items.map((label, i) => ({ label, order: i })) },
        },
      });
    } else {
      await prisma.checklistTemplate.create({
        data: {
          product,
          name: tpl.name,
          items: { create: tpl.items.map((label, i) => ({ label, order: i })) },
        },
      });
    }
  }
  console.log(`  ✓ ${Object.keys(templates).length} checklist templates`);

  // Clean existing seed data (jobs → props → custs) before re-creating.
  await prisma.job.deleteMany({ where: { salesforceId: { startsWith: "seed-job-" } } });
  await prisma.property.deleteMany({ where: { salesforceId: { startsWith: "seed-prop-" } } });
  await prisma.customer.deleteMany({ where: { salesforceId: { startsWith: "seed-cust-" } } });

  const techByEmail = new Map(
    (await prisma.user.findMany({ where: { role: "TECH" } })).map((u) => [u.email, u]),
  );
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  for (const j of JOBS) {
    const customer = await prisma.customer.create({
      data: {
        salesforceId: `seed-cust-${j.seedKey}`,
        name: j.customer,
        email: `contact@${j.customer.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example.com`,
        phone: "+1-555-0100",
      },
    });

    const property = await prisma.property.create({
      data: {
        salesforceId: `seed-prop-${j.seedKey}`,
        customerId: customer.id,
        name: j.property,
        address: j.address,
        city: j.city,
        state: "CA",
        zip: j.zip,
        latitude: j.lat,
        longitude: j.lng,
        region: j.region,
        sqft: j.sqft,
      },
    });

    const tpl = await prisma.checklistTemplate.findUnique({
      where: { product: j.product },
      include: { items: { orderBy: { order: "asc" } } },
    });

    const assignedTech = j.assignTo ? techByEmail.get(j.assignTo) : undefined;
    const dueDate = new Date(now + j.dueInDays * day);
    const lastServiceDate = j.lastServiceDaysAgo
      ? new Date(now - j.lastServiceDaysAgo * day)
      : null;

    const scheduledDate =
      j.stage === "SCHEDULED" || j.stage === "IN_PROGRESS"
        ? new Date(now + Math.max(j.dueInDays - 3, 1) * day)
        : null;

    const completedAt = j.stage === "COMPLETED" ? lastServiceDate : null;

    await prisma.job.create({
      data: {
        jobNumber: `CT-${j.seedKey.padStart(4, "0")}`,
        salesforceId: `seed-job-${j.seedKey}`,
        propertyId: property.id,
        stage: j.stage,
        type: j.type ?? "MAINTENANCE",
        product: j.product,
        sqftTreated: j.sqft,
        contractValue: j.contractValue,
        assignedTechId: assignedTech?.id,
        scheduledDate,
        lastServiceDate,
        dueDate,
        maintenanceIntervalMonths: j.intervalMonths ?? 12,
        completedAt,
        completedById: completedAt ? assignedTech?.id : null,
        deferralReason:
          j.stage === "DEFERRED"
            ? "Customer requested postponement until next fire season"
            : null,
        checklistItems: tpl
          ? {
              create: tpl.items.map((i) => ({
                label: i.label,
                order: i.order,
                completed: j.stage === "COMPLETED",
                completedAt: j.stage === "COMPLETED" ? completedAt : null,
                completedById: j.stage === "COMPLETED" ? assignedTech?.id : null,
              })),
            }
          : undefined,
      },
    });
  }

  console.log(`  ✓ ${JOBS.length} jobs (with properties + customers + checklist items)`);
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
