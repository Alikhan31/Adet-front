"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Heart, MessageCircle, UserPlus, Search, Flame,
  Send, X, ChevronDown, ChevronUp, UserCheck, UserX, Trash2,
  Eye, EyeOff, Lock, Zap, Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  api,
  type ActivityFeedItemResponse,
  type ApiError,
  type FriendResponse,
  type FeedCommentResponse,
  type FriendSearchResult,
  type HabitResponse,
  type HeatmapDay,
  type SharedHabitInvitation,
} from "@/lib/api";

type Props = { token: string; userId: number };

const colorClasses = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"] as const;

function formatTime(iso: string): string {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

function avatarColor(idx: number) {
  return colorClasses[idx % colorClasses.length];
}

// ---------------------------------------------------------------------------
// Feed tab
// ---------------------------------------------------------------------------

const FEED_PAGE_SIZE = 10;

function FeedList({
  token,
  userId,
  mode,
}: {
  token: string;
  userId: number;
  mode: "mine" | "others";
}) {
  const [items, setItems] = useState<ActivityFeedItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Map<number, string>>(new Map());
  const [sendingComment, setSendingComment] = useState<Set<number>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  const feedParams = mode === "mine"
    ? { mine_only: true }
    : { friends_only: true };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const page = await api.feed.list(token, { ...feedParams, limit: FEED_PAGE_SIZE });
      setItems(page);
      setHasMore(page.length === FEED_PAGE_SIZE);
      const liked = new Set<number>();
      for (const item of page) {
        if (item.reactions.some((r) => r.user_id === userId && r.type === "like")) liked.add(item.id);
      }
      setLikedIds(liked);
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await api.feed.list(token, { ...feedParams, skip: items.length, limit: FEED_PAGE_SIZE });
      setItems((prev) => [...prev, ...page]);
      setHasMore(page.length === FEED_PAGE_SIZE);
      const liked = new Set<number>(likedIds);
      for (const item of page) {
        if (item.reactions.some((r) => r.user_id === userId && r.type === "like")) liked.add(item.id);
      }
      setLikedIds(liked);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => { void load(); }, [token, mode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = (item.user_full_name ?? item.user_email ?? "").toLowerCase();
      return name.includes(q);
    });
  }, [items, search]);

  const toggleComments = (id: number) => {
    setExpandedComments((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleLike = async (item: ActivityFeedItemResponse) => {
    const liked = likedIds.has(item.id);
    // Optimistic update both likedIds and reaction count in items
    setLikedIds((prev) => {
      const n = new Set(prev);
      liked ? n.delete(item.id) : n.add(item.id);
      return n;
    });
    setItems((prev) => prev.map((i) => {
      if (i.id !== item.id) return i;
      const reactions = liked
        ? i.reactions.filter((r) => !(r.user_id === userId && r.type === "like"))
        : [...i.reactions, { id: -Date.now(), event_id: i.id, user_id: userId, type: "like", created_at: new Date().toISOString() }];
      return { ...i, reactions };
    }));
    try {
      if (liked) {
        await fetch(`/api/feed/${item.id}/react?reaction_type=like`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await fetch(`/api/feed/${item.id}/react`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ type: "like" }),
        });
      }
    } catch {
      // revert on error
      setLikedIds((prev) => {
        const n = new Set(prev);
        liked ? n.add(item.id) : n.delete(item.id);
        return n;
      });
      setItems((prev) => prev.map((i) => {
        if (i.id !== item.id) return i;
        const reactions = liked
          ? [...i.reactions, { id: -Date.now(), event_id: i.id, user_id: userId, type: "like", created_at: new Date().toISOString() }]
          : i.reactions.filter((r) => !(r.user_id === userId && r.type === "like"));
        return { ...i, reactions };
      }));
    }
  };

  const submitComment = async (eventId: number) => {
    const text = (commentInputs.get(eventId) ?? "").trim();
    if (!text) return;
    setSendingComment((prev) => new Set(prev).add(eventId));
    try {
      const cm = await api.feed.addComment(token, eventId, text);
      setCommentInputs((prev) => new Map(prev).set(eventId, ""));
      setItems((prev) => prev.map((item) =>
        item.id === eventId
          ? { ...item, comments: [...item.comments, cm], comments_count: item.comments_count + 1 }
          : item
      ));
    } catch {
      // silently fail
    } finally {
      setSendingComment((prev) => { const n = new Set(prev); n.delete(eventId); return n; });
    }
  };

  const deleteComment = async (eventId: number, commentId: number) => {
    try {
      await api.feed.deleteComment(token, eventId, commentId);
      setItems((prev) => prev.map((item) =>
        item.id === eventId
          ? { ...item, comments: item.comments.filter((c) => c.id !== commentId), comments_count: item.comments_count - 1 }
          : item
      ));
    } catch {
      // silently fail
    }
  };

  if (loading) return <p className="mt-4 text-sm text-muted-foreground">Loading feed…</p>;
  if (error) return <p className="mt-4 text-sm text-destructive">{error}</p>;

  return (
    <div className="flex flex-col gap-3 mt-4">
      {/* Search bar — only for friends feed */}
      {mode === "others" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {search
            ? "No results for that name."
            : mode === "mine"
              ? "No activity yet. Complete some habits to see your history here."
              : "No activity yet. Add friends to see their activity here."}
        </p>
      )}

      {filtered.map((item, idx) => {
        const displayName = item.user_full_name || item.user_email || "User";
        const payload = (item.payload ?? {}) as Record<string, unknown>;
        const habitName = typeof payload.habit_name === "string" ? payload.habit_name : "a habit";
        const commentsOpen = expandedComments.has(item.id);
        const likeCount = item.reactions.filter((r) => r.type === "like").length;

        return (
          <Card key={item.id} className="border">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className={cn(avatarColor(idx), "text-primary-foreground font-semibold text-xs")}>
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-card-foreground">
                    <span className="font-semibold">{displayName}</span>{" "}
                    <span className="text-muted-foreground">completed</span>{" "}
                    <span className="font-semibold">{habitName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(item.created_at)}</p>

                  {/* Actions */}
                  <div className="mt-2.5 flex items-center gap-4">
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1 text-xs transition-colors",
                        likedIds.has(item.id)
                          ? "text-destructive"
                          : "text-muted-foreground hover:text-destructive"
                      )}
                      onClick={() => void toggleLike(item)}
                    >
                      <Heart className={cn("h-4 w-4", likedIds.has(item.id) && "fill-current")} />
                      {likeCount}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => toggleComments(item.id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {item.comments_count}
                      {commentsOpen
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>

                  {/* Comments */}
                  {commentsOpen && (
                    <div className="mt-3 border-t pt-3 space-y-2">
                      {item.comments.map((cm) => (
                        <div key={cm.id} className="flex items-start gap-2 group">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-semibold">
                              {initials(cm.user_full_name || cm.user_email || "U")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold">
                              {cm.user_full_name || cm.user_email}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">{cm.text}</span>
                          </div>
                          {cm.user_id === userId && (
                            <button
                              type="button"
                              onClick={() => void deleteComment(item.id, cm.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Comment input */}
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          value={commentInputs.get(item.id) ?? ""}
                          onChange={(e) =>
                            setCommentInputs((prev) => new Map(prev).set(item.id, e.target.value))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void submitComment(item.id);
                            }
                          }}
                          placeholder="Write a comment…"
                          className="h-8 text-xs"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          disabled={sendingComment.has(item.id) || !(commentInputs.get(item.id) ?? "").trim()}
                          onClick={() => void submitComment(item.id)}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Pagination */}
      {hasMore && !search && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="w-full py-2.5 text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
      {!hasMore && items.length > 0 && !search && (
        <p className="text-center text-xs text-muted-foreground py-2">You're all caught up</p>
      )}
    </div>
  );
}

function FeedTab({ token, userId }: { token: string; userId: number }) {
  return (
    <Tabs defaultValue="mine" className="mt-3">
      <TabsList className="w-full">
        <TabsTrigger value="mine" className="flex-1">My</TabsTrigger>
        <TabsTrigger value="others" className="flex-1">Other</TabsTrigger>
      </TabsList>
      <TabsContent value="mine">
        <FeedList token={token} userId={userId} mode="mine" />
      </TabsContent>
      <TabsContent value="others">
        <FeedList token={token} userId={userId} mode="others" />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Friends tab
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Friend profile sheet
// ---------------------------------------------------------------------------

function FriendHeatmap({ days }: { days: HeatmapDay[] }) {
  const today = new Date();
  const grid: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    const found = days.find((x) => x.date === iso);
    grid.push({ date: iso, count: found?.count ?? 0 });
  }
  return (
    <div className="flex flex-wrap gap-[3px] mt-1">
      {grid.map((d, i) => (
        <div
          key={i}
          title={`${d.date}: ${d.count}`}
          className="h-[9px] w-[9px] rounded-[2px]"
          style={{ backgroundColor: d.count > 0 ? `hsl(var(--primary) / ${Math.min(0.3 + d.count * 0.2, 1)})` : "hsl(var(--muted))" }}
        />
      ))}
    </div>
  );
}

function FriendProfileSheet({
  token,
  friend,
  open,
  onClose,
  friendXp,
}: {
  token: string;
  friend: FriendResponse | null;
  open: boolean;
  onClose: () => void;
  friendXp?: number;
}) {
  const [habits, setHabits] = useState<HabitResponse[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !friend) return;
    setLoading(true);
    Promise.all([
      api.habits.publicList(token, friend.id),
      api.analytics.heatmap(token, 90, friend.id).catch(() => ({ days: [] })),
    ]).then(([h, hm]) => {
      setHabits(h);
      setHeatmap(hm.days);
    }).catch(() => {
      setHabits([]);
      setHeatmap([]);
    }).finally(() => setLoading(false));
  }, [open, friend, token]);

  const name = friend ? (friend.full_name || friend.email) : "";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80dvh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-chart-1 text-primary-foreground font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left">{name}</SheetTitle>
              {friend?.full_name && (
                <p className="text-xs text-muted-foreground">{friend.email}</p>
              )}
            </div>
            {friendXp !== undefined && (
              <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-primary">{friendXp} XP</span>
              </div>
            )}
          </div>
        </SheetHeader>

        {loading && <p className="text-sm text-muted-foreground mb-4">Loading…</p>}

        {/* Heatmap */}
        {!loading && heatmap.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Last 90 days</p>
            <FriendHeatmap days={heatmap} />
          </div>
        )}

        {/* Habits */}
        <p className="text-sm font-semibold mb-2">Habits</p>
        {!loading && habits.length === 0 && (
          <p className="text-sm text-muted-foreground">No public habits shared.</p>
        )}
        <div className="space-y-2 pb-4">
          {habits.map((h) => (
            <Card key={h.id} className="border">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{h.name}</p>
                  {h.description && (
                    <p className="text-xs text-muted-foreground truncate">{h.description}</p>
                  )}
                </div>
                {h.category && (
                  <Badge variant="secondary" className="text-xs shrink-0">{h.category}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Friends tab
// ---------------------------------------------------------------------------

function FriendsTab({ token }: { token: string }) {
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [requests, setRequests] = useState<FriendResponse[]>([]);
  const [friendXpMap, setFriendXpMap] = useState<Map<number, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileFriend, setProfileFriend] = useState<FriendResponse | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadFriends() {
    setLoading(true);
    try {
      const [fr, rq, lb] = await Promise.all([
        api.friends.list(token),
        api.friends.requests(token).catch(() => [] as FriendResponse[]),
        api.analytics.leaderboard(token, { friends_only: true }).catch(() => null),
      ]);
      setFriends(fr);
      setRequests(rq);
      if (lb) {
        const map = new Map<number, number>();
        for (const e of lb.entries) map.set(e.user_id, e.total_xp);
        setFriendXpMap(map);
      }
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadFriends(); }, [token]);

  // Debounced user search
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.search.users(token, q.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const addFriend = async (email: string) => {
    setAdding(true);
    setError(null);
    try {
      await api.friends.addByEmail(token, email);
      setAddEmail("");
      setSearchQuery("");
      setSearchResults([]);
      await loadFriends();
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to send friend request");
    } finally {
      setAdding(false);
    }
  };

  const removeFriend = async (friendId: number) => {
    if (!confirm("Remove this friend?")) return;
    try {
      await api.friends.remove(token, friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to remove friend");
    }
  };

  const acceptRequest = async (friendshipId: number) => {
    try {
      await api.friends.accept(token, friendshipId);
      await loadFriends();
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to accept request");
    }
  };

  const rejectRequest = async (friendshipId: number) => {
    try {
      await api.friends.reject(token, friendshipId);
      setRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to reject request");
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Search & Add */}
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">Find people</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Search results */}
          {searchQuery.trim() && (
            <div className="space-y-2">
              {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
              {!searching && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground">No users found.</p>
              )}
              {searchResults.map((u, idx) => (
                <div key={u.id} className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={cn(avatarColor(idx), "text-primary-foreground text-xs font-semibold")}>
                      {initials(u.full_name || u.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                    {u.full_name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                  </div>
                  {u.friendship_status === "accepted" ? (
                    <Badge variant="secondary" className="text-xs">Friends</Badge>
                  ) : u.friendship_status === "pending" ? (
                    <Badge variant="outline" className="text-xs">Pending</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => void addFriend(u.email)}
                      disabled={adding}
                    >
                      <UserPlus className="h-3 w-3" />
                      Add
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Manual email add */}
          <div className="flex gap-2">
            <Input
              placeholder="Or add by email…"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void addFriend(addEmail.trim()); }}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              className="h-8 gap-1"
              onClick={() => void addFriend(addEmail.trim())}
              disabled={adding || !addEmail.trim()}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {adding ? "Sending…" : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Incoming requests */}
      {requests.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">Friend requests</p>
          <div className="space-y-2">
            {requests.map((req, idx) => (
              <Card key={req.id} className="border">
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={cn(avatarColor(idx), "text-primary-foreground text-xs font-semibold")}>
                      {initials(req.full_name || req.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{req.full_name || req.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{req.email}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-primary border-primary/30 hover:bg-primary/10"
                      onClick={() => void acceptRequest(req.id)}
                      title="Accept"
                    >
                      <UserCheck className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => void rejectRequest(req.id)}
                      title="Decline"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div>
        <p className="text-sm font-semibold mb-2">
          My friends <span className="text-muted-foreground font-normal">({friends.length})</span>
        </p>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && friends.length === 0 && (
          <p className="text-sm text-muted-foreground">No friends yet. Search above to add some!</p>
        )}
        <div className="space-y-2">
          {friends.map((f, idx) => {
            const xp = friendXpMap.get(f.id);
            return (
              <Card
                key={f.id}
                className="border cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setProfileFriend(f)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={cn(avatarColor(idx), "text-primary-foreground text-xs font-semibold")}>
                      {initials(f.full_name || f.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.full_name || f.email}</p>
                    {f.full_name && <p className="text-xs text-muted-foreground truncate">{f.email}</p>}
                  </div>
                  {xp !== undefined && (
                    <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 mr-1">
                      <Zap className="h-3 w-3 text-primary" />
                      <span className="text-xs font-bold text-primary">{xp}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void removeFriend(f.id); }}
                    className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                    title="Remove friend"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <FriendProfileSheet
        token={token}
        friend={profileFriend}
        open={profileFriend !== null}
        onClose={() => setProfileFriend(null)}
        friendXp={profileFriend ? friendXpMap.get(profileFriend.id) : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

function HabitInvitationsTab({ token }: { token: string }) {
  const [invitations, setInvitations] = useState<SharedHabitInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<number>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const data = await api.sharedHabits.invitations(token);
      setInvitations(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [token]);

  const respond = async (groupId: number, accept: boolean) => {
    setBusy((prev) => new Set(prev).add(groupId));
    try {
      if (accept) {
        await api.sharedHabits.accept(token, groupId);
      } else {
        await api.sharedHabits.decline(token, groupId);
      }
      setInvitations((prev) => prev.filter((i) => i.group_id !== groupId));
    } catch {
      // silently fail
    } finally {
      setBusy((prev) => { const n = new Set(prev); n.delete(groupId); return n; });
    }
  };

  if (loading) {
    return <p className="mt-6 text-center text-sm text-muted-foreground">Loading invitations…</p>;
  }

  if (invitations.length === 0) {
    return (
      <div className="mt-8 text-center text-muted-foreground">
        <p className="text-sm">No pending habit invitations.</p>
        <p className="mt-1 text-xs">When a friend shares a habit with you it will appear here.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {invitations.map((inv) => (
        <Card key={inv.group_id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{inv.habit_name}</p>
                <p className="text-sm text-muted-foreground">
                  from {inv.owner_name || inv.owner_email}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(inv.invited_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  disabled={busy.has(inv.group_id)}
                  onClick={() => void respond(inv.group_id, true)}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy.has(inv.group_id)}
                  onClick={() => void respond(inv.group_id, false)}
                >
                  Decline
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function Social({ token, userId }: Props) {
  return (
    <div className="mx-auto max-w-lg md:max-w-3xl px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Friends</h1>

      <Tabs defaultValue="feed" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="feed" className="flex-1">Feed</TabsTrigger>
          <TabsTrigger value="friends" className="flex-1">Friends</TabsTrigger>
          <TabsTrigger value="habits" className="flex-1">Shared</TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <FeedTab token={token} userId={userId} />
        </TabsContent>

        <TabsContent value="friends">
          <FriendsTab token={token} />
        </TabsContent>

        <TabsContent value="habits">
          <HabitInvitationsTab token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
