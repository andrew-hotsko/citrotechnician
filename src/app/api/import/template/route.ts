import { NextResponse } from "next/server";
import { FIELD_META, FIELD_ORDER } from "@/lib/csv-import";

const SAMPLE_ROWS = [
  [
    "Redwood Estates HOA",
    "Redwood Estates HOA",
    "4100 Oak Hollow Dr",
    "Folsom",
    "CA",
    "95630",
    "System",
    "18200",
    "2025-04-25",
    "12",
    "contact@redwoodestates.example.com",
    "+1-555-0100",
    "NORCAL",
  ],
  [
    "La Jolla Shores Owner",
    "La Jolla Shores Villa",
    "8100 Camino Del Oro",
    "La Jolla",
    "CA",
    "92037",
    "Spray",
    "9100",
    "2025-05-12",
    "12",
    "",
    "",
    "SOCAL",
  ],
];

function csvEscape(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const headers = FIELD_ORDER.map((f) => FIELD_META[f].label);
  const lines = [
    headers.map(csvEscape).join(","),
    ...SAMPLE_ROWS.map((row) => row.map(csvEscape).join(",")),
  ];
  const csv = "\uFEFF" + lines.join("\n") + "\n"; // BOM so Excel reads UTF-8 right

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="citrotech-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
