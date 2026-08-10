import { createHash } from "crypto";
import type { SecurityFinding, SecuritySummary } from "./security";

export interface CachedAnalysis {
  markdown: string;
  securityFindings?: SecurityFinding[];
  securitySummary?: SecuritySummary;
  prInfo: {
    title: string;
    url: string;
    author: string;
    state: string;
  };
}

interface CacheEntry extends CachedAnalysis {
  timestamp: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hora
const MAX_ENTRIES = 50;

// In-memory cache. Em serverless (Vercel), cada cold start zera o cache —
// mesma URL pode re-fetch em invocações diferentes. Pra persistência real
// use KV/Redis/Upstash. Pra demo, em memória é suficiente.
const cache = new Map<string, CacheEntry>();

export function hashUrl(url: string): string {
  const normalized = url.trim().toLowerCase().replace(/\/$/, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export function getCached(url: string): CachedAnalysis | null {
  const key = hashUrl(url);
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }

  return {
    markdown: entry.markdown,
    prInfo: entry.prInfo,
    securityFindings: entry.securityFindings,
    securitySummary: entry.securitySummary,
  };
}

export function setCached(url: string, value: CachedAnalysis): void {
  cache.set(hashUrl(url), { ...value, timestamp: Date.now() });

  if (cache.size > MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [k, v] of cache) {
      if (v.timestamp < oldestTs) {
        oldestTs = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
}
