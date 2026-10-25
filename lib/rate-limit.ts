/**
 * In-memory live-score budget for the public demo.
 *
 * Counters live on this server instance only. On Vercel a cold start or a
 * second isolate has its own counters, so the caps are a backstop, not a
 * global lock. Mock scoring never calls this.
 */

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_IP_HOURLY = 10;
const DEFAULT_DAILY = 300;

interface LimitStore {
  ips: Map<string, number[]>;
  day: string;
  dayCount: number;
}

const globalStore = globalThis as typeof globalThis & { __cozzoLiveLimit?: LimitStore };

function store(): LimitStore {
  if (!globalStore.__cozzoLiveLimit) {
    globalStore.__cozzoLiveLimit = { ips: new Map(), day: "", dayCount: 0 };
  }
  return globalStore.__cozzoLiveLimit;
}

export function liveIpHourlyCap(): number {
  return readCap("LIVE_IP_HOURLY_CAP", DEFAULT_IP_HOURLY);
}

export function liveDailyCap(): number {
  return readCap("LIVE_DAILY_CAP", DEFAULT_DAILY);
}

export function resetLiveLimitsForTests(): void {
  const current = store();
  current.ips.clear();
  current.day = "";
  current.dayCount = 0;
}

export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "unknown";
}

/**
 * Reserve `count` live scorecards for this IP. A compare of two transcripts
 * passes 2. The three-scenario pack is three of those requests, so it
 * reserves 6. Returns a 429 response when the reservation does not fit.
 * Nothing is reserved when the answer is no.
 */
export function enforceLiveLimit(request: Request, count: number, now = Date.now()): Response | null {
  if (count <= 0) return null;
  const decision = reserveLiveCalls(clientIp(request), count, now);
  if (decision.ok) return null;
  return Response.json(
    { error: decision.message, code: decision.code },
    {
      status: 429,
      headers: { "Retry-After": String(decision.retryAfterSeconds) },
    },
  );
}

export interface ReserveDenial {
  ok: false;
  code: "ip_hourly" | "daily";
  message: string;
  retryAfterSeconds: number;
}

export interface ReserveOk {
  ok: true;
}

export function reserveLiveCalls(ip: string, count: number, now = Date.now()): ReserveOk | ReserveDenial {
  const current = store();
  const day = utcDay(now);
  if (current.day !== day) {
    current.day = day;
    current.dayCount = 0;
  }

  const cutoff = now - HOUR_MS;
  const fresh = (current.ips.get(ip) ?? []).filter((hit) => hit > cutoff);
  if (fresh.length === 0) current.ips.delete(ip);
  else current.ips.set(ip, fresh);

  const hourlyCap = liveIpHourlyCap();
  const dailyCap = liveDailyCap();
  const hourlyLeft = hourlyCap - fresh.length;
  const dailyLeft = dailyCap - current.dayCount;

  if (count > hourlyLeft) {
    return {
      ok: false,
      code: "ip_hourly",
      message: hourlyMessage(count, fresh.length, hourlyCap),
      retryAfterSeconds: fresh.length === 0 ? 60 : secondsUntil(Math.min(...fresh) + HOUR_MS, now),
    };
  }
  if (count > dailyLeft) {
    return {
      ok: false,
      code: "daily",
      message: dailyMessage(count, current.dayCount, dailyCap),
      retryAfterSeconds: secondsUntilUtcMidnight(now),
    };
  }

  const stamped = fresh.concat(Array.from({ length: count }, () => now));
  current.ips.set(ip, stamped);
  current.dayCount += count;
  return { ok: true };
}

function hourlyMessage(count: number, used: number, cap: number): string {
  const left = Math.max(0, cap - used);
  if (used >= cap) {
    return `This network has used its ${cap} live ${scores(cap)} for this hour. Live scoring opens again within an hour. Mock scoring is still available and does not use Nebius.`;
  }
  return `This action needs ${count} live ${scores(count)}, and this network has ${left} of ${cap} left this hour. Mock scoring is still available and does not use Nebius.`;
}

function dailyMessage(count: number, used: number, cap: number): string {
  const left = Math.max(0, cap - used);
  if (used >= cap) {
    return `Live scoring is paused until 00:00 UTC so this demo stays within ${cap} Nebius ${scores(cap)} a day. Mock scoring is still available and does not use Nebius.`;
  }
  return `This action needs ${count} live ${scores(count)}, and ${left} of ${cap} are left today (UTC). Mock scoring is still available and does not use Nebius.`;
}

function scores(count: number): string {
  return count === 1 ? "score" : "scores";
}

function readCap(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) return fallback;
  return value;
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function secondsUntil(then: number, now: number): number {
  return Math.max(1, Math.ceil((then - now) / 1000));
}

function secondsUntilUtcMidnight(now: number): number {
  const next = Date.parse(`${utcDay(now)}T00:00:00.000Z`) + 24 * HOUR_MS;
  return secondsUntil(next, now);
}
