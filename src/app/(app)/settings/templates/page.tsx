import Link from "next/link";
import { ChevronLeft, Info } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    redirect("/settings");
  }

  const templates = await prisma.checklistTemplate.findMany({
    include: { items: { orderBy: { order: "asc" } } },
    orderBy: { product: "asc" },
  });

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6 animate-enter">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft className="h-3 w-3" />
        Settings
      </Link>
      <div className="mt-3">
        <h1 className="text-[18px] font-semibold tracking-tight">
          Checklist templates
        </h1>
        <p className="text-[13px] text-neutral-500 mt-1 leading-relaxed max-w-xl">
          The per-product checklist that every tech sees when they open a job.
          Edit once here, every future job using that product picks it up.
        </p>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
        <Info className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
        <p className="text-[12px] text-amber-900">
          Changes only affect{" "}
          <span className="font-semibold">future jobs</span>. Jobs that
          already exist keep the checklist they were created with — removing
          an item here won&apos;t retroactively drop it from an in-flight job.
        </p>
      </div>

      <TemplatesClient
        templates={templates.map((t) => ({
          id: t.id,
          product: t.product,
          name: t.name,
          items: t.items.map((i) => ({
            id: i.id,
            label: i.label,
            order: i.order,
          })),
        }))}
      />
    </div>
  );
}
