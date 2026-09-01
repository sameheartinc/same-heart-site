// Same Heart -- Prime Levels.
//
// A second progression sitting alongside Standing (lib/standing.ts), not
// replacing it. Standing is five rare, named tiers earned over months;
// this is a plain number that ticks up every time your XP total passes
// a prime number -- Level 1 at 2 XP, Level 2 at 3 XP, Level 3 at 5 XP,
// Level 4 at 7 XP, and so on. Primes thin out fast as numbers grow
// (there are 25 primes under 100, but only 168 under 1,000 and 1,229
// under 10,000), so this shape does exactly what was asked for on its
// own, with no hand-tuned curve needed: fast, frequent wins early on,
// and a genuinely long, honest wait for the next one once you're deep
// in -- "hard to reach... but the outcomes evolve... it takes a long
// time" (see IDEAS.md's evolution/unlockables notes).
//
// Deliberately a pure function of XP, not new stored state. XP is
// already the trusted, server-only value every other progression system
// on the site reads from (see lib/standing.ts's own header on this) --
// Level just needs no database column or migration at all, since it's
// derived fresh, every time, from a number that's already real and
// already tamper-proof.

const SIEVE_LIMIT = 200_000; // the 17,984th prime is under 200,000 -- an XP total that large is not a near-term concern, and computing further is one constant away if it ever is

let cachedPrimes: number[] | null = null;

// The Sieve of Eratosthenes: start assuming every number from 2 up is
// prime, then walk each one in turn and cross off all of its multiples
// -- whatever's never crossed off is prime. Runs in O(n log log n), and
// for a limit this size it finishes in well under a millisecond, once,
// the first time any caller asks for a level.
function sieveOfEratosthenes(limit: number): number[] {
  const isComposite = new Uint8Array(limit + 1);
  const primes: number[] = [];
  for (let n = 2; n <= limit; n++) {
    if (isComposite[n]) continue;
    primes.push(n);
    for (let multiple = n * n; multiple <= limit; multiple += n) {
      isComposite[multiple] = 1;
    }
  }
  return primes;
}

function primes(): number[] {
  if (!cachedPrimes) cachedPrimes = sieveOfEratosthenes(SIEVE_LIMIT);
  return cachedPrimes;
}

// How many primes are <= xp -- that count IS the level. primes() is
// sorted ascending, so a binary search finds this in O(log n) rather
// than scanning the whole sieve on every render.
export function getLevel(xp: number): number {
  const list = primes();
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= xp) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// The next prime strictly greater than xp -- i.e. exactly how many more
// Heartbeats stand between someone and their next level-up. Null only if
// XP has grown past SIEVE_LIMIT, which today's XP sources (a few dozen
// Heartbeats at a time) would take an implausible amount of real use to
// reach; a caller sees this as "no known next level yet" rather than a
// crash.
export function nextPrimeThreshold(xp: number): number | null {
  const list = primes();
  for (const p of list) {
    if (p > xp) return p;
  }
  return null;
}
