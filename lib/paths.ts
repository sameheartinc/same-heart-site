// The four paths people quietly sort into as they move through the site.
// Nobody picks a path from a menu -- it's read from a short run of small,
// sensory picks (a colour, a texture, three quick questions, an inkblot)
// plus how their cursor actually behaves, then blended together. This is
// separate from Star Day (lib/starDay.ts): Path is a quick personality
// read assigned at arrival; Star Day is the deeper, permanent signal from
// a birth date, captured right after.

export type PathKey = "guardian" | "seeker" | "weaver" | "flame";

export interface PathDef {
  key: PathKey;
  name: string;
  tagline: string;
  essence: string;
  accent: string;
  accentSoft: string;
  motion: "steady" | "roaming" | "weaving" | "flicker";
}

export const PATH_ORDER: PathKey[] = ["guardian", "seeker", "weaver", "flame"];

export const PATHS: Record<PathKey, PathDef> = {
  guardian: {
    key: "guardian",
    name: "The Guardian",
    tagline: "Steady is its own kind of brave.",
    essence:
      "Grounded and protective -- the calm at the center of the room, the one people check in with.",
    accent: "#c9a15a",
    accentSoft: "rgba(201,161,90,0.16)",
    motion: "steady",
  },
  seeker: {
    key: "seeker",
    name: "The Seeker",
    tagline: "Still curious about everything.",
    essence:
      "Restless and exploratory -- always circling toward whatever hasn't been explained yet.",
    accent: "#7c9fd9",
    accentSoft: "rgba(124,159,217,0.16)",
    motion: "roaming",
  },
  weaver: {
    key: "weaver",
    name: "The Weaver",
    tagline: "It finds the thread between people.",
    essence:
      "Connective and empathetic -- drawn to whoever is standing alone, good at tying strangers together.",
    accent: "#c9576a",
    accentSoft: "rgba(201,87,106,0.16)",
    motion: "weaving",
  },
  flame: {
    key: "flame",
    name: "The Flame",
    tagline: "It shows up loud because it means it.",
    essence:
      "Passionate and expressive -- the spark that starts the room talking.",
    accent: "#e0703a",
    accentSoft: "rgba(224,112,58,0.16)",
    motion: "flicker",
  },
};

export type AxisScores = Record<PathKey, number>;

export function blankAxisScores(): AxisScores {
  return { guardian: 0, seeker: 0, weaver: 0, flame: 0 };
}

export interface OnboardingOption {
  label: string;
  weights: Partial<AxisScores>;
}

export interface OnboardingQuestion {
  id: string;
  prompt: string;
  options: OnboardingOption[];
}

