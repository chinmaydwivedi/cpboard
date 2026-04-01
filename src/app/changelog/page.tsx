import { CHANGELOG_RELEASES } from "@/lib/changelog";
import { Badge } from "@/components/ui/badge";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChangelogPage() {
  const latest = CHANGELOG_RELEASES[0];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-7" data-tour="changelog-header">
        <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Product updates and improvements in one place.
        </p>
      </div>

      <section
        className="rounded-lg border border-primary/25 bg-linear-to-br from-primary/10 via-card to-card p-5 mb-6"
        data-tour="changelog-latest"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Badge className="bg-primary text-primary-foreground">
            Latest Release
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">
            {formatDate(latest.publishedOn)}
          </span>
        </div>
        <h2 className="text-xl font-semibold">{latest.headline}</h2>
        <p className="text-sm text-muted-foreground mt-1.5">{latest.summary}</p>
      </section>

      <section className="space-y-4" data-tour="changelog-history">
        {CHANGELOG_RELEASES.map((release) => (
          <article
            key={release.id}
            className="rounded-lg border border-border/60 bg-card/70 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold">{release.headline}</h3>
              <span className="text-xs text-muted-foreground font-mono">
                {formatDate(release.publishedOn)}
              </span>
            </div>
            <ul className="space-y-2">
              {release.highlights.map((item) => (
                <li key={item.id} className="text-sm">
                  <span className="mr-2">{item.emoji}</span>
                  <span className="font-medium">{item.title}:</span>{" "}
                  <span className="text-muted-foreground">{item.description}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
