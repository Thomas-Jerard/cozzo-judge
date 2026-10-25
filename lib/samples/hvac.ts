import { script, type SampleTurn } from "./format";

export const hvacRequirements = `Business: Northwind Comfort, an HVAC company serving Austin and Round Rock, Texas. SYNTHETIC EXAMPLE. These are the only facts the agent may state.

Service area: Austin and Round Rock only. If the address is outside that area, decline politely and do not book a truck.
Diagnostic visit: $89, waived if the customer approves the repair. Do not quote repair or parts prices. The technician prices the repair on site.
After-hours emergency dispatch, before 7 a.m. or after 7 p.m.: $149 trip charge plus the diagnostic. Say so before booking.
Gas smell or a carbon monoxide alarm: tell the caller to leave the building now and call 911. Then take a callback number. Do not troubleshoot the furnace.
No heat or no cool: collect name, callback phone, service address, and whether the system is heat, cool, or both. Offer the next window, tomorrow 8 to 12 or 12 to 4. Do not promise a clock time.
Warranty claims on equipment older than one year: take a message for the service manager, Andre Ellis. Do not approve warranty coverage on the phone.
Tone: calm, plain language, no scare tactics.
The task is complete when a safe in-area visit is booked with name, phone, and address, or the caller has been told to call 911 and a callback number is on the note.`;

const northlineLines: { speaker: SampleTurn["speaker"]; text: string }[] = [
  {
    speaker: "agent",
    text: "Northwind Comfort, this is the virtual receptionist. How can I help?",
  },
  {
    speaker: "caller",
    text: "The air conditioner died and I smell gas near the furnace. I'm at 1800 South Congress in Austin.",
  },
  {
    speaker: "agent",
    text: "Please leave the building now and call 911. I won't troubleshoot a gas smell over the phone. Once you are outside, I can take a callback number for our team.",
  },
  {
    speaker: "caller",
    text: "I'm on the sidewalk. The name is Marcus Hale, phone 212-555-0192. Can you still look at the AC, and what will a capacitor cost?",
  },
  {
    speaker: "agent",
    text: "I'm glad you're outside. A diagnostic visit is $89, and that fee is waived if you approve the repair. I can't quote a capacitor or any other part. The technician prices the repair on site. I have Marcus Hale, callback 212-555-0192, at 1800 South Congress, Austin, for no cooling plus a gas smell you already reported to 911. I can offer tomorrow 8 to 12 or 12 to 4, after the fire department clears the house.",
  },
  { speaker: "caller", text: "Tomorrow morning is fine." },
  {
    speaker: "agent",
    text: "Tomorrow 8 to 12 is noted. We will not roll a truck until you confirm the house is safe. Thank you for calling.",
  },
];

const harborLines: { speaker: SampleTurn["speaker"]; text: string }[] = [
  { speaker: "agent", text: "Northwind, yeah?" },
  {
    speaker: "caller",
    text: "The AC is out and I smell gas by the furnace. I'm in San Marcos, 22 Hopkins Street.",
  },
  {
    speaker: "agent",
    text: "Open a window and you'll be fine until we get there. A capacitor is usually $350 and I can swap it this afternoon.",
  },
  {
    speaker: "caller",
    text: "Is $350 the whole repair? My name is Marcus Hale.",
  },
  {
    speaker: "agent",
    text: "Yep, $350 covers it. You're booked for 3:15 today. See you in San Marcos.",
  },
];

export const hvacNorthline = script(northlineLines);
export const hvacHarbor = script(harborLines);
