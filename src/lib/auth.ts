import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { Role } from "@/generated/prisma/enums";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function deriveInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function defaultRoleFor(email: string): Role {
  if (adminEmails.includes(email.toLowerCase())) return Role.ADMIN;
  return Role.VIEWER;
}

/**
 * Get the currently authenticated user from the local Prisma User table.
 * On first login, either:
 *   - Links the supabaseUserId to an existing User matched by email (seed case), or
 *   - Creates a new User record.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;
  const email = (authUser.email ?? "").toLowerCase();
  if (!email) return null;

  const name =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    email.split("@")[0];

  // Fast path: already linked.
  const existingBySupabase = await prisma.user.findUnique({
    where: { supabaseUserId: authUser.id },
  });
  if (existingBySupabase) {
    return prisma.user.update({
      where: { id: existingBySupabase.id },
      data: { email, name },
    });
  }

  // Link pre-seeded user by email.
  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: { supabaseUserId: authUser.id, name },
    });
  }

  // Brand-new user.
  return prisma.user.create({
    data: {
      supabaseUserId: authUser.id,
      email,
      name,
      initials: deriveInitials(name),
      role: defaultRoleFor(email),
    },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
