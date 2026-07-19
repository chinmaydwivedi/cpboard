import { after, NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JsonRequestError, readJsonBody } from "@/lib/security";

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
    payload = await readJsonBody(req, 2_048);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
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
        await tx.$executeRaw`
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
