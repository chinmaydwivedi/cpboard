/**
 * ICPC information for Indian college teams, shown on /icpc.
 *
 * Season-specific facts (dates, fees, seats, sites) change every year. When a
 * new season is announced, update `ICPC_SEASON`, `ICPC_TIMELINE` and
 * `ICPC_REGIONALS`, and bump `verifiedOn`. Sources are listed in
 * `ICPC_SOURCES` so the next update knows where to look.
 */

export type IcpcTimelineItem = {
  id: string;
  title: string;
  /** Human-readable date for display. */
  when: string;
  /** ISO date (YYYY-MM-DD) the stage starts; null when not announced. */
  start: string | null;
  /** ISO date (YYYY-MM-DD) the stage ends; defaults to `start`. */
  end?: string;
  description: string;
};

export type IcpcRegional = {
  id: string;
  name: string;
  host: string;
  centres: string[];
  when: string;
  /** ISO date of the first contest day, used to order and flag past sites. */
  start: string;
  onsiteSlots: string;
  womenSlots: number;
  onsiteFee: string | null;
  selection: string;
  url: string;
};

export type IcpcLink = { label: string; href: string; note: string };

export const ICPC_SEASON = {
  label: "2026–27",
  verifiedOn: "2026-09-29",
  prelimFee: "₹1,500",
  onsiteFee: "₹4,500",
  maxIndianRegionals: 2,
} as const;

export const ICPC_TIMELINE: IcpcTimelineItem[] = [
  {
    id: "team",
    title: "Form a team and find a coach",
    when: "Before registration",
    start: null,
    description:
      "Three students from the same institution, plus a faculty member who agrees to act as coach. The coach creates the team on icpc.global.",
  },
  {
    id: "registration",
    title: "Register on icpc.global",
    when: "Closed 25 Sep 2026",
    start: "2026-09-25",
    description:
      "Register for up to two Indian regional sites, pay the preliminary fee, and submit one undertaking per team.",
  },
  {
    id: "prelim",
    title: "Online preliminary round",
    when: "3 Oct 2026 · 1:30–4:30 PM IST",
    start: "2026-10-03",
    description:
      "One common, proctored online contest for all four Indian regionals, hosted on CodeChef in Safe Exam Browser. Each site builds its own rank list from it.",
  },
  {
    id: "shortlist",
    title: "Onsite shortlists announced",
    when: "Mid-October 2026",
    start: "2026-10-15",
    description:
      "Each regional publishes the teams invited onsite, using its own mix of overall rank and per-institute quotas.",
  },
  {
    id: "regionals",
    title: "Onsite regionals",
    when: "10 Dec 2026 – 2 Jan 2027",
    start: "2026-12-10",
    end: "2027-01-02",
    description:
      "Five-hour team contests at Chennai, Kanpur, Mathura and Amritapuri. Regional champions qualify for the World Finals.",
  },
  {
    id: "awc",
    title: "Asia West Continent Championship",
    when: "20–21 Mar 2027 (announced)",
    start: "2027-03-20",
    end: "2027-03-21",
    description:
      "Top teams from each regional compete for the remaining World Finals slots. Team composition cannot change after the regional.",
  },
  {
    id: "wf",
    title: "ICPC World Finals",
    when: "Date and venue set by ICPC",
    start: null,
    description:
      "The world championship. A student can compete in at most two World Finals.",
  },
];

