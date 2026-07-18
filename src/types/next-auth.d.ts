import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    university?: {
      id: string;
      name: string;
      shortName: string;
    };
    role?: Role;
    username?: string;
  }
}
