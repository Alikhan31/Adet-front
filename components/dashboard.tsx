"use client";

import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Flame, CheckCircle2, Circle, Sparkles, TrendingUp,
  Dumbbell, BookOpen, Droplets, Moon, Brain, Heart, CalendarIcon,
  Pencil, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Users,
  Activity, Coffee, Target, Star, Zap, Sun, Smile, Home,
  Music, Code2, Clock, Leaf, Award, Camera, Globe, Lightbulb,
  Headphones, ShoppingBag, Plane, BarChart2, UserPlus, LogOut,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { HabitPieChart } from "@/components/habit-pie-chart";
import { api, type HabitResponse, type FriendResponse, type UserResponse, type HeatmapDay, type SharedHabitMemberStat } from "@/lib/api";
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
  iconKey: string | null;
  category: string;
  categoryKey: string | null;
  color: string;
  streak: number;
  completed: boolean;
  completedDate: string | null; // actual date from the server completion record
  completionDates: string[];    // last 90 days, for per-habit heatmap
  note: string | null;
  target: string;
  days_of_week: number[];
  visibility: "friends" | "selected" | "private";
}

type Props = { token: string; user: UserResponse };

// ── Category + icon registry ────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  heart: Heart, activity: Activity, brain: Brain, "book-open": BookOpen,
  coffee: Coffee, target: Target, star: Star, zap: Zap, sun: Sun, moon: Moon,
  smile: Smile, home: Home, users: Users, music: Music, code: Code2,
  clock: Clock, leaf: Leaf, flame: Flame, award: Award, droplets: Droplets,
  camera: Camera, globe: Globe, lightbulb: Lightbulb, headphones: Headphones,
  "shopping-bag": ShoppingBag, plane: Plane, "bar-chart": BarChart2, dumbbell: Dumbbell,
};

const ALL_ICONS_LIST = [
  "heart", "activity", "dumbbell", "droplets", "flame",
  "brain", "book-open", "lightbulb", "coffee", "headphones", "music",
  "target", "clock", "code", "bar-chart", "award",
  "sun", "moon", "smile", "star", "zap", "home", "leaf", "globe",
  "users", "camera", "plane", "shopping-bag",
];

const CATEGORIES_LIST = [
  { key: "health",    label: "Health",    icon: "heart",     color: "#ef4444" },
  { key: "fitness",   label: "Fitness",   icon: "dumbbell",  color: "#f97316" },
  { key: "mind",      label: "Mind",      icon: "brain",     color: "#8b5cf6" },
  { key: "learning",  label: "Learning",  icon: "book-open", color: "#3b82f6" },
  { key: "social",    label: "Social",    icon: "users",     color: "#ec4899" },
  { key: "work",      label: "Work",      icon: "target",    color: "#10b981" },
  { key: "finance",   label: "Finance",   icon: "bar-chart", color: "#f59e0b" },
  { key: "lifestyle", label: "Lifestyle", icon: "sun",       color: "#06b6d4" },
  { key: "other",     label: "Other",     icon: "star",      color: "#6b7280" },
];

function categoryColor(cat: string | null): string {
  return CATEGORIES_LIST.find(c => c.key === cat)?.color ?? "hsl(var(--primary))";
}

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
  const resolvedIcon = h.icon ? (ICON_MAP[h.icon] ?? iconPalette[idx % iconPalette.length]) : iconPalette[idx % iconPalette.length];
  const resolvedColor = h.category ? categoryColor(h.category) : colorPalette[idx % colorPalette.length];
  return {
    id: h.id,
    name: h.name,
    description: h.description ?? null,
    icon: resolvedIcon,
    iconKey: h.icon ?? null,
    category: h.category ?? categoryPalette[idx % categoryPalette.length],
    categoryKey: h.category ?? null,
    color: resolvedColor,
    streak,
    completed: completedDate !== null,
    completedDate,
    completionDates,
    note,
    target: `${h.target_count}x`,
    days_of_week: h.days_of_week ?? ALL_DAYS,
    visibility: h.visibility ?? "friends",
  };
}

// ---------------------------------------------------------------------------
// Heatmap shared utilities
// ---------------------------------------------------------------------------

