"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NEMOTRON_MODELS } from "@/lib/models";
import type { JudgeStatus, RequestMode } from "@/lib/judge-client";
import { cn } from "@/lib/utils";

export function JudgeSettings({
  status,
  model,
  mode,
  onModel,
  onMode,
}: {
  status: JudgeStatus | null;
  model: string;
  mode: RequestMode;
  onModel: (model: string) => void;
  onMode: (mode: RequestMode) => void;
}) {
  const models = status?.models?.length ? status.models : NEMOTRON_MODELS;
  const selected = models.find((item) => item.id === model) ?? models[0];
  const liveDisabled = status != null && !status.keyConfigured;

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="grid gap-2">
        <Label htmlFor="model">Model</Label>
        <Select
          value={model}
          onValueChange={(value) => {
            if (value) onModel(value);
          }}
        >
          <SelectTrigger id="model" className="w-full min-w-0">
            <SelectValue placeholder="Choose a Nemotron model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="truncate text-xs text-muted-foreground" title={selected?.id}>
          {selected?.detail}. {selected?.id}
        </p>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Connection</legend>
        <div className="flex rounded-lg bg-muted p-1">
          {(
            [
              ["auto", "Auto"],
              ["live", "Live"],
              ["mock", "Mock"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={value === "live" && liveDisabled}
              aria-pressed={mode === value}
              onClick={() => onMode(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function modeHelp(status: JudgeStatus | null, mode: RequestMode): string {
  if (!status) return "Checking whether NEBIUS_API_KEY is configured…";
  if (mode === "mock") {
    return "Mock scores on this machine. Synthetic samples use a calibrated preview. Other transcripts use the local rubric. Nebius is not called.";
  }
  if (mode === "live") {
    return status.keyConfigured
      ? "This run calls Nebius Token Factory with the model above. Choosing Super also asks Nano for a risk line. Ultra runs when you ask for an appeal."
      : "Live judging needs NEBIUS_API_KEY on the server.";
  }
  return status.keyConfigured
    ? "Auto will call Nemotron because a key is configured."
    : "Auto is using the mock judge because NEBIUS_API_KEY is not set.";
}
