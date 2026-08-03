// src/lib/cartellaCache.js
//
// The 300 cartella layouts are static, so we cache them aggressively:
//   - in memory (instant within a session), and
//   - in localStorage (instant on every future open, even after a reload).
// Bump CACHE_VERSION if the backend ever changes the predefined layouts.

import { apiFetch } from "./api/client";

// v2: pool grew from 200 -> 300 cartellas; v1 caches must be invalidated so
// clients refetch the full set (otherwise cards 201-300 have no layout).
const CACHE_VERSION = 2;
const STORAGE_KEY = `cartellas:v${CACHE_VERSION}`;

let memCache = null;
let inflight = null;

export function getCachedCartellas() {
  if (memCache) return memCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memCache = parsed;
        return memCache;
      }
    }
  } catch {
    /* ignore corrupt cache */
  }
  return null;
}

export function setCachedCartellas(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return;
  memCache = cards;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch {
    /* localStorage full / unavailable — memory cache still works */
  }
}

// Fetch the layouts once. Resolves instantly if warm; dedupes concurrent calls
// (e.g. a prefetch from the stake screen + the selection screen mounting).
export async function prefetchCartellas(sessionId) {
  const cached = getCachedCartellas();
  if (cached) return cached;
  if (!sessionId) return null;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await apiFetch("/api/cartellas", { sessionId });
      if (res?.success && Array.isArray(res.cards) && res.cards.length > 0) {
        setCachedCartellas(res.cards);
        return res.cards;
      }
      return null;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
