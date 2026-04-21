import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Route techs to /tech unless they're admins (who can test).
  // Note: /tech routes are implemented in a later phase.

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
    </div>
  );
}
