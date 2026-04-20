export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

function getApiBaseUrl(): string {
  // If Next rewrites are configured, prefer same-origin relative calls.
  // Still allow explicit base URL for direct calls (e.g. server-side utilities).
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
}

async function parseErrorBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
  try {
    return await res.text();
  } catch {
    return undefined; 
  }
}

export async function apiFetch<T>(
  path: string,
  opts?: {
    method?: string;
    token?: string | null;
    body?: unknown;
    headers?: Record<string, string>;
    form?: Record<string, string>;
    baseUrl?: string;
  }
): Promise<T> {
  const method = opts?.method ?? (opts?.body || opts?.form ? "POST" : "GET");
  const headers: Record<string, string> = { ...(opts?.headers || {}) };

  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;

  let body: BodyInit | undefined;
  if (opts?.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form);
  } else if (opts?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  // In the browser, always keep '/api/...' relative so Next rewrites can proxy it.
  // This avoids leaking docker-internal hosts like 'http://api:8000' to the client.
  const shouldForceRelativeApiPath =
    !opts?.baseUrl &&
    typeof window !== "undefined" &&
    (path === "/api" || path.startsWith("/api/"));

  const baseUrl = (opts?.baseUrl ?? getApiBaseUrl()).replace(/\/+$/, "");
  const url = shouldForceRelativeApiPath
    ? path
    : path.startsWith("http://") || path.startsWith("https://")
      ? path
      : baseUrl
        ? `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`
        : path; // allow relative when rewrites are enabled

  const res = await fetch(url, { method, headers, body });
  if (!res.ok) {
    const details = await parseErrorBody(res);
    const message =
      (typeof details === "object" &&
        details !== null &&
        "detail" in details &&
        typeof (details as any).detail === "string" &&
        (details as any).detail) ||
      `${res.status} ${res.statusText}`;
    const err: ApiError = { status: res.status, message, details };
    throw err;
  }

  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("content-type") || "";
  const contentLength = res.headers.get("content-length");
  if (contentLength === "0") return undefined as T;

  if (ct.includes("application/json")) return (await res.json()) as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return text as T;
}

