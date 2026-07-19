import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import {
  claimRateLimit,
  getRequestIp,
  JsonRequestError,
  readBoundedTextBody,
} from "@/lib/security";
import { normalizeEmailAddress } from "@/lib/university-domain";

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  let body: string;
  try {
    // Auth.js parses the request body internally. Read a clone first so every
    // action is bounded before the library sees it, while leaving the original
    // stream untouched for Auth.js.
    body = await readBoundedTextBody(request.clone(), 16_384);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json(
        { url: `${request.nextUrl.origin}/login?error=InvalidRequest` },
        { status: error.status },
      );
    }
    throw error;
  }

  if (request.nextUrl.pathname.endsWith("/signin/nodemailer")) {
    const ipLimit = await claimRateLimit({
      scope: "magic-link-ip",
      identifier: getRequestIp(request),
      limit: 20,
      windowMs: 60 * 60 * 1_000,
    });
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { url: `${request.nextUrl.origin}/login?error=RateLimited` },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfter) },
        },
      );
    }

    const mediaType =
      request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ??
      "";
    if (mediaType !== "application/x-www-form-urlencoded") {
      return NextResponse.json(
        { url: `${request.nextUrl.origin}/login?error=InvalidRequest` },
        { status: 415 },
      );
    }

    const form = new URLSearchParams(body);
    const submittedEmails = form.getAll("email");
    const email =
      submittedEmails.length === 1
        ? normalizeEmailAddress(submittedEmails[0] ?? "")
        : null;
    if (!email) {
      return NextResponse.json(
        { url: `${request.nextUrl.origin}/login?error=InvalidRequest` },
        { status: 400 },
      );
    }

    const emailLimit = await claimRateLimit({
      scope: "magic-link-email",
      identifier: email,
      limit: 5,
      windowMs: 15 * 60 * 1_000,
    });
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { url: `${request.nextUrl.origin}/login?error=RateLimited` },
        {
          status: 429,
          headers: { "Retry-After": String(emailLimit.retryAfter) },
        },
      );
    }
  }

  return handlers.POST(request);
}
