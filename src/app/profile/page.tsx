import { redirect } from "next/navigation";

/** The profile page was merged into the dashboard; keep old links working. */
export default function ProfileRedirectPage() {
  redirect("/dashboard");
}
