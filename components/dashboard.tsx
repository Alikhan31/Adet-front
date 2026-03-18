"use client";

import React from "react";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Flame,
  CheckCircle2,
  Circle,
  Sparkles,
  TrendingUp,
  Dumbbell,
  BookOpen,
  Droplets,
  Moon,
  Brain,
  Heart,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { HabitPieChart } from "@/components/habit-pie-chart";
import { api, type ApiError, type HabitResponse, type UserResponse } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Habit {
  id: number;
  name: string;
  icon: React.ElementType;
  category: string;
  color: string;
  streak: number;
  completed: boolean;
  target: string;
}

type Props = {
  token: string;
  user: UserResponse;
};

const iconPalette = [Dumbbell, BookOpen, Droplets, Brain, Moon, Heart] as const;
const categoryPalette = ["Fitness", "Study", "Health", "Wellness"] as const;
const colorPalette = [
  "hsl(152, 60%, 46%)",
  "hsl(199, 89%, 48%)",
  "hsl(280, 60%, 60%)",
  "hsl(0, 72%, 51%)",
  "hsl(220, 20%, 40%)",
] as const;

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mapHabit(h: HabitResponse, idx: number, completed: boolean): Habit {
  return {
    id: h.id,
    name: h.name,
    icon: iconPalette[idx % iconPalette.length],
    category: categoryPalette[idx % categoryPalette.length],
    color: colorPalette[idx % colorPalette.length],
    streak: 0,
    completed,
    target: `${h.target_count}x (${h.frequency})`,
  };
}

export function Dashboard({ token, user }: Props) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createFrequency, setCreateFrequency] = useState<"daily" | "weekly">("daily");
  const [createTargetCount, setCreateTargetCount] = useState<number>(1);

  const today = useMemo(() => todayIso(), []);

  const completedCount = habits.filter((h) => h.completed).length;
  const totalCount = habits.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const items = await api.habits.list(token);
        const completions = await Promise.all(
          items.map((h) =>
            api.habits
              .listCompletions(token, h.id, { from_date: today, to_date: today })
              .then((rows) => rows.length > 0)
              .catch(() => false)
          )
        );
        const mapped = items.map((h, idx) => mapHabit(h, idx, completions[idx]!));
        if (!cancelled) setHabits(mapped);
      } catch (e) {
        if (!cancelled) setError((e as ApiError).message ?? "Failed to load habits");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, today]);

  const reloadHabits = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await api.habits.list(token);
      const completions = await Promise.all(
        items.map((h) =>
          api.habits
            .listCompletions(token, h.id, { from_date: today, to_date: today })
            .then((rows) => rows.length > 0)
            .catch(() => false)
        )
      );
      const mapped = items.map((h, idx) => mapHabit(h, idx, completions[idx]!));
      setHabits(mapped);
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to load habits");
    } finally {
      setLoading(false);
    }
  };

  const submitCreateHabit = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.habits.create(token, {
        name: createName.trim(),
        description: createDescription.trim() ? createDescription.trim() : null,
        frequency: createFrequency,
        target_count: Number.isFinite(createTargetCount) ? createTargetCount : 1,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateFrequency("daily");
      setCreateTargetCount(1);
      await reloadHabits();
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to create habit");
    } finally {
      setCreating(false);
    }
  };

  const toggleHabit = async (id: number) => {
    if (busyIds.has(id)) return;
    setBusyIds((prev) => new Set(prev).add(id));
    setError(null);
    try {
      const current = habits.find((h) => h.id === id);
      const isCompleted = current?.completed ?? false;
      if (!isCompleted) {
        await api.habits.completeToday(token, id);
      } else {
        await api.habits.removeCompletion(token, id, today);
      }
      setHabits((prev) =>
        prev.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h))
      );
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to update habit");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Good morning</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {user.full_name || user.email}
          </h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button
            size="icon"
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-5 w-5" />
            <span className="sr-only">Add habit</span>
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create habit</DialogTitle>
              <DialogDescription>
                Add a new habit. You can complete it from the dashboard.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="habit-name">Name</Label>
                <Input
                  id="habit-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Morning Run"
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="habit-desc">Description (optional)</Label>
                <Textarea
                  id="habit-desc"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Why this habit matters..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Frequency</Label>
                  <Select
                    value={createFrequency}
                    onValueChange={(v) =>
                      setCreateFrequency(v === "weekly" ? "weekly" : "daily")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="habit-target">Target count</Label>
                  <Input
                    id="habit-target"
                    type="number"
                    min={1}
                    max={100}
                    value={String(createTargetCount)}
                    onChange={(e) => setCreateTargetCount(Number(e.target.value || 1))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitCreateHabit()}
                disabled={creating || !createName.trim()}
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* AI Insight Card */}
      <Card className="mt-5 overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">AI Insight</p>
            <p className="mt-0.5 text-sm leading-relaxed opacity-90">
              {"You're 20% more consistent this week! Your morning run streak is your strongest habit. Keep it going!"}
            </p>
          </div>
          <TrendingUp className="mt-1 h-5 w-5 shrink-0 opacity-70" />
        </CardContent>
      </Card>

      {/* Daily Progress */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {"Today's Progress"}
          </h2>
          <span className="text-sm font-bold text-primary">
            {completedCount}/{totalCount}
          </span>
        </div>
        <Progress value={progressPercent} className="mt-2 h-2.5" />
        <p className="mt-1 text-xs text-muted-foreground">
          {progressPercent}% complete
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* Pie Chart */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-foreground">
          Habit Distribution
        </h2>
        <HabitPieChart habits={habits} />
      </div>

      {/* Habits List */}
      <div className="mt-6 pb-4">
        <h2 className="text-sm font-semibold text-foreground">
          {"Today's Habits"}
        </h2>
        <div className="mt-3 flex flex-col gap-2.5">
          {loading && habits.length === 0 ? (
            <Card className="border">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Loading habits...
              </CardContent>
            </Card>
          ) : habits.length === 0 ? (
            <Card className="border">
              <CardContent className="p-4 text-sm text-muted-foreground">
                No habits yet. Create one via API to see it here.
              </CardContent>
            </Card>
          ) : (
            habits.map((habit) => {
            const Icon = habit.icon;
            return (
              <Card
                key={habit.id}
                className={cn(
                  "cursor-pointer border transition-all hover:shadow-md",
                  habit.completed && "bg-muted/50"
                )}
                onClick={() => void toggleHabit(habit.id)}
                role="button"
                tabIndex={0}
                aria-label={`${habit.completed ? "Unmark" : "Mark"} ${habit.name} as complete`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void toggleHabit(habit.id);
                  }
                }}
              >
                <CardContent className="flex items-center gap-3 p-3.5">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${habit.color}20` }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: habit.color }}
                    />
                  </div>
                  <div className="flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium text-card-foreground",
                        habit.completed && "line-through opacity-60"
                      )}
                    >
                      {habit.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {habit.target}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-full bg-accent/50 px-2 py-0.5">
                      <Flame className="h-3 w-3 text-accent" />
                      <span className="text-xs font-semibold text-accent-foreground">
                        {habit.streak}
                      </span>
                    </div>
                    {habit.completed ? (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
          )}
        </div>
      </div>
    </div>
  );
}
