import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }

  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { university: true },
  });

  if (!user) redirect("/login");

  if (user.onboardingComplete) redirect("/dashboard");

  return (
    <OnboardingClient
      defaultUsername={user.username}
      defaultName={user.name || ""}
      universityName={user.university.name}
    />
  );
}
