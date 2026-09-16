"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";

import { useFocusTrap } from "../hooks/use-focus-trap";
import { KEYBOARD_SHORTCUTS } from "../lib/keyboard-map";
import { PROOF_LOOP_HELP, resolveProductHelp } from "../lib/product-help";
import { cn } from "../ui/cn";

export function ProductHelpDrawer({
  open,
  pathname,
  onClose
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const guide = resolveProductHelp(pathname);
  const handleEscape = useCallback(() => onClose(), [onClose]);

  // Trap + background inert on the full overlay root (backdrop is non-focusable).
  useFocusTrap({
    open,
    containerRef,
    onEscape: handleEscape,
    initialFocusRef: closeRef
  });

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Non-focusable backdrop (P16-1): click-to-dismiss only — not a second tab stop. */}
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45"
      />
      <aside
        aria-labelledby="product-help-title"
        aria-modal="true"
        role="dialog"
        data-testid="product-help-drawer"
        className="absolute inset-0 box-border flex min-w-0 w-full max-w-full flex-col overflow-hidden border-0 bg-[#0a1226] shadow-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-w-md sm:border-l sm:border-[#1e3568] sm:shadow-[0_24px_60px_rgba(0,0,0,0.62)] sm:motion-safe:animate-[help-enter_160ms_ease-out]"
      >
        <header className="flex items-start gap-4 border-b border-line-panel bg-surface-strong px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Page guide
            </p>
            <h2
              id="product-help-title"
              className="mt-1 text-xl font-semibold tracking-tight text-ink"
            >
              {guide.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">{guide.summary}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="grid size-8 shrink-0 place-items-center rounded-control border border-white/20 bg-black/10 text-[#cfe0ff] transition-colors hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="m4 4 8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <section aria-labelledby="help-steps-title">
            <h3
              id="help-steps-title"
              className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-subtle"
            >
              What to do
            </h3>
            <ol className="mt-3 list-none divide-y divide-line border-y border-line">
              {guide.steps.map((step, index) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[1.75rem_1fr] gap-3 py-4"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-brand/10 font-mono text-xs font-semibold text-brand">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-ink">
                      {step.title}
                    </h4>
                    <p className="mt-1 text-[13px] leading-5 text-muted">
                      {step.instruction}
                    </p>
                    {step.href && step.actionLabel ? (
                      <Link
                        href={step.href}
                        onClick={onClose}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand transition-colors hover:text-brand-2"
                      >
                        {step.actionLabel} <span aria-hidden>→</span>
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {guide.caution ? (
            <section className="mt-5 border-l-2 border-approval bg-approval/[0.06] px-3 py-2.5">
              <h3 className="text-xs font-semibold text-ink">Guardrail</h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                {guide.caution}
              </p>
            </section>
          ) : null}

          <section aria-labelledby="help-terms-title" className="mt-6">
            <h3
              id="help-terms-title"
              className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-subtle"
            >
              Terms on this page
            </h3>
            <dl className="mt-3 space-y-3">
              {guide.terms.map((item) => (
                <div key={item.term}>
                  <dt className="text-[13px] font-semibold text-ink">
                    {item.term}
                  </dt>
                  <dd className="mt-0.5 text-xs leading-5 text-muted">
                    {item.definition}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <details className="group mt-6 border-t border-line pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              The complete proof loop
              <span
                aria-hidden
                className="text-muted transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <ol className="mt-3 list-none space-y-2">
              {PROOF_LOOP_HELP.map((stage, index) => (
                <li key={stage.label}>
                  <Link
                    href={stage.href}
                    onClick={onClose}
                    className={cn(
                      "grid grid-cols-[1.5rem_1fr] gap-2 rounded-control px-2 py-2 transition-colors hover:bg-surface",
                      pathname === stage.href && "bg-brand/[0.06]"
                    )}
                  >
                    <span className="font-mono text-xs text-brand">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-ink">
                        {stage.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                        {stage.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </details>

          <section
            aria-labelledby="help-keyboard-title"
            className="mt-6 border-t border-line pt-4"
          >
            <h3
              id="help-keyboard-title"
              className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted"
            >
              Keyboard
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted">
              Modals and drawers respect reduced motion. Escape always dismisses
              the top overlay.
            </p>
            <dl className="mt-3 space-y-2">
              {KEYBOARD_SHORTCUTS.map((row) => (
                <div
                  key={row.keys}
                  className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-2 text-xs"
                >
                  <dt>
                    <kbd className="inline-block rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink">
                      {row.keys}
                    </kbd>
                  </dt>
                  <dd className="text-muted leading-5">{row.action}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <footer className="border-t border-line bg-elevated px-5 py-3 text-xs leading-5 text-ink">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="mb-1 block font-semibold text-ink underline decoration-brand underline-offset-2 transition-colors hover:text-brand"
          >
            Get started on Home →
          </Link>
          Help describes current product behavior. A disabled action still needs
          its displayed prerequisite, permission, policy, or approval.
        </footer>
      </aside>
    </div>
  );
}
