"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Target, Zap, Calendar, Brain, GitBranch } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  LineChart, Line, ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  api,
  type AnalyticsSummaryResponse,
  type SentimentTrendResponse,
  type CorrelationMatrixResponse,
  type ApiError,
} from "@/lib/api";

type Props = { token: string };

export function Analytics({ token }: Props) {
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [chartData, setChartData] = useState<Array<{ day: string; completed: number }>>([]);
  const [sentiment, setSentiment] = useState<SentimentTrendResponse | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [s, sent, corr] = await Promise.all([
          api.analytics.summary(token),
          api.analytics.sentiment(token, 90).catch(() => null),
          api.analytics.correlations(token, 90, 0.3).catch(() => null),
        ]);

        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        const fromDate = start.toISOString().slice(0, 10);
        const toDate = today.toISOString().slice(0, 10);

        const habits = await api.habits.list(token);
        const completionsByHabit = await Promise.all(
          habits.map((h) => api.habits.listCompletions(token, h.id, { from_date: fromDate, to_date: toDate }))
        );

        const counts = new Map<string, number>();
        for (let i = 0; i < 7; i += 1) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          counts.set(d.toISOString().slice(0, 10), 0);
        }
        completionsByHabit.flat().forEach((c) => {
          if (counts.has(c.completed_date)) {
            counts.set(c.completed_date, (counts.get(c.completed_date) ?? 0) + 1);
          }
        });

        const chart = Array.from(counts.entries()).map(([iso, completed]) => {
          const d = new Date(`${iso}T00:00:00`);
          const day = d.toLocaleDateString("en-US", { weekday: "short" });
          return { day, completed };
        });

        if (!cancelled) {
          setSummary(s);
          setChartData(chart);
          setSentiment(sent);
          setCorrelations(corr);
        }
      } catch (e) {
        if (!cancelled) setError((e as ApiError).message ?? "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [token]);

  const consistency = useMemo(() => {
    if (!summary) return 0;
    return Math.min(100, Math.round((summary.completions_this_week / 7) * 100));
  }, [summary]);

  const stats = [
    { label: "Consistency", value: `${consistency}%`, icon: Target },
    { label: "Current Streak", value: `${summary?.stats.current_streak_days ?? 0} days`, icon: Zap },
    { label: "This Week", value: `${summary?.completions_this_week ?? 0} completions`, icon: Calendar },
    { label: "Total XP", value: `${summary?.stats.total_xp ?? 0}`, icon: TrendingUp },
  ];

  const sentimentChart = useMemo(() => {
    if (!sentiment?.daily.length) return [];
    return sentiment.daily.slice(-30).map((d) => ({
      label: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: d.avg_score,
    }));
  }, [sentiment]);

  const sentimentColor = (avg: number) =>
    avg >= 0.05 ? "hsl(var(--chart-2))" : avg <= -0.05 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
        <span className="text-sm text-muted-foreground">Live API</span>
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3">
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
      <Card className="mt-5 border-0 bg-primary text-primary-foreground shadow-lg">
        <CardContent className="p-4">
          <p className="text-sm font-semibold">Level {summary?.stats.level ?? 0}</p>
          <p className="mt-1.5 text-sm opacity-90">Longest streak: {summary?.stats.longest_streak_days ?? 0} days</p>
          <p className="text-sm opacity-90">Completed today: {summary?.completions_today ?? 0}</p>
        </CardContent>
      </Card>

      {/* 7-day bar chart */}
      <Card className="mt-5 border">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-card-foreground">Last 7 days completions</p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sentiment */}
      <Card className="mt-5 border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-card-foreground">Mood from notes</p>
          </div>

          {sentiment && sentiment.daily.length > 0 ? (
            <>
              <p className="mt-2 text-xs text-muted-foreground">{sentiment.insight}</p>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sentimentChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[-1, 1]} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => v.toFixed(2)} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={sentimentColor(sentiment.overall_avg)}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-xs text-muted-foreground text-right">
                Overall avg: <span className="font-medium">{sentiment.overall_avg.toFixed(2)}</span>
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Add notes when completing habits to see your mood trend here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Correlations */}
      <Card className="mt-5 border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-card-foreground">Habit correlations</p>
          </div>

          {correlations && correlations.edges.length > 0 ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Tracked over {correlations.total_days_tracked} days. Positive = tend to happen together.
              </p>
              {correlations.edges.slice(0, 6).map((edge) => {
                const pct = Math.round(Math.abs(edge.correlation) * 100);
                const positive = edge.correlation >= 0;
                return (
                  <div key={`${edge.habit_a_id}-${edge.habit_b_id}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-card-foreground font-medium truncate max-w-[70%]">
                        {edge.habit_a_name} ↔ {edge.habit_b_name}
                      </span>
                      <span className={positive ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                        {positive ? "+" : ""}{edge.correlation.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${positive ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {edge.co_occurrence_days} days together
                    </p>
                  </div>
                );
              })}
            </div>
          ) : correlations && correlations.habits.length < 2 ? (
            <p className="mt-2 text-xs text-muted-foreground">Add at least 2 habits to see correlations.</p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No strong correlations yet — keep tracking and patterns will appear.
            </p>
          )}
        </CardContent>
      </Card>

      {loading && <p className="mt-4 text-sm text-muted-foreground">Loading analytics...</p>}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
