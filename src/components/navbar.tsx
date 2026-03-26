"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Trophy, Zap, LayoutDashboard, Menu, X, LogOut, User, CircleHelp, RefreshCw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tourIdForPathname } from "@/components/walkthrough/tours";
import { runWalkthrough } from "@/components/walkthrough/run-walkthrough";
import { toast } from "sonner";

const links = [
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/cp-rankings", label: "CP Rankings", icon: Zap },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function Navbar({ user }: { user?: { name?: string | null; username?: string } | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="flex items-center">
          <span className="font-semibold text-[15px] tracking-tight">CP Board</span>
        </Link>

        <div className="hidden md:flex items-center gap-0.5">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
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
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="hidden sm:inline-flex items-center justify-center rounded-md border border-border/60 p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors outline-none disabled:opacity-60"
              aria-label="Sync all linked platforms"
              title="Sync all linked platforms"
            >
              <RefreshCw className={`h-4 w-4 ${syncingAll ? "animate-spin" : ""}`} />
            </button>
          )}
          {pageTourId && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="hidden sm:inline-flex items-center justify-center rounded-md border border-border/60 p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors outline-none"
                aria-label="Help and tour"
              >
                <CircleHelp className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[11rem]">
                <DropdownMenuItem
                  onClick={() => {
                    const ok = runWalkthrough(pageTourId);
                    if (!ok) toast.message("Tour unavailable", { description: "This page has no tour targets yet." });
                  }}
                >
                  Tour this page
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-[13px] font-medium hover:bg-secondary transition-colors"
              >
                <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary">
                  {(user.name || user.username || "?")[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline">{user.name || user.username}</span>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-44 rounded-lg border border-border/60 bg-card shadow-lg py-1 z-50">
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <User className="h-3.5 w-3.5" /> Profile
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                  </Link>
                  <div className="border-t border-border/40 my-1" />
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Sign In
            </Link>
          )}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-1.5 rounded-md hover:bg-secondary transition-colors">
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>
      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background px-5 py-2">
          {user && (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                handleSyncAll();
              }}
              className="flex items-center gap-2 w-full px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? "animate-spin" : ""}`} /> Sync all platforms
            </button>
          )}
          {pageTourId && (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                const ok = runWalkthrough(pageTourId);
                if (!ok) toast.message("Tour unavailable", { description: "This page has no tour targets yet." });
              }}
              className="flex items-center gap-2 w-full px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <CircleHelp className="h-3.5 w-3.5" /> Tour this page
            </button>
          )}
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Icon className="h-3.5 w-3.5" /> {link.label}
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
              <button
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
