import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Sign in",
};

// Auth.js and the sign-in route send people back here with ?error=<code>.
const SIGN_IN_ERRORS = new Map([
  ["UnknownUniversity", "Your university is not registered yet. Contact the admin to add it."],
  ["RateLimited", "Too many sign-in attempts. Please wait and try again."],
  ["Verification", "That sign-in link has expired or was already used. Request a new one below."],
]);
const DEFAULT_SIGN_IN_ERROR = "Sign-in failed. Please try again.";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  let session = null;
  try {
    session = await getCurrentSession();
  } catch {
    // Auth unavailable: show the form instead of bouncing to the dashboard.
  }

  if (session?.user?.email) redirect("/dashboard");

  const { error } = await searchParams;
  const initialError = error
    ? SIGN_IN_ERRORS.get(String(error)) ?? DEFAULT_SIGN_IN_ERROR
    : "";

  return <LoginClient initialError={initialError} />;
}
