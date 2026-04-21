import { loadTechJob } from "@/lib/tech-job";
import { SignatureClient } from "./signature-client";

export default async function SignaturePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { job } = await loadTechJob(jobId);

  return (
    <div className="px-4 py-4 max-w-md mx-auto pb-24">
      <h2 className="text-[18px] font-semibold tracking-tight">
        Customer signature
      </h2>
      <p className="text-[12px] text-neutral-500 mt-0.5">
        {job.property.customer.name} · {job.jobNumber}
      </p>
      <p className="text-[11px] text-neutral-500 mt-3 leading-relaxed">
        Hand the device to the customer to sign. Signature confirms the
        application was completed satisfactorily and the customer accepts the
        work.
      </p>

      <SignatureClient
        jobId={job.id}
        existing={job.customerSignature}
        locked={job.stage === "COMPLETED"}
      />
    </div>
  );
}