// Rob, Oct 18 2026: "the questions should not be the same...there
// should be like 100 questions that the bank pulls from...so if someone
// visits again its a new experience." This is that bank -- every
// question still nudges exactly one axis by 2 points, same as always,
// but a single onboarding run only ever uses ONBOARDING_QUESTION_COUNT
// of them, drawn at random by pickOnboardingQuestions() below. Two
// different people (or the same person years apart, if onboarding is
// ever re-run) land on a different three questions almost every time.
export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "room",
    prompt: "You walk into a room full of strangers. First instinct:",
    options: [
      { label: "Find whoever's standing alone", weights: { weaver: 2 } },
      { label: "Clock every exit and detail", weights: { guardian: 2 } },
      { label: "Head for whatever looks unfamiliar", weights: { seeker: 2 } },
      { label: "Say something loud enough to turn heads", weights: { flame: 2 } },
    ],
  },
  {
    id: "hard-day",
    prompt: "On a hard day, what actually helps?",
    options: [
      { label: "A plan, and something to fix", weights: { guardian: 2 } },
      { label: "Getting far away for a while", weights: { seeker: 2 } },
      { label: "Calling the one person who gets it", weights: { weaver: 2 } },
      { label: "Turning the volume up on something", weights: { flame: 2 } },
    ],
  },
  {
    id: "give",
    prompt: "If you could hand someone one thing today, it'd be:",
    options: [
      { label: "Reassurance that they're safe", weights: { guardian: 2 } },
      { label: "A door they hadn't noticed", weights: { seeker: 2 } },
      { label: "An introduction to someone they need", weights: { weaver: 2 } },
      { label: "The nerve to actually try it", weights: { flame: 2 } },
    ],
  },
  {
    id: "new-city",
    prompt: "You land somewhere you've never been, no plans yet. First move:",
    options: [
      { label: "Find your bearings before you do anything else", weights: { guardian: 2 } },
      { label: "Pick a direction and just start walking", weights: { seeker: 2 } },
      { label: "Ask a local where they'd go", weights: { weaver: 2 } },
      { label: "Follow whatever sounds the loudest", weights: { flame: 2 } },
    ],
  },
  {
    id: "storm",
    prompt: "A storm's rolling in and everyone's scrambling. You're:",
    options: [
      { label: "Already checking on the people who need it most", weights: { guardian: 2 } },
      { label: "Watching it build, half-thrilled", weights: { seeker: 2 } },
      { label: "Making sure no one's riding it out alone", weights: { weaver: 2 } },
      { label: "Out in it before anyone tells you not to", weights: { flame: 2 } },
    ],
  },
  {
    id: "silence",
    prompt: "A long silence in the middle of a conversation feels like:",
    options: [
      { label: "A chance to make sure everything's okay", weights: { guardian: 2 } },
      { label: "Room to think about something else entirely", weights: { seeker: 2 } },
      { label: "A weight you want to lift for the other person", weights: { weaver: 2 } },
      { label: "Something you can't help but fill", weights: { flame: 2 } },
    ],
  },
  {
    id: "new-skill",
    prompt: "Learning something totally new, you'd rather:",
    options: [
      { label: "Master the basics cold before moving on", weights: { guardian: 2 } },
      { label: "Skip ahead to the hardest part", weights: { seeker: 2 } },
      { label: "Learn it alongside someone else", weights: { weaver: 2 } },
      { label: "Just dive in and look foolish for a while", weights: { flame: 2 } },
    ],
  },
  {
    id: "apology",
    prompt: "When you've hurt someone, the hardest part is:",
    options: [
      { label: "Making sure it actually doesn't happen again", weights: { guardian: 2 } },
      { label: "Sitting still with it instead of moving on", weights: { seeker: 2 } },
      { label: "Finding the exact right words", weights: { weaver: 2 } },
      { label: "Saying it before the moment passes", weights: { flame: 2 } },
    ],
  },
  {
    id: "crowd-noise",
    prompt: "A room gets too loud. You:",
    options: [
      { label: "Find the quietest corner and hold it down", weights: { guardian: 2 } },
      { label: "Slip out to somewhere stranger, somewhere new", weights: { seeker: 2 } },
      { label: "Pull one person aside for a real conversation", weights: { weaver: 2 } },
      { label: "Get louder right back", weights: { flame: 2 } },
    ],
  },
  {
    id: "old-photo",
    prompt: "An old photo of yourself surfaces. What hits first:",
    options: [
      { label: "Who you were keeping safe back then", weights: { guardian: 2 } },
      { label: "Everywhere you hadn't been yet", weights: { seeker: 2 } },
      { label: "Who's standing next to you in it", weights: { weaver: 2 } },
      { label: "How much you were feeling, out loud, right then", weights: { flame: 2 } },
    ],
  },
  {
    id: "waiting-room",
    prompt: "Stuck waiting somewhere with nothing to do:",
    options: [
      { label: "You make it comfortable for whoever's with you", weights: { guardian: 2 } },
      { label: "You start noticing everything in the room", weights: { seeker: 2 } },
      { label: "You strike up a conversation with a stranger", weights: { weaver: 2 } },
      { label: "You get restless fast", weights: { flame: 2 } },
    ],
  },
  {
    id: "good-news",
    prompt: "You just got good news. Who hears it first:",
    options: [
      { label: "The person who's been there through everything", weights: { guardian: 2 } },
      { label: "No one yet -- you want to sit with it first", weights: { seeker: 2 } },
      { label: "Whoever needs good news today", weights: { weaver: 2 } },
      { label: "Everyone, immediately", weights: { flame: 2 } },
    ],
  },
  {
    id: "supporting-someone",
    prompt: "Someone you love is struggling and won't say why. You:",
    options: [
      { label: "Quietly make sure they're not alone with it", weights: { guardian: 2 } },
      { label: "Ask the question no one else will", weights: { seeker: 2 } },
      { label: "Wait until they're ready to talk", weights: { weaver: 2 } },
      { label: "Tell them exactly what you see happening", weights: { flame: 2 } },
    ],
  },
  {
    id: "unfamiliar-food",
    prompt: "Something unfamiliar shows up on the table. You:",
    options: [
      { label: "Check what's in it before anything else", weights: { guardian: 2 } },
      { label: "Try it before anyone explains what it is", weights: { seeker: 2 } },
      { label: "Watch who else is nervous about it too", weights: { weaver: 2 } },
      { label: "Go first, loudly, daring everyone else to", weights: { flame: 2 } },
    ],
  },
  {
    id: "map-vs-wander",
    prompt: "Exploring somewhere new, you reach for:",
    options: [
      { label: "A map, every time", weights: { guardian: 2 } },
      { label: "Nothing -- getting lost is the point", weights: { seeker: 2 } },
      { label: "Whoever looks like they know the way", weights: { weaver: 2 } },
      { label: "Whatever direction feels most alive", weights: { flame: 2 } },
    ],
  },
  {
    id: "last-word",
    prompt: "In an argument, you're usually the one who:",
    options: [
      { label: "Tries to de-escalate it", weights: { guardian: 2 } },
      { label: "Asks the question that changes the whole subject", weights: { seeker: 2 } },
      { label: "Worries about what it's doing to everyone else", weights: { weaver: 2 } },
      { label: "Needs the last word", weights: { flame: 2 } },
    ],
  },
  {
    id: "gift-received",
    prompt: "Someone gives you something thoughtful. Your first feeling:",
    options: [
      { label: "Gratitude, and the urge to repay it somehow", weights: { guardian: 2 } },
      { label: "Surprise that they noticed at all", weights: { seeker: 2 } },
      { label: "Warmth, thinking about how well they know you", weights: { weaver: 2 } },
      { label: "Pure, loud delight", weights: { flame: 2 } },
    ],
  },
  {
    id: "deadline",
    prompt: "A deadline's closing in fast. You:",
    options: [
      { label: "Already had a buffer built in", weights: { guardian: 2 } },
      { label: "Get distracted by something more interesting", weights: { seeker: 2 } },
      { label: "Check in on everyone else's piece of it", weights: { weaver: 2 } },
      { label: "Do your best work under exactly this pressure", weights: { flame: 2 } },
    ],
  },
  {
    id: "free-day",
    prompt: "You've got a whole day with nowhere to be. You spend it:",
    options: [
      { label: "Taking care of everything that's been waiting", weights: { guardian: 2 } },
      { label: "Somewhere you've never gone before", weights: { seeker: 2 } },
      { label: "With the people you don't see enough", weights: { weaver: 2 } },
      { label: "Doing whatever you feel like, the second you feel it", weights: { flame: 2 } },
    ],
  },
  {
    id: "new-neighbor",
    prompt: "Someone new moves in next door. You:",
    options: [
      { label: "Let them settle, then check if they need anything", weights: { guardian: 2 } },
      { label: "Wonder where they came from and why", weights: { seeker: 2 } },
      { label: "Go introduce yourself within the week", weights: { weaver: 2 } },
      { label: "Wave like you've known them for years", weights: { flame: 2 } },
    ],
  },
  {
    id: "criticism",
    prompt: "Hearing hard feedback about something you made, you:",
    options: [
      { label: "Take it seriously and fix it methodically", weights: { guardian: 2 } },
      { label: "Get curious about what you missed", weights: { seeker: 2 } },
      { label: "Wonder how it landed on the person giving it", weights: { weaver: 2 } },
      { label: "Feel it hard, then come back swinging", weights: { flame: 2 } },
    ],
  },
  {
    id: "power-out",
    prompt: "The power goes out with no warning. You:",
    options: [
      { label: "Find the flashlight before anyone asks", weights: { guardian: 2 } },
      { label: "Go outside to see how far it reaches", weights: { seeker: 2 } },
      { label: "Check that everyone in the house is okay", weights: { weaver: 2 } },
      { label: "Light a candle and make it an event", weights: { flame: 2 } },
    ],
  },
  {
    id: "childhood-memory",
    prompt: "Your clearest childhood memory involves:",
    options: [
      { label: "Someone who made you feel safe", weights: { guardian: 2 } },
      { label: "Somewhere you weren't supposed to go", weights: { seeker: 2 } },
      { label: "A friend you haven't thought of in years", weights: { weaver: 2 } },
      { label: "A moment you got to be loud and nobody stopped you", weights: { flame: 2 } },
    ],
  },
  {
    id: "last-text",
    prompt: "You re-read your last sent text before hitting send. You're checking:",
    options: [
      { label: "That it won't worry anyone", weights: { guardian: 2 } },
      { label: "Nothing -- you already sent it", weights: { seeker: 2 } },
      { label: "That it reads the way you meant it to", weights: { weaver: 2 } },
      { label: "Whether it's bold enough", weights: { flame: 2 } },
    ],
  },
  {
    id: "new-job-first-day",
    prompt: "First day somewhere new, you:",
    options: [
      { label: "Learn every rule before breaking any habit", weights: { guardian: 2 } },
      { label: "Explore every hallway you're allowed in", weights: { seeker: 2 } },
      { label: "Remember everyone's name by lunch", weights: { weaver: 2 } },
      { label: "Make sure people know you're there", weights: { flame: 2 } },
    ],
  },
  {
    id: "compliment",
    prompt: "Someone compliments you out of nowhere. You:",
    options: [
      { label: "Deflect, a little, out of habit", weights: { guardian: 2 } },
      { label: "Wonder what prompted it", weights: { seeker: 2 } },
      { label: "Immediately think of something kind to say back", weights: { weaver: 2 } },
      { label: "Soak it in completely", weights: { flame: 2 } },
    ],
  },
  {
    id: "rainy-day",
    prompt: "A rainy day with nothing planned feels like:",
    options: [
      { label: "A good excuse to get the small things done", weights: { guardian: 2 } },
      { label: "An invitation to go out in it anyway", weights: { seeker: 2 } },
      { label: "A good day to call someone you miss", weights: { weaver: 2 } },
      { label: "A mood, and you lean all the way into it", weights: { flame: 2 } },
    ],
  },
  {
    id: "surprise-party",
    prompt: "Planning a surprise for someone, the part you love most:",
    options: [
      { label: "Making sure nothing goes wrong", weights: { guardian: 2 } },
      { label: "Keeping the secret as long as possible", weights: { seeker: 2 } },
      { label: "Getting everyone who loves them in one room", weights: { weaver: 2 } },
      { label: "The exact second they find out", weights: { flame: 2 } },
    ],
  },
  {
    id: "long-drive",
    prompt: "A long drive with no one else in the car. You spend it:",
    options: [
      { label: "Thinking through everything you need to handle", weights: { guardian: 2 } },
      { label: "Taking the exit you've never taken before", weights: { seeker: 2 } },
      { label: "On the phone with someone you haven't called in a while", weights: { weaver: 2 } },
      { label: "Singing like no one can hear you", weights: { flame: 2 } },
    ],
  },
  {
    id: "first-impression",
    prompt: "People usually say you come across as:",
    options: [
      { label: "Dependable", weights: { guardian: 2 } },
      { label: "Curious", weights: { seeker: 2 } },
      { label: "Warm", weights: { weaver: 2 } },
      { label: "Intense", weights: { flame: 2 } },
    ],
  },
  {
    id: "losing-a-game",
    prompt: "Losing a game you actually cared about, you:",
    options: [
      { label: "Analyze exactly what went wrong", weights: { guardian: 2 } },
      { label: "Already want to try it a completely different way", weights: { seeker: 2 } },
      { label: "Check if your teammates are okay about it", weights: { weaver: 2 } },
      { label: "Feel it in your whole chest for a minute", weights: { flame: 2 } },
    ],
  },
  {
    id: "new-year",
    prompt: "At midnight on New Year's, you're usually:",
    options: [
      { label: "With the handful of people who matter most", weights: { guardian: 2 } },
      { label: "Wondering what you'll do differently", weights: { seeker: 2 } },
      { label: "Making sure everyone's glass is full", weights: { weaver: 2 } },
      { label: "Loud, right in the middle of it", weights: { flame: 2 } },
    ],
  },
  {
    id: "quiet-vs-public-praise",
    prompt: "Would rather be told you did well:",
    options: [
      { label: "Privately, so it actually sinks in", weights: { guardian: 2 } },
      { label: "In passing -- you're already on to the next thing", weights: { seeker: 2 } },
      { label: "By someone who really means it", weights: { weaver: 2 } },
      { label: "In front of everyone", weights: { flame: 2 } },
    ],
  },
  {
    id: "broken-plan",
    prompt: "Plans fall through last minute. You:",
    options: [
      { label: "Already have a backup ready", weights: { guardian: 2 } },
      { label: "See it as an opening, not a loss", weights: { seeker: 2 } },
      { label: "Check who else is disappointed and sit with them", weights: { weaver: 2 } },
      { label: "Turn it into something better on the spot", weights: { flame: 2 } },
    ],
  },
  {
    id: "favorite-season",
    prompt: "Your favorite time of year is the one that feels:",
    options: [
      { label: "Steady and unchanging", weights: { guardian: 2 } },
      { label: "Full of restlessness and change", weights: { seeker: 2 } },
      { label: "Made for being close to people", weights: { weaver: 2 } },
      { label: "Alive in a way you can feel on your skin", weights: { flame: 2 } },
    ],
  },
  {
    id: "unfinished-business",
    prompt: "Something you left unresolved years ago still:",
    options: [
      { label: "Nags at you until you can fix it", weights: { guardian: 2 } },
      { label: "Makes you wonder what would've happened", weights: { seeker: 2 } },
      { label: "Makes you think about the person on the other end of it", weights: { weaver: 2 } },
      { label: "Still gets your blood up a little", weights: { flame: 2 } },
    ],
  },
  {
    id: "new-pet",
    prompt: "Bringing home a new pet, the first thing you do:",
    options: [
      { label: "Pet-proof everything before they even arrive", weights: { guardian: 2 } },
      { label: "Take them somewhere new right away", weights: { seeker: 2 } },
      { label: "Introduce them to everyone you love", weights: { weaver: 2 } },
      { label: "Let them see how big your personality is", weights: { flame: 2 } },
    ],
  },
  {
    id: "standing-ovation",
    prompt: "Watching someone else get a standing ovation, you feel:",
    options: [
      { label: "Proud, like you helped get them there", weights: { guardian: 2 } },
      { label: "Curious what they'll do next", weights: { seeker: 2 } },
      { label: "Moved, almost like it's happening to you too", weights: { weaver: 2 } },
      { label: "Fired up, wanting your own moment", weights: { flame: 2 } },
    ],
  },
  {
    id: "being-wrong",
    prompt: "Realizing you were wrong about something, you:",
    options: [
      { label: "Fix it quietly and move on", weights: { guardian: 2 } },
      { label: "Get interested in how you got there", weights: { seeker: 2 } },
      { label: "Worry about who it affected", weights: { weaver: 2 } },
      { label: "Say it loud before anyone else can point it out", weights: { flame: 2 } },
    ],
  },
  {
    id: "full-inbox",
    prompt: "An inbox full of unread messages makes you feel:",
    options: [
      { label: "Like there's work to do, so you do it", weights: { guardian: 2 } },
      { label: "Nothing much -- you'll get to it eventually", weights: { seeker: 2 } },
      { label: "Guilty about whoever's still waiting on you", weights: { weaver: 2 } },
      { label: "Overwhelmed, loudly, until it's handled", weights: { flame: 2 } },
    ],
  },
  {
    id: "first-snow",
    prompt: "The first snow of the year, you:",
    options: [
      { label: "Check that everyone's got what they need for it", weights: { guardian: 2 } },
      { label: "Go stand in it just to feel it", weights: { seeker: 2 } },
      { label: "Text someone to come look at it with you", weights: { weaver: 2 } },
      { label: "Run outside before it's even finished falling", weights: { flame: 2 } },
    ],
  },
  {
    id: "being-copied",
    prompt: "Someone copies something you made. You feel:",
    options: [
      { label: "Mildly annoyed, then move on", weights: { guardian: 2 } },
      { label: "Curious what they'll do with it", weights: { seeker: 2 } },
      { label: "A little flattered, honestly", weights: { weaver: 2 } },
      { label: "Fired up to make something even bigger", weights: { flame: 2 } },
    ],
  },
  {
    id: "holding-grudge",
    prompt: "An old grudge you still carry is mostly:",
    options: [
      { label: "About trust that got broken", weights: { guardian: 2 } },
      { label: "About a question that never got answered", weights: { seeker: 2 } },
      { label: "About someone who stopped showing up", weights: { weaver: 2 } },
      { label: "About a moment you still think about too often", weights: { flame: 2 } },
    ],
  },
  {
    id: "public-speaking",
    prompt: "Right before speaking in front of a crowd, you feel:",
    options: [
      { label: "Prepared -- you rehearsed for exactly this", weights: { guardian: 2 } },
      { label: "Curious how it'll actually go", weights: { seeker: 2 } },
      { label: "Focused on the people you're speaking to, not yourself", weights: { weaver: 2 } },
      { label: "Electric", weights: { flame: 2 } },
    ],
  },
  {
    id: "messy-room",
    prompt: "A messy room you have to deal with, you:",
    options: [
      { label: "Start with the most important pile first", weights: { guardian: 2 } },
      { label: "Get distracted finding things you forgot you had", weights: { seeker: 2 } },
      { label: "Ask for help instead of doing it alone", weights: { weaver: 2 } },
      { label: "Blast music and make it a whole production", weights: { flame: 2 } },
    ],
  },
  {
    id: "keeping-secret",
    prompt: "Keeping a secret for someone, the hardest part is:",
    options: [
      { label: "The responsibility of holding it right", weights: { guardian: 2 } },
      { label: "Not being able to ask the questions you want to", weights: { seeker: 2 } },
      { label: "Wanting to protect them from it too", weights: { weaver: 2 } },
      { label: "Not being able to talk about it at all", weights: { flame: 2 } },
    ],
  },
  {
    id: "watching-sunrise",
    prompt: "Watching a sunrise, you're thinking about:",
    options: [
      { label: "Everything the day ahead needs from you", weights: { guardian: 2 } },
      { label: "Somewhere you'd rather be watching it from", weights: { seeker: 2 } },
      { label: "Who you wish were there to see it with you", weights: { weaver: 2 } },
      { label: "How alive the whole sky looks", weights: { flame: 2 } },
    ],
  },
  {
    id: "unexpected-visitor",
    prompt: "Someone shows up at your door unannounced. You:",
    options: [
      { label: "Make sure everything's okay before anything else", weights: { guardian: 2 } },
      { label: "Get a little thrill out of the surprise", weights: { seeker: 2 } },
      { label: "Light up -- company is always welcome", weights: { weaver: 2 } },
      { label: "Immediately turn it into an occasion", weights: { flame: 2 } },
    ],
  },
  {
    id: "tough-decision",
    prompt: "A tough decision with no clear right answer, you:",
    options: [
      { label: "Pick whatever protects the most people", weights: { guardian: 2 } },
      { label: "Pick whatever teaches you something either way", weights: { seeker: 2 } },
      { label: "Ask the people it affects what they need", weights: { weaver: 2 } },
      { label: "Go with your gut, fast", weights: { flame: 2 } },
    ],
  },
  {
    id: "being-misunderstood",
    prompt: "Being misunderstood by someone close to you feels like:",
    options: [
      { label: "Something you need to calmly clear up", weights: { guardian: 2 } },
      { label: "An interesting gap to figure out", weights: { seeker: 2 } },
      { label: "A real ache you can't shake", weights: { weaver: 2 } },
      { label: "Something you need to say plainly, right now", weights: { flame: 2 } },
    ],
  },
  {
    id: "watching-fire",
    prompt: "Sitting in front of a fire, you:",
    options: [
      { label: "Keep it tended, just in case", weights: { guardian: 2 } },
      { label: "Stare into it thinking about everything else", weights: { seeker: 2 } },
      { label: "End up in the deepest conversation of the night", weights: { weaver: 2 } },
      { label: "Feel most like yourself", weights: { flame: 2 } },
    ],
  },
  {
    id: "new-language",
    prompt: "Learning a new language, what draws you in:",
    options: [
      { label: "Getting the grammar exactly right", weights: { guardian: 2 } },
      { label: "All the places it could take you", weights: { seeker: 2 } },
      { label: "Talking to someone in their own words", weights: { weaver: 2 } },
      { label: "How different you sound saying it", weights: { flame: 2 } },
    ],
  },
  {
    id: "lost-item",
    prompt: "You lose something that actually mattered. You:",
    options: [
      { label: "Retrace every step until it's found", weights: { guardian: 2 } },
      { label: "Wonder what story it has now, wherever it is", weights: { seeker: 2 } },
      { label: "Call the people who might've seen it", weights: { weaver: 2 } },
      { label: "Feel it hit harder than it probably should", weights: { flame: 2 } },
    ],
  },
  {
    id: "watching-dance",
    prompt: "Watching people dance at a party, you:",
    options: [
      { label: "Hang back, happy to watch", weights: { guardian: 2 } },
      { label: "Wonder what song comes next", weights: { seeker: 2 } },
      { label: "Pull someone shy onto the floor with you", weights: { weaver: 2 } },
      { label: "Are already out there", weights: { flame: 2 } },
    ],
  },
  {
    id: "receiving-advice",
    prompt: "Someone gives you advice you didn't ask for. You:",
    options: [
      { label: "Take what's useful and let the rest go", weights: { guardian: 2 } },
      { label: "Get curious why they think that", weights: { seeker: 2 } },
      { label: "Appreciate that they cared enough to say it", weights: { weaver: 2 } },
      { label: "Bristle a little, even if they're right", weights: { flame: 2 } },
    ],
  },
  {
    id: "home-alone",
    prompt: "Home alone for the evening, you:",
    options: [
      { label: "Finally get to everything you've been putting off", weights: { guardian: 2 } },
      { label: "End up down some rabbit hole you didn't expect", weights: { seeker: 2 } },
      { label: "End up on the phone with someone within the hour", weights: { weaver: 2 } },
      { label: "Turn the music up louder than anyone else would allow", weights: { flame: 2 } },
    ],
  },
  {
    id: "seeing-old-friend",
    prompt: "Running into an old friend you lost touch with, you:",
    options: [
      { label: "Ask how they're really doing, right away", weights: { guardian: 2 } },
      { label: "Ask everything they've been up to since", weights: { seeker: 2 } },
      { label: "Feel the years disappear instantly", weights: { weaver: 2 } },
      { label: "Make plans on the spot to not lose touch again", weights: { flame: 2 } },
    ],
  },
  {
    id: "watching-news",
    prompt: "Hard news on a topic you care about, you:",
    options: [
      { label: "Look for something concrete you can actually do", weights: { guardian: 2 } },
      { label: "Go looking for more of the story", weights: { seeker: 2 } },
      { label: "Think about who it's hurting first", weights: { weaver: 2 } },
      { label: "Feel it loudly before you feel anything else", weights: { flame: 2 } },
    ],
  },
  {
    id: "choosing-a-seat",
    prompt: "Walking into an empty theater, you choose a seat:",
    options: [
      { label: "Near an exit, out of habit", weights: { guardian: 2 } },
      { label: "Somewhere you've never sat before", weights: { seeker: 2 } },
      { label: "Wherever leaves room for whoever's coming", weights: { weaver: 2 } },
      { label: "Dead center, every time", weights: { flame: 2 } },
    ],
  },
  {
    id: "birthday",
    prompt: "On your own birthday, you'd rather:",
    options: [
      { label: "Have the people who matter most, nothing extra", weights: { guardian: 2 } },
      { label: "Do something you've never done before", weights: { seeker: 2 } },
      { label: "Spend it making sure everyone feels included", weights: { weaver: 2 } },
      { label: "Make it impossible to ignore", weights: { flame: 2 } },
    ],
  },
  {
    id: "stray-animal",
    prompt: "You find a stray animal that looks lost. You:",
    options: [
      { label: "Make sure it's safe before anything else", weights: { guardian: 2 } },
      { label: "Wonder where it came from", weights: { seeker: 2 } },
      { label: "Start asking around if it belongs to someone", weights: { weaver: 2 } },
      { label: "Fall for it immediately, loudly", weights: { flame: 2 } },
    ],
  },
  {
    id: "friend-goes-quiet",
    prompt: "A friend goes quiet for no clear reason. You:",
    options: [
      { label: "Check in, gently, more than once", weights: { guardian: 2 } },
      { label: "Give it space and let it play out", weights: { seeker: 2 } },
      { label: "Can't stop thinking about what you might've done", weights: { weaver: 2 } },
      { label: "Say something, even if it's awkward", weights: { flame: 2 } },
    ],
  },
  {
    id: "road-trip-music",
    prompt: "You're in charge of the music for a long trip. You pick:",
    options: [
      { label: "Whatever everyone already agrees on", weights: { guardian: 2 } },
      { label: "Something nobody in the car has heard", weights: { seeker: 2 } },
      { label: "Whatever means something to the person next to you", weights: { weaver: 2 } },
      { label: "Whatever gets everyone singing", weights: { flame: 2 } },
    ],
  },
  {
    id: "watching-someone-struggle",
    prompt: "Watching someone struggle with something you're good at, you:",
    options: [
      { label: "Quietly step in and help", weights: { guardian: 2 } },
      { label: "Let them figure it out their own way", weights: { seeker: 2 } },
      { label: "Ask if they want help before offering it", weights: { weaver: 2 } },
      { label: "Jump in with both hands", weights: { flame: 2 } },
    ],
  },
  {
    id: "old-song-plays",
    prompt: "An old song from a specific time in your life comes on. You:",
    options: [
      { label: "Think of who you were taking care of back then", weights: { guardian: 2 } },
      { label: "Remember exactly where you were headed", weights: { seeker: 2 } },
      { label: "Think of the person you always played it with", weights: { weaver: 2 } },
      { label: "Turn it up and feel sixteen again", weights: { flame: 2 } },
    ],
  },
  {
    id: "moving-cities",
    prompt: "Imagining moving somewhere totally new, what matters most:",
    options: [
      { label: "That the people you love are still close enough", weights: { guardian: 2 } },
      { label: "That it's somewhere you've never lived", weights: { seeker: 2 } },
      { label: "That you could build a real community there", weights: { weaver: 2 } },
      { label: "That it feels like a completely new chapter", weights: { flame: 2 } },
    ],
  },
  {
    id: "disagreement-escalates",
    prompt: "Two people you both know start arguing in front of you. You:",
    options: [
      { label: "Step in to calm it down", weights: { guardian: 2 } },
      { label: "Try to understand both sides", weights: { seeker: 2 } },
      { label: "Worry about the friendship more than who's right", weights: { weaver: 2 } },
      { label: "Say exactly what you think, even unasked", weights: { flame: 2 } },
    ],
  },
  {
    id: "praised-in-public",
    prompt: "A boss or teacher praises you in front of others. You:",
    options: [
      { label: "Feel it, then get back to the work", weights: { guardian: 2 } },
      { label: "Wonder what specifically stood out to them", weights: { seeker: 2 } },
      { label: "Think about who else deserved credit too", weights: { weaver: 2 } },
      { label: "Let yourself enjoy it, fully", weights: { flame: 2 } },
    ],
  },
  {
    id: "childhood-fear",
    prompt: "A fear you've had since childhood is mostly about:",
    options: [
      { label: "Something happening to someone you love", weights: { guardian: 2 } },
      { label: "Never getting to see or do enough", weights: { seeker: 2 } },
      { label: "Being left out or left behind", weights: { weaver: 2 } },
      { label: "Not being heard when it matters", weights: { flame: 2 } },
    ],
  },
  {
    id: "watching-a-parade",
    prompt: "Watching a parade go by, you:",
    options: [
      { label: "Keep an eye on the kids nearby", weights: { guardian: 2 } },
      { label: "Wonder what's coming next", weights: { seeker: 2 } },
      { label: "Wave at every single person who looks your way", weights: { weaver: 2 } },
      { label: "Wish you were the one marching", weights: { flame: 2 } },
    ],
  },
  {
    id: "library-or-concert",
    prompt: "Given the choice for a free evening:",
    options: [
      { label: "A quiet place you already know well", weights: { guardian: 2 } },
      { label: "Somewhere you've genuinely never been", weights: { seeker: 2 } },
      { label: "Wherever the people you love already are", weights: { weaver: 2 } },
      { label: "Wherever the energy is highest", weights: { flame: 2 } },
    ],
  },
  {
    id: "receiving-an-apology",
    prompt: "Someone finally apologizes for something old. You:",
    options: [
      { label: "Accept it and quietly let it go", weights: { guardian: 2 } },
      { label: "Ask the questions you never got to ask", weights: { seeker: 2 } },
      { label: "Feel the relief of the relationship mending", weights: { weaver: 2 } },
      { label: "Still feel the old heat for a second, even now", weights: { flame: 2 } },
    ],
  },
  {
    id: "childhood-nickname",
    prompt: "Your oldest nickname says something about being:",
    options: [
      { label: "The reliable one", weights: { guardian: 2 } },
      { label: "The curious one", weights: { seeker: 2 } },
      { label: "The one who kept everyone together", weights: { weaver: 2 } },
      { label: "The loud one", weights: { flame: 2 } },
    ],
  },
  {
    id: "magic-trick",
    prompt: "Watching a magic trick up close, you:",
    options: [
      { label: "Try to figure out exactly how it's done", weights: { guardian: 2 } },
      { label: "Love not knowing how it's done", weights: { seeker: 2 } },
      { label: "Watch everyone else's faces more than the trick", weights: { weaver: 2 } },
      { label: "React louder than anyone in the room", weights: { flame: 2 } },
    ],
  },
  {
    id: "surprise-day-off",
    prompt: "A surprise day off with zero plans. You spend it:",
    options: [
      { label: "Catching up on everything that's been waiting", weights: { guardian: 2 } },
      { label: "Going somewhere on a whim", weights: { seeker: 2 } },
      { label: "With whoever's free on short notice", weights: { weaver: 2 } },
      { label: "Doing whatever feels most alive in the moment", weights: { flame: 2 } },
    ],
  },
  {
    id: "friend-moving-away",
    prompt: "A close friend tells you they're moving far away. First thought:",
    options: [
      { label: "Making sure you'll both still be okay", weights: { guardian: 2 } },
      { label: "Wondering what pulled them there", weights: { seeker: 2 } },
      { label: "How much you're going to miss the small stuff", weights: { weaver: 2 } },
      { label: "Planning the biggest send-off you can", weights: { flame: 2 } },
    ],
  },
  {
    id: "cold-morning",
    prompt: "A cold morning you don't want to leave the bed for, you:",
    options: [
      { label: "Get up anyway -- there's a routine to keep", weights: { guardian: 2 } },
      { label: "Lie there turning an idea over in your head", weights: { seeker: 2 } },
      { label: "Text someone good morning before you're even up", weights: { weaver: 2 } },
      { label: "Blast something warm and loud to get moving", weights: { flame: 2 } },
    ],
  },
  {
    id: "street-performer",
    prompt: "Walking past a street performer, you:",
    options: [
      { label: "Make sure they're doing okay out there", weights: { guardian: 2 } },
      { label: "Stop, genuinely curious how they got good at it", weights: { seeker: 2 } },
      { label: "Clap loud enough that others join in", weights: { weaver: 2 } },
      { label: "Wish, for a second, that it was you up there", weights: { flame: 2 } },
    ],
  },
  {
    id: "brutally-honest-feedback",
    prompt: "A friend asks for brutally honest feedback. You:",
    options: [
      { label: "Soften it just enough to still be useful", weights: { guardian: 2 } },
      { label: "Give them the most interesting angle, not the easy one", weights: { seeker: 2 } },
      { label: "Think hardest about how to say it kindly", weights: { weaver: 2 } },
      { label: "Give it to them straight, no cushioning", weights: { flame: 2 } },
    ],
  },
  {
    id: "forgotten-plant",
    prompt: "A plant you forgot about is wilting. You:",
    options: [
      { label: "Feel genuinely bad and fix it immediately", weights: { guardian: 2 } },
      { label: "Get curious if it can still bounce back", weights: { seeker: 2 } },
      { label: "Feel for it like it's a small living thing that needed you", weights: { weaver: 2 } },
      { label: "Overcorrect and nearly drown it with care", weights: { flame: 2 } },
    ],
  },
  {
    id: "long-line",
    prompt: "Stuck in a long, slow line, you:",
    options: [
      { label: "Wait it out patiently, no big deal", weights: { guardian: 2 } },
      { label: "People-watch the whole time", weights: { seeker: 2 } },
      { label: "End up talking to whoever's next to you", weights: { weaver: 2 } },
      { label: "Get restless within the first five minutes", weights: { flame: 2 } },
    ],
  },
  {
    id: "old-journal",
    prompt: "Reading an old journal of yours, you mostly notice:",
    options: [
      { label: "How much you were worrying about everyone else", weights: { guardian: 2 } },
      { label: "How many questions you were asking", weights: { seeker: 2 } },
      { label: "How many names show up on every page", weights: { weaver: 2 } },
      { label: "How much feeling is just sitting there in the ink", weights: { flame: 2 } },
    ],
  },
  {
    id: "group-project",
    prompt: "In a group project, you're usually the one who:",
    options: [
      { label: "Makes sure every piece actually gets done", weights: { guardian: 2 } },
      { label: "Pitches the idea nobody else thought of", weights: { seeker: 2 } },
      { label: "Makes sure everyone's voice gets heard", weights: { weaver: 2 } },
      { label: "Carries the actual presentation", weights: { flame: 2 } },
    ],
  },
  {
    id: "unfamiliar-instrument",
    prompt: "Handed an instrument you've never played, you:",
    options: [
      { label: "Ask someone to show you the right way first", weights: { guardian: 2 } },
      { label: "Start pressing things just to hear what happens", weights: { seeker: 2 } },
      { label: "Try to play something you both know", weights: { weaver: 2 } },
      { label: "Make noise and don't care how it sounds", weights: { flame: 2 } },
    ],
  },
  {
    id: "bad-first-impression",
    prompt: "You realize you made a bad first impression. You:",
    options: [
      { label: "Quietly make sure it doesn't happen again", weights: { guardian: 2 } },
      { label: "Get curious what gave that impression", weights: { seeker: 2 } },
      { label: "Worry about it more than you probably should", weights: { weaver: 2 } },
      { label: "Address it head-on, out loud", weights: { flame: 2 } },
    ],
  },
  {
    id: "view-from-a-height",
    prompt: "Standing somewhere high up looking down, you feel:",
    options: [
      { label: "Aware of everyone else's safety up there with you", weights: { guardian: 2 } },
      { label: "The pull to go even higher", weights: { seeker: 2 } },
      { label: "The urge to point it out to someone next to you", weights: { weaver: 2 } },
      { label: "Something close to electric", weights: { flame: 2 } },
    ],
  },
  {
    id: "family-recipe",
    prompt: "Cooking a recipe passed down in your family, you think about:",
    options: [
      { label: "Getting it exactly right, the way it was taught", weights: { guardian: 2 } },
      { label: "What you'd change about it this time", weights: { seeker: 2 } },
      { label: "Who you learned it from", weights: { weaver: 2 } },
      { label: "How good the whole room will feel eating it", weights: { flame: 2 } },
    ],
  },
  {
    id: "left-on-read",
    prompt: "A text you sent gets left on read for days. You:",
    options: [
      { label: "Assume they're just busy and let it be", weights: { guardian: 2 } },
      { label: "Get curious, not worried", weights: { seeker: 2 } },
      { label: "Replay the message wondering if it landed wrong", weights: { weaver: 2 } },
      { label: "Feel it more than you'd admit", weights: { flame: 2 } },
    ],
  },
  {
    id: "unfamiliar-dog",
    prompt: "An unfamiliar dog runs up to you. You:",
    options: [
      { label: "Stay calm and let it come to you", weights: { guardian: 2 } },
      { label: "Crouch down, immediately curious about it", weights: { seeker: 2 } },
      { label: "Look around for its person first", weights: { weaver: 2 } },
      { label: "Get just as excited as the dog", weights: { flame: 2 } },
    ],
  },
  {
    id: "biggest-fear",
    prompt: "Someone asks what you're most afraid of. You say:",
    options: [
      { label: "Something happening to someone you love", weights: { guardian: 2 } },
      { label: "Staying the same forever", weights: { seeker: 2 } },
      { label: "Being forgotten by the people who matter", weights: { weaver: 2 } },
      { label: "Never actually being seen", weights: { flame: 2 } },
    ],
  },
  {
    id: "candle-goes-out",
    prompt: "A candle goes out in the middle of dinner. You:",
    options: [
      { label: "Relight it without missing a beat", weights: { guardian: 2 } },
      { label: "Like the dark for a second before relighting it", weights: { seeker: 2 } },
      { label: "Notice who flinched and who didn't", weights: { weaver: 2 } },
      { label: "Make a whole moment out of it", weights: { flame: 2 } },
    ],
  },
  {
    id: "old-voicemail",
    prompt: "You find an old voicemail from someone you miss. You:",
    options: [
      { label: "Save it somewhere safer this time", weights: { guardian: 2 } },
      { label: "Listen for details you forgot were there", weights: { seeker: 2 } },
      { label: "Feel every bit of the person in their voice", weights: { weaver: 2 } },
      { label: "Feel it hit you right in the chest", weights: { flame: 2 } },
    ],
  },
  {
    id: "coin-flip-decision",
    prompt: "Torn between two choices, you:",
    options: [
      { label: "Pick whichever feels safer long-term", weights: { guardian: 2 } },
      { label: "Pick whichever you know less about", weights: { seeker: 2 } },
      { label: "Ask someone you trust before deciding", weights: { weaver: 2 } },
      { label: "Go with whichever one you felt first", weights: { flame: 2 } },
    ],
  },
  {
    id: "slow-sunday",
    prompt: "A slow Sunday with nowhere to be, you spend it:",
    options: [
      { label: "Getting ahead on the week to come", weights: { guardian: 2 } },
      { label: "Wandering with no destination in mind", weights: { seeker: 2 } },
      { label: "On a long, unhurried call with someone", weights: { weaver: 2 } },
      { label: "Doing something that makes you feel completely alive", weights: { flame: 2 } },
    ],
  },
  {
    id: "praised-for-your-work",
    prompt: "Someone praises something you made, specifically. You:",
    options: [
      { label: "Feel useful, more than proud", weights: { guardian: 2 } },
      { label: "Already thinking about the next version", weights: { seeker: 2 } },
      { label: "Think about who helped you get there", weights: { weaver: 2 } },
      { label: "Let it fill up the whole room with you", weights: { flame: 2 } },
    ],
  },
  {
    id: "stranger-kindness",
    prompt: "A stranger does something kind for no reason. You:",
    options: [
      { label: "File it away as proof people are mostly good", weights: { guardian: 2 } },
      { label: "Wonder what made them do it", weights: { seeker: 2 } },
      { label: "Want to pass it on to someone else", weights: { weaver: 2 } },
      { label: "Feel it louder than the moment probably called for", weights: { flame: 2 } },
    ],
  },
  {
    id: "song-everyone-knows",
    prompt: "A song everyone in the room knows comes on. You:",
    options: [
      { label: "Smile and let everyone else have the moment", weights: { guardian: 2 } },
      { label: "Notice the one person who doesn't know it", weights: { seeker: 2 } },
      { label: "Grab the nearest person to sing it with", weights: { weaver: 2 } },
      { label: "Sing it loudest, first", weights: { flame: 2 } },
    ],
  },
  {
    id: "final-goodbye",
    prompt: "Saying goodbye to someone, not knowing when you'll see them again, you:",
    options: [
      { label: "Make sure they have everything they need before you go", weights: { guardian: 2 } },
      { label: "Ask one more question before they're gone", weights: { seeker: 2 } },
      { label: "Hold on a second longer than usual", weights: { weaver: 2 } },
      { label: "Say exactly what you feel, right there", weights: { flame: 2 } },
    ],
  },
  {
    id: "empty-stage",
    prompt: "An empty stage with a mic still on. You:",
    options: [
      { label: "Check that it's actually turned off before leaving it", weights: { guardian: 2 } },
      { label: "Wonder who was just up there", weights: { seeker: 2 } },
      { label: "Think about who you'd want to see standing on it", weights: { weaver: 2 } },
      { label: "Feel the pull to say something into it", weights: { flame: 2 } },
    ],
  },
  {
    id: "waiting-on-results",
    prompt: "Waiting on news that could go either way, you:",
    options: [
      { label: "Prepare for whatever the answer turns out to be", weights: { guardian: 2 } },
      { label: "Try to guess every possible outcome", weights: { seeker: 2 } },
      { label: "Call someone just to not be waiting alone", weights: { weaver: 2 } },
      { label: "Can barely sit still until it comes", weights: { flame: 2 } },
    ],
  },
];

