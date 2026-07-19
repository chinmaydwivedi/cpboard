import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPushConfigured } from "@/lib/push-notifications";
import { isTrustedPushEndpoint } from "@/lib/push-endpoint";
import { JsonRequestError, readJsonBody } from "@/lib/security";

const statusSchema = z.object({
  endpoint: z.string().url().max(1024).refine(isTrustedPushEndpoint),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await readJsonBody(req, 2_048);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const [preference, subscription] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.pushSubscription.findFirst({
      where: { userId, endpoint: parsed.data.endpoint },
      select: { id: true, lastSeenAt: true },
    }),
  ]);
  if (
    subscription &&
    subscription.lastSeenAt.getTime() < Date.now() - 24 * 60 * 60 * 1000
  ) {
    after(async () => {
      await prisma.pushSubscription
        .update({
          where: { id: subscription.id },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => undefined);
    });
  }

  return NextResponse.json({
    configured: isPushConfigured(),
    subscribed: Boolean(subscription),
    preferences: {
      leaderAlerts: preference?.leaderAlerts ?? true,
      contestAlerts: preference?.contestAlerts ?? true,
      contestLeadMinutes: preference?.contestLeadMinutes ?? 30,
    },
  });
}
