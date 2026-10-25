/**
 * Score the six synthetic calls with a live Nemotron model.
 *
 *   NEBIUS_API_KEY=... npm run live-smoke
 *
 * Prints overall score, verdict, and latency. Never prints the key.
 * Loads .env then .env.local when those files exist. A key already in the
 * environment wins over either file.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { completeWithNebius, tokenFactoryBaseUrl } from "../lib/nebius.ts";
import { judgeCall } from "../lib/rubric/judge.ts";
import { DEFAULT_MODEL_ID, resolveModel } from "../lib/models.ts";
import { SCENARIOS } from "../lib/samples/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const alreadySet = new Set(Object.keys(process.env));
loadEnvFile(resolve(root, ".env"), false);
loadEnvFile(resolve(root, ".env.local"), true);

const key = process.env.NEBIUS_API_KEY?.trim() ?? "";
if (!key) {
  console.error("NEBIUS_API_KEY is not set. Live smoke did not call Token Factory.");
  process.exit(1);
}

let model;
try {
  model = resolveModel(process.env.NEBIUS_MODEL);
} catch (error) {
  console.error(redact(error instanceof Error ? error.message : "Unknown model."));
  process.exit(1);
}

const startedAll = performance.now();
let failed = 0;
let ran = 0;

console.log("Cozzo Judge live smoke");
console.log(`model ${model.id}`);
console.log(`base  ${redact(tokenFactoryBaseUrl())}`);
if (model.id !== DEFAULT_MODEL_ID) {
  console.log(`default remains ${DEFAULT_MODEL_ID}; NEBIUS_MODEL selected this run`);
}

for (const scenario of SCENARIOS) {
  for (const provider of scenario.providers) {
    ran += 1;
    const label = `${scenario.business} · ${provider.name}`;
    const started = performance.now();
    try {
      const card = await judgeCall(
        {
          transcript: provider.plain,
          requirements: scenario.requirements,
          label,
        },
        {
          mode: "live",
          model: model.id,
          complete: (messages) => completeWithNebius(model.id, messages),
        },
      );
      const seconds = elapsed(started);
      const dimensions = card.dimensions.map((dimension) => `${dimension.id} ${dimension.score}`).join("  ");
      console.log(`\n${label}`);
      console.log(
        `  ${card.overall} ${card.verdict}  ${seconds}s  in ${card.judge.promptTokens ?? "-"}  out ${card.judge.completionTokens ?? "-"}`,
      );
      console.log(`  ${dimensions}`);
      if (card.criticalFlags.length > 0) {
        console.log(`  flags ${card.criticalFlags.map((flag) => flag.code).join(", ")}`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Live scoring failed.";
      console.log(`\n${label}`);
      console.log(`  failed  ${elapsed(started)}s  ${redact(message)}`);
    }
  }
}

console.log(`\n${ran - failed}/${ran} scored in ${elapsed(startedAll)}s`);
if (failed > 0) process.exit(1);

function elapsed(started) {
  return ((performance.now() - started) / 1000).toFixed(1);
}

function redact(value) {
  if (!key) return value;
  return value.split(key).join("[redacted]");
}

function loadEnvFile(file, overrideLoaded) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value || alreadySet.has(name)) continue;
    if (!overrideLoaded && process.env[name]) continue;
    process.env[name] = value;
  }
}
