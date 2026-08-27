"use client";

import { useEffect, useRef } from "react";
import { WorldVisual } from "../lib/worlds";

interface WorldFieldProps {
  world: WorldVisual;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// The atmosphere behind each path: drifting dust for the Guardian's earth,
// twinkling stars for the Seeker's sky, a slow current for the Weaver's
// water, rising embers for the Flame. Falls back to this procedural canvas
// until world.backgroundImage/backgroundVideo is set -- swapping in real
// art later needs no changes here.
export default function WorldField({ world }: WorldFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const count = world.particleStyle === "stars" ? 100 : 45;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.1,
      size: 1 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
    }));

    const { r, g, b } = hexToRgb(world.particleColor);

    let raf = 0;
    let t = 0;

    function draw() {
      t += 0.008;
      ctx!.clearRect(0, 0, width, height);

      for (const p of particles) {
        switch (world.particleStyle) {
          case "dust":
            p.x += p.vx + Math.sin(t + p.phase) * 0.05;
            p.y += 0.06 + Math.abs(p.vy);
            break;
          case "current":
            p.x += 0.12;
            p.y += Math.sin(t * 1.4 + p.phase) * 0.15;
            break;
          case "embers":
            p.x += Math.sin(t + p.phase) * 0.08;
            p.y -= 0.12 + Math.abs(p.vy);
            break;
          case "stars":
          default:
            break;
        }

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const twinkle =
          world.particleStyle === "stars"
            ? 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + p.phase))
            : 0.5 + 0.5 * Math.sin(t + p.phase);
        const alpha = (world.particleStyle === "stars" ? 0.85 : 0.35) * twinkle;

        ctx!.beginPath();
        ctx!.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [world]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: world.backgroundImage
          ? `url(${world.backgroundImage}) center/cover no-repeat`
          : `linear-gradient(to bottom, ${world.skyTop}, ${world.skyBottom})`,
        transition: "background 1.5s ease",
      }}
    >
      {world.backgroundVideo && (
        <video
          src={world.backgroundVideo}
          autoPlay
          loop
          muted
          playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
