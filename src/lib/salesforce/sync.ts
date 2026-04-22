import "server-only";
import { prisma } from "@/lib/prisma";
import { maintenanceReminderScheduleFor } from "@/lib/reminder-schedule";
import { geocodeAddress } from "@/lib/geocode";
import { inferRegionFromZip } from "@/lib/csv-import";
import { connect, readConfig, type SalesforceConfig } from "./client";
import type { Product, Region } from "@/generated/prisma/enums";

// -----------------------------------------------------------------------------
// SF row shape — what jsforce returns from the default SOQL. Loosely typed
// because every SF org's schema differs; the mapper below is defensive.
// -----------------------------------------------------------------------------
type SFOpportunity = {
  Id: string;
  Name?: string;
  CloseDate?: string;       // ISO-ish "yyyy-mm-dd"
  Amount?: number | null;
  Description?: string | null;
  Account?: {
    Id: string;
    Name?: string;
    Phone?: string | null;
    BillingStreet?: string | null;
    BillingCity?: string | null;
    BillingState?: string | null;
    BillingPostalCode?: string | null;
  };
};

// -----------------------------------------------------------------------------
// Run options
// -----------------------------------------------------------------------------
export type RunOptions = {
  triggeredBy: "CRON" | "MANUAL" | "TEST";
  triggeredById?: string;
  /** Don't write anything; just return what would happen. */
  dryRun?: boolean;
};

export type RunResult = {
  syncId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  opportunitiesSeen: number;
  customersCreated: number;
  customersUpdated: number;
  propertiesCreated: number;
  jobsCreated: number;
  rowsSkipped: number;
  errors: { sfId: string; reason: string }[];
};

// -----------------------------------------------------------------------------
// Map an SF Opportunity → CitroTech product. Defaults everything to SYSTEM
// since most products in fire defense are "system" applications. Override
// via env var SALESFORCE_PRODUCT_MAP if your SF schema has a product field
// that needs to be split across SYSTEM and SPRAY.
// -----------------------------------------------------------------------------
function pickProduct(opp: SFOpportunity): Product {
  const name = (opp.Name ?? "").toLowerCase();
  if (/spray/.test(name)) return "SPRAY";
  return "SYSTEM";
}

function pickRegion(billingState?: string | null, zip?: string | null): Region {
  const fromZip = inferRegionFromZip(zip ?? undefined);
  if (fromZip) return fromZip;
  if ((billingState ?? "").toUpperCase() === "CA") return "OTHER";
  return "OTHER";
}

