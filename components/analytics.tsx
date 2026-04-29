"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, Target, Zap, Calendar, Brain, GitBranch, Award,
  Flame, Star, ChevronDown, ChevronUp, CheckCircle2,
  Heart, Activity, BookOpen, Coffee, Sun, Moon, Smile, Home,
  Users, Music, Code2, Clock, Leaf, Droplets, Camera, Globe,
  Lightbulb, Headphones, ShoppingBag, Plane, BarChart2, Dumbbell,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  LineChart, Line, ReferenceLine, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  api,
  type AnalyticsSummaryResponse,
  type SentimentTrendResponse,
  type CorrelationMatrixResponse,
  type HabitAnalyticsItem,
  type QuestionField,
  type ProposedHabit,
  type AnalyzeResponse,
} from "@/lib/api";
import { Send, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = { token: string };

// ── Icon + category registry ──────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  heart: Heart, activity: Activity, brain: Brain, "book-open": BookOpen,
  coffee: Coffee, target: Target, star: Star, zap: Zap, sun: Sun, moon: Moon,
  smile: Smile, home: Home, users: Users, music: Music, code: Code2,
  clock: Clock, leaf: Leaf, flame: Flame, award: Award, droplets: Droplets,
  camera: Camera, globe: Globe, lightbulb: Lightbulb, headphones: Headphones,
  "shopping-bag": ShoppingBag, plane: Plane, "bar-chart": BarChart2, dumbbell: Dumbbell,
};

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  health:    { label: "Health",    color: "#ef4444", icon: "heart" },
  fitness:   { label: "Fitness",   color: "#f97316", icon: "dumbbell" },
  mind:      { label: "Mind",      color: "#8b5cf6", icon: "brain" },
  learning:  { label: "Learning",  color: "#3b82f6", icon: "book-open" },
  social:    { label: "Social",    color: "#ec4899", icon: "users" },
  work:      { label: "Work",      color: "#10b981", icon: "target" },
  finance:   { label: "Finance",   color: "#f59e0b", icon: "bar-chart" },
  lifestyle: { label: "Lifestyle", color: "#06b6d4", icon: "sun" },
  other:     { label: "Other",     color: "#6b7280", icon: "star" },
};

function catColor(cat: string | null) { return CATEGORY_META[cat ?? ""]?.color ?? "hsl(var(--primary))"; }
function catLabel(cat: string | null) { return CATEGORY_META[cat ?? ""]?.label ?? (cat ?? "Other"); }
function catIconKey(cat: string | null) { return CATEGORY_META[cat ?? ""]?.icon ?? "star"; }

function HabitIcon({ iconKey, className }: { iconKey: string | null; className?: string }) {
  const Ic = (iconKey ? ICON_MAP[iconKey] : null) ?? CheckCircle2;
  return <Ic className={className ?? "h-4 w-4"} />;
}

