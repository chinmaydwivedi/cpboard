"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Zap,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  User,
  CircleHelp,
  BookText,
  Sparkles,
  RefreshCw,
  Shield,
  CalendarDays,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tourIdForPathname } from "@/components/walkthrough/tours";
import { runWalkthrough } from "@/components/walkthrough/run-walkthrough";
import { openWhatsNewModal } from "@/components/whats-new";
import { toast } from "sonner";

const links = [
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/cp-rankings", label: "CP Rankings", icon: Zap },
  { href: "/contests", label: "Contests", icon: CalendarDays },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function Navbar({
  user,
}: {
  user?: { name?: string | null; username?: string; isAdmin?: boolean; isPotdAdmin?: boolean } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const pageTourId = tourIdForPathname(pathname);

  const handleSyncAll = async () => {
    if (!user || syncingAll) return;
    setSyncingAll(true);
    const toastId = toast.loading("Syncing all your platforms... go solve another question meanwhile 😄");

    try {
      const res = await fetch("/api/platforms/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to sync all platforms", { id: toastId });
        return;
      }

      if (data.failed > 0) {
        const failedPlatforms = (data.results || [])
          .filter((r: { success: boolean; platform: string }) => !r.success)
          .map((r: { platform: string }) => r.platform)
          .join(", ");
        toast.warning(`Synced ${data.successful}/${data.total} platforms`, {
          id: toastId,
          description: failedPlatforms ? `Failed: ${failedPlatforms}` : "Some platforms failed to sync.",
        });
      } else {
        toast.success(`Synced all ${data.total} platforms successfully`, {
          id: toastId,
          description: "Go solve another question while the leaderboard catches up.",
        });
      }
      router.refresh();
    } catch {
      toast.error("Network error while syncing", { id: toastId });
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <header data-tour="site-header" className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <nav
        className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8"
        aria-label="Primary navigation"
      >
        <Link href="/" className="flex items-center">
          <span className="font-semibold text-[15px] tracking-tight">CPBoard</span>
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                  active ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="hidden size-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 sm:inline-flex"
              aria-label="Sync all linked platforms"
              title="Sync all linked platforms"
            >
              <RefreshCw className={`h-4 w-4 ${syncingAll ? "animate-spin" : ""}`} />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="hidden size-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline-flex"
              aria-label="Help and updates"
            >
              <CircleHelp className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              {pageTourId && (
                <DropdownMenuItem
                  onClick={() => {
                    void runWalkthrough(pageTourId).then((ok) => {
                      if (!ok) {
                        toast.message("Tour unavailable", {
                          description: "This page has no tour targets yet.",
                        });
                      }
                    });
                  }}
                >
                  Tour this page
                </DropdownMenuItem>
              )}
              {pageTourId && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => openWhatsNewModal()}>
                <Sparkles className="h-3.5 w-3.5" /> What&apos;s new
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/changelog")}>
                <BookText className="h-3.5 w-3.5" /> Changelog
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {user ? (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger
                aria-label={`${dropdownOpen ? "Close" : "Open"} account menu for ${user.name || user.username || "your account"}`}
                className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-[13px] font-medium transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary">
                  {(user.name || user.username || "?")[0].toUpperCase()}
                </div>
                <span className="hidden max-w-28 truncate sm:inline">
                  {user.name || user.username}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => router.push("/profile")}
                  className="gap-2 px-2 py-2 text-[13px]"
                >
                  <User className="h-3.5 w-3.5" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard")}
                  className="gap-2 px-2 py-2 text-[13px]"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                </DropdownMenuItem>
                {user.isAdmin && (
                  <DropdownMenuItem
                    onClick={() => router.push("/admin")}
                    className="gap-2 px-2 py-2 text-[13px]"
                  >
                    <Shield className="h-3.5 w-3.5" /> Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="gap-2 px-2 py-2 text-[13px]"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login" className="rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Sign In
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>
      {mobileOpen && (
        <div
          id="mobile-navigation"
          className="border-t border-border/40 bg-background px-5 py-2 lg:hidden"
        >
          {user && (
            <button
              type="button"
              disabled={syncingAll}
              onClick={() => {
                setMobileOpen(false);
                void handleSyncAll();
              }}
              className="flex w-full items-center gap-2 px-2 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? "animate-spin" : ""}`} /> Sync all platforms
            </button>
          )}
          {pageTourId && (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                void runWalkthrough(pageTourId).then((ok) => {
                  if (!ok) {
                    toast.message("Tour unavailable", {
                      description: "This page has no tour targets yet.",
                    });
                  }
                });
              }}
              className="flex items-center gap-2 w-full px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <CircleHelp className="h-3.5 w-3.5" /> Tour this page
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              openWhatsNewModal();
            }}
            className="flex items-center gap-2 w-full px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> What&apos;s new
          </button>
          <Link
            href="/changelog"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookText className="h-3.5 w-3.5" /> Changelog
          </Link>
          {links.map((link) => {
            const Icon = link.icon;
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
          {user && (
            <>
              <div className="border-t border-border/40 my-1" />
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <User className="h-3.5 w-3.5" /> Profile
              </Link>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Shield className="h-3.5 w-3.5" /> Admin
                </Link>
              )}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-2 w-full px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
