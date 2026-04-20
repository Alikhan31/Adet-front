"use client";

import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Flame, CheckCircle2, Circle, Sparkles, TrendingUp,
  Dumbbell, BookOpen, Droplets, Moon, Brain, Heart, CalendarIcon,
  Pencil, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { HabitPieChart } from "@/components/habit-pie-chart";
import { api, type ApiError, type HabitResponse, type UserResponse, type HeatmapDay } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// 0 = Monday … 6 = Sunday  (matches backend convention)
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Convert JS Date.getDay() (0=Sun) → our 0=Mon convention */
function todayWeekday(): number {
  return (new Date().getDay() + 6) % 7;
}

interface Habit {
  id: number;
  name: string;
  description: string | null;
  icon: React.ElementType;
  category: string;
  color: string;
  streak: number;
  completed: boolean;
  completedDate: string | null; // actual date from the server completion record
  completionDates: string[];    // last 90 days, for per-habit heatmap
  note: string | null;
  target: string;
  days_of_week: number[];
}

type Props = { token: string; user: UserResponse };

const iconPalette = [Dumbbell, BookOpen, Droplets, Brain, Moon, Heart] as const;
const categoryPalette = ["Fitness", "Study", "Health", "Wellness"] as const;
const colorPalette = [
  "hsl(152, 60%, 46%)",
  "hsl(199, 89%, 48%)",
  "hsl(280, 60%, 60%)",
  "hsl(0, 72%, 51%)",
  "hsl(220, 20%, 40%)",
] as const;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Count consecutive completed scheduled days going backwards from today.
 * If today is scheduled but not yet done, we give a grace period (don't break).
 */
function calcStreak(completedDates: Set<string>, daysOfWeek: number[]): number {
  const allDays = daysOfWeek.length === 0 ? ALL_DAYS : daysOfWeek;
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  let streak = 0;
  let gracedToday = false;

  for (let i = 0; i < 365; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const weekday = (d.getDay() + 6) % 7; // 0=Mon
    if (!allDays.includes(weekday)) continue; // not scheduled → skip without breaking

    const iso = isoDate(d);
    if (completedDates.has(iso)) {
      streak++;
    } else if (i === 0 && !gracedToday) {
      // today scheduled but not done yet — one grace skip
      gracedToday = true;
    } else {
      break; // missed a scheduled day → streak over
    }
  }
  return streak;
}

function mapHabit(
  h: HabitResponse,
  idx: number,
  completedDate: string | null,
  streak: number,
  note: string | null,
  completionDates: string[],
): Habit {
  return {
    id: h.id,
    name: h.name,
    description: h.description ?? null,
    icon: iconPalette[idx % iconPalette.length],
    category: categoryPalette[idx % categoryPalette.length],
    color: colorPalette[idx % colorPalette.length],
    streak,
    completed: completedDate !== null,
    completedDate,
    completionDates,
    note,
    target: `${h.target_count}x`,
    days_of_week: h.days_of_week ?? ALL_DAYS,
  };
}

// ---------------------------------------------------------------------------
// Heatmap component
// ---------------------------------------------------------------------------

const HEATMAP_WEEKS = 26; // how many weeks to show (~6 months)

function getHeatmapColor(count: number): string {
  if (count === 0) return "hsl(220, 13%, 88%)";
  if (count === 1) return "hsl(142, 40%, 70%)";
  if (count === 2) return "hsl(142, 50%, 55%)";
  if (count === 3) return "hsl(142, 55%, 42%)";
  return "hsl(142, 60%, 32%)";
}

function HabitHeatmap({ days }: { days: HeatmapDay[] }) {
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of days) m.set(d.date, d.count);
    return m;
  }, [days]);

  // Build a grid: HEATMAP_WEEKS columns × 7 rows
  // Start from the Sunday of (today - HEATMAP_WEEKS * 7) days so grid aligns to week
  const cells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Find the most recent Sunday (JS: 0) to end on
    const endSunday = new Date(today);
    endSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
    // Start from Sunday HEATMAP_WEEKS weeks back
    const startDate = new Date(endSunday);
    startDate.setDate(endSunday.getDate() - HEATMAP_WEEKS * 7 + 1);

    const result: { iso: string; count: number; dayOfWeek: number }[] = [];
    const cur = new Date(startDate);
    while (cur <= endSunday) {
      const iso = isoDate(cur);
      result.push({
        iso,
        count: countByDate.get(iso) ?? 0,
        dayOfWeek: cur.getDay(), // 0=Sun
      });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [countByDate]);

  // Group into weeks (columns)
  const weeks = useMemo(() => {
    const result: typeof cells[] = [];
    let week: typeof cells = [];
    for (const cell of cells) {
      week.push(cell);
      if (cell.dayOfWeek === 6) { // Saturday = end of week
        result.push(week);
        week = [];
      }
    }
    if (week.length > 0) result.push(week);
    return result;
  }, [cells]);

  const totalCompletions = days.reduce((s, d) => s + d.count, 0);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-foreground">Activity Heatmap</h2>
        <span className="text-xs text-muted-foreground">{totalCompletions} completions</span>
      </div>
      <Card className="border p-3">
        <div className="flex gap-[3px] w-full">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px] flex-1">
              {week.map((cell) => (
                <div
                  key={cell.iso}
                  title={`${cell.iso}: ${cell.count} habit${cell.count !== 1 ? "s" : ""}`}
                  className="w-full aspect-square rounded-[2px] transition-opacity hover:opacity-80 cursor-default"
                  style={{ backgroundColor: getHeatmapColor(cell.count) }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 justify-end">
          <span className="text-[10px] text-muted-foreground">Less</span>
          {[0, 1, 2, 3, 4].map((v) => (
            <div
              key={v}
              className="h-[11px] w-[11px] rounded-[2px]"
              style={{ backgroundColor: getHeatmapColor(v) }}
            />
          ))}
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-habit mini heatmap (13 weeks)
// ---------------------------------------------------------------------------

const MINI_WEEKS = 18; // per-habit heatmap: ~4 months

function MiniHeatmap({ completionDates, daysOfWeek, color }: {
  completionDates: string[];
  daysOfWeek: number[];
  color: string;
}) {
  const doneSet = useMemo(() => new Set(completionDates), [completionDates]);
  const todayIso = useMemo(() => isoDate(new Date()), []);
  const allDays = daysOfWeek.length === 0 ? ALL_DAYS : daysOfWeek;

  // Build grid: MINI_WEEKS columns × 7 rows, Sunday-aligned
  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Align to end-of-week Sunday
    const endSunday = new Date(today);
    endSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
    const startDate = new Date(endSunday);
    startDate.setDate(endSunday.getDate() - MINI_WEEKS * 7 + 1);

    const cells: { iso: string; dayOfWeek: number; done: boolean; scheduled: boolean; isToday: boolean }[] = [];
    const cur = new Date(startDate);
    while (cur <= endSunday) {
      const iso = isoDate(cur);
      const jsDay = cur.getDay(); // 0=Sun
      const ourDay = (jsDay + 6) % 7; // 0=Mon
      cells.push({
        iso,
        dayOfWeek: jsDay,
        done: doneSet.has(iso),
        scheduled: allDays.includes(ourDay),
        isToday: iso === todayIso,
      });
      cur.setDate(cur.getDate() + 1);
    }

    // Group into weeks
    const result: typeof cells[] = [];
    let week: typeof cells = [];
    for (const cell of cells) {
      week.push(cell);
      if (cell.dayOfWeek === 6) { result.push(week); week = []; }
    }
    if (week.length > 0) result.push(week);
    return result;
  }, [doneSet, allDays, todayIso]);

  return (
    <div className="flex gap-[3px] w-full">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px] flex-1">
          {week.map((cell) => {
            let bg: string;
            if (cell.done) bg = color;
            else if (!cell.scheduled) bg = "transparent";
            else bg = "hsl(220, 13%, 88%)";
            return (
              <div
                key={cell.iso}
                title={`${cell.iso}${cell.done ? " ✓" : ""}`}
                className="w-full aspect-square rounded-[2px] cursor-default"
                style={{
                  backgroundColor: bg,
                  opacity: cell.isToday && !cell.done ? 0.5 : 1,
                  outline: cell.isToday ? `1.5px solid ${color}` : undefined,
                  outlineOffset: 1,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function Dashboard({ token, user }: Props) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createDays, setCreateDays] = useState<number[]>([...ALL_DAYS]);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDays, setEditDays] = useState<number[]>([...ALL_DAYS]);
  const [saving, setSaving] = useState(false);

  // Note expansion state per habit id
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [noteValues, setNoteValues] = useState<Map<number, string>>(new Map());
  const [savingNote, setSavingNote] = useState<Set<number>>(new Set());
  const noteTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Heatmap state
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);

  const todayDay = useMemo(() => todayWeekday(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calOpen, setCalOpen] = useState(false);

  const selectedIso = useMemo(() => isoDate(selectedDate), [selectedDate]);

  const isToday = useMemo(
    () => selectedDate.toDateString() === new Date().toDateString(),
    [selectedDate]
  );

  const selectedWeekday = useMemo(() => (selectedDate.getDay() + 6) % 7, [selectedDate]);

  const visibleHabits = useMemo(
    () => habits.filter((h) => h.days_of_week.length === 0 || h.days_of_week.includes(selectedWeekday)),
    [habits, selectedWeekday]
  );

  const completedCount = visibleHabits.filter((h) => h.completed).length;
  const totalCount = visibleHabits.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function formatSelectedDate(d: Date): string {
    if (d.toDateString() === new Date().toDateString()) return "Today";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  async function loadHabits(dateIso: string, cancelled?: { v: boolean }) {
    setLoading(true);
    setError(null);
    try {
      const items = await api.habits.list(token);

      const from90 = new Date();
      from90.setDate(from90.getDate() - 180); // 180 days covers 18-week mini heatmap
      const from90Iso = isoDate(from90);
      const todayStr = isoDate(new Date());

      const allCompletions = await Promise.all(
        items.map((h) =>
          api.habits
            .listCompletions(token, h.id, { from_date: from90Iso, to_date: todayStr })
            .catch(() => [])
        )
      );

      const mapped = items.map((h, idx) => {
        const rows = allCompletions[idx]!;
        const completedDates = new Set(rows.map((r) => r.completed_date));
        const streak = calcStreak(completedDates, h.days_of_week ?? ALL_DAYS);
        const selectedRow = rows.find((r) => r.completed_date === dateIso);
        return mapHabit(
          h, idx,
          selectedRow?.completed_date ?? null,
          streak,
          selectedRow?.note ?? null,
          rows.map((r) => r.completed_date),
        );
      });

      if (!cancelled?.v) {
        setHabits(mapped);
        // Sync note values for expanded habits
        setNoteValues((prev) => {
          const next = new Map(prev);
          for (const h of mapped) {
            if (!next.has(h.id)) {
              next.set(h.id, h.note ?? "");
            }
          }
          return next;
        });
      }
    } catch (e) {
      if (!cancelled?.v) setError((e as ApiError).message ?? "Failed to load habits");
    } finally {
      if (!cancelled?.v) setLoading(false);
    }
  }

  async function loadHeatmap() {
    try {
      const data = await api.analytics.heatmap(token);
      setHeatmapDays(data.days);
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    const c = { v: false };
    void loadHabits(selectedIso, c);
    return () => { c.v = true; };
  }, [token, selectedIso]);

  useEffect(() => {
    void loadHeatmap();
  }, [token]);

  // --- Create dialog ---
  const toggleCreateDay = (d: number) => {
    setCreateDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };

  const submitCreateHabit = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.habits.create(token, {
        name: createName.trim(),
        description: createDescription.trim() || null,
        days_of_week: createDays.length === 7 ? ALL_DAYS : createDays,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateDays([...ALL_DAYS]);
      await loadHabits(selectedIso);
      void loadHeatmap();
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to create habit");
    } finally {
      setCreating(false);
    }
  };

  // --- Edit dialog ---
  const openEditDialog = (e: React.MouseEvent, habit: Habit) => {
    e.stopPropagation();
    setEditHabit(habit);
    setEditName(habit.name);
    setEditDescription(habit.description ?? "");
    setEditDays([...habit.days_of_week]);
    setEditOpen(true);
  };

  const toggleEditDay = (d: number) => {
    setEditDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };

  const submitEditHabit = async () => {
    if (!editHabit || !editName.trim()) return;
    setSaving(true);
    try {
      await api.habits.update(token, editHabit.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        days_of_week: editDays,
      });
      setEditOpen(false);
      await loadHabits(selectedIso);
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to update habit");
    } finally {
      setSaving(false);
    }
  };

  const deleteHabit = async (habitId: number) => {
    if (!confirm("Delete this habit and all its data?")) return;
    setEditOpen(false);
    try {
      await api.habits.delete(token, habitId);
      await loadHabits(selectedIso);
      void loadHeatmap();
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to delete habit");
    }
  };

  // --- Toggle habit completion ---
  const toggleHabit = async (id: number) => {
    if (busyIds.has(id)) return;
    setBusyIds((prev) => new Set(prev).add(id));
    setError(null);
    try {
      const current = habits.find((h) => h.id === id);
      if (!current?.completed) {
        await api.habits.complete(token, id, selectedIso);
        await loadHabits(selectedIso);
        void loadHeatmap();
        // When completing, auto-expand note box
        setExpandedNotes((prev) => new Set(prev).add(id));
        setNoteValues((prev) => { const n = new Map(prev); if (!n.has(id)) n.set(id, ""); return n; });
      } else {
        const dateToDelete = current.completedDate ?? selectedIso;
        await api.habits.removeCompletion(token, id, dateToDelete);
        await loadHabits(selectedIso);
        void loadHeatmap();
        // Collapse note on uncheck
        setExpandedNotes((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to update habit");
    } finally {
      setBusyIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  // --- Note handling ---
  const toggleNote = (e: React.MouseEvent, habitId: number) => {
    e.stopPropagation();
    setExpandedNotes((prev) => {
      const n = new Set(prev);
      if (n.has(habitId)) n.delete(habitId);
      else n.add(habitId);
      return n;
    });
  };

  const handleNoteChange = (habitId: number, value: string, completedDate: string) => {
    setNoteValues((prev) => new Map(prev).set(habitId, value));
    // Debounce save
    const existing = noteTimers.current.get(habitId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      setSavingNote((prev) => new Set(prev).add(habitId));
      try {
        await api.habits.updateNote(token, habitId, completedDate, value.trim() || null);
        setHabits((prev) =>
          prev.map((h) => h.id === habitId ? { ...h, note: value.trim() || null } : h)
        );
      } catch {
        // silently fail for auto-save
      } finally {
        setSavingNote((prev) => { const n = new Set(prev); n.delete(habitId); return n; });
      }
    }, 800);
    noteTimers.current.set(habitId, timer);
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {user.full_name || user.email}
          </h1>
        </div>
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-5 w-5" />
          <span className="sr-only">Add habit</span>
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create habit</DialogTitle>
            <DialogDescription>Choose which days this habit should appear.</DialogDescription>
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
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Days of week</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => setCreateDays(createDays.length === 7 ? [] : [...ALL_DAYS])}
                >
                  {createDays.length === 7 ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, idx) => {
                  const selected = createDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleCreateDay(idx)}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {createDays.length === 0 && (
                <p className="text-xs text-destructive">Select at least one day.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitCreateHabit()}
              disabled={creating || !createName.trim() || createDays.length === 0}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit habit</DialogTitle>
            <DialogDescription>Update name, description, or scheduled days.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-habit-name">Name</Label>
              <Input
                id="edit-habit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-habit-desc">Description (optional)</Label>
              <Textarea
                id="edit-habit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Why this habit matters..."
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Days of week</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => setEditDays(editDays.length === 7 ? [] : [...ALL_DAYS])}
                >
                  {editDays.length === 7 ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, idx) => {
                  const selected = editDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleEditDay(idx)}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {editDays.length === 0 && (
                <p className="text-xs text-destructive">Select at least one day.</p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => editHabit && void deleteHabit(editHabit.id)}
              disabled={saving}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitEditHabit()}
                disabled={saving || !editName.trim() || editDays.length === 0}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Insight */}
      <Card className="mt-5 overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">AI Insight</p>
            <p className="mt-0.5 text-sm leading-relaxed opacity-90">
              {"You're building great habits! Keep tracking to unlock personalized insights."}
            </p>
          </div>
          <TrendingUp className="mt-1 h-5 w-5 shrink-0 opacity-70" />
        </CardContent>
      </Card>

      {/* Progress */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {isToday ? "Today's Progress" : formatSelectedDate(selectedDate)}
          </h2>
          <span className="text-sm font-bold text-primary">{completedCount}/{totalCount}</span>
        </div>
        <Progress value={progressPercent} className="mt-2 h-2.5" />
        <p className="mt-1 text-xs text-muted-foreground">{progressPercent}% complete</p>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* Pie chart */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-foreground">Habit Distribution</h2>
        <HabitPieChart habits={habits} />
      </div>

      {/* Heatmap */}
      <HabitHeatmap days={heatmapDays} />

      {/* Habits list */}
      <div className="mt-6 pb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {isToday ? "Today's Habits" : `${DAY_LABELS[selectedWeekday]} Habits`}
          </h2>

          {/* Date picker */}
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <CalendarIcon className="h-3.5 w-3.5" />
                {formatSelectedDate(selectedDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { if (d) { setSelectedDate(d); setCalOpen(false); } }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {loading && visibleHabits.length === 0 ? (
            <Card className="border">
              <CardContent className="p-4 text-sm text-muted-foreground">Loading habits...</CardContent>
            </Card>
          ) : visibleHabits.length === 0 ? (
            <Card className="border">
              <CardContent className="p-4 text-sm text-muted-foreground">
                No habits scheduled for {DAY_LABELS[selectedWeekday]}. Tap + to create one.
              </CardContent>
            </Card>
          ) : (
            visibleHabits.map((habit) => {
              const Icon = habit.icon;
              const noteExpanded = expandedNotes.has(habit.id);
              const noteValue = noteValues.get(habit.id) ?? habit.note ?? "";
              const isSavingNote = savingNote.has(habit.id);

              return (
                <Card
                  key={habit.id}
                  className={cn(
                    "border transition-all",
                    habit.completed && "bg-muted/50"
                  )}
                >
                  {/* Main row — clicking toggles completion */}
                  <CardContent
                    className="flex items-center gap-3 p-3.5 cursor-pointer"
                    onClick={() => void toggleHabit(habit.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${habit.completed ? "Unmark" : "Mark"} ${habit.name} as complete`}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void toggleHabit(habit.id); } }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${habit.color}20` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: habit.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium text-card-foreground truncate", habit.completed && "line-through opacity-60")}>
                        {habit.name}
                      </p>
                      {/* Day chips */}
                      <div className="mt-0.5 flex gap-0.5 flex-wrap">
                        {DAY_LABELS.map((lbl, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              "rounded px-1 text-[10px] font-medium",
                              habit.days_of_week.includes(idx)
                                ? idx === selectedWeekday
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                                : "opacity-0 pointer-events-none"
                            )}
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Note toggle (only if completed) */}
                      {habit.completed && (
                        <button
                          type="button"
                          onClick={(e) => toggleNote(e, habit.id)}
                          className="flex items-center justify-center h-7 w-7 rounded-full hover:bg-muted transition-colors"
                          title={noteExpanded ? "Hide note" : "Add note"}
                        >
                          {noteExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      )}
                      {/* Edit */}
                      <button
                        type="button"
                        onClick={(e) => openEditDialog(e, habit)}
                        className="flex items-center justify-center h-7 w-7 rounded-full hover:bg-muted transition-colors"
                        title="Edit habit"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <div className="flex items-center gap-1 rounded-full bg-accent/50 px-2 py-0.5">
                        <Flame className="h-3 w-3 text-accent" />
                        <span className="text-xs font-semibold text-accent-foreground">{habit.streak}</span>
                      </div>
                      {habit.completed
                        ? <CheckCircle2 className="h-6 w-6 text-primary" />
                        : <Circle className="h-6 w-6 text-muted-foreground/40" />}
                    </div>
                  </CardContent>

                  {/* Note panel */}
                  {habit.completed && noteExpanded && (
                    <div className="px-3.5 pb-3 -mt-1" onClick={(e) => e.stopPropagation()}>
                      <Textarea
                        value={noteValue}
                        onChange={(e) =>
                          handleNoteChange(habit.id, e.target.value, habit.completedDate ?? selectedIso)
                        }
                        placeholder="Add a note about this completion…"
                        className="text-sm resize-none min-h-[70px]"
                        rows={2}
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground text-right">
                        {isSavingNote ? "Saving…" : "Auto-saved"}
                      </p>
                    </div>
                  )}

                  {/* Per-habit mini heatmap */}
                  <div className="px-3.5 pb-3" onClick={(e) => e.stopPropagation()}>
                    <MiniHeatmap
                      completionDates={habit.completionDates}
                      daysOfWeek={habit.days_of_week}
                      color={habit.color}
                    />
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
