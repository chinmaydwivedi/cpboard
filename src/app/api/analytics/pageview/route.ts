import { after, NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_PATH_LENGTH = 180;
const DEDUPE_WINDOW_MS = 15_000;
const RATE_WINDOW_MS = 60_000;
const MAX_VISITS_PER_WINDOW = 30;

function normalizePath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const basePath = trimmed.split("?")[0].replace(/\/+$/, "") || "/";
  if (basePath.length > MAX_PATH_LENGTH) return null;

  if (/^\/u\/[^/]+$/.test(basePath)) return "/u/[username]";
  if (/^\/leaderboard\/[^/]+$/.test(basePath)) return "/leaderboard/[slug]";

  return basePath;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const viewerUserId = session?.user?.id;
  if (!viewerUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pathInput =
    payload && typeof payload === "object" && "path" in payload
      ? (payload as { path?: unknown }).path
      : null;
  if (typeof pathInput !== "string") {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  const path = normalizePath(pathInput);
  const visitorId = `user:${viewerUserId}`;

  if (!path) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  after(async () => {
    try {
      const dedupeThreshold = new Date(Date.now() - DEDUPE_WINDOW_MS);
      const rateThreshold = new Date(Date.now() - RATE_WINDOW_MS);
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext('cpboard-pageview'),
            hashtext(${viewerUserId})
          )
        `;

        const [visitsInWindow, recentVisit] = await Promise.all([
          tx.pageVisit.count({
            where: {
              viewerUserId,
              createdAt: { gte: rateThreshold },
            },
          }),
          tx.pageVisit.findFirst({
            where: {
              visitorId,
              path,
              createdAt: { gte: dedupeThreshold },
            },
            select: { id: true },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        if (visitsInWindow >= MAX_VISITS_PER_WINDOW || recentVisit) return;
        await tx.pageVisit.create({
          data: { path, visitorId, viewerUserId },
        });
      });
    } catch (error) {
      console.error("[ANALYTICS] Failed to record page view:", error);
    }
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
