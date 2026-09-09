// Small, dependency-free Web Audio helpers for the sensory onboarding
// (see components/PathOnboarding.tsx) -- every sound here is generated
// on the fly with an oscillator or a noise burst, so the texture step
// ("a texture that relates to a sound") needs no audio files at all.
//
// Every function is a safe no-op outside the browser, or if audio is
// blocked/unsupported -- sound is a garnish on the onboarding flow, and
// should never be able to break it.

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

export type TextureSoundId = "smooth" | "rippled" | "woven" | "jagged";

// One distinct sound per texture in lib/paths.ts's TEXTURES -- smooth is
// a held low hum, rippled a quick ascending chime, woven two tones
// answering each other, jagged a short burst of noise.
export function playTextureSound(id: TextureSoundId): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    switch (id) {
      case "smooth":
        tone(ctx, 180, 0, 0.9, "sine", 0.08);
        break;
      case "rippled":
        tone(ctx, 660, 0, 0.18, "sine", 0.07);
        tone(ctx, 880, 0.12, 0.18, "sine", 0.06);
        tone(ctx, 990, 0.24, 0.22, "sine", 0.05);
        break;
      case "woven":
        tone(ctx, 440, 0, 0.7, "sine", 0.06);
        tone(ctx, 550, 0.05, 0.65, "triangle", 0.05);
        break;
      case "jagged": {
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.25));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
        break;
      }
    }
  } catch {
    // See file header -- audio never gets to break the flow.
  }
}

// A soft, texture-independent confirmation chime for a colour orb,
// question bubble, or inkblot pick.
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
