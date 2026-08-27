// Same Heart -- the quote bank.
//
// A new line is picked every time this runs (the Hub calls this once per
// visit), so someone sees a different quote basically every time they log
// on. If their profile's archetype has its own lines, those get mixed in
// alongside the general pool, so it can feel a little more like it's
// speaking to them specifically -- without ever depending on it, since
// the general pool alone is plenty deep.
//
// Honest note on scale: this seeds ~150 original lines, not 1000. Getting
// to 1000 *good* ones isn't a thing to fake with padding or repetition --
// see the README section "Growing the quote bank" for how we get there for
// real, including folding in lines you write yourself.

export type Quote = {
  text: string;
  archetype?: string; // matches an Archetype["name"] from lib/starDay.ts
};

const GENERAL: string[] = [
  "Courage is not the absence of fear. It's the heart deciding to show up anyway.",
  "You don't have to feel brave to be brave. You just have to move while scared.",
  "Every signal starts as a risk. Someone had to send it not knowing if it would be received.",
  "The bravest thing you did today might have been staying soft.",
  "Being seen is a kind of courage most people underestimate.",
  "Your heart doesn't wait for permission to matter.",
  "Fear is loud. Let it be loud. Move anyway.",
  "Some people call it luck. It was just someone who didn't quit at the scared part.",
  "You are allowed to be terrified and still be the one who shows up.",
  "The frequency doesn't care if your hands are shaking when you send it.",
  "Courage looks quieter than people expect. Mostly it looks like staying.",
  "What you're afraid to say is usually the truest thing in the room.",
  "You don't need to be fearless. You need to be honest while afraid.",
  "Vulnerability isn't weakness wearing a costume. It's strength that stopped hiding.",
  "The heart that shows itself when scared is the one people remember.",
  "Nobody arrives brave. They arrive anyway, and bravery catches up later.",
  "Your softness was never the problem. It was always the signal.",
  "Sometimes courage is just one more day of trying.",
  "The scared version of you and the brave version of you are the same person, five minutes apart.",
  "What if the fear isn't a stop sign. What if it's just proof you're close to something real.",
  "Showing your heart is a decision you get to make again every day.",
  "You were never meant to arrive unafraid. You were meant to arrive anyway.",
  "The world doesn't need your certainty. It needs your honesty.",
  "Courage rarely feels like courage while you're doing it. It just feels like doing the thing.",
  "Every person who ever changed something started before they were ready.",
  "Your heart has been trying to tell you something. Today, listen.",
  "It's not brave if it doesn't cost you something. That's how you know it counted.",
  "The people who matter most will meet you in the trembling, not just the triumph.",
  "You don't have to be loud to be brave. You just have to be true.",
  "Being scared and being wrong are not the same thing. Don't confuse them.",
  "Every frequency was unfamiliar before someone learned to hear it.",
  "Some doors only open from the inside. Courage is the hand that reaches for the handle.",
  "The heart doesn't need proof to be worth protecting.",
  "You are not too much. You are just finally being all of yourself in public.",
  "What scares you and what matters to you are usually standing in the same room.",
  "Arrival isn't a feeling. It's a decision you keep making.",
  "You already survived every day you were afraid of becoming today.",
  "The signal was never about being ready. It was about being willing.",
  "Courage doesn't remove the fear. It just refuses to let the fear drive.",
  "Some people wait for the fear to leave before they move. The brave ones move it with them.",
  "You don't have to shout to be heard. You have to be honest at the right volume.",
  "What you protect with silence, you can also set free with a sentence.",
  "The bravest people you know are still scared. They just didn't wait to find out how it ends.",
  "Your story isn't disqualified because you were afraid while living it.",
  "Nobody claps for the moment before the leap. That's usually the only moment that mattered.",
  "Sometimes the whole world changes because one person's heart refused to stay quiet.",
  "You get to be a beginner and brave at the same time.",
  "Frequency is just honesty with a pulse.",
  "It's not weakness to need somewhere safe to be scared out loud.",
  "What you're most afraid to become is often what you already are, unpracticed.",
  "Not every act of courage is visible. Some of the biggest ones happen in silence, in the mirror, at 2am.",
  "You don't need an audience to be brave. You need a decision.",
  "The heart that keeps opening after being hurt is doing something rarer than most people notice.",
  "Growth doesn't ask if you're ready. It just asks if you're willing.",
  "There is no version of you that skips the scared part. There's only a version that goes through it.",
  "Being new at something and being afraid of something are not reasons to stop.",
  "What you call weakness might just be a heart that hasn't finished healing yet. Let it.",
  "You are allowed to change your mind about who you're becoming.",
  "Courage is a muscle. It gets stronger every time you use it, even badly.",
  "The old version of you doesn't need permission to be released. Just gratitude.",
  "Every day you keep choosing yourself is a day the old story loses a little power.",
  "You don't have to arrive as someone new. You just have to stop performing someone old.",
  "Becoming is not a straight line. It's a frequency finding its own shape.",
  "The parts of you that feel unfinished are often the parts still being written.",
  "You are not behind. You are exactly as far as your courage has taken you so far.",
  "Some people spend years running from the very thing that would set them free.",
  "What if you stopped waiting to feel whole before you let yourself be seen.",
  "The truest growth rarely looks impressive from the outside.",
  "You can be proud of who you're becoming and still be scared of getting there.",
  "Nobody becomes brave by accident. It's built one honest moment at a time.",
  "Being witnessed is different from being watched. One is safety. Seek that.",
  "The right people don't need you to perform. They just need you to be there.",
  "Loneliness convinces you no one would understand. Courage tests that theory.",
  "You were built for connection, not proof of worth.",
  "Someone out there needs exactly the honesty you're afraid to give.",
  "Belonging was never about being like everyone else. It was about being fully yourself somewhere safe.",
  "The moment you stop performing is usually the moment someone finally sees you.",
  "Real connection costs something. That's how you know it isn't fake.",
  "You don't find your people by hiding the parts you think they won't like.",
  "Being known is scarier than being liked. Choose being known.",
  "Showing up on the hard days counts more than showing up on the easy ones.",
  "Consistency isn't glamorous. It's just quietly unstoppable.",
  "You don't need a good day to make progress. You need a decision.",
  "Small honest days build a life faster than big dramatic ones.",
  "The version of you a year from now is built entirely out of days like today.",
  "What you repeat, you become. Choose the repetition on purpose.",
  "Discipline is just self-respect wearing work clothes.",
  "Nobody sees the thousand small choices. They just see who you turned into.",
  "Today doesn't need to be impressive. It just needs to be honest.",
  "Progress rarely feels like progress while you're inside it.",
  "You've survived every hard thing that's happened to you so far. That's not nothing.",
  "Resilience isn't about not breaking. It's about what you do after you do.",
  "The comeback doesn't erase the fall. It just proves the fall wasn't the end of the story.",
  "You are allowed to rest without quitting.",
  "Healing isn't linear, and neither is becoming who you're meant to be.",
  "What almost broke you is also what taught you how strong your heart actually is.",
  "You don't have to be unbreakable. You have to be willing to rebuild.",
  "The setback is data, not a verdict.",
  "Every person you admire has a chapter they almost didn't survive.",
  "Strength isn't the absence of struggle. It's what struggle leaves behind, if you let it.",
  "Trust yourself the way you'd trust a friend who's never once given up on you.",
  "Your gut knew before your mind caught up. Start listening earlier.",
  "Self-trust is built the same way any trust is: one kept promise at a time.",
  "You don't need everyone to believe in you. You need to stop needing that.",
  "The quietest voice in the room is sometimes your own, and it's usually right.",
  "Doubt is loud because it's insecure, not because it's true.",
  "You've talked yourself out of more good things than bad ones ever needed you to.",
  "Confidence isn't knowing you'll win. It's trusting you'll survive if you don't.",
  "Stop auditioning for your own life. You already have the part.",
  "The version of you that trusts yourself is the version everyone else starts trusting too.",
  "Honesty is the original signal. Everything else is static.",
  "Say the true thing. The room can handle it more than you think.",
  "A half-truth costs more in the long run than the whole one would have.",
  "What you're not saying is usually louder than what you are.",
  "The truth doesn't need decoration. It just needs saying.",
  "You don't owe anyone a performance of okay when you're not.",
  "Honesty is a form of respect, for them and for you.",
  "The relationships worth keeping can survive your honesty. Test that.",
  "Silence protects the moment. Honesty protects the years.",
  "Say it while it's still true. Timing is not the same as courage.",
  "Quiet bravery doesn't trend. It just changes lives one at a time.",
  "Not every act of courage needs witnesses to count.",
  "The bravest thing in the room is sometimes the person who simply stayed calm.",
  "Some heroism looks like showing up to an ordinary Tuesday anyway.",
  "You don't need a stage. You need a decision nobody else has to see.",
  "Grace under pressure is still courage, just wearing a softer coat.",
  "The unnoticed brave are still brave. History just hasn't caught up yet.",
  "You can be gentle and unshakeable at the same time.",
  "Some of the strongest people you'll ever meet look like they're barely trying.",
  "The quiet ones aren't less brave. They just spend it differently.",
];

