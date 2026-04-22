import Link from "next/link";
import {
  Check,
  Mail,
  Phone,
  Image as ImageIcon,
  FileText,
  MessageSquare,
  ArrowRight as ArrowInbound,
  ArrowLeft as ArrowOutbound,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { JobDetail } from "@/lib/job-detail-query";
import {
  RegionBadge,
  ProductBadge,
  StageBadge,
  CycleBadge,
} from "@/components/badges";
import { TechAvatar } from "@/components/tech-avatar";
import { JobStageSelect } from "@/components/job-stage-select";
import { JobTechSelect } from "@/components/job-tech-select";
import { OfficeNotesEditor } from "@/components/office-notes-editor";
import { ServiceReportSection } from "@/components/service-report-section";
import { EditJobDialog } from "@/components/edit-job-dialog";
import { DeleteJobButton } from "@/components/delete-job-button";
import { LogCommunicationDialog } from "@/components/log-communication-dialog";
import { CompleteJobButton } from "@/components/complete-job-button";
import {
  formatCurrency,
  formatDate,
  formatDueIn,
  urgencyFor,
  URGENCY_TONE,
} from "@/lib/job-helpers";
import { cn } from "@/lib/utils";

type Tech = {
  id: string;
  name: string;
  initials: string | null;
  color: string | null;
};

export function JobDetailContent({
  job,
  techs,
  canEdit,
  userRole,
  layout = "page",
}: {
  job: JobDetail;
  techs: Tech[];
  canEdit: boolean;
  userRole?: string;
  layout?: "page" | "slideover";
}) {
  const urgency = urgencyFor(job.dueDate);
  const doneCount = job.checklistItems.filter((i) => i.completed).length;
  const totalCount = job.checklistItems.length;

  const containerClass = layout === "page" ? "max-w-5xl mx-auto px-6 py-6" : "px-5 py-5";

  return (
    <div className={containerClass}>
      {/* Header identity row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            <span className="font-mono font-medium text-neutral-500">
              {job.jobNumber}
            </span>
            <span className="text-neutral-300">·</span>
            <CycleBadge
              cycleIndex={job.cycleIndex}
              cyclesPlanned={job.cyclesPlanned}
              type={job.type}
            />
            <RegionBadge region={job.property.region} />
            <ProductBadge product={job.product} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight mt-1 truncate">
            {job.property.name}
          </h1>
          <p className="text-[13px] text-neutral-500 mt-0.5">
            {job.property.address}, {job.property.city}, {job.property.state}{" "}
            {job.property.zip ?? ""}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <LogCommunicationDialog jobId={job.id} />
            {/* Complete button only shows for jobs that can still be
                completed. Upcoming jobs too far out probably shouldn't
                be completable, but this matches the lifecycle contract
                (OUTREACH → CONFIRMED → SCHEDULED → IN_PROGRESS → COMPLETED). */}
            {job.stage !== "COMPLETED" && job.stage !== "DEFERRED" && (
              <CompleteJobButton
                jobId={job.id}
                jobNumber={job.jobNumber}
                propertyName={job.property.name}
                hasSignature={Boolean(job.customerSignature)}
                userRole={userRole ?? ""}
              />
            )}
            <EditJobDialog job={job} />
            <DeleteJobButton
              jobId={job.id}
              jobNumber={job.jobNumber}
              propertyName={job.property.name}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {canEdit ? (
          <JobStageSelect jobId={job.id} current={job.stage} />
        ) : (
          <StageBadge stage={job.stage} />
        )}
        {canEdit ? (
          <JobTechSelect jobId={job.id} current={job.assignedTech} techs={techs} />
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-[11px]">
            <TechAvatar tech={job.assignedTech} size="sm" />
            {job.assignedTech?.name ?? "Unassigned"}
          </div>
        )}
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium",
            URGENCY_TONE[urgency],
          )}
        >
          {formatDueIn(job.dueDate)}
        </span>
      </div>

      {/* Key facts grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        <Fact label="Customer" value={job.property.customer.name} />
        <Fact
          label="Phone"
          value={
            job.property.customer.phone ? (
              <a
                href={`tel:${job.property.customer.phone}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Phone className="h-3 w-3" />
                {job.property.customer.phone}
              </a>
            ) : (
              "—"
            )
          }
        />
        <Fact
          label="Email"
          value={
            job.property.customer.email ? (
              <a
                href={`mailto:${job.property.customer.email}`}
                className="inline-flex items-center gap-1 hover:underline truncate"
              >
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{job.property.customer.email}</span>
              </a>
            ) : (
              "—"
            )
          }
        />
        <Fact label="Due date" value={formatDate(job.dueDate)} />
        <Fact label="Last service" value={formatDate(job.lastServiceDate)} />
        <Fact
          label="Scheduled"
          value={
            job.scheduledDate
              ? formatDate(job.scheduledDate)
              : "—"
          }
        />
        <Fact
          label="Maintenance interval"
          value={`${job.maintenanceIntervalMonths} months`}
        />
      </div>

      {/* Deferral reason (if deferred) */}
      {job.stage === "DEFERRED" && job.deferralReason && (
        <Section title="Deferral reason" className="mb-6">
          <p className="text-[13px] text-neutral-700">{job.deferralReason}</p>
        </Section>
      )}

      {/* Service report (if completed) */}
      <ServiceReportSection
        jobId={job.id}
        reports={job.serviceReports.map((r) => ({
          id: r.id,
          pdfUrl: r.pdfUrl,
          version: r.version,
          generatedAt: r.generatedAt,
        }))}
        canRegenerate={canEdit}
        jobCompleted={job.stage === "COMPLETED"}
      />

      {/* Checklist */}
      <Section
        title="Pre-job checklist"
        subtitle={
          totalCount > 0 ? `${doneCount} of ${totalCount} complete` : undefined
        }
        className="mb-6"
      >
        {totalCount === 0 ? (
          <p className="text-[13px] text-neutral-500">
            No checklist items yet.
          </p>
        ) : (
          <>
            <div className="h-1 w-full rounded-full bg-neutral-100 mb-3 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-[width]"
                style={{ width: `${(doneCount / totalCount) * 100}%` }}
              />
            </div>
            <ul className="space-y-1.5">
              {job.checklistItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 text-[13px]"
                >
                  <span
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                      item.completed
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-neutral-300 bg-white",
                    )}
                  >
                    {item.completed && (
                      <Check className="h-2.5 w-2.5 text-white" />
                    )}
                  </span>
                  <span
                    className={cn(
                      item.completed && "text-neutral-500 line-through",
                    )}
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* Office notes — ops-only context (internal notes for the office) */}
      <Section title="Office notes" className="mb-6">
        <OfficeNotesEditor
          jobId={job.id}
          initialValue={job.officeNotes ?? ""}
          canEdit={canEdit}
          field="officeNotes"
          placeholder="Internal notes — customer conversations, scheduling context, access instructions…"
          emptyLabel="No office notes."
        />
      </Section>

      {/* Tech notes — what the field tech saw, wrote back to the office */}
      <Section
        title="Tech notes"
        subtitle="What the tech observed on-site"
        className="mb-6"
      >
        <OfficeNotesEditor
          jobId={job.id}
          initialValue={job.techNotes ?? ""}
          canEdit={canEdit}
          field="techNotes"
          placeholder="Field observations, access notes, follow-up items…"
          emptyLabel="No tech notes yet."
        />
      </Section>

      {/* Communication history — structured log of calls, emails, visits */}
      {job.communications.length > 0 && (
        <Section
          title="Communications"
          subtitle={`${job.communications.length} logged`}
          className="mb-6"
        >
          <ul className="space-y-2">
            {job.communications.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
              >
                <div className="shrink-0 h-7 w-7 rounded-md bg-neutral-100 grid place-items-center">
                  {c.direction === "INBOUND" ? (
                    <ArrowInbound className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <ArrowOutbound className="h-3.5 w-3.5 text-blue-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                    <span className="font-medium text-neutral-700">
                      {channelLabel(c.channel)}
                    </span>
                    <span>·</span>
                    <span>
                      {c.direction === "INBOUND" ? "from customer" : "to customer"}
                    </span>
                    <span>·</span>
                    <span>
                      {formatDistanceToNow(new Date(c.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1">
                      <TechAvatar
                        tech={{
                          name: c.user.name,
                          initials: c.user.initials,
                          color: c.user.color,
                        }}
                        size="sm"
                      />
                    </span>
                  </div>
                  <p className="text-[13px] text-neutral-800 mt-0.5 whitespace-pre-wrap">
                    {c.summary}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Photos (placeholder — Phase 5) */}
      {job.photos.length > 0 && (
        <Section
          title="Photos"
          subtitle={`${job.photos.length} uploaded`}
          className="mb-6"
        >
          <div className="grid grid-cols-3 gap-2">
            {job.photos.slice(0, 6).map((photo) => (
              <div
                key={photo.id}
                className="aspect-square rounded-md bg-neutral-100 grid place-items-center text-neutral-400"
              >
                <ImageIcon className="h-5 w-5" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Documents */}
      {job.documents.length > 0 && (
        <Section title="Documents" className="mb-6">
          <ul className="space-y-1">
            {job.documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 text-[13px]">
                <FileText className="h-3.5 w-3.5 text-neutral-400" />
                <a
                  href={doc.url}
                  className="text-neutral-700 hover:text-neutral-900 hover:underline truncate"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {doc.name}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Maintenance chain */}
      {(job.parentJob || job.childJobs.length > 0) && (
        <Section title="Service history" className="mb-6">
          <ul className="space-y-1.5 text-[13px]">
            {job.parentJob && (
              <li className="flex items-center justify-between">
                <Link
                  href={`/jobs/${job.parentJob.id}`}
                  className="text-neutral-700 hover:text-neutral-900"
                >
                  <span className="font-mono text-[11px] text-neutral-500 mr-1.5">
                    {job.parentJob.jobNumber}
                  </span>
                  Previous service ·{" "}
                  {formatDate(job.parentJob.completedAt) ?? "—"}
                </Link>
                <StageBadge stage={job.parentJob.stage} />
              </li>
            )}
            <li className="flex items-center justify-between bg-neutral-50 -mx-2 px-2 py-1 rounded">
              <span className="text-neutral-700">
                <span className="font-mono text-[11px] text-neutral-500 mr-1.5">
                  {job.jobNumber}
                </span>
                This job · due {formatDate(job.dueDate)}
              </span>
              <StageBadge stage={job.stage} />
            </li>
            {job.childJobs.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <Link
                  href={`/jobs/${c.id}`}
                  className="text-neutral-700 hover:text-neutral-900"
                >
                  <span className="font-mono text-[11px] text-neutral-500 mr-1.5">
                    {c.jobNumber}
                  </span>
                  Next service · due {formatDate(c.dueDate)}
                </Link>
                <StageBadge stage={c.stage} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Activity log */}
      <Section title="Activity" className="mb-6">
        {job.activityLogs.length === 0 ? (
          <p className="text-[13px] text-neutral-500">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {job.activityLogs.map((log) => (
              <li key={log.id} className="flex items-start gap-2">
                <TechAvatar tech={log.user} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-neutral-700">
                    {log.description}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {log.user?.name ?? "System"} ·{" "}
                    {new Date(log.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function channelLabel(
  channel: "PHONE" | "EMAIL" | "TEXT" | "IN_PERSON" | "OTHER",
): string {
  switch (channel) {
    case "PHONE":
      return "Call";
    case "EMAIL":
      return "Email";
    case "TEXT":
      return "Text";
    case "IN_PERSON":
      return "In-person";
    default:
      return "Other";
  }
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] text-neutral-900 truncate">
        {value}
      </dd>
    </div>
  );
}

function Section({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <span className="text-[11px] text-neutral-500">{subtitle}</span>
        )}
      </div>
      {children}
    </section>
  );
}
