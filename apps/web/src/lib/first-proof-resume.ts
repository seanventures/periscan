/**
 * UX-W16: first-proof resume pointer for incomplete first-run setup.
 *
 * When the user activates a primary first-run CTA (GetStarted or rail primary),
 * we store the step label + href so Home can offer "Resume: {label}" if they
 * leave mid-setup. Cleared once the three setup steps complete.
 */

export const FIRST_PROOF_RESUME_KEY = "periscan-first-proof-resume";

export type FirstProofResume = {
  step: string;
  href: string;
  updatedAt: string;
};

function isSafeInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function readFirstProofResume(): FirstProofResume | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(FIRST_PROOF_RESUME_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<FirstProofResume>;
    if (
      typeof parsed.step !== "string" ||
      typeof parsed.href !== "string" ||
      typeof parsed.updatedAt !== "string" ||
      !parsed.step.trim() ||
      !isSafeInternalHref(parsed.href)
    ) {
      return null;
    }
    return {
      step: parsed.step.trim(),
      href: parsed.href,
      updatedAt: parsed.updatedAt
    };
  } catch {
    return null;
  }
}

export function writeFirstProofResume(step: string, href: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const trimmed = step.trim();
  if (!trimmed || !isSafeInternalHref(href)) {
    return;
  }
  try {
    const payload: FirstProofResume = {
      step: trimmed,
      href,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(FIRST_PROOF_RESUME_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearFirstProofResume(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(FIRST_PROOF_RESUME_KEY);
  } catch {
    // ignore unwritable storage
  }
}
