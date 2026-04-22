/**
 * CitroTech CSV import — schema, header detection, and row parsing.
 * Pure data helpers. No server-side effects; runs in both client + server.
 */

export type ImportField =
  | "customerName"
  | "propertyName"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "product"
  | "sqft"
  | "contractValue"
  | "lastServiceDate"
  | "intervalMonths"
  | "customerEmail"
  | "customerPhone"
  | "region";

export const FIELD_META: Record<
  ImportField,
  { label: string; required: boolean; hint?: string }
> = {
  customerName:     { label: "Customer", required: true },
  propertyName:     { label: "Property", required: true },
  address:          { label: "Address", required: true },
  city:             { label: "City", required: true },
  state:            { label: "State", required: false, hint: "default CA" },
  zip:              { label: "ZIP", required: false },
  product:          { label: "Product", required: true, hint: "System / Spray" },
  sqft:             { label: "Sq ft", required: true },
  contractValue:    { label: "Contract value", required: false, hint: "USD, optional" },
  lastServiceDate:  { label: "Last service date", required: true, hint: "ISO or MM/DD/YYYY" },
  intervalMonths:   { label: "Interval (months)", required: false, hint: "default 12" },
  customerEmail:    { label: "Customer email", required: false },
  customerPhone:    { label: "Customer phone", required: false },
  region:           { label: "Region", required: false, hint: "NORCAL / SOCAL / OTHER; inferred from state if blank" },
};

export const FIELD_ORDER: ImportField[] = [
  "customerName",
  "propertyName",
  "address",
  "city",
  "state",
  "zip",
  "product",
  "sqft",
  "contractValue",
  "lastServiceDate",
  "intervalMonths",
  "customerEmail",
  "customerPhone",
  "region",
];

/** Canonicalize a CSV header for matching (lowercase, strip spaces/underscores/hyphens). */
function canon(s: string): string {
  return s.toLowerCase().replace(/[\s_\-/]+/g, "");
}

/** Header aliases — every reasonable name a user might type. */
const ALIASES: Record<ImportField, string[]> = {
  customerName:    ["customer", "customername", "client", "clientname", "account"],
  propertyName:    ["property", "propertyname", "site", "sitename", "location", "locationname"],
  address:         ["address", "addressline", "street", "streetaddress"],
  city:            ["city", "town"],
  state:           ["state", "st"],
  zip:             ["zip", "zipcode", "postalcode", "postcode"],
  product:         ["product", "productcode", "sku", "mfb"],
  sqft:            ["sqft", "squarefeet", "area", "squarefootage", "size"],
  contractValue:   ["contractvalue", "value", "contract", "price", "amount", "usd"],
  lastServiceDate: ["lastservicedate", "lastservice", "serviceddate", "lastapplication", "applieddate"],
  intervalMonths:  ["interval", "intervalmonths", "cadence", "frequency"],
  customerEmail:   ["email", "customeremail", "clientemail"],
  customerPhone:   ["phone", "customerphone", "clientphone", "tel", "telephone"],
  region:          ["region", "area", "zone"],
};

/**
 * Given a CSV header row, produce an auto-detected mapping from each header
 * to our canonical field (or null if no confident match).
 */
export function detectMapping(headers: string[]): Record<string, ImportField | null> {
  const mapping: Record<string, ImportField | null> = {};
  for (const raw of headers) {
    const c = canon(raw);
    let match: ImportField | null = null;
    for (const [field, alias] of Object.entries(ALIASES) as [ImportField, string[]][]) {
      if (alias.some((a) => a === c)) {
        match = field;
        break;
      }
    }
    // Allow partial contains match as a weaker fallback.
    if (!match) {
      for (const [field, alias] of Object.entries(ALIASES) as [ImportField, string[]][]) {
        if (alias.some((a) => c.includes(a) || a.includes(c))) {
          match = field;
          break;
        }
      }
    }
    mapping[raw] = match;
  }
  return mapping;
}

// --- Value parsers -----------------------------------------------------------

const PRODUCT_MAP: Record<string, "SYSTEM" | "SPRAY"> = {
  system: "SYSTEM",
  spray: "SPRAY",
  // Legacy MFB codes still accepted so old CSVs import cleanly.
  mfb31: "SYSTEM",
  "mfb-31": "SYSTEM",
  mfb34: "SYSTEM",
  "mfb-34": "SYSTEM",
  mfb35fm: "SPRAY",
  "mfb-35-fm": "SPRAY",
  mfb35: "SPRAY",
  "mfb-35": "SPRAY",
};

export function parseProduct(raw: string): "SYSTEM" | "SPRAY" | null {
  const c = raw.toLowerCase().replace(/[\s_-]+/g, "");
  return PRODUCT_MAP[c] ?? null;
}

export function parseRegion(
  raw: string | undefined,
): "NORCAL" | "SOCAL" | "OTHER" | null {
  if (!raw) return null;
  const c = raw.toLowerCase().replace(/[\s_-]+/g, "");
  if (c === "norcal" || c === "northerncalifornia" || c === "northca") return "NORCAL";
  if (c === "socal" || c === "southerncalifornia" || c === "southca") return "SOCAL";
  if (c === "other") return "OTHER";
  return null;
}

