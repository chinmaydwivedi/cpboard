import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import { prisma } from "./prisma";

const baseAdapter = PrismaAdapter(prisma);

async function findUniversityByDomain(domain: string) {
  const exact = await prisma.university.findUnique({
    where: { emailDomain: domain },
  });
  if (exact) return exact;

  const parts = domain.split(".");
  for (let i = 1; i < parts.length; i++) {
    const suffix = parts.slice(i).join(".");
    const match = await prisma.university.findFirst({
      where: { emailDomain: { endsWith: suffix } },
    });
    if (match) return match;
  }
  return null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: {
    ...baseAdapter,
    async createUser(data: any) {
      const email = data.email as string;
      const domain = email.split("@")[1];

      const university = await findUniversityByDomain(domain);

      if (!university) {
        throw new Error("University not registered");
      }

      const existing = await prisma.user.findUnique({
        where: { email },
      });

      if (existing) return existing;

      const username = email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      return prisma.user.create({
        data: {
          email: data.email,
          name: data.name || username,
          username,
          universityId: university.id,
          emailVerified: data.emailVerified,
        },
      });
    },
    async deleteSession(sessionToken: string) {
      try {
        return await prisma.session.delete({ where: { sessionToken } });
      } catch {
        return null as any;
      }
    },
  },
  providers: [
    Nodemailer({
      server: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const domain = user.email.split("@")[1];
      if (!domain) return false;

      const university = await findUniversityByDomain(domain);

      if (!university) return "/login?error=UnknownUniversity";

      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl + "/login") || url === baseUrl + "/") {
        return baseUrl + "/onboarding";
      }
      if (url.startsWith("/")) return baseUrl + url;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl + "/onboarding";
    },
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { university: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          (session as any).university = {
            id: dbUser.university.id,
            name: dbUser.university.name,
            shortName: dbUser.university.shortName,
          };
          (session as any).role = dbUser.role;
          (session as any).username = dbUser.username;
        }
      }
      return session;
    },
  },
});
