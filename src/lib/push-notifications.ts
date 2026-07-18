import "server-only";

import { Prisma } from "@prisma/client";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { getUpcomingContestFeed } from "@/lib/contests";

const LEADERBOARD_STATE_KEY = "global";
const STALE_DELIVERY_MS = 5 * 60 * 1000;
const FAILED_RETRY_DELAY_MS = 60 * 1000;
const LEADER_EVENT_RETRY_MS = 24 * 60 * 60 * 1000;
const DELIVERY_TASK_BUDGET_MS = 35 * 1000;

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  expiresAt?: string;
};

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type DeliverySummary = {
  sent: number;
  skipped: number;
  failed: number;
  removed: number;
};

let configuredFor: string | null = null;

function hasValidPushConfiguration() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (
    !publicKey ||
    !privateKey ||
    !subject ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(publicKey) ||
    !/^[A-Za-z0-9_-]{40,60}$/.test(privateKey)
  ) {
    return false;
  }

  try {
    const protocol = new URL(subject).protocol;
    return protocol === "mailto:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function isPushConfigured() {
  return hasValidPushConfiguration();
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject || !hasValidPushConfiguration()) {
    return false;
  }
  const fingerprint = `${subject}:${publicKey}`;
  if (configuredFor !== fingerprint) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configuredFor = fingerprint;
  }
  return true;
}

function emptyDeliverySummary(): DeliverySummary {
  return { sent: 0, skipped: 0, failed: 0, removed: 0 };
}

function mergeDeliverySummary(
  target: DeliverySummary,
  value: DeliverySummary,
) {
  target.sent += value.sent;
  target.skipped += value.skipped;
  target.failed += value.failed;
  target.removed += value.removed;
}

async function runDeliveryTasks(
  tasks: Array<() => Promise<DeliverySummary>>,
  concurrency = 12,
) {
  const summary = emptyDeliverySummary();
  const startedAt = Date.now();
  for (let index = 0; index < tasks.length; index += concurrency) {
    if (Date.now() - startedAt >= DELIVERY_TASK_BUDGET_MS) {
      summary.failed += tasks.length - index;
      break;
    }
    const results = await Promise.allSettled(
      tasks.slice(index, index + concurrency).map((task) => task()),
    );
    for (const result of results) {
      if (result.status === "fulfilled") mergeDeliverySummary(summary, result.value);
      else summary.failed += 1;
    }
  }
  return summary;
}

async function claimDelivery(
  subscriptionId: string,
  eventKey: string,
  type: string,
) {
  const existing = await prisma.notificationDelivery.findUnique({
    where: { subscriptionId_eventKey: { subscriptionId, eventKey } },
  });

  if (existing) {
    if (existing.status === "SENT") return null;
    const retryBefore = new Date(
      Date.now() -
        (existing.status === "FAILED"
          ? FAILED_RETRY_DELAY_MS
          : STALE_DELIVERY_MS),
    );
    const claimed = await prisma.notificationDelivery.updateMany({
      where: {
        id: existing.id,
        status: existing.status,
        updatedAt: { lte: retryBefore },
      },
      data: { status: "PENDING", error: null },
    });
    return claimed.count === 1 ? existing : null;
  }

  try {
    return await prisma.notificationDelivery.create({
      data: { subscriptionId, eventKey, type },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
}

async function sendOne(
  subscription: StoredSubscription,
  payload: PushPayload,
  eventKey: string,
  type: string,
): Promise<DeliverySummary> {
  const summary = emptyDeliverySummary();
  const delivery = await claimDelivery(subscription.id, eventKey, type);
  if (!delivery) {
    summary.skipped = 1;
    return summary;
  }

  try {
    const expiry = payload.expiresAt
      ? new Date(payload.expiresAt).getTime()
      : Number.NaN;
    const ttl = Number.isFinite(expiry)
      ? Math.max(1, Math.min(60 * 60, Math.floor((expiry - Date.now()) / 1000)))
      : 60 * 60;
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({
        ...payload,
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
      }),
      { TTL: ttl, urgency: "normal", timeout: 10_000 },
    );
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
    summary.sent = 1;
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : null;

    if (statusCode === 404 || statusCode === 410) {
      await prisma.pushSubscription.deleteMany({
        where: { id: subscription.id },
      });
      summary.removed = 1;
      return summary;
    }

    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 500) : "Push failed",
      },
    });
    summary.failed = 1;
  }

  return summary;
}

