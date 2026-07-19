import "server-only";

import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@([^\s@]+)$/;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeEmailAddress(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function normalizeEmailDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  return DOMAIN_PATTERN.test(domain) ? domain : null;
}

export async function findUniversityByEmail(email: string) {
  const normalizedEmail = normalizeEmailAddress(email);
  if (!normalizedEmail) return null;
  const domain = normalizeEmailDomain(normalizedEmail.split("@")[1]);
  if (!domain) return null;

  const primary = await prisma.university.findUnique({
    where: { emailDomain: domain },
  });
  if (primary) return primary;

  const alias = await prisma.universityEmailDomain.findUnique({
    where: { domain },
    include: { university: true },
  });
  return alias?.university ?? null;
}
