"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api, type ApiError, type UserResponse } from "@/lib/api";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Mode = "login" | "register" | "forgot" | "verify-pending";

type Props = {
  children: (args: { token: string; user: UserResponse; logout: () => void }) => React.ReactNode;
};

export function AuthGate({ children }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
      if (!token) { setUser(null); return; }
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
    return () => { cancelled = true; };
  }, [token]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuccessMsg(null);
    setShowPassword(false);
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (mode === "forgot") {
        const res = await api.auth.forgotPassword(email);
        setSuccessMsg(res.message);
        return;
      }
      if (mode === "register") {
        await api.auth.register({ email, password, full_name: fullName || undefined });
        setMode("verify-pending");
        setPassword("");
        return;
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

  async function resendVerification() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.auth.resendVerification(email);
      setSuccessMsg(res.message);
    } catch (e) {
      setError((e as ApiError).message ?? "Failed to resend");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (token && user) return <>{children({ token, user, logout })}</>;

  if (mode === "verify-pending") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
        <Card className="w-full border">
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-4xl">📧</div>
            <h2 className="text-lg font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
              Click the link in the email to activate your account.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {successMsg && <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void resendVerification()}
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Resend verification email"}
            </Button>
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Back to sign in
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isForgot = mode === "forgot";

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
      <Card className="w-full border">
        <CardContent className="p-6">
          <div className="mb-4">
            <h1 className="text-xl font-bold">Adet</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" && "Sign in to continue"}
              {mode === "register" && "Create an account"}
              {mode === "forgot" && "Reset your password"}
            </p>
          </div>

          {/* Login / Register tabs — hidden on forgot screen */}
          {!isForgot && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "outline"}
                className="flex-1"
                onClick={() => switchMode("login")}
              >
                Login
              </Button>
              <Button
                type="button"
                variant={mode === "register" ? "default" : "outline"}
                className="flex-1"
                onClick={() => switchMode("register")}
              >
                Register
              </Button>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {/* Full name — register only */}
            {mode === "register" && (
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name (optional)"
                autoComplete="name"
              />
            )}

            {/* Email */}
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              inputMode="email"
            />

            {/* Password with show/hide toggle — hidden on forgot screen */}
            {!isForgot && (
              <div className="relative">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}

            {/* Forgot password link — login mode only */}
            {mode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {successMsg && <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>}

            <Button
              type="button"
              className="w-full"
              onClick={() => void onSubmit()}
              disabled={submitting || !email || (!isForgot && !password)}
            >
              {submitting
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : "Send reset link"}
            </Button>

            {/* Back to login — forgot screen */}
            {isForgot && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Back to sign in
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
