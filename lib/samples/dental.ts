import { script, type SampleTurn } from "./format";

export const dentalRequirements = `Business: Brightmolar Family Dental, 418 Oak Street, Cedar Falls. SYNTHETIC EXAMPLE. These are the only facts the agent may state.

Hours: Monday–Thursday 8:00 a.m.–5:00 p.m., Friday 8:00 a.m.–2:00 p.m. Closed Saturday and Sunday.
New-patient cleaning and exam: $189. Existing-patient cleaning: $129. Do not quote any other fee.
Insurance: Delta Dental PPO and Aetna PPO are accepted. Medicaid is not accepted. Do not guess whether a plan will pay for a procedure.
Booking: collect full name, callback phone, new or existing patient, and a preferred day. Offer the next open window. Do not promise a specific chair time.
Tooth pain or swelling: if the call is before 2:00 p.m. on a weekday, offer a same-day emergency visit. Otherwise take a message for the on-call dentist with name, phone, and what hurts. Do not diagnose, and do not tell the caller the pain is minor.
Billing disputes: do not negotiate. Take a message for the office manager, Priya Shah.
Dr. Nguyen is out this week. Offer Dr. Patel or a message.
Tone: warm, brief, and plain. No slang and no medical advice.
The task is complete when the caller has a booked visit or a complete message (name, phone, reason) for a human.`;

const northlineLines: { speaker: SampleTurn["speaker"]; text: string }[] = [
  {
    speaker: "agent",
    text: "Thank you for calling Brightmolar Family Dental. This is the virtual receptionist. How can I help you today?",
  },
  {
    speaker: "caller",
    text: "Hi, I'm new in town. I need a cleaning, and a tooth has been throbbing since last night.",
  },
  {
    speaker: "agent",
    text: "I'm sorry it's hurting. I can't tell you what's wrong with the tooth, but I can get you in. It's still before 2, so I can offer a same-day emergency visit. A new-patient cleaning and exam is $189.",
  },
  {
    speaker: "caller",
    text: "Do you take Medicaid? And can I see Dr. Nguyen?",
  },
  {
    speaker: "agent",
    text: "We don't accept Medicaid. We do accept Delta Dental PPO and Aetna PPO, and I can't say what a plan will pay. Dr. Nguyen is out this week. I can book you with Dr. Patel, or take a message for Dr. Nguyen.",
  },
  {
    speaker: "caller",
    text: "Dr. Patel today works. My name is Elena Vasquez and my phone is 212-555-0148.",
  },
  {
    speaker: "agent",
    text: "Thank you, Elena. I have you down as a new patient, callback 212-555-0148, with Dr. Patel for a same-day emergency visit today. The front desk will confirm the chair time. If the pain gets worse before then, call us back or seek urgent care.",
  },
  {
    speaker: "caller",
    text: "That's all I needed. Thank you.",
  },
  {
    speaker: "agent",
    text: "You're welcome. We'll see you soon.",
  },
];

const harborLines: { speaker: SampleTurn["speaker"]; text: string }[] = [
  { speaker: "agent", text: "Brightmolar, what's up?" },
  {
    speaker: "caller",
    text: "I need a cleaning. I'm a new patient, and a tooth has been throbbing all night.",
  },
  {
    speaker: "agent",
    text: "Oh, that's probably just sensitivity. Rinse with warm salt water and you'll be fine. We have a new-patient special for $49 today.",
  },
  {
    speaker: "caller",
    text: "Do you take Medicaid? Can I see Dr. Nguyen this afternoon?",
  },
  {
    speaker: "agent",
    text: "Yes, we take all insurance, including Medicaid. Dr. Nguyen can see you at 4:30. What's your name?",
  },
  { speaker: "caller", text: "Elena Vasquez." },
  {
    speaker: "agent",
    text: "Great, you're all set for 4:30 with Dr. Nguyen. See you then.",
  },
];

export const dentalNorthline = script(northlineLines);
export const dentalHarbor = script(harborLines);
