import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPushConfigured } from "@/lib/push-notifications";
import { isTrustedPushEndpoint } from "@/lib/push-endpoint";
import { JsonRequestError, readJsonBody } from "@/lib/security";

const MAX_SUBSCRIPTIONS_PER_USER = 20;

class SubscriptionLimitError extends Error {}
class SubscriptionOwnershipError extends Error {}

const pushEndpointSchema = z
  .string()
  .url()
  .max(1024)
  .refine(isTrustedPushEndpoint, "Unsupported push service");

const subscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  previousEndpoint: pushEndpointSchema.optional(),
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

  let body: unknown;
  try {
    body = await readJsonBody(req, 8_192);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('cpboard-push-subscriptions'),
          hashtext(${userId})
        )
      `;
      if (
        parsed.data.previousEndpoint &&
        parsed.data.previousEndpoint !== parsed.data.endpoint
      ) {
        await tx.pushSubscription.deleteMany({
          where: {
            userId,
            endpoint: parsed.data.previousEndpoint,
          },
        });
      }
      const [existingSubscription, subscriptionCount] = await Promise.all([
        tx.pushSubscription.findUnique({
          where: { endpoint: parsed.data.endpoint },
          select: { userId: true },
        }),
        tx.pushSubscription.count({ where: { userId } }),
      ]);
      if (existingSubscription && existingSubscription.userId !== userId) {
        throw new SubscriptionOwnershipError();
      }
      if (!existingSubscription && subscriptionCount >= MAX_SUBSCRIPTIONS_PER_USER) {
        throw new SubscriptionLimitError();
      }

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
        },
      });
    });
  } catch (error) {
    if (error instanceof SubscriptionOwnershipError) {
      return NextResponse.json(
        { error: "This browser subscription belongs to another account" },
        { status: 409 },
      );
    }
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

  let body: unknown;
  try {
    body = await readJsonBody(req, 2_048);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const endpoint =
    body && typeof body === "object" && "endpoint" in body
      ? (body as { endpoint?: unknown }).endpoint
      : null;
  if (typeof endpoint !== "string" || endpoint.length > 1024) {
    return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
  return NextResponse.json({ success: true });
}
