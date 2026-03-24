import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Always resolves the signed-in user’s current username (avoids stale /u/{username} after renames). */
export default async function ProfileRedirectPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { username: true },
  });

  if (!user?.username) {
    redirect("/login");
  }

  redirect(`/u/${user.username}`);
}
