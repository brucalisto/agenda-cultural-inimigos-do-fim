import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const REQUEST_INTERVAL_MS = 1100;
const DEFAULT_BATCH_SIZE = 12;

type GeocodeResult = {
  latitude: number;
  longitude: number;
};

type PublishedEventLocation = {
  id: string;
  location: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAddress(location: string | null, city: string | null) {
  const cleanLocation = (location || "").replace(/\s+/g, " ").trim();
  const cleanCity = (city || "").replace(/\s+/g, " ").trim();

  if (!cleanLocation || /^(?:não informado|nao informado|a definir|online)$/i.test(cleanLocation)) {
    return null;
  }

  return [cleanLocation, cleanCity, "Brasil"].filter(Boolean).join(", ");
}

async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("q", address);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "InimigosDoFim/1.0 (https://inimigosdofim.app)",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim indisponível (${response.status})`);
  }

  const matches = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const latitude = Number(matches[0]?.lat);
  const longitude = Number(matches[0]?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export async function geocodePublishedEvents(options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(options.limit || DEFAULT_BATCH_SIZE, 25));
  const { data, error } = await supabaseAdmin
    .from("interpreted_contents")
    .select("id,location,city,latitude,longitude")
    .eq("review_status", "publicado")
    .or("latitude.is.null,longitude.is.null")
    .order("updated_at", { ascending: false })
    .limit(limit * 3);

  if (error) throw error;

  const rows = (data || []) as PublishedEventLocation[];
  const candidates = rows
    .map((row) => ({ row, address: normalizeAddress(row.location, row.city) }))
    .filter((item): item is { row: PublishedEventLocation; address: string } => Boolean(item.address))
    .slice(0, limit);

  const cache = new Map<string, GeocodeResult | null>();
  const failures: Array<{ id: string; reason: string }> = [];
  let updated = 0;
  let notFound = 0;
  let externalRequests = 0;

  for (const [index, item] of candidates.entries()) {
    const key = item.address.toLowerCase();
    let coordinates = cache.get(key);

    try {
      if (!cache.has(key)) {
        if (externalRequests > 0) await sleep(REQUEST_INTERVAL_MS);
        coordinates = await geocodeAddress(item.address);
        cache.set(key, coordinates || null);
        externalRequests += 1;
      }

      if (!coordinates) {
        notFound += 1;
        failures.push({ id: item.row.id, reason: "Endereço não localizado" });
        continue;
      }

      const saved = await supabaseAdmin
        .from("interpreted_contents")
        .update({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.row.id)
        .eq("review_status", "publicado");

      if (saved.error) throw saved.error;
      updated += 1;
    } catch (error) {
      failures.push({
        id: item.row.id,
        reason: error instanceof Error ? error.message : "Falha desconhecida na geocodificação",
      });
    }

    if (index === candidates.length - 1) break;
  }

  return {
    inspected: rows.length,
    candidates: candidates.length,
    updated,
    notFound,
    externalRequests,
    failures,
  };
}
