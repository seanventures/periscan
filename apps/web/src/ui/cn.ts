import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge conditional class lists and de-dupe conflicting Tailwind utilities
// (later classes win). Standard helper for the component kit.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
