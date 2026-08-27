"use client";

import { useEffect, useRef, useState } from "react";
import { AxisScores, blankAxisScores } from "./paths";

export type CursorSignalStatus = "idle" | "collecting" | "ready";

export interface CursorSignalState {
  status: CursorSignalStatus;
  axisScores: AxisScores;
  progress: number; // 0..1, how much of the collection window has elapsed
}

const COLLECTION_MS = 9000;
const SAMPLE_INTERVAL_MS = 40;
const STILL_SPEED_PX_MS = 0.03;
const TURN_ANGLE_RAD = Math.PI / 4;

interface Accumulator {
  startedAt: number;
  lastSampleAt: number;
  lastX: number;
  lastY: number;
  lastAngle: number | null;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  speedSum: number;
  speedSumSq: number;
  speedCount: number;
  segments: number;
  turns: number;
  clicks: number;
  stillSince: number | null;
  maxDwellMs: number;
  hasMoved: boolean;
}

function freshAccumulator(): Accumulator {
  return {
    startedAt: 0,
    lastSampleAt: 0,
    lastX: 0,
    lastY: 0,
    lastAngle: null,
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    speedSum: 0,
    speedSumSq: 0,
    speedCount: 0,
    segments: 0,
    turns: 0,
    clicks: 0,
    stillSince: null,
    maxDwellMs: 0,
    hasMoved: false,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Turns raw pointer telemetry into the same four axes the onboarding
// answers score into. Thresholds below are hand-tuned for "feels right"
// rather than derived from any formal model -- this is an ambient signal,
// not a psychometric instrument.
function deriveAxisScores(acc: Accumulator, viewportArea: number): AxisScores {
  if (acc.speedCount === 0) return blankAxisScores();

  const meanSpeed = acc.speedSum / acc.speedCount;
  const variance = Math.max(
    0,
    acc.speedSumSq / acc.speedCount - meanSpeed * meanSpeed
  );
  const speedNorm = clamp01(meanSpeed / 1.4);
  const varianceNorm = clamp01(Math.sqrt(variance) / 1.4);
  const bboxArea =
    isFinite(acc.minX) && acc.maxX > acc.minX && acc.maxY > acc.minY
      ? (acc.maxX - acc.minX) * (acc.maxY - acc.minY)
      : 0;
  const coverageNorm = clamp01(bboxArea / (viewportArea * 0.55));
  const turnRateNorm = clamp01(acc.turns / Math.max(1, acc.segments));
  const dwellNorm = clamp01(acc.maxDwellMs / 2200);
  const clickRateNorm = clamp01(acc.clicks / 5);

  return {
    guardian: clamp01(dwellNorm * 0.6 + (1 - varianceNorm) * 0.25 + (1 - speedNorm) * 0.15),
    seeker: clamp01(coverageNorm * 0.6 + turnRateNorm * 0.4),
    weaver: clamp01((1 - clickRateNorm) * 0.3 + coverageNorm * 0.3 + (1 - varianceNorm) * 0.4),
    flame: clamp01(speedNorm * 0.5 + clickRateNorm * 0.5),
  };
}

export function usePathSignal(): CursorSignalState {
  const [state, setState] = useState<CursorSignalState>({
    status: "idle",
    axisScores: blankAxisScores(),
    progress: 0,
  });
  const accRef = useRef<Accumulator>(freshAccumulator());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const acc = accRef.current;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function handlePointerMove(e: PointerEvent) {
      const now = performance.now();
      if (!acc.hasMoved) {
        acc.hasMoved = true;
        acc.startedAt = now;
        acc.lastX = e.clientX;
        acc.lastY = e.clientY;
        acc.lastSampleAt = now;
        setState((s) => (s.status === "idle" ? { ...s, status: "collecting" } : s));
        return;
      }
      if (now - acc.lastSampleAt < SAMPLE_INTERVAL_MS) return;

      const dt = now - acc.lastSampleAt;
      const dx = e.clientX - acc.lastX;
      const dy = e.clientY - acc.lastY;
      const dist = Math.hypot(dx, dy);
      const speed = dt > 0 ? dist / dt : 0;

      acc.minX = Math.min(acc.minX, e.clientX);
      acc.maxX = Math.max(acc.maxX, e.clientX);
      acc.minY = Math.min(acc.minY, e.clientY);
      acc.maxY = Math.max(acc.maxY, e.clientY);

      acc.speedSum += speed;
      acc.speedSumSq += speed * speed;
      acc.speedCount += 1;
      acc.segments += 1;

      if (speed < STILL_SPEED_PX_MS) {
        acc.stillSince = acc.stillSince ?? acc.lastSampleAt;
        acc.maxDwellMs = Math.max(acc.maxDwellMs, now - acc.stillSince);
      } else {
        acc.stillSince = null;
      }

      if (dist > 2) {
        const angle = Math.atan2(dy, dx);
        if (acc.lastAngle !== null) {
          let delta = Math.abs(angle - acc.lastAngle);
          if (delta > Math.PI) delta = 2 * Math.PI - delta;
          if (delta > TURN_ANGLE_RAD) acc.turns += 1;
        }
        acc.lastAngle = angle;
      }

      acc.lastX = e.clientX;
      acc.lastY = e.clientY;
      acc.lastSampleAt = now;
    }

    function handlePointerDown() {
      acc.clicks += 1;
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });

    function tick() {
      if (acc.hasMoved) {
        const elapsed = performance.now() - acc.startedAt;
        const progress = clamp01(elapsed / COLLECTION_MS);
        if (elapsed >= COLLECTION_MS) {
          const viewportArea = window.innerWidth * window.innerHeight;
          setState({
            status: "ready",
            axisScores: deriveAxisScores(acc, viewportArea),
            progress: 1,
          });
          return; // stop the loop, we're done
        }
        setState((s) => ({ ...s, progress }));
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    if (!prefersReducedMotion) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      // Skip the ambient read entirely; onboarding answers alone decide the path.
      setState({ status: "ready", axisScores: blankAxisScores(), progress: 1 });
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return state;
}
