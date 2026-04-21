"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  updateJobDetails,
  type UpdateJobDetailsInput,
} from "@/app/actions/jobs";
import type { Product, Region } from "@/generated/prisma/enums";
import type { JobDetail } from "@/lib/job-detail-query";
import { cn } from "@/lib/utils";

const PRODUCTS: { value: Product; label: string }[] = [
  { value: "MFB_31", label: "MFB-31" },
  { value: "MFB_34", label: "MFB-34" },
  { value: "MFB_35_FM", label: "MFB-35-FM" },
];

const REGIONS: { value: Region; label: string }[] = [
  { value: "NORCAL", label: "NorCal" },
  { value: "SOCAL", label: "SoCal" },
  { value: "OTHER", label: "Other" },
];

const inputCls =
  "block w-full h-9 px-3 text-[13px] border border-neutral-200 bg-white rounded-md placeholder:text-neutral-400 transition-all focus:outline-none focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/8";

// ISO-date-only slice; the schema stores Dates but the date input wants yyyy-mm-dd.
function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function EditJobDialog({ job }: { job: JobDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  // Customer
  const [customerName, setCustomerName] = useState(job.property.customer.name);
  const [customerEmail, setCustomerEmail] = useState(
    job.property.customer.email ?? "",
  );
  const [customerPhone, setCustomerPhone] = useState(
    job.property.customer.phone ?? "",
  );
  // Property
  const [propertyName, setPropertyName] = useState(job.property.name);
  const [address, setAddress] = useState(job.property.address);
  const [city, setCity] = useState(job.property.city);
  const [state, setState] = useState(job.property.state);
  const [zip, setZip] = useState(job.property.zip ?? "");
  const [region, setRegion] = useState<Region>(job.property.region);
  // Job
  const [product, setProduct] = useState<Product>(job.product);
  const [sqft, setSqft] = useState<string>(String(job.sqftTreated));
  const [contractValue, setContractValue] = useState<string>(
    job.contractValue ? String(Number(job.contractValue)) : "",
  );
  const [lastServiceDate, setLastServiceDate] = useState<string>(
    toDateInput(job.lastServiceDate),
  );
  const [dueDate, setDueDate] = useState<string>(toDateInput(job.dueDate));
  const [intervalMonths, setIntervalMonths] = useState<string>(
    String(job.maintenanceIntervalMonths),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sqftNum = Number(sqft.replace(/[,\s]/g, ""));
    if (!Number.isFinite(sqftNum) || sqftNum <= 0) {
      toast.error("Sq ft must be a positive number");
      return;
    }
    const contractNum = contractValue.trim()
      ? Number(contractValue.replace(/[$,\s]/g, ""))
      : null;
    const intervalNum = Number(intervalMonths) || 12;

    // Build a diff payload — only send what changed, so the server logs
    // only the fields that actually moved.
    const customerChanges: UpdateJobDetailsInput["customer"] = {};
    if (customerName.trim() !== job.property.customer.name)
      customerChanges.name = customerName.trim();
    if ((customerEmail.trim() || null) !== (job.property.customer.email ?? null))
      customerChanges.email = customerEmail.trim() || null;
    if ((customerPhone.trim() || null) !== (job.property.customer.phone ?? null))
      customerChanges.phone = customerPhone.trim() || null;

    const propertyChanges: UpdateJobDetailsInput["property"] = {};
    if (propertyName.trim() !== job.property.name)
      propertyChanges.name = propertyName.trim();
    if (address.trim() !== job.property.address)
      propertyChanges.address = address.trim();
    if (city.trim() !== job.property.city) propertyChanges.city = city.trim();
    if (state.toUpperCase() !== job.property.state)
      propertyChanges.state = state.toUpperCase();
    if ((zip.trim() || null) !== (job.property.zip ?? null))
      propertyChanges.zip = zip.trim() || null;
    if (region !== job.property.region) propertyChanges.region = region;

    const jobChanges: UpdateJobDetailsInput["job"] = {};
    if (product !== job.product) jobChanges.product = product;
    if (sqftNum !== job.sqftTreated) jobChanges.sqftTreated = sqftNum;
    if (contractNum !== (job.contractValue ? Number(job.contractValue) : null))
      jobChanges.contractValue = contractNum;
    const currentLastService = toDateInput(job.lastServiceDate);
    if (lastServiceDate !== currentLastService)
      jobChanges.lastServiceDate = lastServiceDate || null;
    const currentDue = toDateInput(job.dueDate);
    if (dueDate !== currentDue) jobChanges.dueDate = dueDate;
    if (intervalNum !== job.maintenanceIntervalMonths)
      jobChanges.maintenanceIntervalMonths = intervalNum;

    const payload: UpdateJobDetailsInput = {};
    if (Object.keys(customerChanges).length) payload.customer = customerChanges;
    if (Object.keys(propertyChanges).length) payload.property = propertyChanges;
    if (Object.keys(jobChanges).length) payload.job = jobChanges;

    if (Object.keys(payload).length === 0) {
      toast.message("No changes to save");
      setOpen(false);
      return;
    }

    start(async () => {
      const result = await updateJobDetails(job.id, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) setOpen(v);
      }}
    >
      <DialogTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50">
        <Pencil className="h-3.5 w-3.5" />
        Edit details
      </DialogTrigger>

      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {job.jobNumber}</DialogTitle>
          <DialogDescription>
            Changes to the address re-geocode the property. Changing the due
            date rebuilds the T-90/60/30/overdue reminder schedule for any
            reminders that haven&apos;t fired yet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 pt-1">
          <Section label="Customer">
            <Field label="Customer name">
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="contact@example.com"
                  className={inputCls}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+1-555-0100"
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          <Section label="Property">
            <Field label="Property name">
              <input
                required
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Street address" hint="Re-geocodes on change">
              <input
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-[1fr_80px_100px_auto] gap-3">
              <Field label="City">
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="State">
                <input
                  value={state}
                  onChange={(e) =>
                    setState(e.target.value.toUpperCase().slice(0, 2))
                  }
                  maxLength={2}
                  className={cn(inputCls, "uppercase tabular-nums")}
                />
              </Field>
              <Field label="ZIP">
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className={cn(inputCls, "tabular-nums")}
                />
              </Field>
              <Field label="Region">
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region)}
                  className={cn(inputCls, "pr-6")}
                >
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section label="Service">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Product">
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value as Product)}
                  className={inputCls}
                >
                  {PRODUCTS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sq ft">
                <input
                  required
                  inputMode="numeric"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  className={cn(inputCls, "tabular-nums")}
                />
              </Field>
              <Field label="Contract $">
                <input
                  inputMode="decimal"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  placeholder="18200"
                  className={cn(inputCls, "tabular-nums")}
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Last service">
                <input
                  type="date"
                  value={lastServiceDate}
                  onChange={(e) => setLastServiceDate(e.target.value)}
                  className={cn(inputCls, "tabular-nums")}
                />
              </Field>
              <Field label="Due date" hint="Rebuilds reminders">
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={cn(inputCls, "tabular-nums")}
                />
              </Field>
              <Field label="Interval (months)">
                <input
                  inputMode="numeric"
                  value={intervalMonths}
                  onChange={(e) => setIntervalMonths(e.target.value)}
                  className={cn(inputCls, "tabular-nums")}
                />
              </Field>
            </div>
          </Section>

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="inline-flex items-center h-9 px-3 rounded-md border border-neutral-200 bg-white text-[13px] font-medium transition-colors hover:bg-neutral-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-neutral-900 text-white text-[13px] font-medium transition-all hover:bg-neutral-800 disabled:opacity-60 shadow-elev-1"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-medium text-neutral-700">
          {label}
        </span>
        {hint ? (
          <span className="text-[10px] text-neutral-400">{hint}</span>
        ) : null}
      </div>
      {children}
    </label>
  );
}
