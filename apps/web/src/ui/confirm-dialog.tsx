"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useFocusTrap } from "../hooks/use-focus-trap";
import { buttonClassName } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Body copy — what will happen, and whether it's reversible. */
  description: string;
  confirmLabel: string;
  /** Danger styling + (with `confirmPhrase`) a typed-confirmation gate. */
  destructive?: boolean;
  /**
   * When set, the confirm button stays disabled until the user types this exact
   * phrase — for irreversible actions (Revoke, Redact). Usually the resource name.
   */
  confirmPhrase?: string;
  busy?: boolean;
  /** An error to surface inside the dialog (e.g. the action failed). */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A focused, accessible confirmation modal for destructive / governance actions.
 * Keyboard: Escape cancels, focus is trapped to the dialog, the first safe control
 * is focused on open (phrase input, Cancel for destructive, else Confirm).
 * Background siblings are `inert` while open (P16-1 via useFocusTrap). For
 * irreversible actions pass `confirmPhrase` to require the operator to type the
 * resource name — the same rigor the kill-switch already uses, applied uniformly.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  confirmPhrase,
  busy = false,
  error,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [typed, setTyped] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Phrase gate → input; destructive (no phrase) → Cancel (avoid accidental confirm);
  // otherwise Confirm.
  const initialFocusRef = confirmPhrase
    ? inputRef
    : destructive
      ? cancelRef
      : confirmRef;

  const handleEscape = useCallback(() => {
    if (!busy) onCancel();
  }, [busy, onCancel]);

  useFocusTrap({
    open,
    containerRef,
    onEscape: handleEscape,
    initialFocusRef
  });

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  if (!open) return null;

  const phraseOk = !confirmPhrase || typed === confirmPhrase;

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
      <div className="relative w-full max-w-md overflow-hidden rounded-card border border-line-strong bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.55)] motion-safe:animate-[ps-modal_220ms_ease-out]">
        <div className="border-b border-line-panel bg-surface-strong px-5 py-3.5">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
        </div>
        <div className="p-5">
          <p id={descId} className="text-sm leading-relaxed text-muted">
            {description}
          </p>

          {confirmPhrase ? (
            <label className="mt-4 block">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                Type <span className="text-ink">{confirmPhrase}</span> to
                confirm
              </span>
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5 w-full rounded-control border border-[#23386b] bg-[#080d1c] px-3 py-2 font-mono text-sm text-ink outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(60,150,255,0.18)]"
              />
            </label>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-control border border-missed/40 bg-missed/10 px-3 py-2 text-[13px] text-missed"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
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
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={busy || !phraseOk}
              className={buttonClassName({
                size: "sm",
                variant: destructive ? "danger" : "primary"
              })}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
