"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";

const VALID_ROLES: Role[] = ["ADMIN", "OPS_MANAGER", "TECH", "VIEWER"];

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only admins can manage the team");
  }
  return user;
}

/** Updates a user's role. Prevents demoting the last active admin. */
export async function updateUserRole(userId: string, newRole: Role) {
  const actor = await requireAdmin();
  if (!VALID_ROLES.includes(newRole)) {
    throw new Error("Invalid role");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, active: true },
  });
  if (!target) throw new Error("User not found");
  if (target.role === newRole) {
    return { ok: true as const, unchanged: true };
  }

  // Guard: don't allow demoting the last active admin.
  if (target.role === "ADMIN" && newRole !== "ADMIN") {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        id: { not: userId },
        role: "ADMIN",
        active: true,
        deletedAt: null,
      },
    });
    if (otherActiveAdmins === 0) {
      throw new Error(
        "Can't demote the last active admin. Promote another user first.",
      );
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    }),
    prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "role_changed",
        description: `Changed ${target.name}'s role from ${target.role} to ${newRole}`,
        metadata: { targetUserId: userId, from: target.role, to: newRole },
      },
    }),
  ]);

  revalidatePath("/settings/team");
  return { ok: true as const };
}

/** Toggle a user's active flag. Inactive users can't sign in. */
export async function setUserActive(userId: string, active: boolean) {
  const actor = await requireAdmin();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, active: true },
  });
  if (!target) throw new Error("User not found");
  if (target.active === active) {
    return { ok: true as const, unchanged: true };
  }

  // Guard: can't deactivate yourself.
  if (userId === actor.id && !active) {
    throw new Error("You can't deactivate your own account");
  }

  // Guard: can't deactivate the last active admin.
  if (!active && target.role === "ADMIN") {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        id: { not: userId },
        role: "ADMIN",
        active: true,
        deletedAt: null,
      },
    });
    if (otherActiveAdmins === 0) {
      throw new Error("Can't deactivate the last active admin");
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { active },
    }),
    prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: active ? "user_activated" : "user_deactivated",
        description: `${active ? "Activated" : "Deactivated"} ${target.name}`,
        metadata: { targetUserId: userId },
      },
    }),
  ]);

  revalidatePath("/settings/team");
  return { ok: true as const };
}

/**
 * Update cosmetic fields on a tech (initials + avatar color). Visible
 * on the calendar swim lane, job cards, and tech workload widget.
 */
export async function updateTechDisplay(
  userId: string,
  data: { initials?: string; color?: string },
) {
  await requireAdmin();

  const updates: { initials?: string | null; color?: string | null } = {};
  if (data.initials !== undefined) {
    const trimmed = data.initials.trim().toUpperCase();
    if (trimmed.length > 3) {
      throw new Error("Initials must be at most 3 characters");
    }
    updates.initials = trimmed || null;
  }
  if (data.color !== undefined) {
    // Accept anything that parses as a CSS color; cheap validation: must
    // start with # and be 4/7 chars, or start with 'oklch(' / 'rgb(' / 'hsl('.
    const c = data.color.trim();
    const looksOk =
      /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(c) ||
      /^(oklch|rgb|hsl)\(/.test(c);
    if (c && !looksOk) {
      throw new Error("Color must be a hex, oklch, rgb, or hsl value");
    }
    updates.color = c || null;
  }

  await prisma.user.update({
    where: { id: userId },
    data: updates,
  });

  revalidatePath("/settings/team");
  revalidatePath("/pipeline");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
