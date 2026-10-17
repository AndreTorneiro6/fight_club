import { createHash } from "node:crypto";
import { z } from "zod";
export interface CourtOccupation {
  resourceId: string;
  start: string;
  end: string;
}
const base = "https://thirdparty.playtomic.io/api/v1";
let auth: { key: string; value: string; until: number } | undefined;
const cache = new Map<
  string,
  { until: number; occupations: CourtOccupation[]; checkedAt: string }
>();
const inFlight = new Map<
  string,
  Promise<{ occupations: CourtOccupation[]; checkedAt: string }>
>();
export function playtomicConfigured() {
  return !!(
    process.env.PLAYTOMIC_CLIENT_ID &&
    process.env.PLAYTOMIC_CLIENT_SECRET &&
    process.env.PLAYTOMIC_VENUE_ID
  );
}
const booking = z.object({
  tenant_id: z.string(),
  resource_id: z.string(),
  booking_start_date: z.string(),
  booking_end_date: z.string(),
  is_canceled: z.boolean().optional(),
  status: z.string().optional(),
});
function utc(value: string) {
  const iso = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : value + "Z";
  if (!Number.isFinite(Date.parse(iso)))
    throw new Error("Invalid provider time");
  return new Date(iso).toISOString();
}
export function sanitizeBookings(
  raw: unknown,
  venue: string,
): CourtOccupation[] {
  const rows = z.array(booking).parse(raw);
  return rows
    .filter(
      (r) => r.tenant_id === venue && !r.is_canceled && r.status !== "CANCELED",
    )
    .map((r) => {
      const start = utc(r.booking_start_date),
        end = utc(r.booking_end_date);
      if (start >= end) throw new Error("Invalid booking interval");
      return { resourceId: r.resource_id, start, end };
    });
}
async function token(fetcher: typeof fetch) {
  const key = createHash("sha256")
    .update(
      `${process.env.PLAYTOMIC_CLIENT_ID}:${process.env.PLAYTOMIC_CLIENT_SECRET}`,
    )
    .digest("hex");
  if (auth?.key === key && auth.until > Date.now()) return auth.value;
  const response = await fetcher(base + "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PLAYTOMIC_CLIENT_ID,
      secret: process.env.PLAYTOMIC_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Playtomic authentication unavailable");
  const data = z
    .object({ token: z.string().min(1), expires_in: z.number().positive() })
    .parse(await response.json());
  auth = {
    key,
    value: data.token,
    until:
      Date.now() + Math.min(3500, Math.max(0, data.expires_in - 60)) * 1000,
  };
  return data.token;
}
/** Read-only official API. An unoccupied court is not proof that Playtomic will permit a booking. */
export async function playtomicOccupation(
  start: string,
  fetcher: typeof fetch = fetch,
) {
  if (!playtomicConfigured()) throw new Error("Playtomic credentials missing");
  const venue = process.env.PLAYTOMIC_VENUE_ID!;
  const key = `${venue}:${start.slice(0, 10)}:${createHash("sha256").update(process.env.PLAYTOMIC_CLIENT_ID!).digest("hex")}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now())
    return { occupations: hit.occupations, checkedAt: hit.checkedAt };
  const existing = inFlight.get(key);
  if (existing) return existing;
  const load = async () => {
    const from = new Date(start.slice(0, 10) + "T00:00:00Z");
    from.setUTCDate(from.getUTCDate() - 1);
    const to = new Date(start.slice(0, 10) + "T00:00:00Z");
    to.setUTCDate(to.getUTCDate() + 2);
    const occupations: CourtOccupation[] = [];
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({
        tenant_id: venue,
        start_booking_date: from.toISOString().slice(0, 19),
        end_booking_date: to.toISOString().slice(0, 19),
        page: String(page),
        size: "200",
        sport_id: "PADEL",
      });
      const get = async () =>
        fetcher(`${base}/bookings?${query}`, {
          headers: { Authorization: `Bearer ${await token(fetcher)}` },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
      let response = await get();
      if (response.status === 401) {
        auth = undefined;
        response = await get();
      }
      if (!response.ok) throw new Error("Playtomic bookings unavailable");
      const raw: unknown = await response.json();
      if (!Array.isArray(raw)) throw new Error("Unexpected provider response");
      occupations.push(...sanitizeBookings(raw, venue));
      if (raw.length < 200) {
        const checkedAt = new Date().toISOString();
        if (cache.size >= 64) cache.delete(cache.keys().next().value!);
        cache.set(key, { occupations, checkedAt, until: Date.now() + 60000 });
        return { occupations, checkedAt };
      }
    }
    throw new Error("Incomplete provider pagination");
  };
  const pending = load();
  inFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    inFlight.delete(key);
  }
}
