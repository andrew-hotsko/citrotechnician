"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

export function TechNav({
  user,
}: {
  user: { name: string; email: string; initials: string | null; role: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/tech";

  // Derive a back target: on a sub-step (e.g. /tech/abc/checklist),
  // back goes to the job brief (/tech/abc). Everywhere else under /tech,
  // back goes to /tech.
  let backHref: string | undefined;
  if (!isHome) {
    const parts = pathname.split("/").filter(Boolean);
    // parts is ["tech", "<jobId>", ...]
    if (parts.length >= 3) {
      backHref = `/tech/${parts[1]}`;
    } else {
      backHref = "/tech";
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-neutral-200 bg-white">
      <div className="flex h-full items-center gap-2 px-3">
        {backHref ? (
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center -ml-1 text-neutral-600 hover:text-neutral-900"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <Link href="/tech" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-orange-600 grid place-items-center text-white text-xs font-semibold">
              C
            </div>
          </Link>
        )}
        <div className="flex-1 min-w-0">
          {isHome && (
            <h1 className="text-[15px] font-semibold tracking-tight">
              Today
            </h1>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">
            {user.initials ?? user.name.slice(0, 2).toUpperCase()}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-neutral-500 font-normal">
                {user.email}
              </span>
            </DropdownMenuLabel>
            {user.role === "ADMIN" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                  Switch to office view
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
