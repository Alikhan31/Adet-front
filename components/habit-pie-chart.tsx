"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Habit {
  id: string;
  name: string;
  category: string;
  color: string;
  completed: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Fitness: "hsl(152, 60%, 46%)",
  Study: "hsl(199, 89%, 48%)",
  Health: "hsl(0, 72%, 51%)",
  Wellness: "hsl(280, 60%, 60%)",
};

export function HabitPieChart({ habits }: { habits: Habit[] }) {
  const categoryMap = new Map<string, number>();
  for (const habit of habits) {
    categoryMap.set(habit.category, (categoryMap.get(habit.category) || 0) + 1);
  }

  const data = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    value,
    color: CATEGORY_COLORS[name] || "hsl(220, 10%, 50%)",
  }));

  return (
    <div className="mt-3 flex items-center gap-4">
      <div className="h-32 w-32 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={56}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
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
                        {payload[0].value} habits
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
      <div className="flex flex-col gap-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-muted-foreground">{item.name}</span>
            <span className="text-xs font-semibold text-foreground">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
