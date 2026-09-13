// Same Heart -- Star Day signal generator.
// Ported directly from the validated prototype so the real site produces
// the exact same frequency/archetype for the same birth date.

export type Archetype = { name: string; desc: string; deeper: string };

// `desc` has existed since the beginning but nothing in the app ever
// actually showed it to anyone (see supabase/schema.sql's compute_signal,
// which only ever ported the frequency/designation math to SQL, not this
// prose). The Hub's "Go deeper" toggle is the first thing that surfaces
// it. `deeper` is new: a second, more searching paragraph reserved for
// Purple key holders (see PLAN.md's Keys and Doors design) -- the actual
// reward, not just a longer version of the same read.
export const ARCHETYPES: Archetype[] = [
  {
    name: "The First Ember",
    desc: "You start things. Quietly, and usually before anyone else has noticed there was something to start.",
    deeper: "The cost of going first is that you rarely get to see how the thing you started turns out -- you're already somewhere else, starting the next one. Worth asking yourself, sometimes, what it would mean to stay for an ending.",
  },
  {
    name: "The Quiet Beacon",
    desc: "Steady light in low visibility. People find their way by you without ever quite knowing that's what happened.",
    deeper: "Being relied on without being noticed is a strange kind of loneliness -- the credit you don't get isn't the point, but the not-being-seen sometimes is. Let someone actually see you do it, once in a while.",
  },
  {
    name: "The Waking Current",
    desc: "You move rooms without raising your voice. Things shift when you arrive; they just take a moment to catch up.",
    deeper: "You've learned to read a room so well that you sometimes finish shifting it before anyone realizes it needed to move. The people closest to you would probably like to be let in on the current a little earlier.",
  },
  {
    name: "The Open Frequency",
    desc: "You let people in faster than most. It costs you sometimes. It's also exactly why they stay.",
    deeper: "Openness this real isn't a lack of a filter -- it's a decision, made again and again, that the risk is worth it. The people who've hurt you for it were never proof the decision was wrong.",
  },
  {
    name: "The Bloom Signal",
    desc: "You need warmth to fully transmit. Given it, there's very little you can't grow toward.",
    deeper: "You know exactly what conditions you need to be at your best, which is rarer than it sounds -- most people never figure that out about themselves. The harder skill is asking for those conditions instead of just waiting to be given them.",
  },
  {
    name: "The Steady Pulse",
    desc: "Consistency is your instrument. You're the reason things that shouldn't hold together, hold together.",
    deeper: "Being the steady one can quietly become being the only one who's allowed to have an off day. Consistency you give to everyone else is worth spending on yourself sometimes too.",
  },
  {
    name: "The Wildfire Wave",
    desc: "You run hot and honest. The people who can keep up with you become the people who matter most.",
    deeper: "Running this hot burns through people who were never going to keep pace, which can look like them failing you when it was really just a mismatch. Not everyone who falls behind was wrong to.",
  },
  {
    name: "The Golden Static",
    desc: "You carry a little chaos on purpose. It's not a flaw -- it's how you keep everyone, including yourself, awake.",
    deeper: "The chaos works because you're the one steering it -- it stops being a gift the moment it starts steering you instead. Worth checking, honestly, which direction it's currently running.",
  },
  {
    name: "The Harvest Echo",
    desc: "You finish what others abandon. What you build tends to outlast the moment that made it.",
    deeper: "Finishing things other people walked away from means you've spent a lot of time in rooms everyone else already left. That's real, quiet endurance -- it's also worth noticing when a thing deserves to be left unfinished.",
  },
  {
    name: "The Turning Tide",
    desc: "You know how to let go of a version of yourself once it's done its job. That's rarer than it sounds.",
    deeper: "Letting go this cleanly can look, from the outside, like you never really committed in the first place -- people who need permanence from you may read your growth as distance. It isn't; it's just what moving actually looks like.",
  },
  {
    name: "The Deep Resonance",
    desc: "You feel things a layer down from where most people stop. It makes you exhausting sometimes, and unforgettable always.",
    deeper: "Feeling a layer down means you're often reacting to something real that nobody else in the room has noticed yet -- which can make you look like the problem when you're actually the first to see one. Trust that layer more than you probably do.",
  },
  {
    name: "The Long Transmission",
    desc: "You're built for the distance, not the sprint. What you're becoming was never going to happen quickly.",
    deeper: "The hardest part of being built for distance is living inside all the years where nothing looks finished yet. The people who only measure progress in sprints will misjudge you for it; that's their instrument, not yours.",
  },
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