// Dots-30 mini chart
function Dots30({ days, color }: { days: { date: string; count: number }[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-[3px] mt-2">
      {days.map((d, i) => (
        <div
          key={i}
          title={d.date}
          className="h-[9px] w-[9px] rounded-[2px]"
          style={{ backgroundColor: d.count ? color : "hsl(var(--muted))" }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function Analytics({ token }: Props) {
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [habitStats, setHabitStats] = useState<HabitAnalyticsItem[]>([]);
  const [chartData, setChartData] = useState<Array<{ day: string; completed: number }>>([]);
  const [sentiment, setSentiment] = useState<SentimentTrendResponse | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "categories" | "habits" | "ai">("overview");
  const [expandedHabit, setExpandedHabit] = useState<number | null>(null);

  // AI analytics state
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<{ role: string; content: string }[]>([]);
  const [aiResults, setAiResults] = useState<(AnalyzeResponse & { query: string; declinedIdxs?: Set<number>; acceptedIdxs?: Set<number> })[]>([]);
  // Pending questions state
  const [questionState, setQuestionState] = useState<{
    query: string;
    fields: QuestionField[];
    intro: string | null;
    answers: Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const [s, sent, corr, hs] = await Promise.all([
          api.analytics.summary(token),
          api.analytics.sentiment(token, 90).catch(() => null),
          api.analytics.correlations(token, 90, 0.3).catch(() => null),
          api.analytics.habits(token, 90).catch(() => [] as HabitAnalyticsItem[]),
        ]);
        const chart = s.last_7_days.map(({ date: iso, count }) => {
          const d = new Date(`${iso}T00:00:00`);
          const day = d.toLocaleDateString("en-US", { weekday: "short" });
          return { day, completed: count };
        });
        if (!cancelled) {
          setSummary(s); setChartData(chart);
          setSentiment(sent); setCorrelations(corr);
          setHabitStats(hs);
        }
      } catch {
        if (!cancelled) setError("Failed to load analytics. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [token]);

  const consistency = useMemo(() => {
    if (!summary) return 0;
    return Math.min(100, Math.round((summary.completions_this_week / summary.possible_this_week) * 100));
  }, [summary]);

  // Category aggregation
  const categoryData = useMemo(() => {
    if (!habitStats.length) return [];
    const map = new Map<string, { total: number; rateSum: number; count: number }>();
    for (const h of habitStats) {
      const key = h.category ?? "other";
      const cur = map.get(key) ?? { total: 0, rateSum: 0, count: 0 };
      cur.total += h.total_completions;
      cur.rateSum += h.completion_rate;
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({
        key, label: catLabel(key), color: catColor(key), iconKey: catIconKey(key),
        total: v.total, avgRate: Math.round((v.rateSum / v.count) * 100), habitCount: v.count,
      }))
      .sort((a, b) => b.total - a.total);
  }, [habitStats]);

  const sentimentChart = useMemo(() => {
    if (!sentiment?.daily.length) return [];
    return sentiment.daily.slice(-30).map((d) => ({
      label: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: d.avg_score,
    }));
  }, [sentiment]);

  const sentimentColor = (avg: number) =>
    avg >= 0.05 ? "hsl(var(--chart-2))" : avg <= -0.05 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";

  const stats = [
    { label: "Consistency", value: `${consistency}%`, icon: Target },
    { label: "Current Streak", value: `${summary?.stats.current_streak_days ?? 0} days`, icon: Zap },
    { label: "All-time", value: `${summary?.total_completions ?? 0}`, icon: Calendar },
    { label: "Total XP", value: `${summary?.stats.total_xp ?? 0}`, icon: TrendingUp },
  ];

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl px-4 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
        <span className="text-sm text-muted-foreground">Live</span>
      </div>

      {/* Tab bar */}
      <div className="mt-4 flex rounded-xl bg-muted p-1 gap-1">
        {(["overview", "categories", "habits", "ai"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors",
              tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "overview" ? "Overview" : t === "categories" ? "Categories" : t === "habits" ? "Habits" : "AI"}
          </button>
        ))}
      </div>

      {loading && <p className="mt-8 text-center text-sm text-muted-foreground">Loading analytics...</p>}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!loading && tab === "overview" && (
        <>
          {/* Stat cards */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="border">
                  <CardContent className="p-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-card-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Level banner */}
          <Card className="mt-4 border-0 bg-primary text-primary-foreground shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold">Level {summary?.stats.level ?? 0} — {levelTitle(summary?.stats.level ?? 0)}</p>
                  <p className="mt-0.5 text-sm opacity-85">{summary?.stats.total_xp ?? 0} XP total</p>
                </div>
                <Award className="h-7 w-7 opacity-60" />
              </div>
              {/* XP progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs opacity-85 mb-1.5">
                  <span>{(summary?.stats.total_xp ?? 0) % 100}/100 XP</span>
                  <span>→ Level {(summary?.stats.level ?? 0) + 1}</span>
                </div>
                <div className="h-2 rounded-full bg-white/25 overflow-hidden">
                  <div className="h-full rounded-full bg-white" style={{ width: `${(summary?.stats.total_xp ?? 0) % 100}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts grid — 2 columns on desktop */}
          <div className="md:grid md:grid-cols-2 md:gap-4 md:items-start md:mt-4">
          {/* 7-day area chart */}
          <Card className="mt-4 md:mt-0 border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-card-foreground">Last 7 days</p>
              <div className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#completedGrad)" dot={{ fill: "hsl(var(--primary))", r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Streaks */}
          <Card className="mt-4 md:mt-0 border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-card-foreground mb-3">Streaks</p>
              <div className="flex justify-around">
                <div className="text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <span className="text-2xl font-bold text-orange-500">{summary?.stats.current_streak_days ?? 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Current</p>
                </div>
                <div className="w-px bg-border" />
                <div className="text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <Star className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold text-primary">{summary?.stats.longest_streak_days ?? 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Personal best</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          <Card className="mt-4 md:mt-0 border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-card-foreground mb-3">Insights</p>
              <div className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />Best day: <span className="font-medium text-foreground">{summary?.best_weekday ?? "—"}</span></div>
                <div className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-primary shrink-0" />Today: <span className="font-medium text-foreground">{summary?.completions_today ?? 0} completions</span></div>
                <div className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-primary shrink-0" />This week: <span className="font-medium text-foreground">{summary?.completions_this_week ?? 0}/{summary?.possible_this_week ?? 0}</span> scheduled slots</div>
              </div>
            </CardContent>
          </Card>

          {/* Sentiment */}
          {sentiment && sentiment.daily.length > 0 && (
            <Card className="mt-4 md:mt-0 border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-card-foreground">Mood from notes</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{sentiment.insight}</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sentimentChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis domain={[-1, 1]} axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(v: number) => v.toFixed(2)} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="score" stroke={sentimentColor(sentiment.overall_avg)} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  Overall avg: <span className="font-medium">{sentiment.overall_avg.toFixed(2)}</span>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Radar chart — category performance */}
          {categoryData.length >= 3 && (
            <Card className="mt-4 md:mt-0 border">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-card-foreground mb-1">Category performance</p>
                <p className="text-xs text-muted-foreground mb-3">Completion rate across categories</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={categoryData.map(c => ({ subject: c.label, rate: c.avgRate }))}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickCount={3} />
                      <Radar dataKey="rate" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                      <Tooltip formatter={(v: number) => [`${v}%`, "Rate"]} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Correlations */}
          {correlations && correlations.edges.length > 0 && (
            <Card className="mt-4 md:mt-0 border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-card-foreground">Habit correlations</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Over {correlations.total_days_tracked} days. Positive = tend to happen together.
                </p>
                <div className="space-y-3">
                  {correlations.edges.slice(0, 5).map((edge) => {
                    const pct = Math.round(Math.abs(edge.correlation) * 100);
                    const pos = edge.correlation >= 0;
                    return (
                      <div key={`${edge.habit_a_id}-${edge.habit_b_id}`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="truncate max-w-[70%] text-card-foreground font-medium">
                            {edge.habit_a_name} ↔ {edge.habit_b_name}
                          </span>
                          <span className={pos ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                            {pos ? "+" : ""}{edge.correlation.toFixed(2)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${pos ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          </div>{/* end charts grid */}
        </>
      )}

      {!loading && tab === "categories" && (
        <>
          {categoryData.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">No categories yet. Add categories to your habits!</p>
          ) : (
            <>
              {/* Pie chart */}
              <Card className="mt-4 md:mt-0 border">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-card-foreground mb-3">Completions by category</p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                          {categoryData.map((cat) => <Cell key={cat.key} fill={cat.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v} completions`, ""]} />
                        <Legend iconSize={10} iconType="circle" formatter={(val) => <span className="text-xs">{val}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Category breakdown bars */}
              <Card className="mt-4 md:mt-0 border">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-card-foreground mb-4">Category breakdown</p>
                  <div className="space-y-4">
                    {categoryData.map(cat => {
                      const Icon = ICON_MAP[cat.iconKey] ?? Star;
                      const maxTotal = Math.max(...categoryData.map(c => c.total), 1);
                      return (
                        <div key={cat.key}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: cat.color + "20" }}>
                                <Icon className="h-3 w-3" style={{ color: cat.color }} />
                              </div>
                              <span className="text-sm font-medium text-card-foreground">{cat.label}</span>
                              <span className="text-xs text-muted-foreground">{cat.habitCount} habit{cat.habitCount !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-muted-foreground">{cat.avgRate}% rate</span>
                              <span className="font-semibold" style={{ color: cat.color }}>{cat.total}</span>
                            </div>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((cat.total / maxTotal) * 100)}%`, backgroundColor: cat.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Per-category habit lists */}
              {categoryData.map(cat => {
                const habits = habitStats.filter(h => (h.category ?? "other") === cat.key);
                const Icon = ICON_MAP[cat.iconKey] ?? Star;
                return (
                  <Card key={cat.key} className="mt-4 border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: cat.color + "20" }}>
                          <Icon className="h-3.5 w-3.5" style={{ color: cat.color }} />
                        </div>
                        <p className="text-sm font-semibold text-card-foreground">{cat.label}</p>
                      </div>
                      <div className="space-y-2">
                        {habits.map(h => (
                          <div key={h.habit_id} className="flex items-center justify-between py-1.5 border-t border-border text-xs">
                            <span className="text-card-foreground truncate max-w-[55%]">{h.habit_name}</span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Flame className="h-3 w-3 text-orange-500" />
                                <span className="text-orange-500 font-medium">{h.current_streak}d</span>
                              </div>
                              <span className="font-semibold" style={{ color: cat.color }}>{Math.round(h.completion_rate * 100)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}

      {!loading && tab === "habits" && (
        <>
          {habitStats.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">No habits yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {habitStats.map(h => {
                const color = catColor(h.category);
                const expanded = expandedHabit === h.habit_id;
                const rate = Math.round(h.completion_rate * 100);
                const doneIn30 = h.last_30_days.filter(d => d.count).length;
                return (
                  <Card key={h.habit_id} className="border cursor-pointer" onClick={() => setExpandedHabit(expanded ? null : h.habit_id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color + "20" }}>
                          <HabitIcon iconKey={h.icon} className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-card-foreground truncate">{h.habit_name}</p>
                          <p className="text-xs text-muted-foreground">{catLabel(h.category)} · {h.total_completions} completions</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold" style={{ color }}>{rate}%</span>
                          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {expanded && (
                        <div className="mt-4 pt-4 border-t border-border space-y-4">
                          {/* Streak + stats row */}
                          <div className="flex justify-around">
                            <div className="text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <Flame className="h-4 w-4 text-orange-500" />
                                <span className="text-xl font-bold text-orange-500">{h.current_streak}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Current streak</p>
                            </div>
                            <div className="w-px bg-border" />
                            <div className="text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <Star className="h-4 w-4 text-primary" />
                                <span className="text-xl font-bold text-primary">{h.longest_streak}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Best streak</p>
                            </div>
                            <div className="w-px bg-border" />
                            <div className="text-center">
                              <span className="text-xl font-bold" style={{ color }}>{doneIn30}</span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Days in 30</p>
                            </div>
                          </div>

                          {/* Completion rate bar */}
                          <div>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground">Last 30 days</span>
                              <span className="font-medium" style={{ color }}>{doneIn30}/30 days</span>
                            </div>
                            <Dots30 days={h.last_30_days} color={color} />
                          </div>

                          {/* 90-day rate progress */}
                          <div>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground">90-day completion rate</span>
                              <span className="font-medium" style={{ color }}>{rate}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── AI Analytics tab ──────────────────────────────────────────────── */}
      {!loading && tab === "ai" && (
        <div className="mt-4 space-y-4">
          {/* Suggestion chips (shown when empty) */}
          {aiResults.length === 0 && !questionState && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Try asking</p>
              {[
                "What are my best days of the week?",
                "Analyze my fitness category",
                "Which habit has the best streak?",
                "Show my weekly trend over 90 days",
              ].map(q => (
                <button
                  key={q}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-sm text-card-foreground transition hover:border-primary/40 hover:shadow-sm"
                  onClick={() => { setAiInput(q); }}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Questions form */}
          {questionState && (
            <QuestionsForm
              intro={questionState.intro}
              fields={questionState.fields}
              onSubmit={async (answers) => {
                setQuestionState(null);
                setAiLoading(true);
                try {
                  await api.user.patchProfile(token, answers);
                  const result = await api.ai.analyze(token, questionState.query, aiHistory, answers);
                  if (result.mode === "questions") {
                    setQuestionState({ query: questionState.query, fields: result.questions, intro: result.intro ?? null, answers });
                  } else {
                    setAiHistory(prev => [...prev, { role: "user", content: questionState.query }, { role: "assistant", content: result.text }]);
                    setAiResults(prev => [...prev, { ...result, query: questionState.query }]);
                  }
                } catch {
                  setAiResults(prev => [...prev, { mode: "analysis", text: "Sorry, the analysis failed. Please try again.", key_insights: [], charts: [], proposed_habits: [], questions: [], query: questionState.query }]);
                } finally {
                  setAiLoading(false);
                }
              }}
              onCancel={() => setQuestionState(null)}
              loading={aiLoading}
            />
          )}

          {/* Results */}
          {aiResults.map((r, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                <span className="italic">"{r.query}"</span>
              </div>

              {/* Text analysis */}
              {r.text && (
                <Card className="border">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-line">{r.text}</p>
                    {r.key_insights.length > 0 && (
                      <ul className="space-y-1">
                        {r.key_insights.map((ins, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{j + 1}</span>
                            <span className="text-muted-foreground">{ins}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Proposed habits */}
              {r.proposed_habits.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Suggested habits
                  </p>
                  {r.proposed_habits.map((habit, hi) => {
                    const accepted = r.acceptedIdxs?.has(hi);
                    const declined = r.declinedIdxs?.has(hi);
                    return (
                      <ProposedHabitCard
                        key={hi}
                        habit={habit}
                        accepted={!!accepted}
                        declined={!!declined}
                        onAccept={async () => {
                          try {
                            if (habit.existing_habit_id) {
                              await api.habits.update(token, habit.existing_habit_id, {
                                name: habit.name,
                                description: habit.description,
                                category: habit.category,
                                icon: habit.icon,
                                days_of_week: habit.days_of_week,
                                target_count: habit.target_count,
                              });
                            } else {
                              await api.habits.create(token, {
                                name: habit.name,
                                description: habit.description,
                                category: habit.category,
                                icon: habit.icon,
                                days_of_week: habit.days_of_week,
                                target_count: habit.target_count,
                              });
                            }
                            setAiResults(prev => prev.map((res, ri) =>
                              ri === i ? { ...res, acceptedIdxs: new Set([...(res.acceptedIdxs ?? []), hi]) } : res
                            ));
                          } catch { /* silent */ }
                        }}
                        onDecline={() => {
                          setAiResults(prev => prev.map((res, ri) =>
                            ri === i ? { ...res, declinedIdxs: new Set([...(res.declinedIdxs ?? []), hi]) } : res
                          ));
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Charts */}
              {r.charts.map((chart, ci) => {
                const color = chart.color ?? "hsl(var(--primary))";
                const gradId = `aiGrad${ci}`;
                return (
                  <Card key={ci} className="border">
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold text-card-foreground mb-3">{chart.title}</p>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          {chart.type === "line" ? (
                            <LineChart data={chart.data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis dataKey={chart.x_key} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Line type="monotone" dataKey={chart.y_key} stroke={color} dot={false} strokeWidth={2} />
                            </LineChart>
                          ) : chart.type === "area" ? (
                            <AreaChart data={chart.data}>
                              <defs>
                                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis dataKey={chart.x_key} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Area type="monotone" dataKey={chart.y_key} stroke={color} fill={`url(#${gradId})`} strokeWidth={2} dot={false} />
                            </AreaChart>
                          ) : chart.type === "pie" ? (
                            <PieChart>
                              <Pie data={chart.data} dataKey={chart.y_key} nameKey={chart.x_key} cx="50%" cy="50%" outerRadius={70} label>
                                {chart.data.map((_, ei) => (
                                  <Cell key={ei} fill={`hsl(${(ei * 47) % 360}, 65%, 55%)`} />
                                ))}
                              </Pie>
                              <Legend />
                              <Tooltip />
                            </PieChart>
                          ) : chart.type === "radar" ? (
                            <RadarChart data={chart.data}>
                              <PolarGrid stroke="hsl(var(--border))" />
                              <PolarAngleAxis dataKey={chart.x_key} tick={{ fontSize: 10 }} />
                              <PolarRadiusAxis tick={{ fontSize: 9 }} tickCount={3} />
                              <Radar dataKey={chart.y_key} stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
                              <Tooltip />
                            </RadarChart>
                          ) : chart.type === "scatter" ? (
                            <ScatterChart>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey={chart.x_key} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} name={chart.x_key} />
                              <YAxis dataKey={chart.y_key} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} name={chart.y_key} />
                              <ZAxis range={[40, 40]} />
                              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                              <Scatter data={chart.data} fill={color} />
                            </ScatterChart>
                          ) : (
                            <BarChart data={chart.data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis dataKey={chart.x_key} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar dataKey={chart.y_key} fill={color} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ))}

          {aiLoading && (
            <Card className="border">
              <CardContent className="flex items-center gap-3 p-4">
                <Bot className="h-5 w-5 text-primary animate-pulse" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-card-foreground">Analyzing your data...</p>
                  <p className="text-xs text-muted-foreground">Fetching habits, computing patterns</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Input */}
          {!questionState && (
            <form
              className="flex gap-2 pt-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const q = aiInput.trim();
                if (!q || aiLoading) return;
                setAiInput("");
                setAiLoading(true);
                try {
                  const result = await api.ai.analyze(token, q, aiHistory);
                  if (result.mode === "questions") {
                    setQuestionState({ query: q, fields: result.questions, intro: result.intro ?? null, answers: {} });
                  } else {
                    setAiHistory(prev => [...prev, { role: "user", content: q }, { role: "assistant", content: result.text }]);
                    setAiResults(prev => [...prev, { ...result, query: q }]);
                  }
                } catch {
                  setAiResults(prev => [...prev, { mode: "analysis", text: "Sorry, the analysis failed. Please try again.", key_insights: [], charts: [], proposed_habits: [], questions: [], query: q }]);
                } finally {
                  setAiLoading(false);
                }
              }}
            >
              <Input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                placeholder="Ask about your habits..."
                className="flex-1"
                disabled={aiLoading}
              />
              <Button type="submit" size="icon" disabled={!aiInput.trim() || aiLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ProposedHabitCard({
  habit, accepted, declined, onAccept, onDecline,
}: {
  habit: ProposedHabit;
  accepted: boolean;
  declined: boolean;
  onAccept: () => Promise<void>;
  onDecline: () => void;
}) {
  const color = catColor(habit.category ?? null);
  const iconKey = habit.icon ?? catIconKey(habit.category ?? null);
  const [busy, setBusy] = useState(false);

  return (
    <Card className={cn("border transition-opacity", declined && "opacity-40")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color + "22" }}>
            <HabitIcon iconKey={iconKey} className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-card-foreground">{habit.name}</p>
            {habit.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{habit.description}</p>}
            {/* Days of week chips */}
            {habit.days_of_week.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {habit.days_of_week.map(d => (
                  <span key={d} className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: color + "22", color }}>
                    {DAY_LABELS[d]}
                  </span>
                ))}
              </div>
            )}
            {habit.reason && (
              <p className="mt-2 text-xs text-muted-foreground italic border-l-2 pl-2" style={{ borderColor: color + "66" }}>
                {habit.reason}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {!accepted && !declined && (
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5"
              style={{ backgroundColor: color, color: "white" }}
              disabled={busy}
              onClick={async () => { setBusy(true); await onAccept(); setBusy(false); }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Accept
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onDecline}>
              Decline
            </Button>
          </div>
        )}
        {accepted && (
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {habit.existing_habit_id ? "Habit updated!" : "Habit created!"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionsForm({
  intro, fields, onSubmit, onCancel, loading,
}: {
  intro: string | null;
  fields: QuestionField[];
  onSubmit: (answers: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  function set(id: string, val: unknown) {
    setAnswers(prev => ({ ...prev, [id]: val }));
  }

  return (
    <Card className="border border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-card-foreground">A few quick questions</p>
        </div>
        {intro && <p className="text-sm text-muted-foreground leading-relaxed">{intro}</p>}

        {fields.map(f => (
          <div key={f.id} className="space-y-1.5">
            <label className="text-xs font-medium text-card-foreground">{f.label}</label>

            {f.type === "number" && (
              <Input
                type="number"
                min={f.min}
                max={f.max}
                placeholder={f.placeholder ?? ""}
                value={(answers[f.id] as string) ?? ""}
                onChange={e => set(f.id, e.target.value ? Number(e.target.value) : "")}
                className="h-8 text-sm"
              />
            )}

            {f.type === "text" && (
              <Input
                type="text"
                placeholder={f.placeholder ?? ""}
                value={(answers[f.id] as string) ?? ""}
                onChange={e => set(f.id, e.target.value)}
                className="h-8 text-sm"
              />
            )}

            {f.type === "chips" && f.options && (
              <div className="flex flex-wrap gap-1.5">
                {f.options.map(opt => {
                  const selected = answers[f.id] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => set(f.id, selected ? "" : opt)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {f.type === "slider" && (
              <div className="space-y-1">
                <input
                  type="range"
                  min={f.min ?? 0}
                  max={f.max ?? 10}
                  value={(answers[f.id] as number) ?? f.min ?? 0}
                  onChange={e => set(f.id, Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{f.min ?? 0}</span>
                  <span className="font-semibold text-primary">{(answers[f.id] as number) ?? f.min ?? 0}</span>
                  <span>{f.max ?? 10}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <Button
            className="flex-1"
            size="sm"
            disabled={loading}
            onClick={() => void onSubmit(answers)}
          >
            {loading ? "Analyzing..." : "Submit"}
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function levelTitle(l: number) {
  if (l < 5) return "Beginner";
  if (l < 10) return "Explorer";
  if (l < 20) return "Tracker";
  if (l < 35) return "Master";
  return "Legend";
}
