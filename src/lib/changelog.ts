export type ChangelogHighlight = {
  id: string;
  label: "NEW" | "IMPROVED" | "FIXED";
  emoji: string;
  title: string;
  description: string;
};

export type ChangelogRelease = {
  id: string;
  publishedOn: string;
  headline: string;
  summary: string;
  highlights: ChangelogHighlight[];
};

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    id: "2026-04-01-admin-analytics",
    publishedOn: "2026-04-01",
    headline: "New Updates to CPBoard",
    summary:
      "We shipped better privacy controls and stronger analytics with minimal UI changes.",
    highlights: [
      {
        id: "profile-privacy",
        label: "NEW",
        emoji: "🔐",
        title: "Private Profile Details",
        description:
          "Users must be signed in to open full profile details for other members.",
      },
      {
        id: "admin-analytics",
        label: "NEW",
        emoji: "📊",
        title: "Expanded Admin Analytics",
        description:
          "Track site visits, top pages, unique visitors, and logged-in visitor behavior.",
      },
      {
        id: "profile-visit-counter",
        label: "IMPROVED",
        emoji: "👀",
        title: "Profile Visit Counter",
        description:
          "Each profile now shows total visits so users can track profile reach.",
      },
    ],
  },
];

export const CURRENT_CHANGELOG = CHANGELOG_RELEASES[0];

export function getActiveReleaseId(): string {
  const explicit = process.env.NEXT_PUBLIC_WHATS_NEW_RELEASE?.trim();
  if (explicit) return explicit;

  const deploySha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (deploySha) return deploySha.slice(0, 12);

  return CURRENT_CHANGELOG.id;
}
