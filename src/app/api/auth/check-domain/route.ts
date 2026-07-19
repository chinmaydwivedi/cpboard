import { NextRequest, NextResponse } from "next/server";
import { isAllowlistedAdminEmail } from "@/lib/admin";
import { findUniversityByEmail, normalizeEmailAddress } from "@/lib/university-domain";
import {
  claimRateLimit,
  getRequestIp,
  JsonRequestError,
  readJsonBody,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await readJsonBody(req, 2_048);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ valid: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
  const rawEmail =
    body && typeof body === "object" && "email" in body
      ? (body as { email?: unknown }).email
      : null;
  const email = typeof rawEmail === "string" ? normalizeEmailAddress(rawEmail) : null;
  if (!email) {
    return NextResponse.json({ valid: false, error: "Invalid email" });
  }

  const ipLimit = await claimRateLimit({
    scope: "domain-check-ip",
    identifier: getRequestIp(req),
    limit: 30,
    windowMs: 15 * 60 * 1_000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { valid: false, error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
    );
  }

  const emailLimit = await claimRateLimit({
    scope: "domain-check-email",
    identifier: email,
    limit: 8,
    windowMs: 15 * 60 * 1_000,
  });
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { valid: false, error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter) } },
    );
  }

  if (isAllowlistedAdminEmail(email)) {
    return NextResponse.json({ valid: true });
  }

  if (await findUniversityByEmail(email)) return NextResponse.json({ valid: true });

  return NextResponse.json({ valid: false, error: "University not registered" });
}
