import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  IndianRupee,
  Laptop,
  LayoutDashboard,
  MapPin,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ICPC_ELIGIBILITY,
  ICPC_FAQ,
  ICPC_FORMAT,
  ICPC_LINKS,
  ICPC_REGIONALS,
  ICPC_ROADMAP,
  ICPC_SEASON,
  ICPC_SOURCES,
  ICPC_TIMELINE,
  getTimelineStatuses,
  type IcpcStageStatus,
} from "@/lib/icpc";

export const metadata: Metadata = {
  title: "ICPC Guide",
  description:
    "Everything an Indian college student needs to know about ICPC: eligibility, the preliminary round, Indian regionals, the road to the World Finals, and how to prepare.",
};

const SECTIONS = [
  { id: "about", label: "What is ICPC" },
  { id: "road", label: "Road to World Finals" },
  { id: "regionals", label: "Indian regionals" },
  { id: "format", label: "Contest format" },
  { id: "eligibility", label: "Eligibility" },
  { id: "prepare", label: "How to prepare" },
  { id: "resources", label: "Resources" },
  { id: "faq", label: "FAQ" },
];

const KEY_FACTS = [
  { label: "Team", value: "3 + coach", icon: Users },
  { label: "Computers", value: "1 per team", icon: Laptop },
  { label: "Onsite contest", value: "5 hours", icon: Timer },
  { label: "Indian regionals", value: `${ICPC_REGIONALS.length} sites`, icon: MapPin },
];

const CPBOARD_TOOLS = [
  {
    href: "/contests",
    label: "Contest calendar",
    body: "Never miss a Codeforces, CodeChef or AtCoder round in the run-up to the prelims.",
    icon: CalendarDays,
  },
  {
    href: "/cp-rankings",
    label: "CP Rankings",
    body: "See where your Codeforces rating stands against students from every college.",
    icon: Zap,
  },
  {
    href: "/leaderboard",
    label: "Find teammates",
    body: "Filter the leaderboard by your university to spot the most active solvers.",
    icon: Users,
  },
  {
    href: "/dashboard",
    label: "Your dashboard",
    body: "Track consistency on the heatmap and practise the topics you solve least.",
    icon: LayoutDashboard,
  },
];

const STATUS_LABEL: Partial<Record<IcpcStageStatus, string>> = {
  done: "Done",
  live: "Happening now",
  next: "Up next",
};

function formatVerifiedDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function prelimCalendarUrl() {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "ICPC India Preliminary Round",
    // 3 Oct 2026, 1:30–4:30 PM IST.
    dates: "20261003T080000Z/20261003T110000Z",
    details:
      "Common online preliminary for the Amritapuri, Chennai, Kanpur and Mathura regionals, on CodeChef in Safe Exam Browser.\nhttps://indiaicpc.in/",
    location: "https://www.codechef.com/",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function SectionHeading({
  index,
  title,
  description,
}: {
  index: number;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-primary">
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {description && (
        <p className="mt-1 max-w-2xl pl-8 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

function ExternalCardLink({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start justify-between gap-3 border-b border-border/40 px-4 py-3 transition-colors last:border-b-0 hover:bg-secondary/20"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium transition-colors group-hover:text-primary">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>
      </span>
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
    </a>
  );
}

export default function IcpcPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const statuses = getTimelineStatuses(ICPC_TIMELINE, todayIso);
  const nextStage =
    ICPC_TIMELINE.find((item) => statuses[item.id] === "live") ??
    ICPC_TIMELINE.find((item) => statuses[item.id] === "next");

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <PageHeader
        tour="icpc-header"
        eyebrow="For Indian college teams"
        title="ICPC, explained"
        description="The International Collegiate Programming Contest is the biggest team contest for college programmers. Here is how it works in India, how to qualify, and how to get ready."
        actions={
          <a
            href="https://icpc.global/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 px-3 text-xs font-medium transition-colors hover:bg-secondary"
          >
            icpc.global <ArrowUpRight className="size-3.5" />
          </a>
        }
      />

      <nav
        aria-label="On this page"
        className="-mx-5 mb-6 flex gap-1.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex h-7 shrink-0 items-center rounded-md border border-border/60 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {section.label}
          </a>
        ))}
      </nav>

      {nextStage && (
        <section
          className="relative mb-10 overflow-hidden rounded-lg border border-primary/25 bg-linear-to-br from-primary/10 via-card to-card p-5"
          data-tour="icpc-next"
        >
          <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">
                  {statuses[nextStage.id] === "live" ? "Happening now" : "Up next"}
                </Badge>
                <span className="font-mono text-[11px] text-muted-foreground">
                  Season {ICPC_SEASON.label}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{nextStage.title}</h2>
              <p className="mt-1 font-mono text-sm text-foreground/90">{nextStage.when}</p>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                {nextStage.description}
              </p>
            </div>
            {nextStage.id === "prelim" && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <a
                  href={prelimCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 text-xs font-medium transition-colors hover:bg-secondary"
                >
                  <CalendarPlus className="size-3.5" /> Add to calendar
                </a>
                <a
                  href="https://www.codechef.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Practise on CodeChef <ExternalLink className="size-3" />
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="space-y-14">
        <section id="about" className="scroll-mt-20">
          <SectionHeading
            index={1}
            title="What is ICPC"
            description="Teams of three students from the same college solve algorithmic problems against the clock, sharing one computer. It runs in over 100 countries, and the best teams from each region meet at the World Finals."
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {KEY_FACTS.map((fact) => {
              const Icon = fact.icon;
              return (
                <div key={fact.label} className="rounded-lg border border-border/60 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {fact.label}
                    </span>
                  </div>
                  <p className="font-mono text-lg font-bold">{fact.value}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="road" className="scroll-mt-20" data-tour="icpc-road">
          <SectionHeading
            index={2}
            title="Road to the World Finals"
            description="Indian teams go through one shared online preliminary, then an onsite regional, then the Asia West Continent Championship."
          />
          <ol className="relative rounded-lg border border-border/60">
            {ICPC_TIMELINE.map((item, index) => {
              const status = statuses[item.id];
              const highlighted = status === "next" || status === "live";
              return (
                <li
                  key={item.id}
                  className={cn(
                    "relative grid grid-cols-[28px_1fr] gap-3 border-b border-border/40 p-4 last:border-b-0 sm:grid-cols-[28px_1fr_auto]",
                    highlighted && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border font-mono text-[11px] font-semibold",
                      status === "done" && "border-border bg-secondary text-muted-foreground",
                      highlighted && "border-primary/50 bg-primary/15 text-primary",
                      (status === "upcoming" || status === "undated") &&
                        "border-border/80 text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {status === "done" ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3
                        className={cn(
                          "text-sm font-semibold",
                          status === "done" && "text-muted-foreground",
                        )}
                      >
                        {item.title}
                      </h3>
                      {STATUS_LABEL[status] && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4 px-1.5 font-mono text-[9px]",
                            highlighted ? "border-primary/40 text-primary" : "text-muted-foreground",
                          )}
                        >
                          {STATUS_LABEL[status]}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <p className="col-start-2 font-mono text-[11px] text-foreground/80 sm:col-start-3 sm:text-right">
                    {item.when}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <section id="regionals" className="scroll-mt-20" data-tour="icpc-regionals">
          <SectionHeading
            index={3}
            title={`Indian regionals ${ICPC_SEASON.label}`}
            description={`All four sites share the preliminary on CodeChef. You can register for up to ${ICPC_SEASON.maxIndianRegionals}, and each site selects its onsite teams from the preliminary results.`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {ICPC_REGIONALS.map((regional) => {
              const finished = regional.start < todayIso;
              return (
                <article
                  key={regional.id}
                  className="flex flex-col rounded-lg border border-border/60 p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Asia West
                      </p>
                      <h3 className="mt-0.5 text-base font-semibold">{regional.name}</h3>
                      <p className="text-xs text-muted-foreground">{regional.host}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-1 font-mono text-[11px]",
                        finished
                          ? "border-border/60 text-muted-foreground"
                          : "border-primary/30 bg-primary/5 text-primary",
                      )}
                    >
                      {finished ? "Finished" : regional.when}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {regional.centres.map((centre) => (
                      <span
                        key={centre}
                        className="inline-flex items-center gap-1 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        <MapPin className="size-2.5" /> {centre}
                      </span>
                    ))}
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    <div>
                      <dt className="text-[10px] text-muted-foreground">Onsite slots</dt>
                      <dd className="font-mono text-sm font-bold">{regional.onsiteSlots}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">All-female slots</dt>
                      <dd className="font-mono text-sm font-bold">{regional.womenSlots}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">Onsite fee</dt>
                      <dd className="font-mono text-sm font-bold">{regional.onsiteFee ?? "See site"}</dd>
                    </div>
                  </dl>

                  <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {regional.selection}
                  </p>

                  <a
                    href={regional.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex w-fit items-center gap-1 border-t border-border/30 pt-3 text-xs font-medium text-primary hover:underline"
                  >
                    Regional website <ExternalLink className="size-3" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section id="format" className="scroll-mt-20" data-tour="icpc-format">
          <SectionHeading
            index={4}
            title="How the contest works"
            description="ICPC rewards the whole team: speed on easy problems, accuracy under pressure, and smart use of a single keyboard."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ICPC_FORMAT.map((item) => (
              <div key={item.title} className="rounded-lg border border-border/60 p-4">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="eligibility" className="scroll-mt-20">
          <SectionHeading index={5} title="Who can compete" />
          <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
            <ul className="rounded-lg border border-border/60">
              {ICPC_ELIGIBILITY.map((rule) => (
                <li
                  key={rule}
                  className="flex gap-3 border-b border-border/40 p-4 text-sm last:border-b-0"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <GraduationCap className="size-3" />
                  </span>
                  <span className="leading-relaxed">{rule}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <IndianRupee className="size-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">Fees this season</span>
              </div>
              <dl className="space-y-3">
                <div>
                  <dt className="text-[10px] text-muted-foreground">Preliminary, per team</dt>
                  <dd className="font-mono text-xl font-bold">{ICPC_SEASON.prelimFee}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-muted-foreground">Onsite, per qualifying team</dt>
                  <dd className="font-mono text-xl font-bold">{ICPC_SEASON.onsiteFee}</dd>
                  <dd className="mt-0.5 text-[10px] text-muted-foreground">
                    Chennai, Kanpur and Mathura
                  </dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-border/30 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                Final eligibility is decided by the official ICPC regional rules.
              </p>
            </div>
          </div>
        </section>

        <section id="prepare" className="scroll-mt-20" data-tour="icpc-prepare">
          <SectionHeading
            index={6}
            title="How to prepare"
            description="A realistic plan if you start in your first or second year. Ratings are rough guides, not cut-offs."
          />
          <div className="grid gap-3 md:grid-cols-3">
            {ICPC_ROADMAP.map((step) => (
              <div key={step.phase} className="flex flex-col rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                    {step.phase}
                  </span>
                  <span className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {step.target}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
                <ul className="mt-2 space-y-2">
                  {step.points.map((point) => (
                    <li key={point} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/70" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="size-3.5 text-primary" />
              <p className="text-sm font-medium">Use CPBoard to get there</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {CPBOARD_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group rounded-md border border-border/50 bg-background/55 p-3 transition-colors hover:border-primary/30"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium transition-colors group-hover:text-primary">
                      <Icon className="size-3.5" /> {tool.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                      {tool.body}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section id="resources" className="scroll-mt-20">
          <SectionHeading index={7} title="Resources" />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">Official</p>
              <div className="overflow-hidden rounded-lg border border-border/60">
                {ICPC_LINKS.official.map((link) => (
                  <ExternalCardLink key={link.href} {...link} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">Practice</p>
              <div className="overflow-hidden rounded-lg border border-border/60">
                {ICPC_LINKS.practice.map((link) => (
                  <ExternalCardLink key={link.href} {...link} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20">
          <SectionHeading index={8} title="Frequently asked" />
          <div className="overflow-hidden rounded-lg border border-border/60">
            {ICPC_FAQ.map((item) => (
              <details
                key={item.q}
                className="group border-b border-border/40 last:border-b-0 open:bg-secondary/15"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-12 flex flex-col gap-2 border-t border-border/40 pt-5 text-[11px] text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <p className="flex items-center gap-1.5">
          <BookOpen className="size-3.5 shrink-0" />
          Season details checked on {formatVerifiedDate(ICPC_SEASON.verifiedOn)}. Rules change every
          year, so confirm on the official sites.
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          {ICPC_SOURCES.map((source) => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {source.label}
            </a>
          ))}
        </p>
      </div>
    </div>
  );
}
