"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  Check,
  Download,
  Loader2,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  detectMapping,
  FIELD_META,
  FIELD_ORDER,
  type ImportField,
} from "@/lib/csv-import";
import {
  dryRunImport,
  commitImport,
  type DryRunResult,
  type ImportCommitResult,
  type ImportCommitRow,
} from "@/app/actions/import";

type FileState = {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
};

type View = "drop" | "mapping" | "validating" | "results" | "importing" | "done";

export function ImportClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<FileState | null>(null);
  const [mapping, setMapping] = useState<Record<string, ImportField | null>>({});
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<View>("drop");
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(
    null,
  );
  const [pending, start] = useTransition();

  function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const rows = (results.data as Record<string, string>[]).filter(
          (r) => Object.values(r).some((v) => (v ?? "").toString().trim() !== ""),
        );
        const headers = results.meta.fields ?? [];
        setFile({ name: f.name, headers, rows });
        setMapping(detectMapping(headers));
        setView("mapping");
        toast.success(`Parsed ${rows.length} rows`);
      },
      error: (err) => toast.error(err.message ?? "Failed to parse CSV"),
    });
  }

  function clearFile() {
    setFile(null);
    setMapping({});
    setDryRun(null);
    setCommitResult(null);
    setView("drop");
    if (inputRef.current) inputRef.current.value = "";
  }

  function runCommit() {
    if (!dryRun) return;
    const valid: ImportCommitRow[] = dryRun.rows
      .filter((r) => r.errors.length === 0)
      .map((r) => ({
        rowIndex: r.rowIndex,
        values: r.values as ImportCommitRow["values"],
      }));
    if (valid.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setView("importing");
    start(async () => {
      try {
        const result = await commitImport(valid);
        setCommitResult(result);
        setView("done");
        toast.success(
          `Imported ${result.summary.created} ${result.summary.created === 1 ? "job" : "jobs"}`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
        setView("results");
      }
    });
  }

  const mappedRequired = useMemo(() => {
    if (!file) return { mapped: 0, total: 0, missing: [] as ImportField[] };
    const required = FIELD_ORDER.filter((f) => FIELD_META[f].required);
    const mappedSet = new Set(
      Object.values(mapping).filter(Boolean) as ImportField[],
    );
    const missing = required.filter((f) => !mappedSet.has(f));
    return {
      mapped: required.length - missing.length,
      total: required.length,
      missing,
    };
  }, [file, mapping]);

  function runValidation() {
    if (!file) return;
    setView("validating");
    start(async () => {
      try {
        const result = await dryRunImport({
          rows: file.rows,
          mapping,
        });
        setDryRun(result);
        setView("results");
        if (result.summary.errored === 0) {
          toast.success(`All ${result.summary.total} rows look good`);
        } else {
          toast.warning(
            `${result.summary.valid} ready · ${result.summary.errored} with errors`,
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Validation failed");
        setView("mapping");
      }
    });
  }

  // ---------------- drop view ----------------
  if (view === "drop" || !file) {
    return (
      <DropZone
        dragging={dragging}
        setDragging={setDragging}
        onFile={handleFile}
        inputRef={inputRef}
      />
    );
  }

  // ---------------- validating view ----------------
  if (view === "validating") {
    return (
      <div className="mt-8 rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-neutral-500" />
        <p className="text-[13px] font-medium mt-3">Validating + geocoding…</p>
        <p className="text-[11px] text-neutral-500 mt-1">
          Parsing each row and looking up addresses. This takes a few seconds
          for ~60 rows.
        </p>
      </div>
    );
  }

  // ---------------- importing view ----------------
  if (view === "importing") {
    return (
      <div className="mt-8 rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-neutral-500" />
        <p className="text-[13px] font-medium mt-3">Importing…</p>
        <p className="text-[11px] text-neutral-500 mt-1">
          Creating customers, properties, and jobs. Don&apos;t close this tab.
        </p>
      </div>
    );
  }

  // ---------------- done view ----------------
  if (view === "done" && commitResult) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500 grid place-items-center shrink-0">
              <Check className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-[15px] font-semibold tracking-tight text-emerald-900">
                Imported {commitResult.summary.created}{" "}
                {commitResult.summary.created === 1 ? "job" : "jobs"}
              </h2>
              <p className="text-[12px] text-emerald-800 mt-1">
                {commitResult.summary.created} created
                {commitResult.summary.skipped > 0 && (
                  <> &middot; {commitResult.summary.skipped} skipped due to errors</>
                )}
              </p>
            </div>
          </div>
        </div>

        {commitResult.rowErrors.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-white overflow-hidden">
            <header className="px-4 py-3 border-b border-amber-100 bg-amber-50/40">
              <h3 className="text-[13px] font-semibold tracking-tight text-amber-900">
                {commitResult.rowErrors.length} rows were skipped
              </h3>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Fix these in the source CSV and re-upload. The successful rows
                above are already saved.
              </p>
            </header>
            <ul className="divide-y divide-neutral-100 text-[12px]">
              {commitResult.rowErrors.map((e) => (
                <li key={e.rowIndex} className="px-4 py-2 flex gap-3">
                  <span className="text-neutral-400 tabular-nums w-10 shrink-0">
                    #{e.rowIndex}
                  </span>
                  <span className="text-red-600">{e.error}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-4">
          <p className="text-[12px] text-neutral-600">
            The new jobs are now live on your dashboard, pipeline, and map.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/jobs"
              className="inline-flex items-center h-9 px-3 rounded-md border border-neutral-200 bg-white text-[13px] font-medium text-neutral-700 hover:border-neutral-300"
            >
              View jobs
            </Link>
            <button
              type="button"
              onClick={clearFile}
              className="inline-flex items-center h-9 px-3 rounded-md bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800"
            >
              Import more
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- results view ----------------
  if (view === "results" && dryRun) {
    const errored = dryRun.rows.filter((r) => r.errors.length > 0);
    const valid = dryRun.rows.filter((r) => r.errors.length === 0);
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setView("mapping")}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 hover:border-neutral-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to mapping
          </button>
          <button
            type="button"
            onClick={runCommit}
            disabled={pending || valid.length === 0}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-[13px] font-medium transition-colors",
              pending || valid.length === 0
                ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                : "bg-neutral-900 text-white hover:bg-neutral-800",
            )}
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Importing…
              </>
            ) : (
              <>Import {valid.length} valid {valid.length === 1 ? "row" : "rows"}</>
            )}
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCell
            label="Total"
            value={dryRun.summary.total}
            tone="neutral"
          />
          <SummaryCell
            label="Ready to import"
            value={dryRun.summary.valid}
            tone="emerald"
          />
          <SummaryCell
            label="With errors"
            value={dryRun.summary.errored}
            tone={dryRun.summary.errored > 0 ? "amber" : "neutral"}
          />
        </div>

        {errored.length > 0 && (
          <ResultTable
            title={`${errored.length} rows need fixing`}
            rows={errored}
            errored
            allHeaders={file.headers}
          />
        )}
        <ResultTable
          title={`${valid.length} rows ready`}
          rows={valid}
          errored={false}
        />
      </div>
    );
  }

  // ---------------- mapping view ----------------
  return (
    <div className="mt-6 space-y-4">
      {/* File summary */}
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <div className="h-8 w-8 rounded-md bg-neutral-100 grid place-items-center shrink-0">
          <FileText className="h-4 w-4 text-neutral-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate">{file.name}</div>
          <div className="text-[11px] text-neutral-500 tabular-nums">
            {file.rows.length} {file.rows.length === 1 ? "row" : "rows"} ·{" "}
            {file.headers.length} columns
          </div>
        </div>
        <button
          type="button"
          onClick={clearFile}
          className="h-8 w-8 grid place-items-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mapping status */}
      <div
        className={cn(
          "flex items-start gap-2 rounded-xl border px-4 py-3",
          mappedRequired.missing.length === 0
            ? "border-emerald-200 bg-emerald-50/40"
            : "border-amber-200 bg-amber-50/40",
        )}
      >
        {mappedRequired.missing.length === 0 ? (
          <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 text-[12px]">
          <p
            className={cn(
              "font-medium",
              mappedRequired.missing.length === 0
                ? "text-emerald-800"
                : "text-amber-900",
            )}
          >
            {mappedRequired.missing.length === 0
              ? `All ${mappedRequired.total} required columns mapped`
              : `${mappedRequired.mapped} of ${mappedRequired.total} required columns mapped`}
          </p>
          {mappedRequired.missing.length > 0 && (
            <p className="text-amber-800 mt-0.5">
              Still missing:{" "}
              {mappedRequired.missing.map((f) => FIELD_META[f].label).join(", ")}.
              Assign a column to each below, or add the field to your CSV and
              re-upload.
            </p>
          )}
        </div>
      </div>

      {/* Column mapping */}
      <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <header className="px-4 py-3 border-b border-neutral-100">
          <h2 className="text-[13px] font-semibold tracking-tight">
            Column mapping
          </h2>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Auto-detected by header name. Adjust any that look wrong.
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
          <MappingColumn
            title="CSV column"
            rows={file.headers.map((h) => ({
              header: h,
              value: mapping[h] ?? null,
              onChange: (v) => setMapping((m) => ({ ...m, [h]: v })),
            }))}
          />
          <UnmappedRequired
            mapping={mapping}
            onSetMapping={setMapping}
            headers={file.headers}
          />
        </div>
      </section>

      {/* Preview */}
      <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <header className="flex items-baseline justify-between px-4 py-3 border-b border-neutral-100">
          <h2 className="text-[13px] font-semibold tracking-tight">Preview</h2>
          <span className="text-[11px] text-neutral-500 tabular-nums">
            Showing first {Math.min(10, file.rows.length)} of {file.rows.length}
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wider text-neutral-500 w-10">
                  #
                </th>
                {file.headers.map((h) => {
                  const mapped = mapping[h];
                  return (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wider text-neutral-500 whitespace-nowrap"
                    >
                      <div className="flex flex-col">
                        <span>{h}</span>
                        <span
                          className={cn(
                            "text-[9px] normal-case tracking-normal font-normal mt-0.5",
                            mapped ? "text-emerald-700" : "text-neutral-400",
                          )}
                        >
                          → {mapped ? FIELD_META[mapped].label : "ignored"}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {file.rows.slice(0, 10).map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  <td className="px-3 py-2 text-neutral-400 tabular-nums">
                    {i + 1}
                  </td>
                  {file.headers.map((h) => (
                    <td
                      key={h}
                      className="px-3 py-2 text-neutral-700 truncate max-w-[200px]"
                    >
                      {row[h] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Validate CTA */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-4">
        <div>
          <p className="text-[13px] font-medium">Validate & geocode</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Runs server-side: checks every row and looks up each address.
            No writes until you confirm.
          </p>
        </div>
        <button
          type="button"
          onClick={runValidation}
          disabled={pending || mappedRequired.missing.length > 0}
          className={cn(
            "inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-[13px] font-medium transition-all shrink-0",
            pending || mappedRequired.missing.length > 0
              ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
              : "bg-neutral-900 text-white hover:bg-neutral-800",
          )}
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Validating…
            </>
          ) : (
            <>
              <MapPin className="h-3.5 w-3.5" />
              Validate {file.rows.length} rows
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DropZone({
  dragging,
  setDragging,
  onFile,
  inputRef,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onFile: (f: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="mt-6">
      <label
        htmlFor="csv-input"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-14 cursor-pointer transition-colors",
          dragging
            ? "border-neutral-400 bg-neutral-100/60"
            : "border-neutral-300 bg-white hover:border-neutral-400",
        )}
      >
        <div className="h-10 w-10 rounded-full bg-neutral-100 grid place-items-center mb-1">
          <Upload className="h-4 w-4 text-neutral-600" />
        </div>
        <p className="text-[14px] font-medium text-neutral-900">
          Drop your CSV here or click to upload
        </p>
        <p className="text-[12px] text-neutral-500">
          We&apos;ll auto-detect the column mapping from the header row.
        </p>
        <input
          id="csv-input"
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          Expected columns:{" "}
          {FIELD_ORDER.filter((f) => FIELD_META[f].required)
            .map((f) => FIELD_META[f].label)
            .join(", ")}
          .
        </span>
        <a
          href="/api/import/template"
          download="citrotech-import-template.csv"
          className="inline-flex items-center gap-1 font-medium text-neutral-700 hover:text-neutral-900"
        >
          <Download className="h-3 w-3" />
          Download template
        </a>
      </div>
    </div>
  );
}

function MappingColumn({
  title,
  rows,
}: {
  title: string;
  rows: {
    header: string;
    value: ImportField | null;
    onChange: (v: ImportField | null) => void;
  }[];
}) {
  return (
    <div>
      <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-medium text-neutral-500 bg-neutral-50 border-b border-neutral-100">
        {title}
      </div>
      <ul className="divide-y divide-neutral-100">
        {rows.map((r) => (
          <li
            key={r.header}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <span className="text-[12px] font-mono text-neutral-700 truncate max-w-[180px]">
              {r.header}
            </span>
            <select
              value={r.value ?? ""}
              onChange={(e) =>
                r.onChange((e.target.value as ImportField) || null)
              }
              className="text-[12px] h-7 rounded-md border border-neutral-200 bg-white px-2 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400"
            >
              <option value="">— ignore —</option>
              {FIELD_ORDER.map((f) => (
                <option key={f} value={f}>
                  {FIELD_META[f].label}
                  {FIELD_META[f].required ? " *" : ""}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UnmappedRequired({
  mapping,
  onSetMapping,
  headers,
}: {
  mapping: Record<string, ImportField | null>;
  onSetMapping: (m: Record<string, ImportField | null>) => void;
  headers: string[];
}) {
  const mappedSet = new Set(Object.values(mapping).filter(Boolean));
  const required = FIELD_ORDER.filter((f) => FIELD_META[f].required);
  return (
    <div>
      <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-medium text-neutral-500 bg-neutral-50 border-b border-neutral-100">
        Required field
      </div>
      <ul className="divide-y divide-neutral-100">
        {required.map((f) => {
          const mapped = mappedSet.has(f);
          const current =
            Object.entries(mapping).find(([, v]) => v === f)?.[0] ?? "";
          return (
            <li
              key={f}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="text-[12px] font-medium text-neutral-900 truncate max-w-[180px]">
                {FIELD_META[f].label}
                {FIELD_META[f].hint && (
                  <span className="ml-1.5 text-[10px] font-normal text-neutral-500">
                    {FIELD_META[f].hint}
                  </span>
                )}
              </span>
              <select
                value={current}
                onChange={(e) => {
                  const nextHeader = e.target.value;
                  const next = { ...mapping };
                  for (const [h, v] of Object.entries(next)) {
                    if (v === f) next[h] = null;
                  }
                  if (nextHeader) next[nextHeader] = f;
                  onSetMapping(next);
                }}
                className={cn(
                  "text-[12px] h-7 rounded-md border px-2 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400",
                  mapped
                    ? "border-neutral-200 bg-white"
                    : "border-amber-300 bg-amber-50/60",
                )}
              >
                <option value="">— unmapped —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "emerald" | "amber";
}) {
  const dot =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-neutral-400";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </span>
      </div>
      <div className="mt-3 text-[28px] font-semibold tracking-tight tabular-nums leading-none">
        {value}
      </div>
    </div>
  );
}

function ResultTable({
  title,
  rows,
  errored,
  allHeaders,
}: {
  title: string;
  rows: DryRunResult["rows"];
  errored: boolean;
  allHeaders?: string[];
}) {
  if (rows.length === 0) return null;

  function exportErrored() {
    if (!allHeaders) return;
    const csvEscape = (v: string) => {
      if (v == null) return "";
      const s = String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = [...allHeaders, "_row", "_error"];
    const lines = [
      headers.map(csvEscape).join(","),
      ...rows.map((r) =>
        [
          ...allHeaders.map((h) => csvEscape(r.raw[h] ?? "")),
          String(r.rowIndex),
          csvEscape(r.errors.join("; ")),
        ].join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n") + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "citrotech-import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
        {errored && allHeaders && (
          <button
            type="button"
            onClick={exportErrored}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:border-neutral-300"
          >
            <Download className="h-3 w-3" />
            Download errored rows
          </button>
        )}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-neutral-50 border-b border-neutral-100">
            <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="text-left font-medium px-3 py-2 w-10">#</th>
              <th className="text-left font-medium px-3 py-2">Property</th>
              <th className="text-left font-medium px-3 py-2">Customer</th>
              <th className="text-left font-medium px-3 py-2">Geocoded</th>
              {errored && (
                <th className="text-left font-medium px-3 py-2">Issue</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.rowIndex}
                className="border-b border-neutral-100 last:border-b-0"
              >
                <td className="px-3 py-2 text-neutral-400 tabular-nums">
                  {r.rowIndex}
                </td>
                <td className="px-3 py-2 text-neutral-700">
                  {r.values.propertyName ?? (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-700">
                  {r.values.customerName ?? (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {r.geocodedAddress ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Check className="h-3 w-3" />
                      {r.geocodedAddress}
                    </span>
                  ) : r.geocodeError ? (
                    <span className="text-red-600">{r.geocodeError}</span>
                  ) : (
                    "—"
                  )}
                </td>
                {errored && (
                  <td className="px-3 py-2 text-red-600">
                    {r.errors.join("; ")}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