const HEATMAP_WEEKS = 26;
const MINI_WEEKS = 18;
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

// LeetCode-style color scale
const LC_EMPTY  = "var(--lc-empty, hsl(220,13%,91%))";
const LC_LEVELS = [
  "hsl(152,38%,76%)",  // level 1 – very light green
  "hsl(152,48%,58%)",  // level 2
  "hsl(152,56%,42%)",  // level 3
  "hsl(152,62%,29%)",  // level 4 – deep green
] as const;

function lcColor(count: number): string {
  if (count <= 0) return LC_EMPTY;
  if (count === 1)  return LC_LEVELS[0];
  if (count === 2)  return LC_LEVELS[1];
  if (count === 3)  return LC_LEVELS[2];
  return LC_LEVELS[3];
}

// Build weeks array from today going back N weeks, Sunday-aligned
function buildWeeks(numWeeks: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
  const startDate = new Date(endSunday);
  startDate.setDate(endSunday.getDate() - numWeeks * 7 + 1);

  const cells: { iso: string; dayOfWeek: number; month: number; date: Date }[] = [];
  const cur = new Date(startDate);
  while (cur <= endSunday) {
    cells.push({
      iso: isoDate(cur),
      dayOfWeek: cur.getDay(),
      month: cur.getMonth(),
      date: new Date(cur),
    });
    cur.setDate(cur.getDate() + 1);
  }

  const weeks: typeof cells[] = [];
  let week: typeof cells = [];
  for (const c of cells) {
    week.push(c);
    if (c.dayOfWeek === 6) { weeks.push(week); week = []; }
  }
  if (week.length > 0) weeks.push(week);
  return weeks;
}

// ---------------------------------------------------------------------------
// Global activity heatmap (LeetCode style)
// ---------------------------------------------------------------------------

// Day labels: show only Mon / Wed / Fri (rows 1, 3, 5 in 0=Sun grid)
const DAY_ROW_LABELS: Record<number, string> = { 1: "Mon", 3: "Wed", 5: "Fri" };