// How many of the ~100 questions above a single onboarding run actually
// asks -- unchanged from the original fixed set of three; only the pool
// they're drawn from got bigger.
export const ONBOARDING_QUESTION_COUNT = 3;

// Draws ONBOARDING_QUESTION_COUNT distinct questions at random from the
// full bank, without replacement. Called once per onboarding run (see
// components/PathOnboarding.tsx's mount effect, the same place it
// already generates the ambient orb field) so the result is stable for
// that one run instead of re-shuffling on every re-render.
export function pickOnboardingQuestions(count: number): OnboardingQuestion[] {
  const pool = [...ONBOARDING_QUESTIONS];
  const picked: OnboardingQuestion[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

// -- Sensory pre-questions (Sep 6 2026) --------------------------------
// Rob wanted the very first touch to feel less like a form and more like
// a psychoactive drift: a colour picked from a field of floating orbs,
// then a texture that comes with its own sound, before the three text
// questions above ever appear (rendered as coloured bubbles once this
// runs -- see components/PathOnboarding.tsx). Used to close with a
// final "which one feels closer" inkblot pick too; Rob called that one
// irrelevant (Oct 18, 2026) and it's gone now -- the last text question
// finishes onboarding directly. Every pick that's left is a real, if
// gentle, signal into the same four axes everything else here scores
// against -- see scoreOnboarding.

export interface OrbColorOption {
  id: string;
  hex: string;
  glow: string;
  weights: Partial<AxisScores>;
}

// Four "pure" colours mirror each path's own accent 1:1 (so a clean
// pick reads as a clean lean); four "between" colours blend two
// neighbours, so the wheel feels continuous rather than four buckets in
// a trenchcoat.
export const ORB_COLORS: OrbColorOption[] = [
  { id: "gold", hex: "#c9a15a", glow: "rgba(201,161,90,0.6)", weights: { guardian: 2 } },
  { id: "azure", hex: "#7c9fd9", glow: "rgba(124,159,217,0.6)", weights: { seeker: 2 } },
  { id: "rose", hex: "#c9576a", glow: "rgba(201,87,106,0.6)", weights: { weaver: 2 } },
  { id: "ember", hex: "#e0703a", glow: "rgba(224,112,58,0.6)", weights: { flame: 2 } },
  { id: "violet", hex: "#9b7ec9", glow: "rgba(155,126,201,0.6)", weights: { guardian: 1, seeker: 1 } },
  { id: "teal", hex: "#54b0a4", glow: "rgba(84,176,164,0.6)", weights: { seeker: 1, weaver: 1 } },
  { id: "coral", hex: "#d9808c", glow: "rgba(217,128,140,0.6)", weights: { weaver: 1, flame: 1 } },
  { id: "amber", hex: "#d99149", glow: "rgba(217,145,73,0.6)", weights: { flame: 1, guardian: 1 } },
];

export type TextureId = "smooth" | "rippled" | "woven" | "jagged";

export interface TextureOption {
  id: TextureId;
  label: string;
  soundLabel: string;
  weights: Partial<AxisScores>;
}

// Each texture is paired with a distinct tone (see lib/orbTones.ts) so
// the pick is heard as much as it's seen.
export const TEXTURES: TextureOption[] = [
  { id: "smooth", label: "Smooth", soundLabel: "a low, steady hum", weights: { guardian: 2 } },
  { id: "rippled", label: "Rippled", soundLabel: "a bright, curious chime", weights: { seeker: 2 } },
  { id: "woven", label: "Woven", soundLabel: "a warm hum that answers back", weights: { weaver: 2 } },
  { id: "jagged", label: "Jagged", soundLabel: "a sharp crackle of static", weights: { flame: 2 } },
];

// Every pick along the way -- colour, texture, the three questions, the
// inkblot -- feeds this the same way: a Partial<AxisScores> worth up to
// 2 points on one or two axes. The max per axis is derived from however
// many picks were actually passed in, so this scales cleanly whether
// it's fed 3 answers or 6.
export function scoreOnboarding(
  answers: Array<Partial<AxisScores> | undefined>
): AxisScores {
  const scores = blankAxisScores();
  for (const answer of answers) {
    if (!answer) continue;
    for (const key of PATH_ORDER) {
      scores[key] += answer[key] ?? 0;
    }
  }
  const maxPerAxis = Math.max(1, answers.length * 2);
  for (const key of PATH_ORDER) {
    scores[key] = clamp01(scores[key] / maxPerAxis);
  }
  return scores;
}

export function combineScores(
  onboarding: AxisScores,
  cursor: AxisScores,
  onboardingWeight = 0.5
): AxisScores {
  const combined = blankAxisScores();
  for (const key of PATH_ORDER) {
    combined[key] =
      onboarding[key] * onboardingWeight + cursor[key] * (1 - onboardingWeight);
  }
  return combined;
}

export function pickPath(scores: AxisScores): { path: PathKey; confidence: number } {
  const entries = PATH_ORDER.map((key) => [key, scores[key]] as const);
  entries.sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = entries[0];
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const share = total > 0 ? topVal / total : 1 / PATH_ORDER.length;
  // Floor it so a thin lead never reads as near-zero confidence.
  const confidence = clamp01(0.25 + share * 0.75);
  return { path: topKey, confidence };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
