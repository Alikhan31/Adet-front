"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  Target,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const weeklyData = [
  { day: "Mon", completed: 5, total: 6 },
  { day: "Tue", completed: 4, total: 6 },
  { day: "Wed", completed: 6, total: 6 },
  { day: "Thu", completed: 3, total: 6 },
  { day: "Fri", completed: 5, total: 6 },
  { day: "Sat", completed: 6, total: 6 },
  { day: "Sun", completed: 4, total: 6 },
];

const monthlyTrend = [
  { week: "W1", rate: 68 },
  { week: "W2", rate: 72 },
  { week: "W3", rate: 78 },
  { week: "W4", rate: 85 },
];

const categoryBreakdown = [
  { name: "Fitness", value: 35, color: "hsl(152, 60%, 46%)" },
  { name: "Study", value: 25, color: "hsl(199, 89%, 48%)" },
  { name: "Health", value: 25, color: "hsl(0, 72%, 51%)" },
  { name: "Wellness", value: 15, color: "hsl(280, 60%, 60%)" },
];

const stats = [
  {
    label: "Consistency",
    value: "85%",
    change: "+12%",
    trend: "up" as const,
    icon: Target,
  },
  {
    label: "Best Streak",
    value: "24 days",
    change: "+3",
    trend: "up" as const,
    icon: Zap,
  },
  {
    label: "This Week",
    value: "33/42",
    change: "+5",
    trend: "up" as const,
    icon: Calendar,
  },
  {
    label: "Success Rate",
    value: "79%",
    change: "-2%",
    trend: "down" as const,
    icon: TrendingUp,
  },
];

const habitRankings = [
  { name: "Drink Water", rate: 96, color: "hsl(199, 89%, 48%)" },
  { name: "Healthy Meal", rate: 89, color: "hsl(0, 72%, 51%)" },
  { name: "Morning Run", rate: 82, color: "hsl(152, 60%, 46%)" },
  { name: "Read 20 Pages", rate: 75, color: "hsl(199, 89%, 48%)" },
  { name: "Meditate", rate: 64, color: "hsl(280, 60%, 60%)" },
  { name: "Sleep by 11 PM", rate: 52, color: "hsl(220, 20%, 40%)" },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
        <p className="font-medium text-card-foreground">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="text-muted-foreground">
            {p.name}: <span className="font-semibold text-card-foreground">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function Analytics() {
  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Analytics
        </h1>
        <span className="text-sm text-muted-foreground">This Week</span>
      </div>

      {/* Stats Grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-0.5 text-xs font-semibold",
                      stat.trend === "up" ? "text-primary" : "text-destructive"
                    )}
                  >
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {stat.change}
                  </div>
                </div>
                <p className="mt-2 text-xl font-bold text-card-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <Tabs defaultValue="weekly" className="mt-6">
        <TabsList className="w-full">
          <TabsTrigger value="weekly" className="flex-1">
            Weekly
          </TabsTrigger>
          <TabsTrigger value="trend" className="flex-1">
            Trend
          </TabsTrigger>
          <TabsTrigger value="category" className="flex-1">
            Category
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-4">
          <Card className="border">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-card-foreground">
                Daily Completions
              </h3>
              <div className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} barGap={4}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="completed"
                      name="Completed"
                      fill="hsl(var(--chart-1))"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="total"
                      name="Total"
                      fill="hsl(var(--muted))"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trend" className="mt-4">
          <Card className="border">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-card-foreground">
                Consistency Trend
              </h3>
              <div className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="week"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      domain={[50, 100]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="rate"
                      name="Rate"
                      stroke="hsl(var(--chart-1))"
                      fill="url(#colorRate)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="mt-4">
          <Card className="border">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-card-foreground">
                Category Breakdown
              </h3>
              <div className="mt-3 flex items-center gap-6">
                <div className="h-40 w-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {categoryBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-sm">
                                <span className="font-medium text-card-foreground">
                                  {payload[0].name}
                                </span>
                                <span className="ml-2 text-muted-foreground">
                                  {payload[0].value}%
                                </span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-3">
                  {categoryBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {item.name}
                      </span>
                      <span className="text-xs font-bold text-card-foreground">
                        {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Prediction */}
      <Card className="mt-5 border-0 bg-primary text-primary-foreground shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <p className="text-sm font-semibold">AI Prediction</p>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed opacity-90">
            Based on your current trajectory, there is a 78% chance you will maintain
            all streaks through next week. Focus on Meditation and Sleep habits
            for the biggest impact.
          </p>
        </CardContent>
      </Card>

      {/* Habit Rankings */}
      <div className="mt-6 pb-4">
        <h2 className="text-sm font-semibold text-foreground">
          Habit Success Rates
        </h2>
        <div className="mt-3 flex flex-col gap-2.5">
          {habitRankings.map((habit, idx) => (
            <div key={habit.name} className="flex items-center gap-3">
              <span className="w-5 text-right text-xs font-bold text-muted-foreground">
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {habit.name}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {habit.rate}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${habit.rate}%`,
                      backgroundColor: habit.color,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
