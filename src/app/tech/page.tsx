import Link from "next/link";
import { ChevronRight, MapPin, Phone } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listTechJobs, type TechJob } from "@/lib/tech-query";
import { StageBadge, ProductBadge, RegionBadge } from "@/components/badges";
import { formatDate } from "@/lib/job-helpers";

export default async function TechHomePage() {
  const user = (await getCurrentUser())!;
  const { today, thisWeek, unscheduled } = await listTechJobs(
    user.id,
    user.role === "ADMIN",
  );

  const firstName = user.name.split(" ")[0];
  const hasWork = today.length + thisWeek.length + unscheduled.length > 0;

  return (
    <div className="px-4 py-4 max-w-md mx-auto pb-24">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
        Hey {firstName}
      </p>
      <h2 className="text-[22px] font-semibold tracking-tight mt-1.5">
        {today.length === 0
          ? "Nothing on the books today"
          : today.length === 1
            ? "1 job today"
            : `${today.length} jobs today`}
      </h2>
      {user.role === "ADMIN" && (
        <p className="text-[11px] text-neutral-500 mt-1">
          Viewing as admin — showing all techs&apos; jobs.
        </p>
      )}

      {!hasWork && (
        <div className="mt-10 rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-sm text-neutral-600">
            No scheduled jobs right now. Check back after the ops manager
            schedules the next ones.
          </p>
        </div>
      )}

      {today.length > 0 && (
        <JobSection title="Today" jobs={today} emphasis />
      )}
      {thisWeek.length > 0 && (
        <JobSection title="This week" jobs={thisWeek} />
      )}
      {unscheduled.length > 0 && (
        <JobSection
          title="Unscheduled"
          subtitle="Confirmed with customer but not yet on the calendar"
          jobs={unscheduled}
        />
      )}
    </div>
  );
}

function JobSection({
  title,
  subtitle,
  jobs,
  emphasis = false,
}: {
  title: string;
  subtitle?: string;
  jobs: TechJob[];
  emphasis?: boolean;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="text-[11px] tabular-nums text-neutral-500">
          {jobs.length}
        </span>
      </div>
      <ul className="space-y-2">
        {jobs.map((j) => (
          <TechJobCard key={j.id} job={j} emphasis={emphasis} />
        ))}
      </ul>
    </section>
  );
}

function TechJobCard({
  job,
  emphasis,
}: {
  job: TechJob;
  emphasis: boolean;
}) {
  const mapUrl = `https://maps.apple.com/?daddr=${encodeURIComponent(
    `${job.property.address}, ${job.property.city}, ${job.property.state} ${job.property.zip ?? ""}`,
  )}`;

  return (
    <li>
      <Link
        href={`/tech/${job.id}`}
        className={`block rounded-lg border bg-white p-4 active:bg-neutral-50 transition-colors ${
          emphasis
            ? "border-neutral-300 shadow-sm"
            : "border-neutral-200"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-mono text-[11px] text-neutral-500">
            {job.jobNumber}
          </span>
          <div className="flex items-center gap-1">
            <RegionBadge region={job.property.region} />
            <ProductBadge product={job.product} />
          </div>
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-semibold tracking-tight truncate">
              {job.property.name}
            </h4>
            <p className="text-[12px] text-neutral-500 truncate mt-0.5">
              {job.property.address}, {job.property.city}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-neutral-400 shrink-0 mt-1" />
        </div>
        <div className="flex items-center justify-between mt-3">
          <StageBadge stage={job.stage} />
          {job.scheduledDate && (
            <span className="text-[11px] text-neutral-500">
              {formatDate(job.scheduledDate)}
            </span>
          )}
        </div>
      </Link>
      <div className="flex gap-2 mt-1.5 px-1">
        <a
          href={mapUrl}
          className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 active:text-neutral-900"
        >
          <MapPin className="h-3 w-3" />
          Directions
        </a>
        {job.property.customer.phone && (
          <a
            href={`tel:${job.property.customer.phone}`}
            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 active:text-neutral-900"
          >
            <Phone className="h-3 w-3" />
            {job.property.customer.phone}
          </a>
        )}
      </div>
    </li>
  );
}
