import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ImportClient } from "./import-client";

export default function ImportPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 animate-enter">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft className="h-3 w-3" />
        Settings
      </Link>
      <div className="mt-3">
        <h1 className="text-[18px] font-semibold tracking-tight">
          Import jobs from CSV
        </h1>
        <p className="text-[13px] text-neutral-500 mt-1 leading-relaxed max-w-xl">
          Bulk-load existing maintenance jobs. Each row becomes a
          Customer + Property + Job in the system. Addresses are
          geocoded automatically.
        </p>
      </div>

      <ImportClient />
    </div>
  );
}
