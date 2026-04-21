"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, FileText, X, AlertCircle, Check, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  detectMapping,
  FIELD_META,
  FIELD_ORDER,
  type ImportField,
} from "@/lib/csv-import";

type FileState = {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
};

export function ImportClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<FileState | null>(null);
  const [mapping, setMapping] = useState<Record<string, ImportField | null>>({});
  const [dragging, setDragging] = useState(false);

  function pickFile() {
    inputRef.current?.click();
  }

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
        toast.success(`Parsed ${rows.length} rows`);
      },
      error: (err) => {
        toast.error(err.message ?? "Failed to parse CSV");
      },
    });
  }

  function clearFile() {
    setFile(null);
    setMapping({});
    if (inputRef.current) inputRef.current.value = "";
  }

  // Count how many required fields are currently mapped.
  const mappedRequired = useMemo(() => {
    if (!file) return { mapped: 0, total: 0, missing: [] as ImportField[] };
    const required = FIELD_ORDER.filter((f) => FIELD_META[f].required);
    const mappedSet = new Set(Object.values(mapping).filter(Boolean) as ImportField[]);
    const missing = required.filter((f) => !mappedSet.has(f));
    return {
      mapped: required.length - missing.length,
      total: required.length,
      missing,
    };
  }, [file, mapping]);

  if (!file) {
    return <DropZone dragging={dragging} setDragging={setDragging} onFile={handleFile} onPick={pickFile} inputRef={inputRef} />;
  }

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

      {/* Next-step CTA — disabled until 7.2 / 7.3 ship */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 bg-white/60 px-4 py-4">
        <p className="text-[12px] text-neutral-600 leading-relaxed">
          Next: validate every row, geocode addresses, and import. That flow
          ships in the follow-up commits.
        </p>
        <button
          type="button"
          disabled
          className="h-9 px-3 rounded-md bg-neutral-200 text-neutral-500 text-[13px] font-medium cursor-not-allowed shrink-0"
        >
          Validate & import
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
  onPick,
  inputRef,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onFile: (f: File) => void;
  onPick: () => void;
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
          Expected columns: {FIELD_ORDER.filter((f) => FIELD_META[f].required).map((f) => FIELD_META[f].label).join(", ")}.
        </span>
        <a
          href="/api/import/template"
          download
          className="inline-flex items-center gap-1 font-medium text-neutral-700 hover:text-neutral-900"
          onClick={(e) => {
            // 7.4 ships the real template endpoint; guard until then.
            e.preventDefault();
            onPick();
          }}
        >
          <Download className="h-3 w-3" />
          Template
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
          // Which CSV header currently maps to this field?
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
                  // Clear any existing header mapped to this field first.
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
