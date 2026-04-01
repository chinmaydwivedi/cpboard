import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  COMMENT_COOLDOWN_SECONDS,
  MAX_COMMENT_LENGTH,
  normalizeCommentBody,
} from "@/lib/potd";

const COMMENT_COOLDOWN_MS = COMMENT_COOLDOWN_SECONDS * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const comments = await prisma.dailyPracticeComment.findMany({
    where: {
      problemId: id,
      problem: { isPublished: true },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const problem = await prisma.dailyPracticeProblem.findUnique({
    where: { id },
    select: { id: true, isPublished: true },
  });

  if (!problem || !problem.isPublished) {
    return NextResponse.json({ error: "Problem not available" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      username: true,
      name: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bodyRaw =
    payload && typeof payload === "object" && "body" in payload
      ? (payload as { body?: unknown }).body
      : null;

  if (typeof bodyRaw !== "string") {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }

  const body = normalizeCommentBody(bodyRaw);
  if (!body) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }

  if (body.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `Comment must be at most ${MAX_COMMENT_LENGTH} characters` },
      { status: 400 }
    );
  }

  const latestComment = await prisma.dailyPracticeComment.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (
    latestComment &&
    Date.now() - latestComment.createdAt.getTime() < COMMENT_COOLDOWN_MS
  ) {
    return NextResponse.json(
      {
        error: `Please wait ${COMMENT_COOLDOWN_SECONDS}s before posting again`,
      },
      { status: 429 }
    );
  }

  const comment = await prisma.dailyPracticeComment.create({
    data: {
      problemId: problem.id,
      userId: user.id,
      body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    comment: {
      ...comment,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    },
  });
}
