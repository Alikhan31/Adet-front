"use client";

import { useState } from "react";
import {
  Home,
  Users,
  BarChart3,
  MessageCircle,
  User,
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
        <div className="flex min-h-dvh flex-col bg-background">
          <main className="flex-1 overflow-y-auto pb-20">
            {activeTab === "home" && <Dashboard token={token} user={user} />}
            {activeTab === "social" && <Social />}
            {activeTab === "analytics" && <Analytics />}
            {activeTab === "coach" && <AiCoach />}
            {activeTab === "profile" && <Profile onLogout={logout} user={user} />}
          </main>

          <nav
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/80 backdrop-blur-xl"
            role="navigation"
            aria-label="Main navigation"
          >
            <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
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
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-all",
                        isActive && "scale-110"
                      )}
                    />
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
