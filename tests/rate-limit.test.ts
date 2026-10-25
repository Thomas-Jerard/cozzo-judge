import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  clientIp,
  enforceLiveLimit,
  liveDailyCap,
  liveIpHourlyCap,
  resetLiveLimitsForTests,
  reserveLiveCalls,
} from "../lib/rate-limit";

const HOUR = 60 * 60 * 1000;
const start = Date.parse("2026-10-25T15:00:00.000Z");

afterEach(() => {
  delete process.env.LIVE_IP_HOURLY_CAP;
  delete process.env.LIVE_DAILY_CAP;
  resetLiveLimitsForTests();
});

describe("live score limits", { concurrency: false }, () => {
  it("defaults to 10 an hour per IP and 300 a day", () => {
    assert.equal(liveIpHourlyCap(), 10);
    assert.equal(liveDailyCap(), 300);
  });

  it("allows 10 live scores for one IP and refuses the 11th without consuming it", () => {
    for (let index = 0; index < 10; index += 1) {
      assert.equal(reserveLiveCalls("203.0.113.8", 1, start + index).ok, true);
    }
    const denied = reserveLiveCalls("203.0.113.8", 1, start + 10);
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.code, "ip_hourly");
      assert.match(denied.message, /10 live scores/);
      assert.match(denied.message, /Mock scoring is still available/);
    }
    assert.equal(reserveLiveCalls("203.0.113.9", 1, start + 10).ok, true);
  });

  it("counts a compare as two and does not reserve a pair that does not fit", () => {
    assert.equal(reserveLiveCalls("203.0.113.8", 9, start).ok, true);
    const denied = reserveLiveCalls("203.0.113.8", 2, start + 1);
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.match(denied.message, /needs 2 live scores/);
    assert.equal(reserveLiveCalls("203.0.113.8", 1, start + 1).ok, true);
    assert.equal(reserveLiveCalls("203.0.113.8", 1, start + 2).ok, false);
  });

  it("lets a three-scenario pack reserve six calls", () => {
    process.env.LIVE_IP_HOURLY_CAP = "6";
    assert.equal(reserveLiveCalls("203.0.113.8", 2, start).ok, true);
    assert.equal(reserveLiveCalls("203.0.113.8", 2, start + 1).ok, true);
    assert.equal(reserveLiveCalls("203.0.113.8", 2, start + 2).ok, true);
    assert.equal(reserveLiveCalls("203.0.113.8", 2, start + 3).ok, false);
  });

  it("forgets IP hits after an hour", () => {
    assert.equal(reserveLiveCalls("203.0.113.8", 10, start).ok, true);
    assert.equal(reserveLiveCalls("203.0.113.8", 1, start + HOUR).ok, true);
  });

  it("stops at the UTC daily cap and resets the next day", () => {
    process.env.LIVE_DAILY_CAP = "4";
    process.env.LIVE_IP_HOURLY_CAP = "100";
    assert.equal(reserveLiveCalls("198.51.100.2", 2, start).ok, true);
    assert.equal(reserveLiveCalls("198.51.100.3", 2, start + 1).ok, true);
    const denied = reserveLiveCalls("198.51.100.4", 1, start + 2);
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.code, "daily");
      assert.match(denied.message, /4 Nebius scores a day/);
    }
    const nextDay = Date.parse("2026-10-26T00:00:00.000Z");
    assert.equal(reserveLiveCalls("198.51.100.4", 1, nextDay).ok, true);
  });

  it("returns 429 for a live reservation and ignores a non-positive count", async () => {
    process.env.LIVE_IP_HOURLY_CAP = "1";
    const request = new Request("http://local/api/judge", { headers: { "x-real-ip": "203.0.113.20" } });
    assert.equal(clientIp(request), "203.0.113.20");
    assert.equal(enforceLiveLimit(request, 0, start), null);
    assert.equal(enforceLiveLimit(request, 1, start), null);
    const blocked = enforceLiveLimit(request, 1, start + 1);
    assert.ok(blocked);
    assert.equal(blocked?.status, 429);
    assert.equal(blocked?.headers.get("retry-after") != null, true);
    const body = (await blocked?.json()) as { error: string; code: string };
    assert.equal(body.code, "ip_hourly");
    assert.match(body.error, /Mock scoring is still available/);
  });

  it("ignores a bad cap and keeps the default", () => {
    process.env.LIVE_DAILY_CAP = "nope";
    process.env.LIVE_IP_HOURLY_CAP = "-3";
    assert.equal(liveDailyCap(), 300);
    assert.equal(liveIpHourlyCap(), 10);
  });
});
