import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  let session;
  try {
    session = await getCurrentSession();
  } catch {
    redirect("/login");
  }

  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      username: true,
      name: true,
      onboardingComplete: true,
      ownershipVerificationRequired: true,
      university: { select: { name: true } },
      platformProfiles: {
        select: {
          platform: true,
          handle: true,
          verified: true,
          verifiedAt: true,
          ownershipKey: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  if (user.onboardingComplete) redirect("/dashboard");

  return (
    <OnboardingClient
      defaultUsername={user.username}
      defaultName={user.name || ""}
      universityName={user.university.name}
      ownershipVerificationRequired={user.ownershipVerificationRequired}
      initialProfiles={user.platformProfiles.map((profile) => ({
        platform: profile.platform,
        handle: profile.handle,
        ownershipVerified: Boolean(
          profile.verified && profile.verifiedAt && profile.ownershipKey,
        ),
      }))}
    />
  );
}
