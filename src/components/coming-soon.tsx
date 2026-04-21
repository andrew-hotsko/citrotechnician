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
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
        {phase}
      </p>
      <h1 className="text-xl font-semibold tracking-tight mt-1">{title}</h1>
      {description && (
        <p className="text-sm text-neutral-600 mt-3 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
