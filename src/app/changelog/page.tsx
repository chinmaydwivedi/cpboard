import Image from "next/image";
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
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {latest.highlights.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-border/50 bg-background/55 p-3"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 font-mono text-[9px]"
                >
                  {item.label}
                </Badge>
                <span className="text-xs font-medium">{item.title}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" data-tour="changelog-history">
        {CHANGELOG_RELEASES.slice(1).map((release) => (
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
                <li key={item.id} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/70">
                    <Image
                      src={item.iconSrc || "/favicon.ico"}
                      alt=""
                      width={12}
                      height={12}
                      className="rounded-[3px]"
                    />
                  </div>
                  <div>
                    <span className="font-medium">{item.title}:</span>{" "}
                    <span className="text-muted-foreground">{item.description}</span>{" "}
                    <span className="text-[11px] text-muted-foreground/85 font-mono">
                      ({item.pageLabel})
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
