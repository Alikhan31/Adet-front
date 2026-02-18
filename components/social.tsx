"use client";

import { useState } from "react";
import {
  Heart,
  MessageCircle,
  UserPlus,
  Search,
  MoreHorizontal,
  Flame,
  Trophy,
  Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FeedItem {
  id: string;
  user: { name: string; initials: string; color: string };
  action: string;
  habit: string;
  streak: number;
  time: string;
  likes: number;
  comments: number;
  liked: boolean;
}

const friends = [
  { name: "Sarah K.", initials: "SK", color: "bg-chart-1", status: "online", streak: 45 },
  { name: "Mike T.", initials: "MT", color: "bg-chart-2", status: "online", streak: 32 },
  { name: "Jess L.", initials: "JL", color: "bg-chart-3", status: "offline", streak: 28 },
  { name: "Dan R.", initials: "DR", color: "bg-chart-4", status: "online", streak: 19 },
  { name: "Ava M.", initials: "AM", color: "bg-chart-5", status: "offline", streak: 52 },
];

const initialFeed: FeedItem[] = [
  {
    id: "1",
    user: { name: "Sarah K.", initials: "SK", color: "bg-chart-1" },
    action: "completed",
    habit: "Morning Yoga",
    streak: 45,
    time: "2h ago",
    likes: 12,
    comments: 3,
    liked: false,
  },
  {
    id: "2",
    user: { name: "Mike T.", initials: "MT", color: "bg-chart-2" },
    action: "hit a new milestone on",
    habit: "Daily Reading",
    streak: 30,
    time: "4h ago",
    likes: 24,
    comments: 7,
    liked: true,
  },
  {
    id: "3",
    user: { name: "Jess L.", initials: "JL", color: "bg-chart-3" },
    action: "started a new habit",
    habit: "Cold Showers",
    streak: 1,
    time: "5h ago",
    likes: 8,
    comments: 2,
    liked: false,
  },
  {
    id: "4",
    user: { name: "Dan R.", initials: "DR", color: "bg-chart-4" },
    action: "completed",
    habit: "Meditation",
    streak: 19,
    time: "6h ago",
    likes: 15,
    comments: 1,
    liked: false,
  },
];

export function Social() {
  const [feed, setFeed] = useState<FeedItem[]>(initialFeed);

  const toggleLike = (id: string) => {
    setFeed((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              liked: !item.liked,
              likes: item.liked ? item.likes - 1 : item.likes + 1,
            }
          : item
      )
    );
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Friends
        </h1>
        <Button variant="outline" size="sm" className="gap-1.5 bg-transparent">
          <UserPlus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search friends..."
          className="pl-9"
        />
      </div>

      {/* Friends Horizontal Scroll */}
      <div className="mt-5">
        <h2 className="text-sm font-semibold text-foreground">Online Friends</h2>
        <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
          {friends.map((friend) => (
            <div key={friend.name} className="flex flex-col items-center gap-1.5">
              <div className="relative">
                <Avatar className="h-14 w-14 border-2 border-card">
                  <AvatarFallback className={cn(friend.color, "text-primary-foreground font-semibold text-sm")}>
                    {friend.initials}
                  </AvatarFallback>
                </Avatar>
                {friend.status === "online" && (
                  <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary" />
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {friend.name}
              </span>
              <div className="flex items-center gap-0.5">
                <Flame className="h-3 w-3 text-accent" />
                <span className="text-[10px] font-bold text-foreground">{friend.streak}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="mt-6 pb-4">
        <h2 className="text-sm font-semibold text-foreground">Activity Feed</h2>
        <div className="mt-3 flex flex-col gap-3">
          {feed.map((item) => (
            <Card key={item.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn(item.user.color, "text-primary-foreground font-semibold text-xs")}>
                      {item.user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-card-foreground">
                        <span className="font-semibold">{item.user.name}</span>{" "}
                        <span className="text-muted-foreground">{item.action}</span>{" "}
                        <span className="font-semibold">{item.habit}</span>
                      </p>
                      <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="More options">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Flame className="h-3 w-3 text-accent" />
                        {item.streak} day streak
                      </Badge>
                      {item.streak >= 30 && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Trophy className="h-3 w-3 text-accent" />
                          Milestone
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {item.time}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 text-sm transition-colors",
                          item.liked
                            ? "text-destructive"
                            : "text-muted-foreground hover:text-destructive"
                        )}
                        onClick={() => toggleLike(item.id)}
                        aria-label={item.liked ? "Unlike" : "Like"}
                      >
                        <Heart
                          className={cn("h-4 w-4", item.liked && "fill-current")}
                        />
                        <span className="text-xs font-medium">{item.likes}</span>
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                        aria-label="Comment"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">{item.comments}</span>
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                        aria-label="Encourage"
                      >
                        <Send className="h-4 w-4" />
                        <span className="text-xs font-medium">Encourage</span>
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
