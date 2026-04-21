import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type StepButtonProps = {
  href: string;
  label: string;
  progress: string;
  complete?: boolean;
  icon: React.ReactNode;
};

export function StepButton({
  href,
  label,
  progress,
  complete = false,
  icon,
}: StepButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-white p-4 transition-colors active:bg-neutral-50",
        complete
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-neutral-200 hover:border-neutral-300",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-md shrink-0",
          complete ? "bg-emerald-500 text-white" : "bg-neutral-100 text-neutral-600",
        )}
      >
        {complete ? <Check className="h-5 w-5" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold tracking-tight">{label}</div>
        <div
          className={cn(
            "text-[12px] mt-0.5",
            complete ? "text-emerald-700" : "text-neutral-500",
          )}
        >
          {progress}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-neutral-400 shrink-0" />
    </Link>
  );
}
