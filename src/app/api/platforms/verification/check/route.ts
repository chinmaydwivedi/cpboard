import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  checkPlatformVerification,
  PlatformVerificationError,
} from "@/lib/platform-verification";
import { invalidatePlatformViews } from "@/lib/platform-cache";
import { prisma } from "@/lib/prisma";
import { JsonRequestError, readJsonBody } from "@/lib/security";

const checkSchema = z.object({
  platform: z.enum(["CODEFORCES", "LEETCODE"]),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const username = session?.username;
  const universityShortName = session?.university?.shortName;
  if (!userId || !username || !universityShortName) {
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
    body = await readJsonBody(request, 1_024);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message, code: "INVALID_INPUT" }, { status: error.status });
    }
    throw error;
  }
  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose Codeforces or LeetCode", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  try {
    const result = await checkPlatformVerification({
      userId,
      platform: parsed.data.platform,
    });
    if (result.verified && result.newlyVerified) {
      invalidatePlatformViews({
        username,
        universityShortName,
        codeforces: parsed.data.platform === "CODEFORCES",
        topicRadar: true,
      });
    }
    return NextResponse.json(result);
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
      { error: "Could not check verification right now" },
      { status: 500 },
    );
  }
}
