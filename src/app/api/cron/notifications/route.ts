import { NextRequest, NextResponse } from "next/server";
import { runNotificationCycle } from "@/lib/push-notifications";
import { acquireJobLease } from "@/lib/job-lease";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!(await acquireJobLease("notifications", 60_000))) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "already_running",
      });
    }
    const result = await runNotificationCycle();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Notification cron failed", error);
    return NextResponse.json(
      { error: "Notification cycle failed" },
      { status: 500 },
    );
  }
}
