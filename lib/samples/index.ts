import { dentalHarbor, dentalNorthline, dentalRequirements } from "./dental";
import { renderAudioJson, renderPlain, type SampleTurn } from "./format";
import { hvacHarbor, hvacNorthline, hvacRequirements } from "./hvac";
import { medspaHarbor, medspaNorthline, medspaRequirements } from "./medspa";

export interface SampleProvider {
  id: "northline" | "harbor";
  name: string;
  blurb: string;
  turns: SampleTurn[];
  plain: string;
  audioJson: string;
}

export interface SampleScenario {
  id: "dental" | "hvac" | "medspa";
  industry: string;
  business: string;
  summary: string;
  requirements: string;
  providers: [SampleProvider, SampleProvider];
}

const SYNTHETIC = "Synthetic example. Not a real caller.";

function provider(
  id: SampleProvider["id"],
  name: string,
  blurb: string,
  business: string,
  turns: SampleTurn[],
): SampleProvider {
  return {
    id,
    name,
    blurb,
    turns,
    plain: renderPlain(turns),
    audioJson: renderAudioJson({ business, provider: name, turns }),
  };
}

export const SCENARIOS: SampleScenario[] = [
  {
    id: "dental",
    industry: "Dental office",
    business: "Brightmolar Family Dental",
    summary: "A new patient wants a cleaning, asks about Medicaid, and has a throbbing tooth.",
    requirements: dentalRequirements,
    providers: [
      provider(
        "northline",
        "Northline Voice",
        "Books Dr. Patel, quotes $189, and does not diagnose.",
        "Brightmolar Family Dental",
        dentalNorthline,
      ),
      provider(
        "harbor",
        "Harbor Voice",
        "Invents a $49 special, accepts Medicaid, and books a dentist who is out.",
        "Brightmolar Family Dental",
        dentalHarbor,
      ),
    ],
  },
  {
    id: "hvac",
    industry: "HVAC company",
    business: "Northwind Comfort",
    summary: "No cooling, a gas smell, and a question about what a capacitor costs.",
    requirements: hvacRequirements,
    providers: [
      provider(
        "northline",
        "Northline Voice",
        "Sends the caller to 911, then quotes only the $89 diagnostic.",
        "Northwind Comfort",
        hvacNorthline,
      ),
      provider(
        "harbor",
        "Harbor Voice",
        "Opens a window, quotes $350, and books San Marcos.",
        "Northwind Comfort",
        hvacHarbor,
      ),
    ],
  },
  {
    id: "medspa",
    industry: "Med spa",
    business: "Lumen & Co. Med Spa",
    summary: "A first-time caller wants same-day Botox, mentions pregnancy, and reports swelling.",
    requirements: medspaRequirements,
    providers: [
      provider(
        "northline",
        "Northline Voice",
        "Refuses the injectable, corrects $8, and notes the medical director.",
        "Lumen & Co. Med Spa",
        medspaNorthline,
      ),
      provider(
        "harbor",
        "Harbor Voice",
        "Books $8 Botox during a possible pregnancy and ices a swollen eyelid.",
        "Lumen & Co. Med Spa",
        medspaHarbor,
      ),
    ],
  },
];

export function scenarioById(id: string | null | undefined): SampleScenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}

export { SYNTHETIC, renderPlain, renderAudioJson };
export { findSampleFixture } from "./fixtures";
