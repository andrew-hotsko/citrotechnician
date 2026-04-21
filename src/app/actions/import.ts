"use server";

import { requireUser } from "@/lib/auth";
import { parseRow, type ImportField, type ParsedRow } from "@/lib/csv-import";
import { geocodeBatch } from "@/lib/geocode";

export type DryRunRow = ParsedRow & {
  geocodeError?: string;
  geocodedAddress?: string;
};

export type DryRunResult = {
  ok: boolean;
  rows: DryRunRow[];
  summary: {
    total: number;
    valid: number;
    errored: number;
  };
};

/**
 * Client sends the parsed CSV (rows + mapping). Server validates each row
 * and geocodes the address to produce a preview with all errors surfaced
 * BEFORE any write. Side-effect free.
 */
export async function dryRunImport(payload: {
  rows: Record<string, string>[];
  mapping: Record<string, ImportField | null>;
}): Promise<DryRunResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    throw new Error("Only admins and ops managers can import");
  }

  const parsed: DryRunRow[] = payload.rows.map((raw, i) => parseRow(raw, payload.mapping, i + 1));

  // Geocode the rows that have the minimum fields present. Use rowIndex as key.
  const geocodeInputs = parsed
    .filter(
      (r) =>
        r.values.address &&
        r.values.city &&
        r.errors.length === 0,
    )
    .map((r) => ({
      key: String(r.rowIndex),
      street: r.values.address!,
      city: r.values.city!,
      state: r.values.state ?? "CA",
      zip: r.values.zip,
    }));

  const geo = await geocodeBatch(geocodeInputs);

  for (const row of parsed) {
    const g = geo[String(row.rowIndex)];
    if (!g) continue;
    if (g.ok) {
      row.geocodedAddress = g.value.formattedAddress;
      // Stash the coordinates onto the values so 7.3's commit action can read them.
      (row.values as Record<string, unknown>).latitude = g.value.latitude;
      (row.values as Record<string, unknown>).longitude = g.value.longitude;
    } else {
      row.geocodeError = g.error;
      row.errors.push(`Geocoding failed: ${g.error}`);
    }
  }

  const valid = parsed.filter((r) => r.errors.length === 0).length;
  return {
    ok: true,
    rows: parsed,
    summary: {
      total: parsed.length,
      valid,
      errored: parsed.length - valid,
    },
  };
}
