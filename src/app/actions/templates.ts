"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

async function requireOpsOrAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    throw new Error("Only admins and ops managers can edit checklist templates");
  }
  return user;
}

export async function updateTemplateName(templateId: string, name: string) {
  await requireOpsOrAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name can't be empty");
  if (trimmed.length > 80) throw new Error("Name is too long");

  await prisma.checklistTemplate.update({
    where: { id: templateId },
    data: { name: trimmed },
  });
  revalidatePath("/settings/templates");
  return { ok: true as const };
}

export async function addTemplateItem(templateId: string, label: string) {
  await requireOpsOrAdmin();
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Item can't be empty");
  if (trimmed.length > 200) throw new Error("Item is too long");

  const maxOrder = await prisma.checklistTemplateItem.aggregate({
    where: { templateId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const item = await prisma.checklistTemplateItem.create({
    data: { templateId, label: trimmed, order: nextOrder },
  });
  revalidatePath("/settings/templates");
  return { ok: true as const, id: item.id };
}

export async function updateTemplateItem(itemId: string, label: string) {
  await requireOpsOrAdmin();
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Item can't be empty");
  if (trimmed.length > 200) throw new Error("Item is too long");

  await prisma.checklistTemplateItem.update({
    where: { id: itemId },
    data: { label: trimmed },
  });
  revalidatePath("/settings/templates");
  return { ok: true as const };
}

export async function deleteTemplateItem(itemId: string) {
  await requireOpsOrAdmin();
  await prisma.checklistTemplateItem.delete({ where: { id: itemId } });
  revalidatePath("/settings/templates");
  return { ok: true as const };
}

/**
 * Reorder template items by moving one item up or down by a step.
 * Swaps the `order` values with the adjacent sibling in a transaction.
 */
export async function moveTemplateItem(
  itemId: string,
  direction: "up" | "down",
) {
  await requireOpsOrAdmin();

  const item = await prisma.checklistTemplateItem.findUnique({
    where: { id: itemId },
    select: { id: true, order: true, templateId: true },
  });
  if (!item) throw new Error("Item not found");

  const neighbor = await prisma.checklistTemplateItem.findFirst({
    where: {
      templateId: item.templateId,
      order: direction === "up" ? { lt: item.order } : { gt: item.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbor) {
    // Already at top/bottom.
    return { ok: true as const, unchanged: true };
  }

  await prisma.$transaction([
    // Park item at a sentinel to avoid the @@unique(templateId, order) collision
    // that would fire mid-swap (not currently enforced but future-proof).
    prisma.checklistTemplateItem.update({
      where: { id: item.id },
      data: { order: -1 - item.order },
    }),
    prisma.checklistTemplateItem.update({
      where: { id: neighbor.id },
      data: { order: item.order },
    }),
    prisma.checklistTemplateItem.update({
      where: { id: item.id },
      data: { order: neighbor.order },
    }),
  ]);
  revalidatePath("/settings/templates");
  return { ok: true as const };
}