function HabitHeatmap({ days }: { days: HeatmapDay[] }) {
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of days) m.set(d.date, d.count);
    return m;
  }, [days]);

  const weeks = useMemo(() => buildWeeks(HEATMAP_WEEKS), []);

  // Month labels: one per new month, placed at the week where it first appears
  const monthCols = useMemo(() => {
    const seen = new Set<number>();
    return weeks.map((week) => {
      const m = week[0]?.month ?? -1;
      if (m !== -1 && !seen.has(m)) { seen.add(m); return MONTH_NAMES[m]; }
      return "";
    });
  }, [weeks]);

  const totalCompletions = days.reduce((s, d) => s + d.count, 0);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        <span className="text-xs text-muted-foreground">{totalCompletions} completions</span>
      </div>
      <Card className="border p-3 pb-2">
        <div className="flex gap-1.5">
          {/* Day-of-week labels */}
          <div className="flex flex-col shrink-0" style={{ paddingTop: "1.1rem", gap: 0 }}>
            {Array.from({ length: 7 }, (_, row) => (
              <div
                key={row}
                className="flex items-center justify-end pr-1"
                style={{ height: "calc((100% - 6 * 3px) / 7)" }}
              >
                <span className="text-[9px] leading-none text-muted-foreground w-5 text-right">
                  {DAY_ROW_LABELS[row] ?? ""}
                </span>
              </div>
            ))}
          </div>

          {/* Grid + month labels */}
          <div className="flex-1 min-w-0">
            {/* Month labels row */}
            <div className="flex gap-[3px] mb-[3px]">
              {monthCols.map((label, wi) => (
                <div key={wi} className="flex-1 overflow-hidden">
                  <span className="text-[9px] leading-none text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div className="flex gap-[3px] w-full">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px] flex-1">
                  {week.map((cell) => (
                    <div
                      key={cell.iso}
                      title={`${cell.iso}: ${countByDate.get(cell.iso) ?? 0} habit${(countByDate.get(cell.iso) ?? 0) !== 1 ? "s" : ""}`}
                      className="w-full aspect-square rounded-[3px] cursor-default transition-opacity hover:opacity-70"
                      style={{ backgroundColor: lcColor(countByDate.get(cell.iso) ?? 0) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-[3px] justify-end">
          <span className="text-[9px] text-muted-foreground mr-1">Less</span>
          {[0, 1, 2, 3, 4].map((v) => (
            <div key={v} className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: lcColor(v) }} />
          ))}
          <span className="text-[9px] text-muted-foreground ml-1">More</span>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-habit mini heatmap (LeetCode style, no labels)
// ---------------------------------------------------------------------------

function MiniHeatmap({ completionDates, daysOfWeek, color }: {
  completionDates: string[];
  daysOfWeek: number[];
  color: string;
}) {
  const doneSet = useMemo(() => new Set(completionDates), [completionDates]);
  const todayStr = useMemo(() => isoDate(new Date()), []);
  const allDays = daysOfWeek.length === 0 ? ALL_DAYS : daysOfWeek;

  const weeks = useMemo(() => buildWeeks(MINI_WEEKS), []);

  return (
    <div className="flex gap-[3px] w-full">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px] flex-1">
          {week.map((cell) => {
            const ourDay = (cell.dayOfWeek + 6) % 7;
            const scheduled = allDays.includes(ourDay);
            const done = doneSet.has(cell.iso);
            const isToday = cell.iso === todayStr;

            let bg: string;
            if (done) bg = color;
            else if (!scheduled) bg = "transparent";
            else bg = LC_EMPTY;

            return (
              <div
                key={cell.iso}
                title={`${cell.iso}${done ? " ✓" : scheduled ? "" : " (not scheduled)"}`}
                className="w-full aspect-square rounded-[2px] cursor-default"
                style={{
                  backgroundColor: bg,
                  opacity: isToday && !done ? 0.45 : 1,
                  boxShadow: isToday ? `0 0 0 1.5px ${color}` : undefined,
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
  const [createCategory, setCreateCategory] = useState<string | null>(null);
  const [createIcon, setCreateIcon] = useState<string | null>(null);
  const [createVisibility, setCreateVisibility] = useState<"friends" | "selected" | "private">("friends");
  const [createSelectedFriends, setCreateSelectedFriends] = useState<Set<number>>(new Set());

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDays, setEditDays] = useState<number[]>([...ALL_DAYS]);
  const [editVisibility, setEditVisibility] = useState<"friends" | "selected" | "private">("friends");
  const [editSelectedFriends, setEditSelectedFriends] = useState<Set<number>>(new Set());
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [friendsList, setFriendsList] = useState<FriendResponse[]>([]);
  const [saving, setSaving] = useState(false);

  // Share dialog state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareHabitId, setShareHabitId] = useState<number | null>(null);
  const [shareHabitName, setShareHabitName] = useState("");
  const [shareSearch, setShareSearch] = useState("");
  const [shareSearchResults, setShareSearchResults] = useState<FriendResponse[]>([]);
  const [shareInviting, setShareInviting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  // Members panel per habit id
  const [expandedMembers, setExpandedMembers] = useState<Set<number>>(new Set());
  const [habitMembers, setHabitMembers] = useState<Map<number, SharedHabitMemberStat[]>>(new Map());
  type ShareInfoCache = { group_id: number | null; is_owner: boolean };
  const [habitShareInfo, setHabitShareInfo] = useState<Map<number, ShareInfoCache>>(new Map());
  type SortKey = "name" | "streak" | "completion_rate";
  const [memberSort, setMemberSort] = useState<Map<number, { key: SortKey; dir: "asc" | "desc" }>>(new Map());

  // Note expansion state per habit id
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [noteValues, setNoteValues] = useState<Map<number, string>>(new Map());
  const [savingNote, setSavingNote] = useState<Set<number>>(new Set());
  const noteTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Heatmap state
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);

  // Daily AI insight
  const [dailyInsight, setDailyInsight] = useState<string | null>(null);

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
        // Load share info for all habits so the members panel is visible
        void (async () => {
          const results = await Promise.allSettled(
            mapped.map((h) => api.sharedHabits.shareInfo(token, h.id))
          );
          setHabitShareInfo((prev) => {
            const next = new Map(prev);
            mapped.forEach((h, i) => {
              const r = results[i];
              next.set(h.id, r?.status === "fulfilled" ? r.value : { group_id: null, is_owner: false });
            });
            return next;
          });
        })();
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
    } catch {
      if (!cancelled?.v) setError("Failed to load habits. Please try again.");
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

  async function loadDailyInsight() {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `adet_insight_${user.id}_${today}`;
    const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
    if (cached) { setDailyInsight(cached); return; }
    try {
      const data = await api.ai.dailyInsight(token);
      setDailyInsight(data.insight);
      if (typeof window !== "undefined") localStorage.setItem(cacheKey, data.insight);
    } catch {
      // silently fail — keep null to show static fallback
    }
  }

  useEffect(() => {
    const c = { v: false };
    void loadHabits(selectedIso, c);
    return () => { c.v = true; };
  }, [token, selectedIso]);

  useEffect(() => {
    void loadHeatmap();
    void loadDailyInsight();
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
      const created = await api.habits.create(token, {
        name: createName.trim(),
        description: createDescription.trim() || null,
        days_of_week: createDays.length === 7 ? ALL_DAYS : createDays,
        category: createCategory,
        icon: createIcon,
        visibility: createVisibility,
      });
      if (createVisibility === "selected" && createSelectedFriends.size > 0) {
        await api.habits.setVisibleTo(token, created.id, [...createSelectedFriends]);
      }
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateDays([...ALL_DAYS]);
      setCreateCategory(null);
      setCreateIcon(null);
      setCreateVisibility("friends");
      setCreateSelectedFriends(new Set());
      await loadHabits(selectedIso);
      void loadHeatmap();
    } catch {
      setError("Failed to create habit. Please try again.");
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
    setEditVisibility(habit.visibility);
    setEditSelectedFriends(new Set());
    setEditCategory(habit.categoryKey ?? null);
    setEditIcon(habit.iconKey ?? null);
    setEditOpen(true);
    // Load friends list for the picker
    api.friends.list(token).then(setFriendsList).catch(() => {});
    if (habit.visibility === "selected") {
      api.habits.getVisibleTo(token, habit.id)
        .then((ids) => setEditSelectedFriends(new Set(ids)))
        .catch(() => {});
    }
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
        visibility: editVisibility,
        category: editCategory,
        icon: editIcon,
      });
      if (editVisibility === "selected") {
        await api.habits.setVisibleTo(token, editHabit.id, [...editSelectedFriends]);
      }
      setEditOpen(false);
      await loadHabits(selectedIso);
    } catch {
      setError("Failed to update habit. Please try again.");
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
    } catch {
      setError("Failed to delete habit. Please try again.");
    }
  };

  const cycleVisibility = async (e: React.MouseEvent, habitId: number, current: "friends" | "selected" | "private") => {
    e.stopPropagation();
    const cycle: Array<"friends" | "selected" | "private"> = ["friends", "selected", "private"];
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    setHabits((prev) => prev.map((h) => h.id === habitId ? { ...h, visibility: next } : h));
    try {
      await api.habits.update(token, habitId, { visibility: next });
    } catch {
      setHabits((prev) => prev.map((h) => h.id === habitId ? { ...h, visibility: current } : h));
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
      }
    } catch {
      setError("Failed to update habit. Please try again.");
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

  // --- Share handlers ---
  const openShareDialog = async (e: React.MouseEvent, habit: Habit) => {
    e.stopPropagation();
    setShareHabitId(habit.id);
    setShareHabitName(habit.name);
    setShareSearch("");
    setShareSearchResults([]);
    setShareError(null);
    // Populate with accepted friends
    const friends = await api.friends.list(token).catch(() => [] as FriendResponse[]);
    setShareSearchResults(friends.filter((f) => f.status === "accepted"));
    setShareOpen(true);
  };

  const inviteFriend = async (userId: number) => {
    if (!shareHabitId) return;
    setShareInviting(true);
    setShareError(null);
    try {
      await api.sharedHabits.invite(token, shareHabitId, userId);
      setShareError("Invited!");
    } catch {
      setShareError("Failed to send invite. Please try again.");
    } finally {
      setShareInviting(false);
    }
  };

  const toggleMembersPanel = async (e: React.MouseEvent, habit: Habit) => {
    e.stopPropagation();
    const next = new Set(expandedMembers);
    if (next.has(habit.id)) {
      next.delete(habit.id);
      setExpandedMembers(next);
      return;
    }
    next.add(habit.id);
    setExpandedMembers(next);
    try {
      const members = await api.sharedHabits.members(token, habit.id);
      setHabitMembers((prev) => new Map(prev).set(habit.id, members));
    } catch {
      setHabitMembers((prev) => new Map(prev).set(habit.id, []));
    }
  };

  const leaveOrDissolveGroup = async (habitId: number, groupId: number) => {
    const isOwner = habitShareInfo.get(habitId)?.is_owner ?? false;
    const msg = isOwner
      ? "Dissolve this shared habit? All members will keep their habit copies but the link will be removed."
      : "Leave this shared habit? Your habit copy will be deleted.";
    if (!confirm(msg)) return;
    try {
      await api.sharedHabits.leave(token, groupId);
      setExpandedMembers((prev) => { const n = new Set(prev); n.delete(habitId); return n; });
      setHabitShareInfo((prev) => { const n = new Map(prev); n.delete(habitId); return n; });
      await loadHabits(selectedIso);
    } catch {
      setError("Failed to leave shared habit. Please try again.");
    }
  };

  const cycleSort = (habitId: number, key: SortKey) => {
    setMemberSort((prev) => {
      const cur = prev.get(habitId);
      const next = new Map(prev);
      if (cur?.key === key) {
        next.set(habitId, { key, dir: cur.dir === "asc" ? "desc" : "asc" });
      } else {
        next.set(habitId, { key, dir: key === "name" ? "asc" : "desc" });
      }
      return next;
    });
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="mx-auto w-full max-w-lg md:max-w-4xl px-4 pt-6 min-w-0">
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
          onClick={() => { setCreateOpen(true); api.friends.list(token).then(setFriendsList).catch(() => {}); }}
        >
          <Plus className="h-5 w-5" />
          <span className="sr-only">Add habit</span>
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            {/* Category */}
            <div className="grid gap-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES_LIST.map((cat) => {
                  const CatIcon = ICON_MAP[cat.icon] ?? Star;
                  const active = createCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        setCreateCategory(cat.key);
                        if (!createIcon) setCreateIcon(cat.icon);
                      }}
                      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                      style={active ? { borderColor: cat.color, backgroundColor: cat.color + "20", color: cat.color } : {}}
                    >
                      <CatIcon className="h-3 w-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Icon */}
            <div className="grid gap-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ICONS_LIST.map((key) => {
                  const Ic = ICON_MAP[key] ?? Star;
                  const active = createIcon === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCreateIcon(key)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      <Ic className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Visibility */}
            <div className="grid gap-2">
              <Label>Who sees this in the feed?</Label>
              <div className="flex gap-2">
                {([
                  { key: "friends", label: "All friends", Icon: Eye },
                  { key: "selected", label: "Select", Icon: Users },
                  { key: "private", label: "Nobody", Icon: EyeOff },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCreateVisibility(key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors",
                      createVisibility === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              {createVisibility === "selected" && (
                <div className="mt-1 max-h-40 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
                  {friendsList.length === 0 && (
                    <p className="text-xs text-muted-foreground">No friends yet.</p>
                  )}
                  {friendsList.map((f) => {
                    const on = createSelectedFriends.has(f.id);
                    return (
                      <label key={f.id} className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        on ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      )}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            setCreateSelectedFriends((prev) => {
                              const n = new Set(prev);
                              on ? n.delete(f.id) : n.add(f.id);
                              return n;
                            });
                          }}
                          className="accent-primary"
                        />
                        {f.full_name || f.email}
                      </label>
                    );
                  })}
                </div>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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

            {/* Category */}
            <div className="grid gap-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES_LIST.map((cat) => {
                  const CatIcon = ICON_MAP[cat.icon] ?? Star;
                  const active = editCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        setEditCategory(cat.key);
                        if (!editIcon) setEditIcon(cat.icon);
                      }}
                      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                      style={active ? { borderColor: cat.color, backgroundColor: cat.color + "20", color: cat.color } : {}}
                    >
                      <CatIcon className="h-3 w-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Icon */}
            <div className="grid gap-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ICONS_LIST.map((key) => {
                  const Ic = ICON_MAP[key] ?? Star;
                  const active = editIcon === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditIcon(key)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      <Ic className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visibility */}
            <div className="grid gap-2">
              <Label>Who sees this in the feed?</Label>
              <div className="flex gap-2">
                {([
                  { key: "friends", label: "All friends", Icon: Eye },
                  { key: "selected", label: "Select", Icon: Users },
                  { key: "private", label: "Nobody", Icon: EyeOff },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditVisibility(key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors",
                      editVisibility === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              {editVisibility === "selected" && (
                <div className="mt-1 max-h-40 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
                  {friendsList.length === 0 && (
                    <p className="text-xs text-muted-foreground">No friends yet.</p>
                  )}
                  {friendsList.map((f) => {
                    const on = editSelectedFriends.has(f.id);
                    return (
                      <label key={f.id} className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        on ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      )}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            setEditSelectedFriends((prev) => {
                              const n = new Set(prev);
                              on ? n.delete(f.id) : n.add(f.id);
                              return n;
                            });
                          }}
                          className="accent-primary"
                        />
                        {f.full_name || f.email}
                      </label>
                    );
                  })}
                </div>
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

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share &ldquo;{shareHabitName}&rdquo;</DialogTitle>
            <DialogDescription>Invite a friend to join this habit. They&apos;ll get their own copy once they accept.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {shareError && (
              <p className={cn("text-sm", shareError === "Invited!" ? "text-green-600" : "text-destructive")}>
                {shareError}
              </p>
            )}
            {shareSearchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accepted friends found.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {shareSearchResults.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{f.full_name || f.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={shareInviting}
                      onClick={() => void inviteFriend(f.id)}
                    >
                      Invite
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShareOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Insight — refreshed once per day */}
      <Card className="mt-5 overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">AI Insight</p>
            <p className="mt-0.5 text-sm leading-relaxed opacity-90">
              {dailyInsight ?? "Loading your personalized insight…"}
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
      <div className="overflow-x-auto">
        <HabitHeatmap days={heatmapDays} />
      </div>

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

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {loading && visibleHabits.length === 0 ? (
            <Card className="border lg:col-span-2">
              <CardContent className="p-4 text-sm text-muted-foreground">Loading habits...</CardContent>
            </Card>
          ) : visibleHabits.length === 0 ? (
            <Card className="border lg:col-span-2">
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
                      {/* Note toggle — always visible */}
                      <button
                        type="button"
                        onClick={(e) => toggleNote(e, habit.id)}
                        className={cn(
                          "flex items-center justify-center h-7 w-7 rounded-full hover:bg-muted transition-colors",
                          noteValue && "text-primary"
                        )}
                        title={noteExpanded ? "Hide note" : habit.completed ? "Add note" : "Add skip reason"}
                      >
                        {noteExpanded
                          ? <ChevronUp className={cn("h-3.5 w-3.5", noteValue ? "text-primary" : "text-muted-foreground")} />
                          : <ChevronDown className={cn("h-3.5 w-3.5", noteValue ? "text-primary" : "text-muted-foreground")} />}
                      </button>
                      {/* Visibility cycle: friends → selected → private */}
                      <button
                        type="button"
                        onClick={(e) => void cycleVisibility(e, habit.id, habit.visibility)}
                        className="flex items-center justify-center h-7 w-7 rounded-full hover:bg-muted transition-colors"
                        title={
                          habit.visibility === "friends" ? "All friends — click to select specific"
                          : habit.visibility === "selected" ? "Selected friends — click to make private"
                          : "Private — click to show to all friends"
                        }
                      >
                        {habit.visibility === "friends"
                          ? <Eye className="h-3.5 w-3.5 text-primary" />
                          : habit.visibility === "selected"
                          ? <Users className="h-3.5 w-3.5 text-chart-2" />
                          : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      {/* Edit + Share — hide only for non-owner members of a shared group */}
                      {(habitShareInfo.get(habit.id)?.group_id === null ||
                        habitShareInfo.get(habit.id)?.is_owner === true ||
                        !habitShareInfo.has(habit.id)) && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => openEditDialog(e, habit)}
                            className="flex items-center justify-center h-7 w-7 rounded-full hover:bg-muted transition-colors"
                            title="Edit habit"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void openShareDialog(e, habit)}
                            className="flex items-center justify-center h-7 w-7 rounded-full hover:bg-muted transition-colors"
                            title="Share with a friend"
                          >
                            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </>
                      )}
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
                  {noteExpanded && (
                    <div className="px-3.5 pb-3 -mt-1" onClick={(e) => e.stopPropagation()}>
                      <Textarea
                        value={noteValue}
                        onChange={(e) =>
                          handleNoteChange(habit.id, e.target.value, habit.completedDate ?? selectedIso)
                        }
                        placeholder={habit.completed ? "Add a note about this completion…" : "Why couldn't you complete this today?"}
                        className="text-sm resize-none min-h-[70px]"
                        rows={2}
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground text-right">
                        {isSavingNote ? "Saving…" : "Auto-saved"}
                      </p>
                    </div>
                  )}

                  {/* Per-habit mini heatmap */}
                  <div className="px-3.5 pb-3 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <MiniHeatmap
                      completionDates={habit.completionDates}
                      daysOfWeek={habit.days_of_week}
                      color={habit.color}
                    />
                  </div>

                  {/* Shared members toggle — only shown if habit is in a group */}
                  {habitShareInfo.has(habit.id) && habitShareInfo.get(habit.id)?.group_id !== null && (() => {
                    const info = habitShareInfo.get(habit.id)!;
                    const sort = memberSort.get(habit.id) ?? { key: "streak" as SortKey, dir: "desc" as const };
                    const rawMembers = habitMembers.get(habit.id) ?? [];
                    const sorted = [...rawMembers].sort((a, b) => {
                      let diff = 0;
                      if (sort.key === "name") diff = (a.full_name || a.email).localeCompare(b.full_name || b.email);
                      else if (sort.key === "streak") diff = a.streak - b.streak;
                      else diff = a.completion_rate - b.completion_rate;
                      return sort.dir === "asc" ? diff : -diff;
                    });
                    const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
                      <button
                        type="button"
                        onClick={() => cycleSort(habit.id, col)}
                        className="flex items-center gap-0.5 hover:text-foreground transition-colors"
                      >
                        {label}
                        {sort.key === col ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                      </button>
                    );
                    return (
                      <div className="px-3.5 pb-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => void toggleMembersPanel(e, habit)}
                        >
                          <Users className="h-3 w-3" />
                          <span>{expandedMembers.has(habit.id) ? "Hide members" : "Show members"}</span>
                        </button>

                        {expandedMembers.has(habit.id) && (
                          <div className="mt-2">
                            {/* Table header */}
                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[10px] font-semibold text-muted-foreground mb-1 px-1">
                              <SortBtn col="name" label="Member" />
                              <SortBtn col="streak" label="Streak" />
                              <SortBtn col="completion_rate" label="30d %" />
                            </div>
                            <div className="space-y-1">
                              {sorted.map((m) => (
                                <div key={m.user_id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center text-xs rounded-md bg-muted/40 px-1 py-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                      <span className="text-[9px] font-bold text-primary uppercase">
                                        {(m.full_name || m.email)[0]}
                                      </span>
                                    </div>
                                    <span className="truncate text-foreground font-medium">
                                      {m.full_name || m.email}
                                      {m.is_owner && <span className="ml-1 text-[10px] text-muted-foreground">(owner)</span>}
                                    </span>
                                  </div>
                                  <span className="flex items-center gap-0.5 font-semibold text-foreground">
                                    <Flame className="h-2.5 w-2.5 text-orange-500" />
                                    {m.streak}
                                  </span>
                                  <span className="font-semibold text-foreground text-right">{m.completion_rate}%</span>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="flex items-center gap-1 text-[11px] text-destructive/70 hover:text-destructive mt-2"
                              onClick={() => {
                                if (info.group_id) void leaveOrDissolveGroup(habit.id, info.group_id);
                              }}
                            >
                              <LogOut className="h-3 w-3" />
                              {info.is_owner ? "Dissolve shared habit" : "Leave shared habit"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
