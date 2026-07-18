import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

/** Always resolves the signed-in user’s current username (avoids stale /u/{username} after renames). */
export default async function ProfileRedirectPage() {
  const session = await getCurrentSession();
  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!session.username) {
    redirect("/login");
  }

  redirect(`/u/${session.username}`);
}
