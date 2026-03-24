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
        host: "smtp-relay.brevo.com",
        port: 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      maxAge: 60 * 60, // 1 hour token validity
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const nodemailer = await import("nodemailer");
        const transport = nodemailer.createTransport(provider.server as any);
        console.log("[EMAIL] Sending to:", email, "from:", provider.from);
        console.log("[EMAIL] SMTP host:", (provider.server as any)?.host);
        try {
          const result = await transport.sendMail({
            to: email,
            from: provider.from,
            subject: "Sign in to CPBoard",
            text: `Sign in to CPBoard\n\nClick the link below to sign in:\n${url}\n\nIf you did not request this, you can ignore this email.\n`,
            html: `
              <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;padding:32px 24px;background:#0a0a0f;color:#e5e5e5;border-radius:12px;">
                <h1 style="font-size:20px;font-weight:bold;margin:0 0 8px 0;color:#ffffff;">CPBoard</h1>
                <p style="font-size:14px;color:#999;margin:0 0 24px 0;">University Competitive Programming Leaderboard</p>
                <p style="font-size:14px;line-height:1.6;margin:0 0 24px 0;">Click the button below to sign in to your account. This link expires in 24 hours.</p>
                <a href="${url}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Sign In</a>
                <p style="font-size:12px;color:#666;margin:24px 0 0 0;">If you didn't request this email, you can safely ignore it.</p>
              </div>
            `,
          });
          console.log("[EMAIL] Response:", result.response);
          console.log("[EMAIL] Accepted:", result.accepted);
          console.log("[EMAIL] Rejected:", result.rejected);
          console.log("[EMAIL] MessageId:", result.messageId);
          const failed = result.rejected?.filter(Boolean);
          if (failed?.length) {
            throw new Error(`Email could not be sent to ${failed.join(", ")}`);
          }
        } catch (err: any) {
          console.error("[EMAIL] SEND FAILED:", err.message);
          throw err;
        }
      },
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
