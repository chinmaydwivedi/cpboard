"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProblemPlatform, SolutionLanguage } from "@prisma/client";
import { ArrowLeft, CalendarDays, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  POTD_LANGUAGES,
  PROBLEM_PLATFORM_LABELS,
  SOLUTION_LANGUAGE_LABELS,
} from "@/lib/potd";

type SolutionFormState = {
  code: string;
  explanation: string;
};

type DailyPracticeProblemItem = {
  id: string;
  dateKey: string;
  platform: ProblemPlatform;
  title: string;
  problemUrl: string;
  difficulty: string | null;
  notes: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string;
    name: string | null;
  };
  solutions: {
    id: string;
    language: SolutionLanguage;
    code: string;
    explanation: string | null;
  }[];
};

type FormState = {
  date: string;
  platform: ProblemPlatform;
  title: string;
  problemUrl: string;
  difficulty: string;
  notes: string;
  solutions: Record<SolutionLanguage, SolutionFormState>;
};

const PLATFORM_OPTIONS: ProblemPlatform[] = [
  "LEETCODE",
  "CODEFORCES",
  "ATCODER",
  "CODECHEF",
];

function createEmptyForm(todayKey: string): FormState {
  return {
    date: todayKey,
    platform: "LEETCODE",
    title: "",
    problemUrl: "",
    difficulty: "",
    notes: "",
    solutions: {
      JAVA: { code: "", explanation: "" },
      CPP: { code: "", explanation: "" },
      PYTHON: { code: "", explanation: "" },
    },
  };
}

function formFromProblem(problem: DailyPracticeProblemItem): FormState {
  const byLanguage = new Map(problem.solutions.map((solution) => [solution.language, solution]));
  return {
    date: problem.dateKey,
    platform: problem.platform,
    title: problem.title,
    problemUrl: problem.problemUrl,
    difficulty: problem.difficulty ?? "",
    notes: problem.notes ?? "",
    solutions: {
      JAVA: {
        code: byLanguage.get("JAVA")?.code ?? "",
        explanation: byLanguage.get("JAVA")?.explanation ?? "",
      },
      CPP: {
        code: byLanguage.get("CPP")?.code ?? "",
        explanation: byLanguage.get("CPP")?.explanation ?? "",
      },
      PYTHON: {
        code: byLanguage.get("PYTHON")?.code ?? "",
        explanation: byLanguage.get("PYTHON")?.explanation ?? "",
      },
    },
  };
}

function hasAllLanguageSolutions(problem: DailyPracticeProblemItem): boolean {
  return POTD_LANGUAGES.every((language) => {
    const entry = problem.solutions.find((solution) => solution.language === language);
    return Boolean(entry && entry.code.trim());
  });
}

