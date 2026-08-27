"use client";

import { useEffect, useRef } from "react";

interface CommonsSphereProps {
  size?: number;
  humansPresent: number;
}

interface Capsule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

// The "living sphere" from the vision doc, rendered as a bounded 2D
// canvas rather than a full WebGL/Three.js scene -- a deliberate v1
// choice (see README) so the Commons stays light and dependency-free
// while still reading as a glowing, inhabited space rather than a
// static graphic. Small drifting capsules stand in for real humans
// present; the count is driven by the real presence number, capped for
// legibility/perf rather than rendering thousands of dots.
export default function CommonsSphere({ size = 340, humansPresent }: CommonsSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const center = size / 2;
    const radius = size / 2 - 6;

    const count = Math.max(6, Math.min(46, humansPresent || 6));
    const capsules: Capsule[] = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * (radius - 14);
      return {
        x: center + Math.cos(a) * d,
        y: center + Math.sin(a) * d,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: 1.4 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      };
    });

    let raf = 0;
    let t = 0;

    function frame() {
      t += 0.01;
      ctx!.clearRect(0, 0, size, size);

      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(center, center, radius, 0, Math.PI * 2);
      ctx!.clip();

      // Glassy interior gradient.
      const grad = ctx!.createRadialGradient(center, center * 0.75, 4, center, center, radius);
      grad.addColorStop(0, "rgba(201,161,90,0.14)");
      grad.addColorStop(0.55, "rgba(18,26,44,0.55)");
      grad.addColorStop(1, "rgba(10,14,26,0.85)");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, size, size);

      // Faint interior rings -- "screens on the inner wall" implied, not drawn literally.
      for (const rr of [0.36, 0.62, 0.86]) {
        ctx!.beginPath();
        ctx!.arc(center, center, radius * rr, 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(201,161,90,0.08)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      for (const c of capsules) {
        if (!reducedMotion) {
          c.x += c.vx;
          c.y += c.vy;
          const dx = c.x - center;
          const dy = c.y - center;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius - 10) {
            c.vx -= (dx / dist) * 0.02;
            c.vy -= (dy / dist) * 0.02;
          }
        }
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.6 + c.phase);
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(201,161,90,${0.35 + 0.45 * twinkle})`;
        ctx!.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.restore();

      // Outer rim.
      ctx!.beginPath();
      ctx!.arc(center, center, radius, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(201,161,90,0.4)";
      ctx!.lineWidth = 1.5;
      ctx!.stroke();

      if (!reducedMotion) raf = requestAnimationFrame(frame);
    }
    frame();

    return () => cancelAnimationFrame(raf);
  }, [size, humansPresent]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        display: "block",
        borderRadius: "50%",
        filter: "drop-shadow(0 0 46px rgba(201,161,90,0.22))",
      }}
    />
  );
}
