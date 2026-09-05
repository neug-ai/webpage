"use client";

import { useEffect, useState } from "react";

const REPOSITORY = "alibaba/neug";
const CACHE_KEY = `neug-github-stars:${REPOSITORY}`;
const CACHE_TTL = 60 * 60 * 1000;

type CachedStars = {
  count: number;
  updatedAt: number;
};

let pendingRequest: Promise<number> | null = null;

function readCachedStars(): CachedStars | null {
  try {
    const value = window.localStorage.getItem(CACHE_KEY);
    if (!value) return null;

    const parsed = JSON.parse(value) as Partial<CachedStars>;
    if (typeof parsed.count !== "number" || typeof parsed.updatedAt !== "number") {
      return null;
    }

    return { count: parsed.count, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

function requestStars() {
  if (!pendingRequest) {
    pendingRequest = fetch(`https://api.github.com/repos/${REPOSITORY}`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        const data = (await response.json()) as { stargazers_count?: unknown };
        if (typeof data.stargazers_count !== "number") {
          throw new Error("GitHub returned an invalid star count");
        }
        return data.stargazers_count;
      })
      .finally(() => {
        pendingRequest = null;
      });
  }

  return pendingRequest;
}

function formatStars(count: number) {
  if (count < 1_000) return count.toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
}

export function GitHubStarCount({
  className,
  initialCount,
}: {
  className?: string;
  initialCount: number;
}) {
  const [stars, setStars] = useState(initialCount);

  useEffect(() => {
    const cached = readCachedStars();
    if (cached) setStars(cached.count);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL) return;

    let active = true;
    requestStars()
      .then((count) => {
        if (!active) return;
        setStars(count);
        try {
          window.localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ count, updatedAt: Date.now() } satisfies CachedStars),
          );
        } catch {
          // The count still works when storage is unavailable.
        }
      })
      .catch(() => {
        // Keep a stale cached value when GitHub is temporarily unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <span
      className={className}
      aria-label={`${stars.toLocaleString("en-US")} GitHub stars`}
      aria-live="polite"
      title={`${stars.toLocaleString("en-US")} stars`}
    >
      {formatStars(stars)}
    </span>
  );
}
