import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_SIZE = 200 * 1024; // 200KB max for base64 data URL

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { avatar } = await req.json();
  if (!avatar || typeof avatar !== "string") {
    return NextResponse.json({ error: "No avatar data" }, { status: 400 });
  }

  if (!avatar.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
  }

  if (avatar.length > MAX_SIZE) {
    return NextResponse.json({ error: "Image too large. Max 200KB." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: avatar },
  });

  return NextResponse.json({ success: true, avatarUrl: avatar });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: null },
  });

  return NextResponse.json({ success: true });
}
