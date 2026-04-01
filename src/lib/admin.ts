import { prisma } from "@/lib/prisma";

function parseAdminEmailAllowlist(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlistedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = parseAdminEmailAllowlist(process.env.ADMIN_ALLOWLIST_EMAILS);
  return allowlist.includes(email.toLowerCase());
}

export async function hasAdminAccess(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAllowlistedAdminEmail(email)) return true;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });

  return user?.role === "ADMIN";
}