export const ICPC_REGIONALS: IcpcRegional[] = [
  {
    id: "chennai",
    name: "Chennai",
    host: "SRM Institute of Science and Technology",
    centres: ["Kattankulathur, Chennai"],
    when: "10–11 Dec 2026",
    start: "2026-12-10",
    onsiteSlots: "120",
    womenSlots: 4,
    onsiteFee: "₹4,500",
    selection:
      "Teams with zero solves are dropped, the top 20 go through on rank, and the rest of the seats are filled institute by institute.",
    url: "https://icpcchennai.vercel.app/",
  },
  {
    id: "kanpur",
    name: "Kanpur",
    host: "CSJM University, Kanpur",
    centres: ["Kanpur", "Gandhinagar", "Pune"],
    when: "22–23 Dec 2026",
    start: "2026-12-22",
    onsiteSlots: "240+",
    womenSlots: 5,
    onsiteFee: "₹4,500",
    selection:
      "Based on preliminary performance, following the published selection-criteria PDF.",
    url: "https://kanpur.indiaicpc.in/",
  },
  {
    id: "mathura",
    name: "Mathura",
    host: "GLA University",
    centres: ["Mathura"],
    when: "27–28 Dec 2026",
    start: "2026-12-27",
    onsiteSlots: "100",
    womenSlots: 5,
    onsiteFee: "₹4,500",
    selection:
      "Top 15 teams qualify directly, then institute toppers are ranked by preliminary performance to fill the rest.",
    url: "https://mathuraicpc.in/",
  },
  {
    id: "amritapuri",
    name: "Amritapuri",
    host: "Amrita Vishwa Vidyapeetham",
    centres: ["Kollam", "Bengaluru", "Coimbatore", "Mysuru"],
    when: "1–2 Jan 2027",
    start: "2027-01-01",
    onsiteSlots: "380",
    womenSlots: 20,
    onsiteFee: null,
    selection:
      "Shortlisted on preliminary performance using the published onsite criteria; teams are notified by 15 Oct 2026.",
    url: "https://amritaicpc.in/",
  },
];

export const ICPC_ELIGIBILITY = [
  "All three contestants are enrolled in a degree programme at the same institution.",
  "Each contestant began post-secondary studies in 2022 or later, or was born in 2003 or later (2026–27 rule).",
  "A contestant can usually compete in at most five regional contest years, and in at most two World Finals.",
  "A faculty coach from your institution registers and is responsible for the team.",
];

export const ICPC_FORMAT = [
  {
    title: "Three people, one computer",
    body: "The whole team shares a single machine, so deciding who types, who thinks and who debugs on paper matters as much as raw skill.",
  },
  {
    title: "Five hours, roughly 8–12 problems",
    body: "Onsite regionals usually run five hours. The preliminary is shorter, about three hours online.",
  },
  {
    title: "Solved first, then penalty time",
    body: "Teams are ranked by problems solved. Ties are broken by penalty: the minute each problem was accepted, plus 20 minutes for every rejected attempt on it.",
  },
  {
    title: "Frozen scoreboard",
    body: "The standings stop updating for the final hour, so you cannot tell exactly where you finished until the results are revealed.",
  },
  {
    title: "A 25-page team notebook",
    body: "Onsite, you can bring a printed reference of up to 25 pages: templates, algorithms, and formulas you trust. No internet.",
  },
  {
    title: "C++, Java or Python",
    body: "Most teams use C++ for speed and the STL. Time limits are rarely tuned for Python, so keep it for quick scripts only.",
  },
];

export const ICPC_ROADMAP = [
  {
    phase: "1st year",
    title: "Foundations",
    target: "Codeforces 1200–1400",
    points: [
      "Learn C++ and the STL properly: vectors, sets, maps, sorting, and fast I/O.",
      "Do Codeforces Div. 3 and Div. 2 rounds live, every week you can.",
      "Work through the CSES problem set for sorting, searching and basic DP.",
    ],
  },
  {
    phase: "2nd year",
    title: "Algorithms and a team",
    target: "Codeforces 1600–1900",
    points: [
      "Cover graphs, DP, number theory, segment trees and binary search on answers.",
      "Pick teammates whose strengths differ from yours: one math-heavy, one strong implementer.",
      "Start weekly five-hour virtual contests on old ICPC sets in Codeforces Gym.",
    ],
  },
  {
    phase: "Season",
    title: "Contest mode",
    target: "Sep–Dec",
    points: [
      "Practise the preliminary on CodeChef in Safe Exam Browser (it does not run on Linux).",
      "Build and print your notebook; KACTL is a good starting point.",
      "Upsolve every problem you missed, and agree on who reads which problems first.",
    ],
  },
];

