"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Users, CheckCircle2, XCircle, Plus, Globe2, Activity, Eye } from "lucide-react";

type University = {
  id: string;
  name: string;
  shortName: string;
  emailDomain: string;
  logoUrl: string | null;
  userCount: number;
};

export function AdminClient({
  universities: initialUniversities,
  totalUsers,
  syncStats,
  analytics,
}: {
  universities: University[];
  totalUsers: number;
  syncStats: { success: number; failed: number };
  analytics: {
    siteVisits: number;
    siteVisits24h: number;
    uniqueVisitors30d: number;
    totalProfileVisits: number;
    topPages: { path: string; visits: number }[];
    topVisitors: {
      userId: string;
      username: string;
      name: string | null;
      visits: number;
      mostVisitedPath: string;
      mostVisitedCount: number;
    }[];
  };
}) {
  const [universities, setUniversities] = useState(initialUniversities);
  const [newUni, setNewUni] = useState({ name: "", shortName: "", emailDomain: "" });
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUni.name || !newUni.shortName || !newUni.emailDomain) {
      toast.error("All fields are required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/universities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUni),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to add university");
        return;
      }
      const data = await res.json();
      setUniversities((prev) => [...prev, { ...data.university, userCount: 0 }]);
      setNewUni({ name: "", shortName: "", emailDomain: "" });
      toast.success("University added");
    } catch {
      toast.error("Failed to add university");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage universities, monitor analytics, and configure POTD</p>
        <div className="mt-3">
          <Link
            href="/admin/daily-practice"
            className="inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted transition-colors"
          >
            Manage Daily Practice
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Total Users</span>
          </div>
          <p className="text-2xl font-bold font-mono">{totalUsers}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Site Visits</span>
          </div>
          <p className="text-2xl font-bold font-mono">{analytics.siteVisits}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Visits (24h)</span>
          </div>
          <p className="text-2xl font-bold font-mono">{analytics.siteVisits24h}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Unique Visitors (30d)</span>
          </div>
          <p className="text-2xl font-bold font-mono">{analytics.uniqueVisitors30d}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Profile Visits</span>
          </div>
          <p className="text-2xl font-bold font-mono">{analytics.totalProfileVisits}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <span className="text-[11px] font-medium text-muted-foreground">Syncs (24h)</span>
          </div>
          <p className="text-2xl font-bold font-mono text-green-400">{syncStats.success}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[11px] font-medium text-muted-foreground">Failed Syncs (24h)</span>
          </div>
          <p className="text-2xl font-bold font-mono text-red-400">{syncStats.failed}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 mb-6">
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60">
            <p className="text-sm font-medium">Most Visited Pages (30d)</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="text-[11px]">Page</TableHead>
                <TableHead className="text-right text-[11px]">Visits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.topPages.map((page) => (
                <TableRow key={page.path} className="hover:bg-secondary/20 border-border/40">
                  <TableCell className="font-mono text-[12px]">{page.path}</TableCell>
                  <TableCell className="text-right font-mono text-[13px]">{page.visits}</TableCell>
                </TableRow>
              ))}
              {analytics.topPages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-8 text-sm">
                    No analytics data yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border border-border/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60">
            <p className="text-sm font-medium">Who Visits Which Page Most (30d)</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="text-[11px]">User</TableHead>
                <TableHead className="text-[11px]">Top Page</TableHead>
                <TableHead className="text-right text-[11px]">Visits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.topVisitors.map((visitor) => (
                <TableRow key={visitor.userId} className="hover:bg-secondary/20 border-border/40">
                  <TableCell className="text-[13px]">
                    <p className="font-medium leading-tight">{visitor.name || visitor.username}</p>
                    <p className="text-[11px] text-muted-foreground">@{visitor.username}</p>
                  </TableCell>
                  <TableCell className="font-mono text-[12px]">{visitor.mostVisitedPath}</TableCell>
                  <TableCell className="text-right font-mono text-[13px]">{visitor.visits}</TableCell>
                </TableRow>
              ))}
              {analytics.topVisitors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8 text-sm">
                    No logged-in visitor data yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 p-5 mb-6">
        <p className="text-sm font-medium mb-4">Add University</p>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Full Name</Label>
            <Input placeholder="PES University" value={newUni.name} onChange={(e) => setNewUni((p) => ({ ...p, name: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="w-32 space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Short Name</Label>
            <Input placeholder="PESU" value={newUni.shortName} onChange={(e) => setNewUni((p) => ({ ...p, shortName: e.target.value.toUpperCase() }))} className="h-8 text-sm" />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Email Domain</Label>
            <Input placeholder="pesu.pes.edu" value={newUni.emailDomain} onChange={(e) => setNewUni((p) => ({ ...p, emailDomain: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="flex items-end">
            <Button type="submit" size="sm" disabled={adding} className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" /> {adding ? "Adding..." : "Add"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/60">
          <p className="text-sm font-medium">Universities ({universities.length})</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="text-[11px]">Name</TableHead>
              <TableHead className="text-[11px]">Short</TableHead>
              <TableHead className="text-[11px]">Domain</TableHead>
              <TableHead className="text-right text-[11px]">Users</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {universities.map((uni) => (
              <TableRow key={uni.id} className="hover:bg-secondary/20 border-border/40">
                <TableCell className="font-medium text-[13px]">{uni.name}</TableCell>
                <TableCell><Badge variant="outline" className="font-mono text-[10px]">{uni.shortName}</Badge></TableCell>
                <TableCell className="text-[13px] text-muted-foreground font-mono">@{uni.emailDomain}</TableCell>
                <TableCell className="text-right font-mono text-[13px]">{uni.userCount}</TableCell>
              </TableRow>
            ))}
            {universities.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                  No universities registered yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
