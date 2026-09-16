"use client";

import { useEffect, useRef } from "react";

import type { StateTone } from "../ui";

export interface RadarAgent {
  id: string;
  label: string;
  kind: "model" | "mission" | "engagement";
  tone: StateTone;
  active: boolean;
}

const KIND_RING: Record<RadarAgent["kind"], number> = {
  model: 0.46,
  mission: 0.7,
  engagement: 0.93
};

function readColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/**
 * Live validation ops radar. An always-sweeping sonar scope (on-brand with the
 * Periscan mark) where each real work item — a governed model session, a mission
 * in flight, or an engagement — sits as a blip that brightens as the sweep
 * passes. No fabricated blips: positions come from the passed records. Honors
 * prefers-reduced-motion (static frame, no sweep).
 */
export default function AgentRadarCanvas({
  agents,
  height = 380
}: {
  agents: RadarAgent[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<RadarAgent[]>(agents);
  agentsRef.current = agents;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette = {
      brand: readColor("--color-brand", "#1499d6"),
      line: readColor("--color-line", "rgba(150,172,194,0.14)"),
      validated: readColor("--color-validated", "#2bb6a3"),
      approval: readColor("--color-approval", "#e0a33e"),
      inconclusive: readColor("--color-inconclusive", "#7e8fa3"),
      missed: readColor("--color-missed", "#e5484d"),
      fixed: readColor("--color-fixed", "#41c08a"),
      blocked: readColor("--color-blocked", "#5566e0"),
      neutral: readColor("--color-muted", "#9daec0"),
      ink: readColor("--color-ink", "#eaf1f8"),
      subtle: readColor("--color-subtle", "#66788b")
    };
    const toneColor = (tone: StateTone) =>
      (palette as Record<string, string>)[tone] ?? palette.neutral;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = container.clientWidth;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = container?.clientWidth ?? width;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!canvas) return;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    const start = performance.now();

    function positions(list: RadarAgent[], maxR: number) {
      const byKind: Record<string, RadarAgent[]> = {
        model: [],
        mission: [],
        engagement: []
      };
      for (const a of list) byKind[a.kind]?.push(a);
      const out: { a: RadarAgent; angle: number; r: number }[] = [];
      for (const kind of Object.keys(byKind)) {
        const group = byKind[kind] ?? [];
        const ring = KIND_RING[kind as RadarAgent["kind"]] * maxR;
        group.forEach((a, i) => {
          const angle =
            (i / Math.max(1, group.length)) * Math.PI * 2 +
            (kind === "mission" ? 0.6 : kind === "engagement" ? 1.2 : 0);
          const jitter = ((i % 3) - 1) * maxR * 0.05;
          out.push({ a, angle, r: ring + jitter });
        });
      }
      return out;
    }

    function draw(now: number) {
      if (!ctx || !canvas) return;
      const t = (now - start) / 1000;
      const w = width;
      const h = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) / 2 - 26;

      // Rings
      ctx.lineWidth = 1;
      for (const ratio of [0.28, 0.5, 0.72, 0.94]) {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = palette.line;
        ctx.stroke();
      }
      // Cross hairs
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.strokeStyle = palette.line;
      ctx.stroke();

      // Sweep
      const sweep = reduce ? -Math.PI / 2 : (t * 0.9) % (Math.PI * 2);
      if (!reduce) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        grad.addColorStop(0, hexA(palette.brand, 0.28));
        grad.addColorStop(1, hexA(palette.brand, 0));
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, sweep - 0.5, sweep);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        // Leading edge
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweep) * maxR, cy + Math.sin(sweep) * maxR);
        ctx.strokeStyle = hexA(palette.brand, 0.5);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Core
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = palette.brand;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 8 + (reduce ? 0 : Math.sin(t * 2) * 2), 0, Math.PI * 2);
      ctx.strokeStyle = hexA(palette.brand, 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Blips
      const placed = positions(agentsRef.current, maxR);
      for (const { a, angle, r } of placed) {
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        // Sweep proximity glow (radar ping): brighter when the beam is near.
        let ping = 0;
        if (!reduce) {
          const d = Math.abs(((sweep - angle + Math.PI) % (Math.PI * 2)) - Math.PI);
          ping = Math.max(0, 1 - d / 0.9);
        }
        const color = toneColor(a.tone);
        const pulse = a.active && !reduce ? 0.5 + Math.sin(t * 3 + r) * 0.3 : 0.4;
        const alpha = Math.min(1, 0.35 + pulse * 0.4 + ping * 0.5);

        // connective line to core
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = hexA(color, 0.1 + ping * 0.15);
        ctx.lineWidth = 1;
        ctx.stroke();

        // glow
        ctx.beginPath();
        ctx.arc(x, y, 9 + ping * 5, 0, Math.PI * 2);
        ctx.fillStyle = hexA(color, 0.12 + ping * 0.18);
        ctx.fill();
        // dot
        ctx.beginPath();
        ctx.arc(x, y, a.active ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = hexA(color, alpha);
        ctx.fill();
        if (a.active) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.strokeStyle = hexA(color, 0.9);
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // label
        ctx.font =
          "10px 'IBM Plex Mono', ui-monospace, monospace";
        ctx.fillStyle = hexA(palette.subtle, 0.9);
        ctx.textAlign = x < cx ? "end" : "start";
        ctx.textBaseline = "middle";
        const label = a.label.length > 16 ? `${a.label.slice(0, 15)}…` : a.label;
        ctx.fillText(label, x + (x < cx ? -8 : 8), y);
      }

      if (!reduce) raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} role="presentation" />
    </div>
  );
}

// #rrggbb (+ optional existing alpha) → rgba() with the given alpha. Falls back
// to the raw value for non-hex tokens (e.g. rgba() line colors).
function hexA(color: string, alpha: number): string {
  const hex = color.replace("#", "");
  if (hex.length === 6 && /^[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
