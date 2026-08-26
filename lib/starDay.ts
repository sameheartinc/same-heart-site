// Same Heart -- Star Day signal generator.
// Ported directly from the validated prototype so the real site produces
// the exact same frequency/archetype for the same birth date.

export type Archetype = { name: string; desc: string };

export const ARCHETYPES: Archetype[] = [
  { name: "The First Ember", desc: "You start things. Quietly, and usually before anyone else has noticed there was something to start." },
  { name: "The Quiet Beacon", desc: "Steady light in low visibility. People find their way by you without ever quite knowing that's what happened." },
  { name: "The Waking Current", desc: "You move rooms without raising your voice. Things shift when you arrive; they just take a moment to catch up." },
  { name: "The Open Frequency", desc: "You let people in faster than most. It costs you sometimes. It's also exactly why they stay." },
  { name: "The Bloom Signal", desc: "You need warmth to fully transmit. Given it, there's very little you can't grow toward." },
  { name: "The Steady Pulse", desc: "Consistency is your instrument. You're the reason things that shouldn't hold together, hold together." },
  { name: "The Wildfire Wave", desc: "You run hot and honest. The people who can keep up with you become the people who matter most." },
  { name: "The Golden Static", desc: "You carry a little chaos on purpose. It's not a flaw -- it's how you keep everyone, including yourself, awake." },
  { name: "The Harvest Echo", desc: "You finish what others abandon. What you build tends to outlast the moment that made it." },
  { name: "The Turning Tide", desc: "You know how to let go of a version of yourself once it's done its job. That's rarer than it sounds." },
  { name: "The Deep Resonance", desc: "You feel things a layer down from where most people stop. It makes you exhausting sometimes, and unforgettable always." },
  { name: "The Long Transmission", desc: "You're built for the distance, not the sprint. What you're becoming was never going to happen quickly." }
];

function pad(n: number): string {
  return String(n).length < 2 ? "0" + n : String(n);
}

export type SignalResult = {
  frequency: number;
  designation: string;
  archetype: Archetype;
};

export function computeSignal(month: number, day: number, year: number): SignalResult {
  const mdays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let dayOfYear = day;
  for (let i = 0; i < month - 1; i++) dayOfYear += mdays[i];

  const seed = year * 372 + dayOfYear * 13 + day * 7 + month * 29;
  const frequency = Math.round((200 + ((seed % 6700) / 10)) * 10) / 10;
  const designation = "SH-" + pad(month) + pad(day) + "·" + String(year).slice(-2);
  const archetype = ARCHETYPES[month - 1];

  return { frequency, designation, archetype };
}
