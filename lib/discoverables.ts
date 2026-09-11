"use client";

import { useEffect, useRef, useState } from "react";
import { DISCOVERABLE_POSITIONS, WorldDef } from "./worlds";

export interface HotspotState {
  x: number; // percent
  y: number; // percent
  found: boolean;
  progress: number; // 0..1 while lingering toward reveal
}

function storageKey(pathKey: string): string {
  return `sh_found_${pathKey}`;
}

function loadFound(pathKey: string): boolean[] {
  if (typeof window === "undefined") return DISCOVERABLE_POSITIONS.map(() => false);
  try {
    const raw = window.localStorage.getItem(storageKey(pathKey));
    const parsed = raw ? (JSON.parse(raw) as boolean[]) : [];
    return DISCOVERABLE_POSITIONS.map((_, i) => Boolean(parsed[i]));
  } catch {
    return DISCOVERABLE_POSITIONS.map(() => false);
  }
}

function saveFound(pathKey: string, found: boolean[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(pathKey), JSON.stringify(found));
  }
}

// Finds hidden things in the current world by moving through it the way
// that world's character calls for: lingering somewhere calm (Guardian,
// Weaver), a brief pause mid-wander (Seeker), or a decisive click (Flame).
export function useDiscoverables(world: WorldDef | null, onFound: () => void): HotspotState[] {
  const [hotspots, setHotspots] = useState<HotspotState[]>(() =>
    DISCOVERABLE_POSITIONS.map(([x, y]) => ({ x, y, found: false, progress: 0 }))
  );
  const foundRef = useRef<boolean[]>(DISCOVERABLE_POSITIONS.map(() => false));
  const lingerRef = useRef<number[]>(DISCOVERABLE_POSITIONS.map(() => 0));
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!world) return;
    const found = loadFound(world.key);
    foundRef.current = found;
    lingerRef.current = DISCOVERABLE_POSITIONS.map(() => 0);
    setHotspots(DISCOVERABLE_POSITIONS.map(([x, y], i) => ({ x, y, found: found[i], progress: found[i] ? 1 : 0 })));
  }, [world]);

  useEffect(() => {
    if (!world || typeof window === "undefined") return;

    const mouse = { x: -9999, y: -9999 };
    let raf = 0;

    function reveal(index: number) {
      foundRef.current[index] = true;
      saveFound(world!.key, foundRef.current);
      setHotspots((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], found: true, progress: 1 };
        return next;
      });
      onFound();
    }

    function checkPoint(px: number, py: number, isClick: boolean) {
      DISCOVERABLE_POSITIONS.forEach(([xPct, yPct], i) => {
        if (foundRef.current[i]) return;
        const x = (xPct / 100) * window.innerWidth;
        const y = (yPct / 100) * window.innerHeight;
        const within = Math.hypot(px - x, py - y) <= world!.discoverRadius;

        if (world!.discoverMechanic === "click") {
          if (within && isClick) reveal(i);
          return;
        }

        if (within) {
          const now = performance.now();
          const dt = lastTickRef.current ? now - lastTickRef.current : 0;
          lingerRef.current[i] += dt;
          if (lingerRef.current[i] >= world!.discoverDurationMs) reveal(i);
        } else {
          lingerRef.current[i] = 0;
        }
      });
    }

    function handleMove(e: PointerEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function handleClick(e: PointerEvent) {
      if (world!.discoverMechanic === "click") checkPoint(e.clientX, e.clientY, true);
    }

    function tick() {
      const now = performance.now();
      if (world!.discoverMechanic !== "click") {
        checkPoint(mouse.x, mouse.y, false);
        setHotspots((prev) =>
          prev.map((h, i) =>
            h.found
              ? h
              : { ...h, progress: Math.min(1, lingerRef.current[i] / world!.discoverDurationMs) }
          )
        );
      }
      lastTickRef.current = now;
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerdown", handleClick, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleClick);
      cancelAnimationFrame(raf);
    };
  }, [world, onFound]);

  return hotspots;
}
