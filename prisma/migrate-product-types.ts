/**
 * One-time migration: rekey existing Job + ChecklistTemplate rows from
 * the legacy MFB_31 / MFB_34 / MFB_35_FM enum values to SYSTEM / SPRAY.
 *
 * Mapping (conservative):
 *   MFB_31  → SYSTEM   (most common demo product; merges with SYSTEM items)
 *   MFB_34  → SYSTEM   (second "system" flavor — merges into SYSTEM)
 *   MFB_35_FM → SPRAY  (the spray-on finish variant)
 *
 * ChecklistTemplate has @unique on product, so we can't have two
 * templates both keyed to SYSTEM. Strategy:
 *   1. If SYSTEM template doesn't exist, rename MFB_31 → SYSTEM.
 *   2. If MFB_34 template exists, merge its items into the SYSTEM
 *      template (preserving order), then delete MFB_34 template.
 *   3. Rename MFB_35_FM → SPRAY.
 *
 * Safe to re-run: every step checks current state first.
 *
 * Run with:  npx tsx prisma/migrate-product-types.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL || "";
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // -------------------------------------------------------------------------
  // 1. Jobs
  // -------------------------------------------------------------------------
  const jobUpdates = await prisma.$executeRawUnsafe(`
    UPDATE "Job"
    SET product = CASE
      WHEN product::text IN ('MFB_31', 'MFB_34') THEN 'SYSTEM'::"Product"
      WHEN product::text = 'MFB_35_FM' THEN 'SPRAY'::"Product"
      ELSE product
    END
    WHERE product::text IN ('MFB_31', 'MFB_34', 'MFB_35_FM')
  `);
  console.log(`✓ Rekeyed ${jobUpdates} job row(s) to SYSTEM / SPRAY`);

  // -------------------------------------------------------------------------
  // 2. ChecklistTemplates
  // -------------------------------------------------------------------------
  // Find all current templates (regardless of product) so we can decide
  // how to merge.
  const templates = await prisma.checklistTemplate.findMany({
    include: { items: { orderBy: { order: "asc" } } },
  });

  const byProduct = new Map(templates.map((t) => [t.product as string, t]));

  const systemTpl = byProduct.get("SYSTEM");
  const sprayTpl = byProduct.get("SPRAY");
  const mfb31 = byProduct.get("MFB_31");
  const mfb34 = byProduct.get("MFB_34");
  const mfb35 = byProduct.get("MFB_35_FM");

  // --- SYSTEM template ---
  if (!systemTpl && mfb31) {
    // Rename MFB_31 template → SYSTEM.
    await prisma.checklistTemplate.update({
      where: { id: mfb31.id },
      data: {
        product: "SYSTEM",
        name:
          mfb31.name.includes("MFB")
            ? "System Pre-Job Checklist"
            : mfb31.name,
      },
    });
    console.log(
      `✓ Renamed MFB_31 template → SYSTEM (${mfb31.items.length} items)`,
    );
  } else if (!systemTpl && mfb34) {
    await prisma.checklistTemplate.update({
      where: { id: mfb34.id },
      data: { product: "SYSTEM", name: "System Pre-Job Checklist" },
    });
    console.log(
      `✓ Renamed MFB_34 template → SYSTEM (${mfb34.items.length} items)`,
    );
  }

  // If both MFB_31 and MFB_34 existed, merge MFB_34's items into whatever
  // is now SYSTEM, then drop MFB_34.
  const systemAfterRename = await prisma.checklistTemplate.findUnique({
    where: { product: "SYSTEM" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const remainingMfb34 = await prisma.checklistTemplate.findUnique({
    where: { product: "MFB_34" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (systemAfterRename && remainingMfb34) {
    // Append MFB_34 items that don't duplicate (by label) the SYSTEM items.
    const existingLabels = new Set(
      systemAfterRename.items.map((i) => i.label.toLowerCase().trim()),
    );
    const toAppend = remainingMfb34.items.filter(
      (i) => !existingLabels.has(i.label.toLowerCase().trim()),
    );
    const maxOrder = systemAfterRename.items.reduce(
      (m, i) => Math.max(m, i.order),
      -1,
    );
    if (toAppend.length > 0) {
      await prisma.checklistTemplateItem.createMany({
        data: toAppend.map((i, idx) => ({
          templateId: systemAfterRename.id,
          label: i.label,
          order: maxOrder + 1 + idx,
        })),
      });
      console.log(
        `✓ Merged ${toAppend.length} unique MFB_34 item(s) into SYSTEM`,
      );
    }
    // Delete MFB_34 template (items cascade via schema).
    await prisma.checklistTemplate.delete({
      where: { id: remainingMfb34.id },
    });
    console.log("✓ Deleted legacy MFB_34 template");
  }

  // --- SPRAY template ---
  if (!sprayTpl && mfb35) {
    await prisma.checklistTemplate.update({
      where: { id: mfb35.id },
      data: {
        product: "SPRAY",
        name:
          mfb35.name.includes("MFB")
            ? "Spray Pre-Job Checklist"
            : mfb35.name,
      },
    });
    console.log(
      `✓ Renamed MFB_35_FM template → SPRAY (${mfb35.items.length} items)`,
    );
  }

  // Summary
  const finalTemplates = await prisma.checklistTemplate.findMany({
    orderBy: { product: "asc" },
    include: { _count: { select: { items: true } } },
  });
  console.log("\nFinal templates:");
  for (const t of finalTemplates) {
    console.log(
      `  ${t.product.padEnd(10)} ${t.name} (${t._count.items} items)`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
