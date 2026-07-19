import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  PlatformVerificationError,
  startPlatformVerification,
} from "@/lib/platform-verification";
import { prisma } from "@/lib/prisma";
import {
  JsonRequestError,
  readJsonBody,
} from "@/lib/security";

const startSchema = z.object({
  platform: z.enum(["CODEFORCES", "LEETCODE"]),
  handle: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ownershipVerificationRequired: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!user.ownershipVerificationRequired) {
    return NextResponse.json(
      {
        error: "Your existing CPBoard account does not require this check",
        code: "VERIFICATION_NOT_REQUIRED",
      },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 2_048);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message, code: "INVALID_INPUT" }, { status: error.status });
    }
    throw error;
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid platform and handle", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  try {
    const challenge = await startPlatformVerification({
      userId,
      platform: parsed.data.platform,
      rawHandle: parsed.data.handle,
    });
    return NextResponse.json({ challenge });
  } catch (error) {
    if (error instanceof PlatformVerificationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: error.status,
          headers: error.retryAfter
            ? { "Retry-After": String(error.retryAfter) }
            : undefined,
        },
      );
    }
    return NextResponse.json(
      { error: "Could not start verification right now" },
      { status: 500 },
    );
  }
}