export async function sendPushToSubscriptions(
  subscriptions: StoredSubscription[],
  payload: PushPayload,
  eventKey: string,
  type: string,
) {
  if (!configureWebPush()) {
    const summary = emptyDeliverySummary();
    summary.failed = subscriptions.length;
    return summary;
  }
  return runDeliveryTasks(
    subscriptions.map(
      (subscription) => () => sendOne(subscription, payload, eventKey, type),
    ),
  );
}

export async function sendTestNotification(
  userId: string,
  endpoint?: string,
  cooldownBucket = Math.floor(Date.now() / 30_000),
) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, ...(endpoint ? { endpoint } : {}) },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subscriptions.length === 0) return emptyDeliverySummary();
  return sendPushToSubscriptions(
    subscriptions,
    {
      title: "CPBoard notifications are ready",
      body: "You’ll hear about leaderboard changes and upcoming contests here.",
      url: "/dashboard",
      tag: "cpboard-test",
    },
    `test:${userId}:${cooldownBucket}`,
    "TEST",
  );
}

function contestPlatformLabel(platform: string) {
  const labels: Record<string, string> = {
    "codeforces.com": "Codeforces",
    "leetcode.com": "LeetCode",
    "atcoder.jp": "AtCoder",
    "codechef.com": "CodeChef",
  };
  return labels[platform] ?? platform;
}

