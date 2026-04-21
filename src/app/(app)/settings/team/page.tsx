import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { TeamList } from "./team-list";

export default async function TeamSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/settings");

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      initials: true,
      color: true,
      createdAt: true,
      supabaseUserId: true,
    },
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-6 animate-enter">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft className="h-3 w-3" />
        Settings
      </Link>
      <div className="mt-3">
        <h1 className="text-[18px] font-semibold tracking-tight">Team</h1>
        <p className="text-[13px] text-neutral-500 mt-1 leading-relaxed max-w-xl">
          Every user who has ever signed in appears here. Promote, demote, or
          deactivate. Seeded techs who haven&apos;t logged in yet show as
          &quot;Unlinked&quot; until they sign in for the first time.
        </p>
      </div>

      <TeamList users={users} currentUserId={user.id} />
    </div>
  );
}
