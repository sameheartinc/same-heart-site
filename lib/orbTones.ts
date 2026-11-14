// Small, dependency-free Web Audio helper for the onboarding question
// pick (see components/PathOnboarding.tsx) -- generated on the fly with
// an oscillator, so it needs no audio files at all.
//
// A safe no-op outside the browser, or if audio is blocked/unsupported
// -- sound is a garnish on the onboarding flow, and should never be
// able to break it. (The texture step this once also scored -- a
// distinct tone per shape -- is gone; see lib/paths.ts's file header,
// Nov 13 2026.)

let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  if (sharedCtx.state === "suspended") {
    sharedCtx.resume().catch(() => {
      // Ignore -- next user gesture will retry via getContext() again.
    });
  }
  return sharedCtx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType,
  peak = 0.09
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

// A soft confirmation chime for a question pick.
export function playSelectChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    tone(ctx, 520, 0, 0.22, "sine", 0.05);
    tone(ctx, 780, 0.05, 0.28, "sine", 0.04);
  } catch {
    // See file header.
  }
}
