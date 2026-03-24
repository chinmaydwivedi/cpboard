import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, username: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { username, name } = body as { username?: string; name?: string };

  const updates: Record<string, string> = {};

  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      return NextResponse.json({ error: "Name must be 1-50 characters" }, { status: 400 });
    }
    updates.name = trimmed;
  }

  if (username !== undefined) {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (clean.length < 3 || clean.length > 30) {
      return NextResponse.json({ error: "Username must be 3-30 characters (letters, numbers, _ , -)" }, { status: 400 });
    }
    if (clean !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username: clean } });
      if (existing) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
      updates.username = clean;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "No changes" });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: { username: true, name: true },
  });

  return NextResponse.json(updated);
}