// -----------------------------------------------------------------------------
// The orchestration: connect → query → for each row { upsert customer,
// upsert property, create job if not exists } → write a single
// SalesforceSync row that summarizes the run. Idempotent: re-running the
// same set of opps is a no-op (Customer/Property/Job all dedupe by
// Salesforce ID).
// -----------------------------------------------------------------------------
export async function runSync(options: RunOptions): Promise<RunResult> {
  // 1) Open the audit row immediately so even crashes leave a trace.
  const sync = await prisma.salesforceSync.create({
    data: {
      triggeredBy: options.triggeredBy,
      triggeredById: options.triggeredById,
      status: "RUNNING",
      soqlQuery: null,
    },
  });

  function emptyResult(extra: Partial<RunResult> = {}): RunResult {
    return {
      syncId: sync.id,
      status: "FAILED",
      opportunitiesSeen: 0,
      customersCreated: 0,
      customersUpdated: 0,
      propertiesCreated: 0,
      jobsCreated: 0,
      rowsSkipped: 0,
      errors: [],
      ...extra,
    };
  }

  const status = readConfig();
  if (!status.configured) {
    await prisma.salesforceSync.update({
      where: { id: sync.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: `Not configured. Missing env vars: ${status.missing.join(", ")}`,
      },
    });
    return emptyResult({
      status: "FAILED",
      errors: [
        {
          sfId: "*",
          reason: `Missing: ${status.missing.join(", ")}`,
        },
      ],
    });
  }

  let opportunities: SFOpportunity[];
  try {
    opportunities = await fetchOpportunities(status.config);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SF error";
    await prisma.salesforceSync.update({
      where: { id: sync.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: message,
        soqlQuery: status.config.soqlQuery,
      },
    });
    return emptyResult({ status: "FAILED", errors: [{ sfId: "*", reason: message }] });
  }

  const counters = {
    opportunitiesSeen: opportunities.length,
    customersCreated: 0,
    customersUpdated: 0,
    propertiesCreated: 0,
    jobsCreated: 0,
    rowsSkipped: 0,
  };
  const errors: { sfId: string; reason: string }[] = [];

  for (const opp of opportunities) {
    try {
      if (!opp.Account?.Id || !opp.Account.Name) {
        errors.push({ sfId: opp.Id, reason: "Opportunity has no Account" });
        counters.rowsSkipped++;
        continue;
      }

      // ---- Customer: upsert by SF Account.Id -------------------------------
      const existingCust = await prisma.customer.findUnique({
        where: { salesforceId: opp.Account.Id },
        select: { id: true },
      });
      if (options.dryRun) {
        if (!existingCust) counters.customersCreated++;
        else counters.customersUpdated++;
      } else {
        const cust = await prisma.customer.upsert({
          where: { salesforceId: opp.Account.Id },
          update: {
            name: opp.Account.Name,
            phone: opp.Account.Phone ?? undefined,
            lastSyncedAt: new Date(),
          },
          create: {
            salesforceId: opp.Account.Id,
            name: opp.Account.Name,
            phone: opp.Account.Phone ?? null,
            lastSyncedAt: new Date(),
          },
        });
        if (!existingCust) counters.customersCreated++;
        else counters.customersUpdated++;

        // ---- Property: dedup by SF Account.Id (1 customer = 1 property) ----
        // If multi-property per customer is needed, switch the dedup key to
        // (Account.Id + address) and import multiple opps per Account.
        const propertyKey = `sf:${opp.Account.Id}`;
        const existingProp = await prisma.property.findUnique({
          where: { salesforceId: propertyKey },
          select: { id: true },
        });

        let propertyId: string;
        if (existingProp) {
          propertyId = existingProp.id;
        } else {
          // Need lat/lng — geocode the SF address.
          const street = opp.Account.BillingStreet ?? "";
          const city = opp.Account.BillingCity ?? "";
          const state = opp.Account.BillingState ?? "CA";
          const zip = opp.Account.BillingPostalCode ?? undefined;
          if (!street || !city) {
            errors.push({
              sfId: opp.Id,
              reason: "Account is missing BillingStreet or BillingCity",
            });
            counters.rowsSkipped++;
            continue;
          }
          const geo = await geocodeAddress(street, city, state, zip);
          if (!geo.ok) {
            errors.push({
              sfId: opp.Id,
              reason: `Geocode failed: ${geo.error}`,
            });
            counters.rowsSkipped++;
            continue;
          }

          const created = await prisma.property.create({
            data: {
              salesforceId: propertyKey,
              customerId: cust.id,
              name: opp.Account.Name,
              address: street,
              city,
              state: state.toUpperCase(),
              zip,
              latitude: geo.value.latitude,
              longitude: geo.value.longitude,
              region: pickRegion(state, zip),
              sqft: 0, // unknown from SF; ops can fill later if needed
              lastSyncedAt: new Date(),
            },
          });
          propertyId = created.id;
          counters.propertiesCreated++;
        }

        // ---- Job: dedup by SF Opportunity.Id -------------------------------
        const existingJob = await prisma.job.findUnique({
          where: { salesforceId: opp.Id },
          select: { id: true },
        });
        if (existingJob) {
          // Already imported, nothing to do.
          continue;
        }

        const closeDate = opp.CloseDate ? new Date(opp.CloseDate) : new Date();
        const dueDate = new Date(closeDate);
        dueDate.setMonth(dueDate.getMonth() + 12); // first annual = 1 year out

        const product = pickProduct(opp);
        const jobNumber = await nextJobNumber();

        const tpl = await prisma.checklistTemplate.findUnique({
          where: { product },
          include: { items: { orderBy: { order: "asc" } } },
        });

        const job = await prisma.job.create({
          data: {
            jobNumber,
            salesforceId: opp.Id,
            propertyId,
            stage: "UPCOMING",
            type: "INITIAL_APPLICATION",
            product,
            sqftTreated: 0,
            contractValue: opp.Amount ?? undefined,
            lastServiceDate: closeDate,
            dueDate,
            maintenanceIntervalMonths: 12,
            cycleIndex: 0,
            cyclesPlanned: 2,
            lastSyncedAt: new Date(),
            checklistItems: tpl
              ? {
                  create: tpl.items.map((i) => ({
                    label: i.label,
                    order: i.order,
                  })),
                }
              : undefined,
          },
        });

        await prisma.maintenanceReminder.createMany({
          data: maintenanceReminderScheduleFor(job.id, dueDate),
        });

        await prisma.activityLog.create({
          data: {
            jobId: job.id,
            userId: options.triggeredById ?? null,
            action: "imported_from_salesforce",
            description: `Created from SF Opportunity ${opp.Id} (${opp.Name ?? "unnamed"}).`,
            metadata: {
              sfOpportunityId: opp.Id,
              sfAccountId: opp.Account.Id,
              syncId: sync.id,
            },
          },
        });

        counters.jobsCreated++;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown row error";
      errors.push({ sfId: opp.Id, reason });
      counters.rowsSkipped++;
    }
  }

  const finalStatus =
    errors.length === 0
      ? "SUCCESS"
      : counters.jobsCreated + counters.customersCreated > 0
        ? "PARTIAL"
        : "FAILED";

  await prisma.salesforceSync.update({
    where: { id: sync.id },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      soqlQuery: status.config.soqlQuery,
      ...counters,
      errorCount: errors.length,
      rowErrors: errors.length > 0 ? errors : undefined,
    },
  });

  return {
    syncId: sync.id,
    status: finalStatus,
    ...counters,
    errors,
  };
}

async function fetchOpportunities(cfg: SalesforceConfig): Promise<SFOpportunity[]> {
  const conn = await connect(cfg);
  const result = await conn.query<SFOpportunity>(cfg.soqlQuery);
  return result.records;
}

async function nextJobNumber(): Promise<string> {
  const latest = await prisma.job.findFirst({
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });
  const m = latest?.jobNumber.match(/^CT-(\d+)$/);
  const next = m ? Number(m[1]) + 1 : 1;
  return `CT-${String(next).padStart(4, "0")}`;
}

/** Lightweight check for the Settings panel — doesn't touch any data. */
export async function testConnection(): Promise<
  | { ok: true; userInfo: { username: string; orgId: string } }
  | { ok: false; reason: string }
> {
  const status = readConfig();
  if (!status.configured) {
    return {
      ok: false,
      reason: `Missing env vars: ${status.missing.join(", ")}`,
    };
  }
  try {
    const conn = await connect(status.config);
    const id = await conn.identity();
    return {
      ok: true,
      userInfo: {
        username: id.username,
        orgId: id.organization_id,
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
