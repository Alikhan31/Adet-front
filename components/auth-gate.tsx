"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { api, type ApiError, type UserResponse } from "@/lib/api";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  children: (args: { token: string; user: UserResponse; logout: () => void }) => React.ReactNode;
};

export function AuthGate({ children }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const logout = useMemo(
    () => () => {
      clearStoredToken();
      setToken(null);
      setUser(null);
      setError(null);
      setMode("login");
    },
    []
  );

  useEffect(() => {
    const t = getStoredToken();
    setToken(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setUser(null);
        return;
      }
      setError(null);
      try {
        const me = await api.auth.me(token);
        if (!cancelled) setUser(me);
      } catch (e) {
        if (cancelled) return;
        clearStoredToken();
        setToken(null);
        setUser(null);
        setError((e as ApiError).message ?? "Auth failed");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "register") {
        await api.auth.register({
          email,
          password,
          full_name: fullName || undefined,
        });
      }
      const t = await api.auth.login({ email, password });
      setStoredToken(t.access_token);
      setToken(t.access_token);
      setPassword("");
    } catch (e) {
      setError((e as ApiError).message ?? "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (token && user) return <>{children({ token, user, logout })}</>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
      <Card className="w-full border">
        <CardContent className="p-6">
          <div className="mb-4">
            <h1 className="text-xl font-bold">HabitFlow</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to continue" : "Create an account"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("login")}
            >
              Login
            </Button>
            <Button
              type="button"
              variant={mode === "register" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("register")}
            >
              Register
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {mode === "register" && (
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name (optional)"
                autoComplete="name"
              />
            )}

            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              inputMode="email"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="button"
              className="w-full"
              onClick={() => void onSubmit()}
              disabled={submitting || !email || !password}
            >
              {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

