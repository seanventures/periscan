import "./globals.css";
import "./tailwind.css";

import type { ReactNode } from "react";

import { AppShell } from "../src/components/app-shell";
import { PeriscanQueryProvider } from "../src/components/query-provider";

export const metadata = {
  title: "Periscan — Evidence Dashboard",
  description:
    "Find the path. Validate the risk. Prove it's fixed. Periscan validates exposure, controls, attack paths, and AI applications, then turns the results into proof.",
  icons: {
    icon: "/brand/periscan-favicon-32.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Product type: IBM Plex Sans + Mono only (no AI-trend display faces). */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="font-sans antialiased">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <PeriscanQueryProvider>
          <AppShell>{children}</AppShell>
        </PeriscanQueryProvider>
      </body>
    </html>
  );
}
