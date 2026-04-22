"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
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
import { createJob, type CreateJobInput } from "@/app/actions/jobs";
import type { Product, Region } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type Tech = { id: string; name: string; initials: string | null; color: string | null };

const PRODUCTS: { value: Product; label: string }[] = [
  { value: "SYSTEM", label: "System" },
  { value: "SPRAY", label: "Spray" },
];

const REGIONS: { value: Region; label: string }[] = [
  { value: "NORCAL", label: "NorCal" },
  { value: "SOCAL", label: "SoCal" },
  { value: "OTHER", label: "Other" },
];

const inputCls =
  "block w-full h-9 px-3 text-[13px] border border-neutral-200 bg-white rounded-md placeholder:text-neutral-400 transition-all focus:outline-none focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/8";

export function NewJobDialog({ techs }: { techs: Tech[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  // Customer
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  // Property
  const [propertyName, setPropertyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("CA");
  const [zip, setZip] = useState("");
  const [region, setRegion] = useState<Region | "">("");
  // Service
  const [product, setProduct] = useState<Product>("SYSTEM");
  const [lastServiceDate, setLastServiceDate] = useState<string>("");
  const [intervalMonths, setIntervalMonths] = useState<string>("12");
  const [assignedTechId, setAssignedTechId] = useState<string>("");

  function reset() {
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setPropertyName("");
    setAddress("");
    setCity("");
    setState("CA");
    setZip("");
    setRegion("");
    setProduct("SYSTEM");
    setLastServiceDate("");
    setIntervalMonths("12");
    setAssignedTechId("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const intervalNum = intervalMonths.trim() ? Number(intervalMonths) : 12;

    const payload: CreateJobInput = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      propertyName: propertyName.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim() || "CA",
      zip: zip.trim() || undefined,
      region: region || undefined,
      product,
      lastServiceDate: lastServiceDate || undefined,
      intervalMonths: intervalNum,
      assignedTechId: assignedTechId || undefined,
    };

    start(async () => {
      const result = await createJob(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Created ${result.jobNumber}`);
      reset();
      setOpen(false);
      router.push(`/jobs/${result.jobId}`);
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
      <DialogTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 text-white text-[12px] font-medium transition-all hover:bg-neutral-800 shadow-elev-1">
        <Plus className="h-3.5 w-3.5" />
        New job
      </DialogTrigger>

      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New job</DialogTitle>
          <DialogDescription>
            Create a single maintenance job. The address is geocoded so it
            lands correctly on the map. Reminders at T-90/60/30/overdue are
            scheduled automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 pt-1">
          <Section label="Customer">
            <Field label="Customer name" hint="Existing customers with the same name are reused">
              <input
                required
                autoFocus
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Redwood Estates HOA"
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
                placeholder="Redwood Estates HOA"
                className={inputCls}
              />
            </Field>
            <Field label="Street address">
              <input
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="4100 Oak Hollow Dr"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-[1fr_80px_100px_auto] gap-3">
              <Field label="City">
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Folsom"
                  className={inputCls}
                />
              </Field>
              <Field label="State">
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                  maxLength={2}
                  className={cn(inputCls, "uppercase tabular-nums")}
                />
              </Field>
              <Field label="ZIP">
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="95630"
                  className={cn(inputCls, "tabular-nums")}
                />
              </Field>
              <Field label="Region" hint="Auto from ZIP">
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region | "")}
                  className={cn(inputCls, "pr-6")}
                >
                  <option value="">Auto</option>
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
            <div className="grid grid-cols-2 gap-3">
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
              <Field
                label="Last service"
                hint="Leave blank for new install"
              >
                <input
                  type="date"
                  value={lastServiceDate}
                  onChange={(e) => setLastServiceDate(e.target.value)}
                  className={cn(inputCls, "tabular-nums")}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interval (months)">
                <input
                  inputMode="numeric"
                  value={intervalMonths}
                  onChange={(e) => setIntervalMonths(e.target.value)}
                  placeholder="12"
                  className={cn(inputCls, "tabular-nums")}
                />
              </Field>
              <Field label="Assign to" hint="Optional">
                <select
                  value={assignedTechId}
                  onChange={(e) => setAssignedTechId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Unassigned</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
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
                  Creating
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create job
                </>
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
