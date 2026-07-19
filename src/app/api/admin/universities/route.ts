import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { z } from "zod";
import { normalizeEmailDomain } from "@/lib/university-domain";
import { JsonRequestError, readJsonBody } from "@/lib/security";

const universitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  shortName: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/),
  emailDomain: z.string().trim().min(4).max(253),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccessAdmin = await hasAdminAccess(session.user.email);
  if (!canAccessAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await readJsonBody(req, 4_096);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const parsed = universitySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid name, short name, and email domain" },
      { status: 400 }
    );
  }
  const name = parsed.data.name;
  const shortName = parsed.data.shortName.toUpperCase();
  const emailDomain = normalizeEmailDomain(parsed.data.emailDomain);
  if (!emailDomain) {
    return NextResponse.json({ error: "Enter a valid email domain" }, { status: 400 });
  }

  const [existing, existingAlias] = await Promise.all([
    prisma.university.findFirst({
      where: { OR: [{ shortName }, { emailDomain }] },
    }),
    prisma.universityEmailDomain.findUnique({ where: { domain: emailDomain } }),
  ]);

  if (existing || existingAlias) {
    return NextResponse.json(
      { error: "University with this short name or email domain already exists" },
      { status: 409 }
    );
  }

  const university = await prisma.university.create({
    data: { name, shortName, emailDomain },
  });
  revalidateTag(CACHE_TAGS.universities, { expire: 0 });
  revalidateTag(CACHE_TAGS.landingStats, { expire: 0 });

  return NextResponse.json({ university }, { status: 201 });
}
