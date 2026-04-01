import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccessAdmin = await hasAdminAccess(session.user.email);
  if (!canAccessAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, shortName, emailDomain } = body;

  if (!name || !shortName || !emailDomain) {
    return NextResponse.json(
      { error: "Name, shortName, and emailDomain are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.university.findFirst({
    where: {
      OR: [{ shortName }, { emailDomain }],
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "University with this short name or email domain already exists" },
      { status: 409 }
    );
  }

  const university = await prisma.university.create({
    data: { name, shortName, emailDomain },
  });

  return NextResponse.json({ university }, { status: 201 });
}
