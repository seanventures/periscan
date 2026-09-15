import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PeriscanQueryProvider } from "./query-provider";

function Probe() {
  const client = useQueryClient();

  return (
    <div>
      <span>query client ready</span>
      <span>{client instanceof QueryClient ? "typed client" : "missing"}</span>
    </div>
  );
}

describe("PeriscanQueryProvider", () => {
  it("provides a TanStack Query client to App Router children", () => {
    render(
      <PeriscanQueryProvider>
        <Probe />
      </PeriscanQueryProvider>
    );

    expect(screen.getByText("query client ready")).toBeInTheDocument();
    expect(screen.getByText("typed client")).toBeInTheDocument();
  });
});
