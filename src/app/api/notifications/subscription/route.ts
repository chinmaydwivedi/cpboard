import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPushConfigured } from "@/lib/push-notifications";

const MAX_SUBSCRIPTIONS_PER_USER = 20;
const PUSH_SERVICE_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

class SubscriptionLimitError extends Error {}

function isTrustedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (!url.port || url.port === "443") &&
      !url.username &&
      !url.password &&
      (PUSH_SERVICE_HOSTS.has(url.hostname) ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}

const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(1024)
    .refine(isTrustedPushEndpoint, "Unsupported push service"),
  keys: z.object({
    p256dh: z.string().min(16).max(1024),
    auth: z.string().min(8).max(512),
  }),
});

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Push notifications are not configured" },
      { status: 503 },
    );
  }

  const parsed = subscriptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('cpboard-push-subscriptions'),
          hashtext(${userId})
        )
      `;
      const [existingSubscription, subscriptionCount] = await Promise.all([
        tx.pushSubscription.findUnique({
          where: { endpoint: parsed.data.endpoint },
          select: { userId: true },
        }),
        tx.pushSubscription.count({ where: { userId } }),
      ]);
      if (
        existingSubscription?.userId !== userId &&
        subscriptionCount >= MAX_SUBSCRIPTIONS_PER_USER
      ) {
        throw new SubscriptionLimitError();
      }
      const movedFromAnotherAccount =
        existingSubscription && existingSubscription.userId !== userId;

      await tx.notificationPreference.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      await tx.pushSubscription.upsert({
        where: { endpoint: parsed.data.endpoint },
        create: {
          userId,
          endpoint: parsed.data.endpoint,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          userAgent,
        },
        update: {
          userId,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          userAgent,
          lastSeenAt: new Date(),
          ...(movedFromAnotherAccount
            ? { deliveries: { deleteMany: {} } }
            : {}),
        },
      });
    });
  } catch (error) {
    if (error instanceof SubscriptionLimitError) {
      return NextResponse.json(
        { error: "Too many browsers are connected to this account" },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || body.endpoint.length > 1024) {
    return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint: body.endpoint },
  });
  return NextResponse.json({ success: true });
}
