import "server-only";

export type Geocoded = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

export type GeocodeResult =
  | { ok: true; value: Geocoded }
  | { ok: false; error: string };

/**
 * Geocode a street address via the Google Geocoding API. Runs server-side
 * only so the key is never exposed. Server-side API key is GOOGLE_MAPS_API_KEY
 * (separate from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to allow key restriction).
 */
export async function geocodeAddress(
  streetAddress: string,
  city: string,
  state: string,
  zip?: string,
): Promise<GeocodeResult> {
  const key =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return { ok: false, error: "GOOGLE_MAPS_API_KEY not set" };
  }

  const parts = [streetAddress, city, state, zip, "USA"].filter(Boolean).join(", ");
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", parts);
  url.searchParams.set("key", key);
  url.searchParams.set("region", "us");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `Geocoding HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      status: string;
      error_message?: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    if (json.status === "ZERO_RESULTS") {
      return { ok: false, error: "Address not found" };
    }
    if (json.status !== "OK") {
      return {
        ok: false,
        error: json.error_message ?? `Geocoding: ${json.status}`,
      };
    }
    const hit = json.results[0];
    return {
      ok: true,
      value: {
        latitude: hit.geometry.location.lat,
        longitude: hit.geometry.location.lng,
        formattedAddress: hit.formatted_address,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Geocoding failed",
    };
  }
}

/**
 * Batch geocode — parallel with a modest concurrency cap to stay under
 * Google's free-tier QPS while still being fast on 60-row imports.
 */
export async function geocodeBatch(
  addresses: {
    key: string;
    street: string;
    city: string;
    state: string;
    zip?: string;
  }[],
  concurrency = 8,
): Promise<Record<string, GeocodeResult>> {
  const results: Record<string, GeocodeResult> = {};
  let cursor = 0;

  async function worker() {
    while (cursor < addresses.length) {
      const i = cursor++;
      const a = addresses[i];
      results[a.key] = await geocodeAddress(a.street, a.city, a.state, a.zip);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, addresses.length) }, worker);
  await Promise.all(workers);
  return results;
}