export type UserResponse = {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type HabitResponse = {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  frequency: string;
  target_count: number;
  days_of_week: number[]; // 0=Mon … 6=Sun
  created_at: string;
  updated_at: string;
};

export type HabitCompletionResponse = {
  id: number;
  habit_id: number;
  completed_date: string;
  count: number;
  note: string | null;
  created_at: string;
};

export type UserStatsResponse = {
  total_xp: number;
  level: number;
  current_streak_days: number;
  longest_streak_days: number;
  updated_at: string;
};

export type AnalyticsSummaryResponse = {
  stats: UserStatsResponse;
  completions_this_week: number;
  completions_today: number;
};

export type FriendResponse = {
  id: number;
  email: string;
  full_name: string | null;
  status: string;
  created_at: string;
};

export type FeedCommentResponse = {
  id: number;
  event_id: number;
  user_id: number;
  user_email: string | null;
  user_full_name: string | null;
  text: string;
  created_at: string;
};

export type ActivityFeedItemResponse = {
  id: number;
  user_id: number;
  user_email: string | null;
  user_full_name: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  reactions: { id: number; event_id: number; user_id: number; type: string; created_at: string }[];
  comments: FeedCommentResponse[];
  comments_count: number;
};

export type FriendSearchResult = {
  id: number;
  email: string;
  full_name: string | null;
  friendship_status: string | null;
};

export type DailySentiment = {
  date: string;
  avg_score: number;
  notes_count: number;
};

export type SentimentTrendResponse = {
  daily: DailySentiment[];
  overall_avg: number;
  insight: string;
};

export type HabitCorrelationEdge = {
  habit_a_id: number;
  habit_a_name: string;
  habit_b_id: number;
  habit_b_name: string;
  correlation: number;
  co_occurrence_days: number;
};

export type CorrelationMatrixResponse = {
  habits: { id: number; name: string }[];
  edges: HabitCorrelationEdge[];
  total_days_tracked: number;
};

export type HeatmapDay = {
  date: string;
  count: number;
};

export type HeatmapResponse = {
  days: HeatmapDay[];
};

export const api = {
  auth: {
    register: (payload: { email: string; password: string; full_name?: string }) =>
      apiFetch<UserResponse>("/api/auth/register", { method: "POST", body: payload }),
    login: (payload: { email: string; password: string }) =>
      apiFetch<TokenResponse>("/api/auth/login", {
        method: "POST",
        form: { username: payload.email, password: payload.password },
      }),
    me: (token: string) => apiFetch<UserResponse>("/api/auth/me", { token }),
    forgotPassword: (email: string) =>
      apiFetch<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: { email } }),
  },
  habits: {
    list: (token: string, day?: number) =>
      apiFetch<HabitResponse[]>(
        day !== undefined ? `/api/habits?day=${day}` : "/api/habits",
        { token }
      ),
    create: (
      token: string,
      payload: {
        name: string;
        description?: string | null;
        frequency?: string;
        target_count?: number;
        days_of_week?: number[];
      }
    ) =>
      apiFetch<HabitResponse>("/api/habits", {
        method: "POST",
        token,
        body: payload,
      }),
    listCompletions: (
      token: string,
      habitId: number,
      params?: { from_date?: string; to_date?: string }
    ) => {
      const qs = new URLSearchParams();
      if (params?.from_date) qs.set("from_date", params.from_date);
      if (params?.to_date) qs.set("to_date", params.to_date);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return apiFetch<HabitCompletionResponse[]>(
        `/api/habits/${habitId}/completions${suffix}`,
        { token }
      );
    },
    completeToday: (token: string, habitId: number) =>
      apiFetch<HabitCompletionResponse>(`/api/habits/${habitId}/complete-today`, {
        method: "POST",
        token,
      }),
    complete: (token: string, habitId: number, completedDate: string) =>
      apiFetch<HabitCompletionResponse>(`/api/habits/${habitId}/completions`, {
        method: "POST",
        token,
        body: { completed_date: completedDate, count: 1 },
      }),
    removeCompletion: (token: string, habitId: number, completedDate: string) =>
      apiFetch<void>(`/api/habits/${habitId}/completions/${completedDate}`, {
        method: "DELETE",
        token,
      }),
    updateNote: (token: string, habitId: number, completedDate: string, note: string | null) =>
      apiFetch<HabitCompletionResponse>(`/api/habits/${habitId}/completions/${completedDate}`, {
        method: "PATCH",
        token,
        body: { note },
      }),
    update: (
      token: string,
      habitId: number,
      payload: { name?: string; description?: string | null; frequency?: string; target_count?: number; days_of_week?: number[] }
    ) =>
      apiFetch<HabitResponse>(`/api/habits/${habitId}`, {
        method: "PATCH",
        token,
        body: payload,
      }),
    delete: (token: string, habitId: number) =>
      apiFetch<void>(`/api/habits/${habitId}`, { method: "DELETE", token }),
  },
  analytics: {
    summary: (token: string) =>
      apiFetch<AnalyticsSummaryResponse>("/api/analytics/summary", { token }),
    stats: (token: string) => apiFetch<UserStatsResponse>("/api/analytics/stats", { token }),
    sentiment: (token: string, days = 90) =>
      apiFetch<SentimentTrendResponse>(`/api/analytics/sentiment?days=${days}`, { token }),
    correlations: (token: string, days = 90, minCorrelation = 0.3) =>
      apiFetch<CorrelationMatrixResponse>(
        `/api/analytics/correlations?days=${days}&min_correlation=${minCorrelation}`,
        { token }
      ),
    heatmap: (token: string, days = 365) =>
      apiFetch<HeatmapResponse>(`/api/analytics/heatmap?days=${days}`, { token }),
  },
  friends: {
    list: (token: string) => apiFetch<FriendResponse[]>("/api/friends", { token }),
    addByEmail: (token: string, email: string) =>
      apiFetch<FriendResponse>("/api/friends", {
        method: "POST",
        token,
        body: { email },
      }),
    remove: (token: string, friendId: number) =>
      apiFetch<void>(`/api/friends/${friendId}`, { method: "DELETE", token }),
    accept: (token: string, friendshipId: number) =>
      apiFetch<FriendResponse>(`/api/friends/${friendshipId}/accept`, { method: "PATCH", token }),
    reject: (token: string, friendshipId: number) =>
      apiFetch<void>(`/api/friends/${friendshipId}/reject`, { method: "PATCH", token }),
    requests: (token: string) => apiFetch<FriendResponse[]>("/api/friends/requests", { token }),
  },
  feed: {
    list: (token: string, params?: { friends_only?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.friends_only) qs.set("friends_only", "true");
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return apiFetch<ActivityFeedItemResponse[]>(`/api/feed${suffix}`, { token });
    },
    addComment: (token: string, eventId: number, text: string) =>
      apiFetch<FeedCommentResponse>(`/api/feed/${eventId}/comments`, {
        method: "POST",
        token,
        body: { text },
      }),
    deleteComment: (token: string, eventId: number, commentId: number) =>
      apiFetch<void>(`/api/feed/${eventId}/comments/${commentId}`, { method: "DELETE", token }),
  },
  search: {
    users: (token: string, q: string) =>
      apiFetch<FriendSearchResult[]>(`/api/friends/search?q=${encodeURIComponent(q)}`, { token }),
  },
};

