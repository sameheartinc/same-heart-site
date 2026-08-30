// Same Heart -- the "transmit" sound.
//
// Plays the moment someone submits their Star Day: a short burst of static
// settling into a clean tone, like a radio tuning in and locking onto a
// frequency. Fully synthesized with the Web Audio API -- no audio file to
// ship, host, or license.
//
// Safe to call from a click/submit handler (that's a user gesture, so
// browsers won't block it). Silently does nothing if Web Audio isn't
// available, or if anything about audio throws -- this is a nice-to-have,
// never something that should block the actual submit.

export const TRANSMIT_DURATION_MS = 1200;

export function playTransmitSound(): void {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // --- Static crackle (0 - ~0.4s): filtered white noise, decaying. ---
    const noiseDuration = 0.4;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(600, now + noiseDuration);
    noiseFilter.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);

    noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + noiseDuration);

    // --- Signal lock (~0.3s onward): a tone settling in, not sweeping or
    // plucking. A small, slow rise (a third of a semitone-heavy octave,
    // not two full octaves) plus a soft attack and a long, gentle decay
    // keep this feeling like a signal settling in, not a "blip"/droplet
    // pluck -- that quick, wide pitch-jump-plus-fast-decay combination is
    // exactly what reads as a water droplet, so it's deliberately avoided
    // here. A triangle wave (instead of a pure sine) through a lowpass
    // filter gives it a little body/warmth without adding brightness.
    const toneStart = now + 0.3;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(340, toneStart);
    osc.frequency.linearRampToValueAtTime(430, toneStart + 0.5);

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = "lowpass";
    toneFilter.frequency.value = 1100;

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, toneStart);
    oscGain.gain.linearRampToValueAtTime(0.08, toneStart + 0.18);
    oscGain.gain.setValueAtTime(0.08, toneStart + 0.45);
    oscGain.gain.exponentialRampToValueAtTime(0.001, toneStart + 0.85);

    osc.connect(toneFilter).connect(oscGain).connect(ctx.destination);
    osc.start(toneStart);
    osc.stop(toneStart + 0.9);

    // Tear the context down once everything's finished playing -- most
    // browsers cap how many AudioContexts can be alive at once.
    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // Audio is a nice-to-have here -- never let it break the actual flow.
  }
}
