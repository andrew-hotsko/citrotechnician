import { cn } from "@/lib/utils";

type TechLike = {
  name: string;
  initials: string | null;
  color: string | null;
};

export function TechAvatar({
  tech,
  size = "md",
  className,
}: {
  tech: TechLike | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-5 w-5 text-[9px]",
    md: "h-6 w-6 text-[10px]",
    lg: "h-8 w-8 text-xs",
  } as const;

  if (!tech) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-dashed border-neutral-300 text-neutral-400",
          sizes[size],
          className,
        )}
        title="Unassigned"
      >
        ?
      </span>
    );
  }

  const initials =
    tech.initials ??
    tech.name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: tech.color ?? "#525252" }}
      title={tech.name}
    >
      {initials}
    </span>
  );
}
