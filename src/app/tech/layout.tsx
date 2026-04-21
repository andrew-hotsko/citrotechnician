import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TechNav } from "@/components/tech/tech-nav";

export default async function TechLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "TECH" && user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <TechNav
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
