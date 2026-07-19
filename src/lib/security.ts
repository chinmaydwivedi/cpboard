import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const MAX_RATE_WINDOW_MS = 24 * 60 * 60 * 1_000;

export class JsonRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = "JsonRequestError";
  }
}

export async function readBoundedTextBody(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new JsonRequestError("Request body is too large", 413);
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new JsonRequestError("Request body is too large", 413);
    }
    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
}

export async function readJsonBody(
  request: Request,
  maxBytes = 32 * 1_024,
): Promise<unknown> {
  const mediaType =
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ??
    "";
  if (mediaType !== "application/json") {
    throw new JsonRequestError("Content-Type must be application/json", 415);
  }

  const body = await readBoundedTextBody(request, maxBytes);

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new JsonRequestError("Invalid JSON body", 400);
  }
}

function rateLimitDigest(scope: string, identifier: string) {
  const secret =
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "development"
      ? "cpboard-local-rate-limit-key"
      : undefined);
  if (!secret) throw new Error("AUTH_SECRET is required for rate limiting");

  return createHmac("sha256", secret)
    .update(`${scope}\u0000${identifier}`)
    .digest("base64url");
}

export async function claimRateLimit(args: {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
}) {
  const limit = Math.max(1, Math.floor(args.limit));
  const windowMs = Math.max(
    1_000,
    Math.min(Math.floor(args.windowMs), MAX_RATE_WINDOW_MS),
  );
  const key = `${args.scope}:${rateLimitDigest(args.scope, args.identifier)}`;
  const rows = await prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
    INSERT INTO "RateLimitBucket" (
      "key",
      "count",
      "windowStart",
      "expiresAt"
    )
    VALUES (
      ${key},
      1,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP + (
        CAST(${windowMs} AS double precision) * INTERVAL '1 millisecond'
      )
    )
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP
        ELSE "RateLimitBucket"."windowStart"
      END,
      "expiresAt" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + (
            CAST(${windowMs} AS double precision) * INTERVAL '1 millisecond'
          )
        ELSE "RateLimitBucket"."expiresAt"
      END
    WHERE "RateLimitBucket"."expiresAt" <= CURRENT_TIMESTAMP
      OR "RateLimitBucket"."count" < ${limit}
    RETURNING "count", "expiresAt"
  `;

  if (rows[0]) {
    return { allowed: true as const, remaining: Math.max(0, limit - rows[0].count) };
  }

  const existing = await prisma.rateLimitBucket.findUnique({
    where: { key },
    select: { expiresAt: true },
  });
  return {
    allowed: false as const,
    retryAfter: Math.max(
      1,
      Math.ceil(((existing?.expiresAt.getTime() ?? Date.now() + windowMs) - Date.now()) / 1_000),
    ),
  };
}

export function getRequestIp(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip");
  return (forwarded?.split(",")[0]?.trim() || "unknown").slice(0, 128);
}

export function verifyBearerSecret(
  authorizationHeader: string | null,
  expectedSecret: string | undefined,
) {
  if (!expectedSecret || !authorizationHeader?.startsWith("Bearer ")) {
    return false;
  }
  const actual = Buffer.from(authorizationHeader.slice(7));
  const expected = Buffer.from(expectedSecret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function cleanupExpiredSecurityState() {
  return prisma.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1_000) } },
  });
}
