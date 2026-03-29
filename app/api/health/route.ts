import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REQUIRED_ENV_VARS = [
  "DEEPL_API_KEY",
  "DEEPGRAM_API_KEY",
  "REPLICATE_API_TOKEN",
  "OPEN_ROUTER_API_TOKEN",
] as const;

const PROD_ONLY_REQUIRED_ENV_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

function getMissingRequiredEnv(): string[] {
  const requiredVars =
    process.env.NODE_ENV === "production"
      ? [...REQUIRED_ENV_VARS, ...PROD_ONLY_REQUIRED_ENV_VARS]
      : [...REQUIRED_ENV_VARS];

  return requiredVars.filter((name) => !process.env[name]);
}

function getHealthPayload() {
  const missingEnv = getMissingRequiredEnv();
  const ready = missingEnv.length === 0;

  return {
    status: ready ? "ok" : "degraded",
    ready,
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      env: ready ? "ok" : "missing_required_env",
    },
    missingEnv,
  };
}

export async function GET() {
  const payload = getHealthPayload();

  return NextResponse.json(payload, {
    status: payload.ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function HEAD() {
  const payload = getHealthPayload();

  return new NextResponse(null, {
    status: payload.ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