function compactNotificationText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength
    ? compact
    : `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeContestLeadMinutes(value: number) {
  return value === 15 || value === 60 ? value : 30;
}

export async function refreshScheduledContests() {
  const feed = await getUpcomingContestFeed({ fresh: true });
  const contests = feed.contests;
  if (feed.available && contests.length > 0) {
    const existing = await prisma.scheduledContest.findMany({
      where: { id: { in: contests.map((contest) => contest.id) } },
    });
    const existingById = new Map(existing.map((contest) => [contest.id, contest]));
    const incomingIds = contests.map((contest) => contest.id);
    const writes = contests.flatMap((contest) => {
      const stored = existingById.get(contest.id);
      const data = {
        title: contest.title,
        url: contest.url,
        platform: contest.platform,
        startTime: new Date(contest.startTime),
        endTime: new Date(contest.endTime),
        durationSeconds: contest.durationSeconds,
      };
      if (!stored) {
        return [prisma.scheduledContest.create({ data: { id: contest.id, ...data } })];
      }
      if (
        stored.title === data.title &&
        stored.url === data.url &&
        stored.platform === data.platform &&
        stored.startTime.getTime() === data.startTime.getTime() &&
        stored.endTime.getTime() === data.endTime.getTime() &&
        stored.durationSeconds === data.durationSeconds
      ) {
        return [];
      }
      return [
        prisma.scheduledContest.update({
          where: { id: contest.id },
          data,
        }),
      ];
    });

    await prisma.$transaction([
      ...writes,
      prisma.scheduledContest.deleteMany({
        where: {
          id: { notIn: incomingIds },
          startTime: { gte: new Date() },
        },
      }),
    ]);
  }

  await prisma.scheduledContest.deleteMany({
    where: { endTime: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return { refreshed: contests.length, sourceAvailable: feed.available };
}

export async function sendDueContestReminders(now = new Date()) {
  if (!configureWebPush()) return emptyDeliverySummary();

  const contests = await prisma.scheduledContest.findMany({
    where: {
      startTime: {
        gt: now,
        lte: new Date(now.getTime() + 60 * 60 * 1000),
      },
    },
    orderBy: { startTime: "asc" },
  });
  if (contests.length === 0) return emptyDeliverySummary();

  const preferences = await prisma.notificationPreference.findMany({
    where: {
      contestAlerts: true,
      user: { pushSubscriptions: { some: {} } },
    },
    include: {
      user: {
        select: {
          pushSubscriptions: {
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          },
        },
      },
    },
  });

  const deliveryTasks: Array<() => Promise<DeliverySummary>> = [];
  for (const preference of preferences) {
    const leadMinutes = normalizeContestLeadMinutes(
      preference.contestLeadMinutes,
    );
    const dueBefore = now.getTime() + leadMinutes * 60 * 1000;
    for (const contest of contests) {
      if (contest.startTime.getTime() > dueBefore) continue;
      const minutesAway = Math.max(
        1,
        Math.round((contest.startTime.getTime() - now.getTime()) / 60_000),
      );
      for (const subscription of preference.user.pushSubscriptions) {
        deliveryTasks.push(() =>
          sendOne(
            subscription,
            {
              title: `${contestPlatformLabel(contest.platform)} contest soon`,
              body: `${compactNotificationText(contest.title, 140)} starts in about ${minutesAway} minute${minutesAway === 1 ? "" : "s"}.`,
              url: "/contests",
              tag: `contest-${contest.id}`,
              expiresAt: contest.startTime.toISOString(),
            },
            `contest:${contest.id}:${contest.startTime.toISOString()}`,
            "CONTEST_REMINDER",
          ),
        );
      }
    }
  }
  return runDeliveryTasks(deliveryTasks);
}

async function getGlobalLeader() {
  const leaders = await prisma.$queryRaw<
    Array<{
      id: string;
      username: string;
      name: string | null;
      totalSolved: number;
      bestRating: number;
    }>
  >`
    SELECT
      users."id",
      users."username",
      users."name",
      COALESCE(SUM(profiles."problemsSolved"), 0)::integer AS "totalSolved",
      COALESCE(
        MAX(
          CASE
            WHEN profiles."platform" = 'LEETCODE'::"Platform"
              THEN CASE
                WHEN profiles."rating" > 0 THEN profiles."rating"
                ELSE profiles."maxRating"
              END
            ELSE 0
          END
        ),
        0
      )::integer AS "bestRating"
    FROM "User" AS users
    INNER JOIN "PlatformProfile" AS profiles
      ON profiles."userId" = users."id" AND profiles."verified" = true
    WHERE users."onboardingComplete" = true
    GROUP BY users."id", users."username", users."name"
    ORDER BY "totalSolved" DESC, "bestRating" DESC, users."username" COLLATE "C" ASC
    LIMIT 1
  `;

  return leaders[0];
}

async function deliverLeaderboardChange(
  leader: NonNullable<Awaited<ReturnType<typeof getGlobalLeader>>>,
  eventVersion: number,
) {
  if (!configureWebPush()) return emptyDeliverySummary();
  const recipients = await prisma.notificationPreference.findMany({
    where: {
      leaderAlerts: true,
      user: { pushSubscriptions: { some: {} } },
    },
    include: {
      user: {
        select: {
          id: true,
          pushSubscriptions: {
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          },
        },
      },
    },
  });
  const displayName = compactNotificationText(
    leader.name || `@${leader.username}`,
    80,
  );
  return runDeliveryTasks(
    recipients.flatMap((recipient) => {
      const isLeader = recipient.user.id === leader.id;
      return recipient.user.pushSubscriptions.map(
        (subscription) => () =>
          sendOne(
            subscription,
            {
              title: isLeader ? "You’re leading CPBoard" : "New leaderboard leader",
              body: isLeader
                ? `You’re now #1 with ${leader.totalSolved.toLocaleString()} problems solved.`
                : `${displayName} is now #1 with ${leader.totalSolved.toLocaleString()} problems solved.`,
              url: `/u/${leader.username}`,
              tag: "cpboard-leader",
            },
            `leader:${eventVersion}:${leader.id}`,
            "LEADER_CHANGE",
          ),
      );
    }),
  );
}

