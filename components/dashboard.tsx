"use client";

import React from "react"

import { useState } from "react";
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

interface Habit {
  id: string;
  name: string;
  icon: React.ElementType;
  category: string;
  color: string;
  streak: number;
  completed: boolean;
  target: string;
}

const initialHabits: Habit[] = [
  {
    id: "1",
    name: "Morning Run",
    icon: Dumbbell,
    category: "Fitness",
    color: "hsl(152, 60%, 46%)",
    streak: 12,
    completed: false,
    target: "30 min",
  },
  {
    id: "2",
    name: "Read 20 Pages",
    icon: BookOpen,
    category: "Study",
    color: "hsl(199, 89%, 48%)",
    streak: 8,
    completed: true,
    target: "20 pages",
  },
  {
    id: "3",
    name: "Drink 8 Glasses",
    icon: Droplets,
    category: "Health",
    color: "hsl(199, 89%, 48%)",
    streak: 24,
    completed: true,
    target: "8 glasses",
  },
  {
    id: "4",
    name: "Meditate",
    icon: Brain,
    category: "Wellness",
    color: "hsl(280, 60%, 60%)",
    streak: 5,
    completed: false,
    target: "15 min",
  },
  {
    id: "5",
    name: "Sleep by 11 PM",
    icon: Moon,
    category: "Health",
    color: "hsl(220, 20%, 40%)",
    streak: 3,
    completed: false,
    target: "Before 11 PM",
  },
  {
    id: "6",
    name: "Healthy Meal",
    icon: Heart,
    category: "Health",
    color: "hsl(0, 72%, 51%)",
    streak: 15,
    completed: true,
    target: "3 meals",
  },
];

export function Dashboard() {
  const [habits, setHabits] = useState<Habit[]>(initialHabits);

  const completedCount = habits.filter((h) => h.completed).length;
  const totalCount = habits.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const toggleHabit = (id: string) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h))
    );
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Good morning</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Alex
          </h1>
        </div>
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span className="sr-only">Add habit</span>
        </Button>
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
          {habits.map((habit) => {
            const Icon = habit.icon;
            return (
              <Card
                key={habit.id}
                className={cn(
                  "cursor-pointer border transition-all hover:shadow-md",
                  habit.completed && "bg-muted/50"
                )}
                onClick={() => toggleHabit(habit.id)}
                role="button"
                tabIndex={0}
                aria-label={`${habit.completed ? "Unmark" : "Mark"} ${habit.name} as complete`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleHabit(habit.id);
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
          })}
        </div>
      </div>
    </div>
  );
}
