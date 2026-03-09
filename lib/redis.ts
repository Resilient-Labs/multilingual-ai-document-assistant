import { Redis } from "@upstash/redis";
import { REDIS_TTL_SECONDS } from "./constants";

/**
 * Redis client for ephemeral document storage.
 * Uses Upstash Redis (works with Vercel/serverless).
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env.
 */
let _redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    _redis = new Redis({ url, token });
    return _redis;
  }
  try {
    _redis = Redis.fromEnv();
    return _redis;
  } catch {
    return null;
  }
}

export const redis = getRedisClient();

/**
 * Set a key with TTL (7 days).
 */
export async function setWithTTL<T>(
  key: string,
  value: T,
  ttlSeconds: number = REDIS_TTL_SECONDS
): Promise<void> {
  const client = redis;
  if (!client) {
    throw new Error(
      "Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }
  await client.set(key, value, { ex: ttlSeconds });
}

/**
 * Get a key. Upstash returns parsed JSON for objects.
 */
export async function getWithParse<T>(key: string): Promise<T | null> {
  const client = redis;
  if (!client) return null;
  const raw = await client.get<T>(key);
  return raw ?? null;
}
