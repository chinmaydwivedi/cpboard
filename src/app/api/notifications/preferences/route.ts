import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JsonRequestError, readJsonBody } from "@/lib/security";

const preferencesSchema = z
  .object({
    leaderAlerts: z.boolean().optional(),
    contestAlerts: z.boolean().optional(),
    contestLeadMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await readJsonBody(req, 2_048);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification settings" }, { status: 400 });
  }

  const preference = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json({
    success: true,
    preferences: {
      leaderAlerts: preference.leaderAlerts,
      contestAlerts: preference.contestAlerts,
      contestLeadMinutes: preference.contestLeadMinutes,
    },
  });
}