const ARCHETYPE_QUOTES: Quote[] = [
  { archetype: "The First Ember", text: "You started something today just by showing up before it made sense to anyone else." },
  { archetype: "The First Ember", text: "Ember-starters don't need a fire built yet. They just need a spark and the nerve to strike it." },

  { archetype: "The Quiet Beacon", text: "Your steadiness is a kind of courage nobody applauds and everybody needs." },
  { archetype: "The Quiet Beacon", text: "You don't have to shine loudly to be the reason someone found their way tonight." },

  { archetype: "The Waking Current", text: "Rooms shift when you enter them. That's not an accident, that's your frequency doing its work." },
  { archetype: "The Waking Current", text: "You don't have to raise your voice to move something. You already do it just by arriving." },

  { archetype: "The Open Frequency", text: "Letting people in this fast has cost you before. It's also the exact reason the right ones stayed." },
  { archetype: "The Open Frequency", text: "Openness isn't naivety. It's a decision to keep transmitting even after static." },

  { archetype: "The Bloom Signal", text: "Warmth isn't a weakness you need. It's the fuel your whole signal runs on." },
  { archetype: "The Bloom Signal", text: "You grow toward whatever you're given. Today, give yourself something worth growing toward." },

  { archetype: "The Steady Pulse", text: "You are the reason things that shouldn't hold together, hold together. That's not small." },
  { archetype: "The Steady Pulse", text: "Consistency is your quiet superpower. Most people never notice it until it's gone." },

  { archetype: "The Wildfire Wave", text: "Running hot and honest scares people who run cold and careful. Keep running." },
  { archetype: "The Wildfire Wave", text: "The ones who can keep up with your heat are the ones worth keeping." },

  { archetype: "The Golden Static", text: "The chaos you carry isn't a flaw. It's how you keep the room, and yourself, awake." },
  { archetype: "The Golden Static", text: "Not every signal needs to be clean to be true." },

  { archetype: "The Harvest Echo", text: "You finish what others quietly gave up on. That's a form of courage with no applause." },
  { archetype: "The Harvest Echo", text: "What you build today will still be standing after the moment that made it is gone." },

  { archetype: "The Turning Tide", text: "Letting go of a version of yourself that's done its job is rarer, and braver, than it sounds." },
  { archetype: "The Turning Tide", text: "You don't owe loyalty to who you used to be." },

  { archetype: "The Deep Resonance", text: "Feeling things a layer down isn't too much. It's just depth most people haven't reached yet." },
  { archetype: "The Deep Resonance", text: "Your exhausting is someone else's unforgettable. Keep transmitting." },

  { archetype: "The Long Transmission", text: "You were built for distance, not the sprint. Slow is not the same as lost." },
  { archetype: "The Long Transmission", text: "What you're becoming was never going to happen quickly, and that was always the plan." },
];

export const QUOTES: Quote[] = [
  ...GENERAL.map((text): Quote => ({ text })),
  ...ARCHETYPE_QUOTES,
];

/** Picks a fresh quote. If an archetype is passed and has its own lines,
 *  those are mixed into the pool so the odds lean (slightly) toward
 *  something relevant -- without ever excluding the general pool. */
export function pickQuote(archetype?: string | null): Quote {
  const pool = archetype
    ? [...GENERAL.map((text): Quote => ({ text })), ...ARCHETYPE_QUOTES.filter((q) => q.archetype === archetype)]
    : QUOTES.filter((q) => !q.archetype);
  return pool[Math.floor(Math.random() * pool.length)];
}
