import { Sparkles } from "lucide-react";

export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20 animate-enter">
      <div className="relative inline-flex items-center justify-center mb-4">
        <div
          className="absolute inset-0 -inset-3 rounded-full blur-lg opacity-50"
          style={{
            background:
              "radial-gradient(circle, oklch(0.9 0.1 60) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative h-10 w-10 rounded-full bg-white border border-neutral-200 shadow-elev-1 grid place-items-center">
          <Sparkles className="h-4 w-4 text-orange-600" />
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-orange-700 font-semibold">
        {phase} · Coming soon
      </p>
      <h1 className="text-[22px] font-semibold tracking-tight mt-1.5">
        {title}
      </h1>
      {description && (
        <p className="text-[13px] text-neutral-600 mt-3 leading-relaxed max-w-md">
          {description}
        </p>
      )}
    </div>
  );
}
