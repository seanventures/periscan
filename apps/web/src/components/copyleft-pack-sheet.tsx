"use client";

import { useId, useRef, useState } from "react";

import type { ThirdPartyTool } from "@periscan/shared";

import { useFocusTrap } from "../hooks/use-focus-trap";
import { buttonClassName } from "../ui";

export function CopyleftPackSheet({
  engines,
  busy,
  error,
  onCancel,
  onAcceptAndInstall
}: {
  engines: Array<{
    license: string;
    title: string;
    toolId: string;
    match: { tool: ThirdPartyTool } | null;
  }>;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onAcceptAndInstall: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const [authorized, setAuthorized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useFocusTrap({
    open: true,
    containerRef,
    onEscape: () => {
      if (!busy) onCancel();
    },
    initialFocusRef: cancelRef
  });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        className="absolute inset-0 bg-black/55"
        onClick={() => !busy && onCancel()}
        aria-hidden
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-card border border-line-strong bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
        <div className="border-b border-line-panel bg-surface-strong px-5 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            Copyleft license ceremony
          </p>
          <h2 id={titleId} className="mt-1 text-base font-semibold text-ink">
            Accept GPL / LGPL and download official pins
          </h2>
        </div>
        <div className="space-y-4 p-5">
          <p id={descId} className="text-sm leading-relaxed text-muted">
            Periscan does not ship these binaries. You accept each SPDX for this
            tenant, then Engine Lab downloads the official upstream pin. They
            stay out of the Community start set. sqlmap, SharpHound, Atomic,
            Caldera, and Metasploit are not in this pack.
          </p>
          <ul className="max-h-56 space-y-2 overflow-auto rounded-control border border-line px-3 py-2 text-sm">
            {engines.map((engine) => (
              <li key={engine.toolId}>
                <span className="font-semibold text-ink">{engine.title}</span>
                {" · "}
                <span className="font-mono text-[12px] text-muted">
                  {engine.license}
                </span>
                {engine.match?.tool.tool.tool.docsUrl ? (
                  <>
                    {" · "}
                    <a
                      href={engine.match.tool.tool.tool.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:text-brand-2"
                    >
                      license / docs
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-control border border-line bg-surface/30 px-3 py-2.5 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={authorized}
              disabled={busy}
              onChange={(event) => setAuthorized(event.target.checked)}
            />
            <span>
              I am authorized to accept these third-party copyleft licenses for
              this tenant. Periscan is not redistributing these packages.
            </span>
          </label>
          {error ? (
            <p
              role="alert"
              className="rounded-control border border-missed/40 bg-missed/10 px-3 py-2 text-[13px] text-missed"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={busy}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-copyleft-pack"
              onClick={onAcceptAndInstall}
              disabled={busy || !authorized}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy ? "Downloading…" : "Accept licenses & download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
