"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

import { cn } from "./cn";

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

// Accessible tabs (keyboard + roving focus) via Radix, styled with the kit.
export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  className,
  ...rest
}: TabsProps) {
  return (
    <RadixTabs.Root
      className={cn("flex flex-col gap-4", className)}
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
    >
      <RadixTabs.List
        aria-label={rest["aria-label"]}
        className="flex w-full max-w-full gap-1 overflow-x-auto border-b border-line"
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              "-mb-px border-b-2 border-transparent px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted",
              "shrink-0",
              "transition-colors hover:text-ink",
              "data-[state=active]:border-brand data-[state=active]:text-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content
          key={item.value}
          value={item.value}
          className="focus-visible:outline-none"
        >
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
