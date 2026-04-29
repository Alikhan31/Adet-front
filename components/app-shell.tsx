"use client";

import { useState } from "react";
import {
  Home,
  Users,
  BarChart3,
  MessageCircle,
  User,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dashboard } from "@/components/dashboard";
import { Social } from "@/components/social";
import { Analytics } from "@/components/analytics";
import { AiCoach } from "@/components/ai-coach";
import { Profile } from "@/components/profile";
import { AuthGate } from "@/components/auth-gate";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "social", label: "Friends", icon: Users },
  { id: "analytics", label: "Stats", icon: BarChart3 },
  { id: "coach", label: "AI Coach", icon: MessageCircle },
  { id: "profile", label: "Profile", icon: User },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>("home");

  return (
    <AuthGate>
      {({ token, user, logout }) => (
        <div className="flex min-h-dvh bg-background">

          {/* ── Desktop sidebar ── */}
          <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-50 w-56 border-r border-border bg-card/80 backdrop-blur-xl">
            {/* Logo */}
            <div className="flex items-center gap-2 px-5 py-5 border-b border-border">
              <span className="text-xl font-bold tracking-tight text-foreground">Adet</span>
            </div>

            {/* Nav items */}
            <nav className="flex flex-col gap-1 p-3 flex-1" role="navigation" aria-label="Main navigation">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-left",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* User chip + logout at bottom */}
            <div className="p-3 border-t border-border space-y-1">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-primary uppercase">
                    {(user.full_name || user.email)[0]}
                  </span>
                </div>
                <span className="truncate">{user.full_name || user.email}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </button>
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 md:ml-56 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 min-w-0">
            {activeTab === "home" && <Dashboard token={token} user={user} />}
            {activeTab === "social" && <Social token={token} userId={user.id} />}
            {activeTab === "analytics" && <Analytics token={token} />}
            {activeTab === "coach" && <AiCoach />}
            {activeTab === "profile" && <Profile onLogout={logout} user={user} />}
          </main>

          {/* ── Mobile bottom nav ── */}
          <nav
            className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/80 backdrop-blur-xl"
            role="navigation"
            aria-label="Main navigation"
          >
            <div className="flex items-center justify-around px-2 py-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label={tab.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className={cn("h-5 w-5 transition-all", isActive && "scale-110")} />
                    <span className="text-[10px] font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </AuthGate>
  );
}
