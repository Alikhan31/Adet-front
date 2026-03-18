"use client";

import {
  Trophy,
  Flame,
  Star,
  Medal,
  Crown,
  Shield,
  Zap,
  Target,
  Sun,
  Moon,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { UserResponse } from "@/lib/api";

const badges = [
  {
    icon: Flame,
    name: "7-Day Streak",
    description: "Completed 7 days in a row",
    earned: true,
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: Trophy,
    name: "First Milestone",
    description: "Reached 100 completions",
    earned: true,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Star,
    name: "Early Bird",
    description: "Complete 5 habits before 8 AM",
    earned: true,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
  },
  {
    icon: Medal,
    name: "30-Day Streak",
    description: "Maintain a 30-day streak",
    earned: false,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  {
    icon: Crown,
    name: "Leader",
    description: "Reach #1 on the leaderboard",
    earned: false,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  {
    icon: Shield,
    name: "Unstoppable",
    description: "Complete all habits for a week",
    earned: false,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
];

const leaderboard = [
  { rank: 1, name: "Ava M.", initials: "AM", xp: 4820, color: "bg-chart-5" },
  { rank: 2, name: "Sarah K.", initials: "SK", xp: 4350, color: "bg-chart-1" },
  { rank: 3, name: "You", initials: "AJ", xp: 3890, color: "bg-primary" },
  { rank: 4, name: "Mike T.", initials: "MT", xp: 3240, color: "bg-chart-2" },
  { rank: 5, name: "Dan R.", initials: "DR", xp: 2810, color: "bg-chart-4" },
];

type Props = {
  user: UserResponse;
  onLogout: () => void;
};

export function Profile({ user, onLogout }: Props) {
  const { theme, setTheme } = useTheme();

  const currentXp = 3890;
  const nextLevelXp = 5000;
  const level = 12;
  const xpProgress = Math.round((currentXp / nextLevelXp) * 100);

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
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
              Habit enthusiast since Jan 2025
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3 w-3 text-accent" />
                Level {level}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Flame className="h-3 w-3 text-accent" />
                24 day streak
              </Badge>
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
              Level {level + 1} in {nextLevelXp - currentXp} XP
            </span>
          </div>
          <Progress value={xpProgress} className="mt-2 h-3" />
          <p className="mt-1 text-xs text-muted-foreground">
            {currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
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
          <span className="text-xs text-muted-foreground">
            {badges.filter((b) => b.earned).length}/{badges.length} earned
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {badges.map((badge) => {
            const Icon = badge.icon;
            return (
              <Card
                key={badge.name}
                className={cn(
                  "border transition-all",
                  !badge.earned && "opacity-50"
                )}
              >
                <CardContent className="flex flex-col items-center gap-1.5 p-3 text-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      badge.bgColor
                    )}
                  >
                    <Icon className={cn("h-5 w-5", badge.color)} />
                  </div>
                  <span className="text-xs font-medium text-card-foreground leading-tight">
                    {badge.name}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="mt-6 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Leaderboard</h2>
          <button type="button" className="flex items-center gap-0.5 text-xs text-primary font-medium">
            View all
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <Card className="mt-3 border">
          <CardContent className="p-0">
            {leaderboard.map((entry, idx) => (
              <div key={entry.name}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    entry.name === "You" && "bg-primary/5"
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
                        entry.color,
                        "text-primary-foreground text-xs font-semibold"
                      )}
                    >
                      {entry.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "flex-1 text-sm font-medium text-card-foreground",
                      entry.name === "You" && "font-bold"
                    )}
                  >
                    {entry.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3 text-primary" />
                    <span className="text-sm font-semibold text-card-foreground">
                      {entry.xp.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">XP</span>
                  </div>
                </div>
                {idx < leaderboard.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