export function DailyPracticeAdminClient({
  todayKey,
  problems,
}: {
  todayKey: string;
  problems: DailyPracticeProblemItem[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<SolutionLanguage>("JAVA");
  const [saving, setSaving] = useState(false);
  const [busyPublishId, setBusyPublishId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyForm(todayKey));

  const setSolutionField = (
    language: SolutionLanguage,
    key: keyof SolutionFormState,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      solutions: {
        ...prev.solutions,
        [language]: {
          ...prev.solutions[language],
          [key]: value,
        },
      },
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setActiveLanguage("JAVA");
    setForm(createEmptyForm(todayKey));
  };

  const startEditing = (problem: DailyPracticeProblemItem) => {
    setEditingId(problem.id);
    setActiveLanguage("JAVA");
    setForm(formFromProblem(problem));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitForm = async (publish: boolean) => {
    if (saving) return;

    setSaving(true);
    try {
      const endpoint = editingId
        ? `/api/admin/daily-practice/${editingId}`
        : "/api/admin/daily-practice";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          platform: form.platform,
          title: form.title,
          problemUrl: form.problemUrl,
          difficulty: form.difficulty || null,
          notes: form.notes || null,
          isPublished: publish,
          solutions: {
            JAVA: {
              code: form.solutions.JAVA.code,
              explanation: form.solutions.JAVA.explanation || null,
            },
            CPP: {
              code: form.solutions.CPP.code,
              explanation: form.solutions.CPP.explanation || null,
            },
            PYTHON: {
              code: form.solutions.PYTHON.code,
              explanation: form.solutions.PYTHON.explanation || null,
            },
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save daily practice problem");
        return;
      }

      toast.success(
        editingId ? "Daily practice problem updated" : "Daily practice problem created"
      );
      resetForm();
      router.refresh();
    } catch {
      toast.error("Failed to save daily practice problem");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (problem: DailyPracticeProblemItem) => {
    if (busyPublishId) return;
    setBusyPublishId(problem.id);
    try {
      const res = await fetch(`/api/admin/daily-practice/${problem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !problem.isPublished }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update publish state");
        return;
      }

      toast.success(problem.isPublished ? "Problem unpublished" : "Problem published");
      router.refresh();
    } catch {
      toast.error("Failed to update publish state");
    } finally {
      setBusyPublishId(null);
    }
  };

  const handleDelete = async (problem: DailyPracticeProblemItem) => {
    if (busyDeleteId) return;
    if (!confirm(`Delete POTD for ${problem.dateKey}? This cannot be undone.`)) return;

    setBusyDeleteId(problem.id);
    try {
      const res = await fetch(`/api/admin/daily-practice/${problem.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete problem");
        return;
      }

      toast.success("Problem deleted");
      if (editingId === problem.id) {
        resetForm();
      }
      router.refresh();
    } catch {
      toast.error("Failed to delete problem");
    } finally {
      setBusyDeleteId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6" data-tour="admin-potd-header">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">Daily Practice Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create, edit, and publish the POTD with Java, C++, and Python solutions.
        </p>
      </div>

      <section className="rounded-lg border border-border/60 p-5 mb-6" data-tour="admin-potd-form">
        <div className="flex items-center justify-between gap-2 mb-4">
          <p className="text-sm font-medium">{editingId ? "Edit POTD" : "Create POTD"}</p>
          {editingId ? (
            <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitForm(false);
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Date (IST)</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, date: event.target.value }))
                }
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    platform: (value as ProblemPlatform | null) ?? prev.platform,
                  }))
                }
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {PROBLEM_PLATFORM_LABELS[platform]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Problem Title</Label>
            <Input
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              required
              className="h-9"
              placeholder="Two Sum"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Problem URL</Label>
              <Input
                value={form.problemUrl}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, problemUrl: event.target.value }))
                }
                required
                className="h-9"
                placeholder="https://leetcode.com/problems/two-sum/"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Difficulty</Label>
              <Input
                value={form.difficulty}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, difficulty: event.target.value }))
                }
                className="h-9"
                placeholder="Easy"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Admin Notes (Optional)</Label>
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              className="min-h-16 text-sm"
              placeholder="Any hints or constraints for this POTD."
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-muted-foreground">Solutions</p>
              <Badge variant="outline" className="text-[10px] font-mono">
                Java / C++ / Python required for publish
              </Badge>
            </div>
            <Tabs
              value={activeLanguage}
              onValueChange={(value) =>
                setActiveLanguage((value as SolutionLanguage | null) ?? "JAVA")
              }
            >
              <TabsList>
                {POTD_LANGUAGES.map((language) => (
                  <TabsTrigger key={language} value={language}>
                    {SOLUTION_LANGUAGE_LABELS[language]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {POTD_LANGUAGES.map((language) => (
                <TabsContent key={language} value={language} className="mt-3 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      {SOLUTION_LANGUAGE_LABELS[language]} Code
                    </Label>
                    <Textarea
                      value={form.solutions[language].code}
                      onChange={(event) =>
                        setSolutionField(language, "code", event.target.value)
                      }
                      className="min-h-44 font-mono text-[12px]"
                      placeholder={`Write ${SOLUTION_LANGUAGE_LABELS[language]} solution here`}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Explanation (Optional)
                    </Label>
                    <Textarea
                      value={form.solutions[language].explanation}
                      onChange={(event) =>
                        setSolutionField(language, "explanation", event.target.value)
                      }
                      className="min-h-20 text-sm"
                      placeholder="Brief explanation for this solution."
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                void submitForm(false);
              }}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Draft"
                  : "Create Draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                void submitForm(true);
              }}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update & Publish"
                  : "Create & Publish"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border/60 overflow-hidden" data-tour="admin-potd-list">
        <div className="px-5 py-3 border-b border-border/60">
          <p className="text-sm font-medium">Recent POTD Entries</p>
        </div>

        <div className="divide-y divide-border/40">
          {problems.map((problem) => {
            const complete = hasAllLanguageSolutions(problem);
            return (
              <div key={problem.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">{problem.title}</h3>
                      <Badge
                        variant={problem.isPublished ? "default" : "outline"}
                        className="text-[10px] font-mono"
                      >
                        {problem.isPublished ? "PUBLISHED" : "DRAFT"}
                      </Badge>
                      {!complete ? (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          Missing solution
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> 3 languages
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" /> {problem.dateKey}
                      </span>
                      <span>• {PROBLEM_PLATFORM_LABELS[problem.platform]}</span>
                      {problem.difficulty ? <span>• {problem.difficulty}</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(problem)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={problem.isPublished ? "ghost" : "outline"}
                      onClick={() => handleTogglePublish(problem)}
                      disabled={
                        busyPublishId === problem.id ||
                        (!problem.isPublished && !complete)
                      }
                    >
                      {busyPublishId === problem.id
                        ? "Updating..."
                        : problem.isPublished
                          ? "Unpublish"
                          : "Publish"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(problem)}
                      disabled={busyDeleteId === problem.id}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {busyDeleteId === problem.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {problems.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No POTD entries yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