export function parseSqft(raw: string): number | null {
  const clean = raw.replace(/[,\s]/g, "");
  const n = parseInt(clean, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const clean = raw.replace(/[$,\s]/g, "");
  const n = parseFloat(clean);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Try ISO first.
  const iso = new Date(trimmed);
  if (!isNaN(iso.getTime())) return iso;
  // Try MM/DD/YYYY.
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, mo, d, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(year, Number(mo) - 1, Number(d));
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

/** NorCal/SoCal inference from the first part of the ZIP code (very rough). */
export function inferRegionFromZip(zip: string | undefined): "NORCAL" | "SOCAL" | null {
  if (!zip) return null;
  const n = parseInt(zip.trim().slice(0, 3), 10);
  if (!Number.isFinite(n)) return null;
  // 900-935 SoCal, 936-961 NorCal (approximate CA ZIP3 split).
  if (n >= 900 && n <= 935) return "SOCAL";
  if (n >= 936 && n <= 961) return "NORCAL";
  return null;
}

export type ParsedRow = {
  rowIndex: number; // 1-based within the file (excluding header)
  raw: Record<string, string>;
  values: Partial<{
    customerName: string;
    propertyName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    product: "SYSTEM" | "SPRAY";
    sqft: number;
    contractValue: number;
    lastServiceDate: Date;
    intervalMonths: number;
    customerEmail: string;
    customerPhone: string;
    region: "NORCAL" | "SOCAL" | "OTHER";
  }>;
  errors: string[];
};

/** Parse and validate a single CSV row given the column → field mapping. */
export function parseRow(
  raw: Record<string, string>,
  mapping: Record<string, ImportField | null>,
  rowIndex: number,
): ParsedRow {
  const values: ParsedRow["values"] = {};
  const errors: string[] = [];

  // Invert mapping so we can ask "which CSV header is customerName?"
  const fieldToHeader = new Map<ImportField, string>();
  for (const [header, field] of Object.entries(mapping)) {
    if (field) fieldToHeader.set(field, header);
  }

  const get = (field: ImportField): string | undefined => {
    const header = fieldToHeader.get(field);
    if (!header) return undefined;
    const v = raw[header];
    return typeof v === "string" ? v.trim() : undefined;
  };

  // Strings (pass-through, validate non-empty on required).
  const stringFields: ImportField[] = [
    "customerName",
    "propertyName",
    "address",
    "city",
    "customerEmail",
    "customerPhone",
  ];
  for (const f of stringFields) {
    const v = get(f);
    if (v) (values as Record<string, unknown>)[f] = v;
  }

  values.state = get("state") || "CA";
  const zipRaw = get("zip");
  if (zipRaw) values.zip = zipRaw;

  // Product (required).
  const productRaw = get("product");
  if (productRaw) {
    const p = parseProduct(productRaw);
    if (p) values.product = p;
    else errors.push(`Unknown product "${productRaw}" — expected MFB-31, MFB-34, or MFB-35-FM`);
  }

  // Sqft (required).
  const sqftRaw = get("sqft");
  if (sqftRaw) {
    const n = parseSqft(sqftRaw);
    if (n !== null) values.sqft = n;
    else errors.push(`Invalid sq ft "${sqftRaw}"`);
  }

  // Contract value (optional).
  const valueRaw = get("contractValue");
  if (valueRaw) {
    const n = parseMoney(valueRaw);
    if (n !== null) values.contractValue = n;
    else errors.push(`Invalid contract value "${valueRaw}"`);
  }

  // Last service date (required).
  const dateRaw = get("lastServiceDate");
  if (dateRaw) {
    const d = parseDate(dateRaw);
    if (d) values.lastServiceDate = d;
    else errors.push(`Unparseable last-service date "${dateRaw}"`);
  }

  // Interval months (optional, default 12).
  const intervalRaw = get("intervalMonths");
  if (intervalRaw) {
    const n = parseInt(intervalRaw, 10);
    if (Number.isFinite(n) && n > 0) values.intervalMonths = n;
    else errors.push(`Invalid interval "${intervalRaw}"`);
  } else {
    values.intervalMonths = 12;
  }

  // Region (optional, infer from ZIP).
  const regionRaw = get("region");
  const region = regionRaw ? parseRegion(regionRaw) : null;
  if (region) values.region = region;
  else if (values.zip) {
    const inferred = inferRegionFromZip(values.zip);
    if (inferred) values.region = inferred;
  }
  if (!values.region) values.region = "OTHER";

  // Required-field check.
  for (const f of FIELD_ORDER) {
    if (!FIELD_META[f].required) continue;
    if ((values as Record<string, unknown>)[f] === undefined) {
      errors.push(`Missing ${FIELD_META[f].label}`);
    }
  }

  return { rowIndex, raw, values, errors };
}
