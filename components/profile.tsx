"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  Star,
  Zap,
  Target,
  Crown,
  Sun,
  Moon,
  Settings,
  ChevronRight,
  Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { api, type AnalyticsSummaryResponse, type ApiError, type LeaderboardEntry, type LeaderboardResponse, type UserResponse } from "@/lib/api";

type Props = {
  user: UserResponse;
  onLogout: () => void;
};

export function Profile({ user, onLogout }: Props) {
  const { theme, setTheme } = useTheme();
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [globalLeaderboardMeta, setGlobalLeaderboardMeta] = useState<LeaderboardResponse | null>(null);
  const [friendsOnlyLeaderboard, setFriendsOnlyLeaderboard] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"total" | "month">("total");
  const [leaderboardMonth, setLeaderboardMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("adet_token");
        if (!token) return;
        const s = await api.analytics.summary(token);
        if (!cancelled) {
          setSummary(s);
        }
      } catch (e) {
        if (!cancelled) setError((e as ApiError).message ?? "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadLeaderboard() {
      try {
        const token = localStorage.getItem("adet_token");
        if (!token) return;
        const selectedPromise = api.analytics.leaderboard(token, {
          limit: friendsOnlyLeaderboard ? 8 : 10,
          friends_only: friendsOnlyLeaderboard,
          period: leaderboardPeriod,
          month: leaderboardPeriod === "month" ? leaderboardMonth : undefined,
        });
        const globalPromise = friendsOnlyLeaderboard
          ? api.analytics.leaderboard(token, {
              limit: 10,
              friends_only: false,
              period: leaderboardPeriod,
              month: leaderboardPeriod === "month" ? leaderboardMonth : undefined,
            })
          : selectedPromise;
        const [selected, global] = await Promise.all([selectedPromise, globalPromise]);
        if (!cancelled) {
          let selectedData = selected;
          const normalizeEntries = (entries: LeaderboardEntry[]) => {
            const seen = new Set<number>();
            const uniq = entries.filter((entry) => {
              if (seen.has(entry.user_id)) return false;
              seen.add(entry.user_id);
              return true;
            });
            return uniq.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
          };
          // Safety filter: in Friends mode, keep only accepted friends + current user.
          if (friendsOnlyLeaderboard) {
            const friends = await api.friends.list(token).catch(() => []);
            const allowedUserIds = new Set<number>([user.id, ...friends.map((f) => f.id)]);
            selectedData = {
              ...selectedData,
              entries: normalizeEntries(
                selectedData.entries.filter((entry) => allowedUserIds.has(entry.user_id))
              ),
            };
          } else {
            selectedData = {
              ...selectedData,
              entries: normalizeEntries(selectedData.entries),
            };
          }
          setLeaderboardData(selectedData);
          setGlobalLeaderboardMeta(global);
        }
      } catch {
        if (!cancelled) {
          setLeaderboardData(null);
          setGlobalLeaderboardMeta(null);
        }
      }
    }
    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [friendsOnlyLeaderboard, leaderboardPeriod, leaderboardMonth, user.id]);

  const level = summary?.stats.level ?? 1;
  const currentXp = summary?.stats.total_xp ?? 0;
  const levelStartXp = (level - 1) * 100;
  const nextLevelXp = level * 100;
  const xpInLevel = Math.max(0, currentXp - levelStartXp);
  const xpForLevel = Math.max(1, nextLevelXp - levelStartXp);
  const xpProgress = Math.round((xpInLevel / xpForLevel) * 100);
  const daysStreak = summary?.stats.current_streak_days ?? 0;
  const badges = summary?.badges ?? [];
  const earnedBadges = badges.filter((b) => b.earned);
  const visibleBadges = showAllBadges ? badges : badges.slice(0, 6);
  const leaderboard = leaderboardData?.entries ?? [];
  const globalRank = globalLeaderboardMeta?.me_rank ?? null;
  const isTop10Global = !!globalRank && globalRank <= 10;

  const joinedLabel = useMemo(() => {
    const d = new Date(user.created_at);
    if (Number.isNaN(d.getTime())) return "Habit enthusiast";
    return `Habit enthusiast since ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }, [user.created_at]);

  function badgeStyles(category: string, earned: boolean) {
    if (!earned) return { color: "text-muted-foreground", bg: "bg-muted" };
    if (category === "created_habits") return { color: "text-primary", bg: "bg-primary/10" };
    if (category === "overall_streak") return { color: "text-accent", bg: "bg-accent/10" };
    return { color: "text-chart-2", bg: "bg-chart-2/10" };
  }

  function badgeIcon(category: string) {
    if (category === "created_habits") return Target;
    if (category === "overall_streak") return Flame;
    return Award;
  }

  const avatarColors = ["bg-chart-5", "bg-chart-1", "bg-primary", "bg-chart-2", "bg-chart-4"] as const;

  return (
    <div className="mx-auto max-w-lg md:max-w-2xl px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Profile
        </h1>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* User Card */}
      <Card className="mt-5 border">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
              {(user.full_name || user.email || "U")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0]!.toUpperCase())
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-card-foreground">
              {user.full_name || user.email}
            </h2>
            <p className="text-sm text-muted-foreground">
              {joinedLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3 w-3 text-accent" />
                Level {level}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Flame className="h-3 w-3 text-accent" />
                {daysStreak}d streak
              </Badge>
              {globalRank && (
                <Badge variant="secondary" className="gap-1">
                  {isTop10Global ? <Crown className="h-3 w-3 text-accent" /> : <Target className="h-3 w-3 text-primary" />}
                  #{globalRank}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </CardContent>
      </Card>

      {/* XP Progress */}
      <Card className="mt-4 border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-card-foreground">XP Progress</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Level {level + 1} in {Math.max(0, nextLevelXp - currentXp)} XP
            </span>
          </div>
          <Progress value={xpProgress} className="mt-2 h-3" />
          <p className="mt-1 text-xs text-muted-foreground">
            {xpInLevel.toLocaleString()} / {xpForLevel.toLocaleString()} XP
          </p>
        </CardContent>
      </Card>

      {/* Theme Toggle */}
      <Card className="mt-4 border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-accent" />
              )}
              <span className="text-sm font-semibold text-card-foreground">Appearance</span>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all",
                  theme === "light"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all",
                  theme === "dark"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                Dark
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Badges</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {earnedBadges.length}/{badges.length} earned
            </span>
            <button
              type="button"
              onClick={() => setShowAllBadges((v) => !v)}
              className="text-xs text-primary font-medium"
            >
              {showAllBadges ? "Less" : "More"}
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {visibleBadges.map((badge) => {
            const Icon = badgeIcon(badge.category);
            const styles = badgeStyles(badge.category, badge.earned);
            return (
              <Card
                key={badge.id}
                className={cn(
                  "border transition-all",
                  !badge.earned && "opacity-50"
                )}
              >
                <CardContent className="flex flex-col items-center gap-1.5 p-3 text-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      styles.bg
                    )}
                  >
                    <Icon className={cn("h-5 w-5", styles.color)} />
                  </div>
                  <span className="text-xs font-medium text-card-foreground leading-tight">
                    {badge.title}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="mt-6 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground mr-auto">Leaderboard</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setFriendsOnlyLeaderboard(false)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  !friendsOnlyLeaderboard
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                Global
              </button>
              <button
                type="button"
                onClick={() => setFriendsOnlyLeaderboard(true)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  friendsOnlyLeaderboard
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                Friends
              </button>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setLeaderboardPeriod("total")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  leaderboardPeriod === "total"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                Total
              </button>
              <button
                type="button"
                onClick={() => setLeaderboardPeriod("month")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  leaderboardPeriod === "month"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                Month
              </button>
            </div>
            {leaderboardPeriod === "month" && (
              <input
                type="month"
                value={leaderboardMonth}
                onChange={(e) => setLeaderboardMonth(e.target.value)}
                className="h-7 rounded-md border border-border bg-background px-2 text-[11px] text-foreground"
              />
            )}
            <button type="button" className="flex items-center gap-0.5 text-xs text-primary font-medium">
              View all
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
        <Card className="mt-3 border">
          <CardContent className="p-0">
            {leaderboard.map((entry, idx) => (
              <div key={`${entry.user_id}-${entry.rank}`}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    entry.is_me && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      entry.rank === 1
                        ? "bg-accent text-accent-foreground"
                        : entry.rank === 2
                          ? "bg-muted text-muted-foreground"
                          : entry.rank === 3
                            ? "bg-chart-3/20 text-chart-3"
                            : "bg-muted text-muted-foreground"
                    )}
                  >
                    {entry.rank}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className={cn(
                        avatarColors[idx % avatarColors.length],
                        "text-primary-foreground text-xs font-semibold"
                      )}
                    >
                      {entry.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "flex-1 text-sm font-medium text-card-foreground",
                      entry.is_me && "font-bold"
                    )}
                  >
                    {entry.is_me ? "You" : entry.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3 text-primary" />
                    <span className="text-sm font-semibold text-card-foreground">
                      {entry.total_xp.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">XP</span>
                  </div>
                </div>
                {idx < leaderboard.length - 1 && <Separator />}
              </div>
            ))}
            {!leaderboard.length && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No leaderboard data yet.
              </div>
            )}
          </CardContent>
        </Card>
        {!friendsOnlyLeaderboard && globalRank && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your global rank: <span className="font-medium text-foreground">#{globalRank}</span>
            {isTop10Global && <span className="ml-1 text-accent">🏆 Top 10</span>}
          </p>
        )}
        {loading && <p className="mt-3 text-sm text-muted-foreground">Loading profile...</p>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
