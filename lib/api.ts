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

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
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
  },
  habits: {
    list: (token: string) => apiFetch<HabitResponse[]>("/api/habits", { token }),
    create: (
      token: string,
      payload: {
        name: string;
        description?: string | null;
        frequency?: string;
        target_count?: number;
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
    removeCompletion: (token: string, habitId: number, completedDate: string) =>
      apiFetch<void>(`/api/habits/${habitId}/completions/${completedDate}`, {
        method: "DELETE",
        token,
      }),
  },
};

