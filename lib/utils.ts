import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fetches JSON from an API route and gracefully retries if the Cloud Run / preview
 * proxy temporarily returns an HTML warmup splash page ("<!doctype html...") during boot.
 */
export async function safeFetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
  retries = 3
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      const trimmed = text.trim();

      if (!res.ok || !trimmed || trimmed.startsWith('<')) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        return null;
      }

      return JSON.parse(trimmed) as T;
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return null;
    }
  }
  return null;
}
