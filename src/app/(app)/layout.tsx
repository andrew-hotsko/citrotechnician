import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/top-nav";
import { CommandPalette } from "@/components/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "TECH") redirect("/tech");

  // Snapshot for the command palette. Scope: non-deleted, non-completed
  // jobs (50 most recent) + active techs. Fresh on each page render.
  const [paletteJobs, paletteTechs] = await Promise.all([
    prisma.job.findMany({
      where: {
        deletedAt: null,
        stage: { notIn: ["COMPLETED", "DEFERRED"] },
      },
      select: {
        id: true,
        jobNumber: true,
        stage: true,
        property: { select: { name: true, city: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      where: { role: "TECH", deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        user={{
          name: user.name,
          email: user.email,
          initials: user.initials,
          role: user.role,
        }}
      />
      <main className="flex-1">{children}</main>
      <CommandPalette
        jobs={paletteJobs.map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          stage: j.stage,
          propertyName: j.property.name,
          propertyCity: j.property.city,
        }))}
        techs={paletteTechs}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
