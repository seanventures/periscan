"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";

import { StateBadge, cn, type StateTone } from "../ui";

export interface OrchestrationNode {
  id: string;
  code: string;
  label: string;
  detail: string;
  state: string;
  tone: StateTone;
  column: number;
  row: number;
  active?: boolean;
}

export interface OrchestrationLink {
  from: string;
  to: string;
  tone: StateTone;
  active?: boolean;
}

interface Point {
  x: number;
  y: number;
}

const TONE_FALLBACK: Record<StateTone, string> = {
  approval: "#ffcf4d",
  blocked: "#3c96ff",
  brand: "#3c96ff",
  fixed: "#2fe0b0",
  inconclusive: "#9fb2d6",
  missed: "#ff5065",
  neutral: "#9fb2d6",
  validated: "#2fe0b0"
};

function toneColor(tone: StateTone) {
  if (typeof window === "undefined") return TONE_FALLBACK[tone];
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(`--color-${tone}`)
      .trim() || TONE_FALLBACK[tone]
  );
}

function rgba(color: string, alpha: number) {
  const value = color.replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(value)) {
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${red},${green},${blue},${alpha})`;
  }
  return color;
}

/**
 * A data-backed orchestration map. The DOM owns every real record and its
 * accessible state; canvas only draws the relationship and live handoff layer.
 */
export function OrchestrationFlowMap({
  ariaLabel,
  links,
  nodes,
  selectedId: controlledSelectedId,
  onSelect
}: {
  ariaLabel: string;
  links: OrchestrationLink[];
  nodes: OrchestrationNode[];
  selectedId?: string;
  onSelect?: (node: OrchestrationNode) => void;
}) {
  const defaultSelectedId = nodes[0]?.id ?? "";
  const [internalSelectedId, setInternalSelectedId] = useState(defaultSelectedId);
  const selectedId = controlledSelectedId ?? internalSelectedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const linksRef = useRef(links);
  linksRef.current = links;

  useEffect(() => {
    if (!nodes.some((node) => node.id === selectedId) && defaultSelectedId) {
      setInternalSelectedId(defaultSelectedId);
    }
  }, [defaultSelectedId, nodes, selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || typeof ResizeObserver === "undefined") return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const drawingContext = context;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let frame = 0;
    let width = container.clientWidth;
    let height = container.clientHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const startedAt = performance.now();

    const pointFor = (id: string): Point | null => {
      const element = nodeRefs.current.get(id);
      if (!element) return null;
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return {
        x: elementRect.left - containerRect.left + elementRect.width / 2,
        y: elementRect.top - containerRect.top + elementRect.height / 2
      };
    };

    function draw(now: number) {
      drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawingContext.clearRect(0, 0, width, height);
      const elapsed = (now - startedAt) / 1000;

      for (const link of linksRef.current) {
        const from = pointFor(link.from);
        const to = pointFor(link.to);
        if (!from || !to) continue;
        const color = toneColor(link.tone);
        const midpointX = from.x + (to.x - from.x) * 0.5;
        drawingContext.beginPath();
        drawingContext.moveTo(from.x, from.y);
        drawingContext.bezierCurveTo(
          midpointX,
          from.y,
          midpointX,
          to.y,
          to.x,
          to.y
        );
        drawingContext.setLineDash(link.active ? [6, 6] : [4, 7]);
        drawingContext.lineDashOffset =
          link.active && !reduceMotion ? -(elapsed * 18) % 24 : 0;
        drawingContext.lineWidth = link.active ? 1.9 : 1.4;
        drawingContext.shadowBlur = link.active ? 8 : 3;
        drawingContext.shadowColor = rgba(color, link.active ? 0.36 : 0.15);
        drawingContext.strokeStyle = rgba(color, link.active ? 0.9 : 0.58);
        drawingContext.stroke();
      }

      if (!reduceMotion && linksRef.current.some((link) => link.active)) {
        frame = requestAnimationFrame(draw);
      }
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [nodes]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? nodes[0],
    [nodes, selectedId]
  );

  function select(node: OrchestrationNode) {
    if (controlledSelectedId === undefined) setInternalSelectedId(node.id);
    onSelect?.(node);
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div
        ref={containerRef}
        className="orchestration-flow-map relative min-h-[390px] overflow-hidden border-b border-line"
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 max-md:hidden"
        />
        <div
          className="orchestration-flow-grid relative z-10"
          role="group"
          aria-label={ariaLabel}
        >
          {nodes.map((node) => (
            <button
              key={node.id}
              ref={(element) => {
                if (element) nodeRefs.current.set(node.id, element);
                else nodeRefs.current.delete(node.id);
              }}
              type="button"
              onClick={() => select(node)}
              aria-pressed={selectedNode?.id === node.id}
              data-active={node.active ? "true" : "false"}
              className={cn(
                "orchestration-flow-node group min-w-0 rounded-card border bg-[#0a1226]/95 px-3 py-2.5 text-left",
                "transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                selectedNode?.id === node.id
                  ? "border-brand/80 shadow-[0_0_18px_rgba(60,150,255,0.2)]"
                  : "border-[#1e3568] hover:border-brand/60"
              )}
              style={
                {
                  "--flow-column": node.column,
                  "--flow-row": node.row,
                  "--flow-tone": `var(--color-${node.tone})`
                } as CSSProperties
              }
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="orchestration-flow-signal flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-semibold tracking-[0.05em]"
                >
                  {node.code}
                </span>
                <span className="min-w-0">
                  <span className="block line-clamp-2 font-display text-[12px] font-semibold leading-[1.25] text-ink">
                    {node.label}
                  </span>
                  <span className="block truncate font-mono text-[9.5px] text-subtle">
                    {node.detail}
                  </span>
                </span>
              </span>
              <StateBadge tone={node.tone} className="mt-2" dot={false}>
                {node.state}
              </StateBadge>
            </button>
          ))}
        </div>
      </div>
      {selectedNode ? (
        <div
          className="flex flex-wrap items-start justify-between gap-3 bg-[#080d1c] px-4 py-3"
          aria-live="polite"
        >
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              Selected record
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {selectedNode.label}
            </p>
            <p className="break-all font-mono text-[11px] text-muted">
              {selectedNode.id}
            </p>
          </div>
          <StateBadge tone={selectedNode.tone}>
            {selectedNode.state}
          </StateBadge>
        </div>
      ) : null}
    </div>
  );
}
