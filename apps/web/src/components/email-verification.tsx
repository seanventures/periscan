"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { Brandmark, buttonClassName } from "../ui";

export function EmailVerification() {
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [status, setStatus] = useState("Verifying your email…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token =
      searchParams?.get("token")?.trim() ??
      new URLSearchParams(window.location.search).get("token")?.trim() ??
      "";
    if (!token) {
      setError("This verification link is missing its secure token.");
      return;
    }
    void api
      .verifyEmail(token)
      .then((result) => setStatus(result.message))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Unable to verify email.");
      });
  }, [searchParams]);

  return (
    <main id="main-content" tabIndex={-1} className="auth-main flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-ink">
      <div className="w-full max-w-sm rounded-card border border-line bg-elevated p-6 text-center">
        <div className="mb-4 flex justify-center"><Brandmark size={26} /></div>
        <h1 className="font-display text-lg font-semibold">Email verification</h1>
        <p role={error ? "alert" : "status"} className={cnStatus(error)}>
          {error ?? status}
        </p>
        <Link href="/login" className={buttonClassName({ variant: "primary" }) + " mt-5 w-full justify-center"}>
          Continue to sign in
        </Link>
      </div>
    </main>
  );
}

function cnStatus(error: string | null) {
  return `mt-2 text-sm ${error ? "text-missed" : "text-muted"}`;
}