export const ICPC_LINKS: { official: IcpcLink[]; practice: IcpcLink[] } = {
  official: [
    {
      label: "icpc.global",
      href: "https://icpc.global/",
      note: "Team registration, official rules and World Finals.",
    },
    {
      label: "ICPC India",
      href: "https://indiaicpc.in/",
      note: "Every Indian regional, dates and fees on one page.",
    },
    {
      label: "Regional rules",
      href: "https://icpc.global/regionals/rules",
      note: "The official eligibility and contest rules.",
    },
    {
      label: "CodeChef",
      href: "https://www.codechef.com/",
      note: "Hosts the Indian preliminary round.",
    },
  ],
  practice: [
    {
      label: "Codeforces Gym",
      href: "https://codeforces.com/gyms",
      note: "Past ICPC regionals and finals to run as virtual contests.",
    },
    {
      label: "CSES Problem Set",
      href: "https://cses.fi/problemset/",
      note: "A classic problem set covering the core syllabus.",
    },
    {
      label: "CP-Algorithms",
      href: "https://cp-algorithms.com/",
      note: "Clear write-ups of the standard algorithms.",
    },
    {
      label: "KACTL",
      href: "https://github.com/kth-competitive-programming/kactl",
      note: "A proven team notebook to base yours on.",
    },
    {
      label: "Universal Cup",
      href: "https://ucup.ac/",
      note: "Weekly team contests on strong regional sets.",
    },
    {
      label: "Past Indian ICPC contests",
      href: "https://github.com/m-e-r-l-i-n/icpc-india",
      note: "Links to earlier Indian preliminaries and regionals.",
    },
  ],
};

export const ICPC_FAQ = [
  {
    q: "Can first-year students take part?",
    a: "Yes. There is no minimum year of study. Many strong teams include a first- or second-year student who grows with the team.",
  },
  {
    q: "Can teammates be from different colleges?",
    a: "No. All three contestants must be enrolled at the same institution.",
  },
  {
    q: "Do we really need a coach?",
    a: "Yes. A faculty member from your institution has to register the team on icpc.global. Ask a professor early, because registration closes in September.",
  },
  {
    q: "How many regionals can we try?",
    a: `Up to ${ICPC_SEASON.maxIndianRegionals} Indian regional sites, each registered separately. All of them share the same online preliminary.`,
  },
  {
    q: "What does it cost?",
    a: `The preliminary is ${ICPC_SEASON.prelimFee} per team. Teams invited onsite pay about ${ICPC_SEASON.onsiteFee} per team at Chennai, Kanpur and Mathura; check Amritapuri's site for its fee.`,
  },
  {
    q: "Do we need to be top 20 in India to go onsite?",
    a: "No. Several regionals (Chennai and Mathura this season) fill seats institute by institute after the top teams, so the best team from your college has a real chance even without a top national rank.",
  },
  {
    q: "Are there seats for all-female teams?",
    a: "Yes. Every Indian regional reserves onsite slots for all-female teams this season.",
  },
];

export const ICPC_SOURCES = [
  { label: "ICPC India", href: "https://indiaicpc.in/" },
  { label: "Amritapuri regional", href: "https://amritaicpc.in/" },
  { label: "Kanpur regional", href: "https://kanpur.indiaicpc.in/" },
  { label: "A guide to Indian ICPC 2026", href: "https://aryanc403.com/blog/india-icpc-2026/" },
];

export type IcpcStageStatus = "done" | "live" | "next" | "upcoming" | "undated";

/** Labels each timeline stage relative to `todayIso` (YYYY-MM-DD, UTC). */
export function getTimelineStatuses(
  items: IcpcTimelineItem[],
  todayIso: string,
): Record<string, IcpcStageStatus> {
  const statuses: Record<string, IcpcStageStatus> = {};
  let nextAssigned = false;
  for (const item of items) {
    if (!item.start) {
      statuses[item.id] = "undated";
      continue;
    }
    const end = item.end ?? item.start;
    if (end < todayIso) {
      statuses[item.id] = "done";
    } else if (item.start <= todayIso) {
      statuses[item.id] = "live";
      nextAssigned = true;
    } else if (!nextAssigned) {
      statuses[item.id] = "next";
      nextAssigned = true;
    } else {
      statuses[item.id] = "upcoming";
    }
  }
  return statuses;
}