export async function checkAndNotifyLeaderboardLeader() {
  const leader = await getGlobalLeader();
  if (!leader) return { changed: false, initialized: false, ...emptyDeliverySummary() };

  const state = await prisma.leaderboardNotificationState.findUnique({
    where: { key: LEADERBOARD_STATE_KEY },
  });

  if (!state) {
    try {
      await prisma.leaderboardNotificationState.create({
        data: {
          key: LEADERBOARD_STATE_KEY,
          leaderUserId: leader.id,
          leaderUsername: leader.username,
          leaderScore: leader.totalSolved,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }
    return { changed: false, initialized: true, ...emptyDeliverySummary() };
  }

  if (state.leaderUserId === leader.id) {
    if (state.leaderScore !== leader.totalSolved) {
      await prisma.leaderboardNotificationState.update({
        where: { key: LEADERBOARD_STATE_KEY },
        data: { leaderScore: leader.totalSolved, leaderUsername: leader.username },
      });
    }
    if (
      state.version > 0 &&
      state.changedAt.getTime() >= Date.now() - LEADER_EVENT_RETRY_MS
    ) {
      const retrySummary = await deliverLeaderboardChange(leader, state.version);
      return { changed: false, initialized: false, retrying: true, ...retrySummary };
    }
    return {
      changed: false,
      initialized: false,
      retrying: false,
      ...emptyDeliverySummary(),
    };
  }

  const updatedState = await prisma.leaderboardNotificationState.updateMany({
    where: {
      key: LEADERBOARD_STATE_KEY,
      leaderUserId: state.leaderUserId,
      version: state.version,
    },
    data: {
      leaderUserId: leader.id,
      leaderUsername: leader.username,
      leaderScore: leader.totalSolved,
      version: { increment: 1 },
      changedAt: new Date(),
    },
  });
  if (updatedState.count === 0) {
    return { changed: false, initialized: false, ...emptyDeliverySummary() };
  }
  const eventVersion = state.version + 1;
  const summary = await deliverLeaderboardChange(leader, eventVersion);

  return { changed: true, initialized: false, ...summary };
}

export async function runNotificationCycle() {
  if (!isPushConfigured()) {
    return {
      contestRefresh: { refreshed: 0, sourceAvailable: false },
      contestReminders: emptyDeliverySummary(),
      leaderboard: {
        changed: false,
        initialized: false,
        ...emptyDeliverySummary(),
      },
      expiredDeliveriesRemoved: 0,
    };
  }

  const subscriptionCount = await prisma.pushSubscription.count();
  if (subscriptionCount === 0) {
    return {
      contestRefresh: { refreshed: 0, sourceAvailable: true },
      contestReminders: emptyDeliverySummary(),
      leaderboard: {
        changed: false,
        initialized: false,
        ...emptyDeliverySummary(),
      },
      expiredDeliveriesRemoved: 0,
    };
  }

  const contestRefreshPromise = refreshScheduledContests();
  const leaderboardPromise = checkAndNotifyLeaderboardLeader();
  const cleanupPromise = prisma.notificationDelivery.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });
  const contestRefresh = await contestRefreshPromise;
  const [contestReminders, leaderboard, expiredDeliveries] = await Promise.all([
    sendDueContestReminders(),
    leaderboardPromise,
    cleanupPromise,
  ]);
  return {
    contestRefresh,
    contestReminders,
    leaderboard,
    expiredDeliveriesRemoved: expiredDeliveries.count,
  };
}
