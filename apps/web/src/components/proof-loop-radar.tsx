"use client";

import { useEffect, useRef } from "react";

import { PROOF_LOOP_STAGE_LABELS } from "../lib/product-help";

function readColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

// Product proof-loop stages (same vocabulary as PROOF_LOOP_HELP / activation).
// Placed evenly around the scope so the sweep reads as "the loop is alive" for
// a brand-new tenant that has not run anything yet.
const STAGES = [...PROOF_LOOP_STAGE_LABELS];

/**
 * Decorative proof-loop radar (canvas sweep).
 *
 * UX-W2 item 55 / dual-metaphor honesty: first-run product UI prefers the
 * interactive ProofLoopMap (GetStarted hero). Do not mount this radar alongside
 * ProofLoopMap on first-run — keep one spatial metaphor. This component remains
 * for isolated demos/tests; product shell uses the map only.
 *
 * Stage labels match the product proof loop (Connect → Prove), not CTEM
 * program stages. CTEM (Scope → Discover → Prioritize → Validate → Mobilize →
 * Verify) is a separate program model shown on the CTEM program surface.
 */
export default function ProofLoopRadar({ size = 320 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette = {
      brand: readColor("--color-brand", "#1499d6"),
      brand2: readColor("--color-brand-2", "#5bc0ee"),
      validated: readColor("--color-validated", "#2bb6a3"),
      ink: readColor("--color-ink", "#f3f7fb"),
      subtle: readColor("--color-subtle", "#6f869b")
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const R = size / 2 - 14;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function drawFrame(sweep: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);

      // Concentric range rings.
      for (let i = 1; i <= 4; i += 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(148,178,206,${0.06 + i * 0.015})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Crosshairs.
      ctx.strokeStyle = "rgba(148,178,206,0.08)";
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.stroke();

      // The sweep wedge — a soft gradient trailing the leading edge.
      const grad = ctx.createConicGradient(sweep, cx, cy);
      grad.addColorStop(0, "rgba(20,153,214,0.28)");
      grad.addColorStop(0.08, "rgba(20,153,214,0.04)");
      grad.addColorStop(1, "rgba(20,153,214,0)");
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, sweep - Math.PI * 0.5, sweep);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Leading edge line.
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
      ctx.strokeStyle = palette.brand2;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Stage nodes around the loop; each brightens as the sweep passes it.
      STAGES.forEach((label, idx) => {
        const angle = (idx / STAGES.length) * Math.PI * 2 - Math.PI / 2;
        const nx = cx + Math.cos(angle) * R * 0.82;
        const ny = cy + Math.sin(angle) * R * 0.82;

        // Angular distance from the sweep line (0 = just lit).
        let delta = sweep - angle;
        delta = ((delta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const glow = Math.max(0, 1 - delta / (Math.PI * 0.5)); // fades over 90°

        ctx.beginPath();
        ctx.arc(nx, ny, 3 + glow * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = palette.brand;
        ctx.globalAlpha = 0.35 + glow * 0.65;
        ctx.fill();

        if (glow > 0.2) {
          ctx.beginPath();
          ctx.arc(nx, ny, 8 + glow * 10, 0, Math.PI * 2);
          ctx.fillStyle = palette.brand2;
          ctx.globalAlpha = glow * 0.12;
          ctx.fill();
        }

        ctx.globalAlpha = 0.35 + glow * 0.6;
        ctx.fillStyle = glow > 0.5 ? palette.ink : palette.subtle;
        ctx.font =
          '600 9px "IBM Plex Sans Condensed", system-ui, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lx = cx + Math.cos(angle) * R * 1.02;
        const ly = cy + Math.sin(angle) * R * 1.02;
        ctx.fillText(label.toUpperCase(), lx, ly);
        ctx.globalAlpha = 1;
      });

      // Core.
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = palette.brand2;
      ctx.fill();
    }

    if (reduced) {
      drawFrame(-Math.PI / 2);
      return;
    }

    let raf = 0;
    let sweep = -Math.PI / 2;
    let last = performance.now();
    function loop(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      sweep += dt * 0.9; // ~7s per revolution
      drawFrame(sweep);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  const stageList = STAGES.join(", ");

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Periscan proof-loop radar — continuously sweeping through ${stageList}.`}
      style={{ width: size, height: size }}
    />
  );
}
