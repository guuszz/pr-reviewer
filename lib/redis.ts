import { Redis } from "@upstash/redis";
import crypto from "node:crypto";
import type { SecurityFinding, SecuritySummary } from "./security";

// ─── Cliente Redis ───────────────────────────────────────────────────
// Auto-detecta as env vars KV_REST_API_URL/KV_REST_API_TOKEN (do Vercel KV)
// OU UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (Upstash direto).
//
// Se nenhuma estiver setada, fromEnv() lança no primeiro uso — capturamos
// em try/catch nos handlers e devolvemos 503 amigável.

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (redisInstance) return redisInstance;

  // Tenta primeiro Vercel KV vars, depois Upstash direto
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

  if (!url || !token) {
    throw new Error(
      "Redis não configurado. Provisiona Upstash KV em vercel.com/<team>/pr-reviewer/stores e seta as env vars.",
    );
  }

  redisInstance = new Redis({ url, token });
  return redisInstance;
}

export function isRedisConfigured(): boolean {
  return !!(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

// ─── Hashing de URL → short ID ────────────────────────────────────────
// Normaliza a URL antes de hashar pra que `?diff=true` e `?diff=true&w=1`
// produzam IDs distintos só se semanticamente forem PRs distintos.

export function shortIdFromUrl(prUrl: string): string {
  const normalized = normalizeUrl(prUrl);
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return hash.slice(0, 10); // 10 chars = 40 bits, baixíssima chance de colisão
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

// ─── Shape do que guardamos ──────────────────────────────────────────
export interface SharedReview {
  markdown: string;
  securityFindings?: SecurityFinding[];
  securitySummary?: SecuritySummary;
  prInfo: {
    title: string;
    url: string;
    author: string;
    state: string;
  };
  createdAt: number;
  truncated?: boolean;
}

// ─── API pública ─────────────────────────────────────────────────────

const KEY_PREFIX = "pr-review:";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export async function saveSharedReview(
  prUrl: string,
  review: Omit<SharedReview, "createdAt">,
): Promise<string> {
  const id = shortIdFromUrl(prUrl);
  const redis = getRedis();
  const data: SharedReview = { ...review, createdAt: Date.now() };

  await redis.set(`${KEY_PREFIX}${id}`, JSON.stringify(data), { ex: TTL_SECONDS });
  return id;
}

export async function getSharedReview(id: string): Promise<SharedReview | null> {
  // Validação de input — só aceita hex 10 chars
  if (!/^[a-f0-9]{10}$/.test(id)) return null;

  const redis = getRedis();
  const raw = await redis.get<string | SharedReview>(`${KEY_PREFIX}${id}`);

  if (!raw) return null;

  // Upstash às vezes auto-deserializa, às vezes não — tratamos os 2 casos
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as SharedReview;
    } catch {
      return null;
    }
  }
  return raw;
}
