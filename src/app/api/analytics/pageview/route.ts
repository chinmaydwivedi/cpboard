import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_PATH_LENGTH = 180;
const MAX_VISITOR_ID_LENGTH = 128;
const DEDUPE_WINDOW_MS = 15_000;
const VISITOR_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

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
  const visitorIdInput =
    payload && typeof payload === "object" && "visitorId" in payload
      ? (payload as { visitorId?: unknown }).visitorId
      : null;

  if (typeof pathInput !== "string" || typeof visitorIdInput !== "string") {
    return NextResponse.json(
      { error: "Both path and visitorId are required" },
      { status: 400 }
    );
  }

  const path = normalizePath(pathInput);
  const visitorId = visitorIdInput.trim();

  if (!path) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (
    visitorId.length < 8 ||
    visitorId.length > MAX_VISITOR_ID_LENGTH ||
    !VISITOR_ID_REGEX.test(visitorId)
  ) {
    return NextResponse.json({ error: "Invalid visitorId" }, { status: 400 });
  }

  let viewerUserId: string | null = null;
  try {
    const session = await auth();
    const sessionUser = session?.user as
      | { id?: string | null; email?: string | null }
      | undefined;

    if (sessionUser?.id) {
      viewerUserId = sessionUser.id;
    } else if (sessionUser?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: sessionUser.email },
        select: { id: true },
      });
      viewerUserId = dbUser?.id ?? null;
    }
  } catch {
    viewerUserId = null;
  }

  const dedupeThreshold = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const recentVisit = await prisma.pageVisit.findFirst({
    where: {
      visitorId,
      path,
      createdAt: { gte: dedupeThreshold },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (recentVisit) {
    return NextResponse.json({ ok: true });
  }

  await prisma.pageVisit.create({
    data: {
      path,
      visitorId,
      viewerUserId,
    },
  });

  return NextResponse.json({ ok: true });
}
