export interface NemotronModel {
  id: string;
  label: string;
  detail: string;
}

/**
 * Host that answered GET /v1/models for a working Token Factory key.
 * Every Nemotron id below is served from this base. NEBIUS_BASE_URL can override it.
 */
export const TOKEN_FACTORY_BASE_URL = "https://api.tokenfactory.nebius.com/v1";

/**
 * NVIDIA open models on Nebius Token Factory.
 * Ids match the catalog returned by GET /v1/models.
 * Super 120B is the default everyday judge.
 */
export const NEMOTRON_MODELS: readonly NemotronModel[] = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    label: "Nemotron 3 Super",
    detail: "120B · default scorecards",
  },
  {
    id: "nvidia/Nemotron-3-Ultra-550b-a55b",
    label: "Nemotron 3 Ultra",
    detail: "550B · deeper reasoning",
  },
  {
    id: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    label: "Nemotron 3 Nano",
    detail: "30B · lowest latency",
  },
  {
    id: "nvidia/Nemotron-3_5-Lightning",
    label: "Nemotron 3.5 Lightning",
    detail: "Nemotron 3.5 · low latency",
  },
  {
    id: "nvidia/Nemotron-3.5-Super-VL",
    label: "Nemotron 3.5 Super VL",
    detail: "Nemotron 3.5 · vision-language",
  },
] as const;

export const DEFAULT_MODEL_ID = NEMOTRON_MODELS[0].id;
export const SUPER_MODEL_ID = NEMOTRON_MODELS[0].id;
export const ULTRA_MODEL_ID = NEMOTRON_MODELS[1].id;
export const NANO_MODEL_ID = NEMOTRON_MODELS[2].id;

export function resolveModel(modelId?: string): NemotronModel {
  const requested = modelId?.trim() || process.env.NEBIUS_MODEL?.trim() || DEFAULT_MODEL_ID;
  const found = NEMOTRON_MODELS.find((model) => model.id === requested);
  if (!found) {
    const known = NEMOTRON_MODELS.map((model) => model.id).join(", ");
    throw new Error(`Unknown model "${requested}". Choose one of: ${known}.`);
  }
  return found;
}
