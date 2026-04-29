"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, type ApiError } from "@/lib/api";
import { setStoredToken } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the link.");
      return;
    }

    api.auth.verifyEmail(token)
      .then((res) => {
        setStoredToken(res.access_token);
        setStatus("success");
        setMessage(res.message ?? "Email verified!");
        setTimeout(() => router.replace("/"), 1500);
      })
      .catch((e: ApiError) => {
        setStatus("error");
        setMessage(e.message ?? "Verification failed.");
      });
  }, [token, router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
      <Card className="w-full border">
        <CardContent className="p-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <div className="text-4xl animate-pulse">⏳</div>
              <p className="text-sm text-muted-foreground">Verifying your email…</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="text-4xl">✅</div>
              <h2 className="text-lg font-semibold">Email verified!</h2>
              <p className="text-sm text-muted-foreground">{message} Redirecting…</p>
            </>
          )}
          {status === "error" && (
            <>
              <div className="text-4xl">❌</div>
              <h2 className="text-lg font-semibold">Verification failed</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button type="button" variant="outline" onClick={() => router.replace("/")}>
                Go to sign in
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
