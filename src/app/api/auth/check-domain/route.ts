import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAllowlistedAdminEmail } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ valid: false, error: "Invalid email" });
  }

  if (isAllowlistedAdminEmail(email)) {
    return NextResponse.json({ valid: true, university: "Admin allowlist" });
  }

  const domain = email.split("@")[1];

  const exact = await prisma.university.findUnique({
    where: { emailDomain: domain },
  });
  if (exact) {
    return NextResponse.json({ valid: true, university: exact.name });
  }

  const parts = domain.split(".");
  for (let i = 1; i < parts.length; i++) {
    const suffix = parts.slice(i).join(".");
    const match = await prisma.university.findFirst({
      where: { emailDomain: { endsWith: suffix } },
    });
    if (match) {
      return NextResponse.json({ valid: true, university: match.name });
    }
  }

  return NextResponse.json({ valid: false, error: "University not registered" });
}
