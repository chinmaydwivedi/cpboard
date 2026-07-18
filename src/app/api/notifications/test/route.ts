import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isPushConfigured,
  sendTestNotification,
} from "@/lib/push-notifications";

const testSchema = z.object({ endpoint: z.string().url().max(1024) });
const TEST_COOLDOWN_MS = 30 * 1000;

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Push notifications are not configured" },
      { status: 503 },
    );
  }

  const parsed = testSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const recentTest = await prisma.notificationDelivery.findFirst({
    where: {
      type: "TEST",
      createdAt: { gte: new Date(Date.now() - TEST_COOLDOWN_MS) },
      subscription: {
        userId,
        endpoint: parsed.data.endpoint,
      },
    },
    select: { id: true },
  });
  if (recentTest) {
    return NextResponse.json(
      { error: "Wait a few seconds before sending another test" },
      { status: 429 },
    );
  }

  const cooldownBucket = Math.floor(Date.now() / TEST_COOLDOWN_MS);
  const result = await sendTestNotification(
    userId,
    parsed.data.endpoint,
    cooldownBucket,
  );
  if (result.sent === 0) {
    if (result.skipped > 0) {
      return NextResponse.json(
        { error: "Wait a few seconds before sending another test" },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: result.failed > 0 ? "Test notification failed" : "This browser is not subscribed" },
      { status: result.failed > 0 ? 502 : 404 },
    );
  }
  return NextResponse.json({ success: true });
}
