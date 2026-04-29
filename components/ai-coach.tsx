"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Lightbulb,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
}

interface HistoryItem {
  role: string;
  content: string;
}

const SESSION_KEY = "adet_coach_session";
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24h

function loadSession(): { messages: Message[]; history: HistoryItem[] } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { messages: Message[]; history: HistoryItem[]; savedAt: number };
    if (Date.now() - data.savedAt > SESSION_TTL) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { messages: data.messages, history: data.history };
  } catch {
    return null;
  }
}

function saveSession(messages: Message[], history: HistoryItem[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages, history, savedAt: Date.now() }));
  } catch {}
}

const suggestions = [
  { icon: Lightbulb, text: "How can I improve my morning routine?" },
  { icon: TrendingUp, text: "Why did my streak drop last week?" },
  { icon: Clock, text: "What is the best time to meditate?" },
  { icon: Sparkles, text: "Give me a motivation boost" },
];

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AiCoach() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setMessages(saved.messages);
      setHistory(saved.history);
      return;
    }

    async function init() {
      const token = getStoredToken();
      if (!token) {
        const msg: Message[] = [{ id: "1", role: "assistant", content: "Hey! I'm your AI habit coach. How can I help you today?", time: "Just now" }];
        setMessages(msg);
        saveSession(msg, []);
        return;
      }
      try {
        const [me, summary] = await Promise.all([api.auth.me(token), api.analytics.summary(token)]);
        const name = me.full_name?.split(" ")[0] ?? me.email.split("@")[0];
        const pct = summary.possible_this_week > 0
          ? Math.round((summary.completions_this_week / summary.possible_this_week) * 100)
          : 0;
        const greeting = `Hey ${name}! I'm your AI habit coach. I've been looking at your data — you're at a ${pct}% completion rate this week with ${summary.habits_count} active habits. How can I help you today?`;
        const msg: Message[] = [{ id: "1", role: "assistant", content: greeting, time: "Just now" }];
        setMessages(msg);
        saveSession(msg, []);
      } catch {
        const msg: Message[] = [{ id: "1", role: "assistant", content: "Hey! I'm your AI habit coach. How can I help you today?", time: "Just now" }];
        setMessages(msg);
        saveSession(msg, []);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const token = getStoredToken();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      time: nowTime(),
    };
    setMessages(prev => {
      const next = [...prev, userMessage];
      saveSession(next, history);
      return next;
    });
    setInput("");
    setIsTyping(true);

    try {
      if (!token) throw new Error("no token");
      const { reply } = await api.ai.chat(token, text.trim(), history);
      const newHistory = [...history, { role: "user", content: text.trim() }, { role: "assistant", content: reply }];
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: reply, time: nowTime() };
      setHistory(newHistory);
      setMessages(prev => {
        const next = [...prev, assistantMsg];
        saveSession(next, newHistory);
        return next;
      });
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't reach the AI service right now. Please try again in a moment.",
        time: nowTime(),
      };
      setMessages(prev => {
        const next = [...prev, errMsg];
        saveSession(next, history);
        return next;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex h-[calc(100dvh-5rem)] md:h-dvh flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="mx-auto flex max-w-lg md:max-w-3xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Coach</h1>
            <p className="text-xs text-muted-foreground">
              Powered by your habit data
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="mx-auto max-w-lg md:max-w-3xl px-4 py-4">
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" && "flex-row-reverse"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    message.role === "assistant"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {message.role === "assistant" ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5",
                    message.role === "assistant"
                      ? "rounded-tl-sm bg-card border border-border text-card-foreground"
                      : "rounded-tr-sm bg-primary text-primary-foreground"
                  )}
                >
                  <p className="whitespace-pre-line text-sm leading-relaxed">
                    {message.content}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      message.role === "assistant"
                        ? "text-muted-foreground"
                        : "text-primary-foreground/70"
                    )}
                  >
                    {message.time}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Suggestion Chips */}
          {showSuggestions && (
            <div className="mt-6">
              <p className="text-xs font-medium text-muted-foreground">
                Quick questions
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {suggestions.map((suggestion) => {
                  const Icon = suggestion.icon;
                  return (
                    <Card
                      key={suggestion.text}
                      className="cursor-pointer border transition-all hover:border-primary/40 hover:shadow-sm"
                      onClick={() => sendMessage(suggestion.text)}
                      role="button"
                      tabIndex={0}
                      aria-label={suggestion.text}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          sendMessage(suggestion.text);
                        }
                      }}
                    >
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm text-card-foreground">
                          {suggestion.text}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border px-4 py-3">
        <form
          className="mx-auto flex max-w-lg md:max-w-3xl items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your AI coach..."
            className="flex-1"
            disabled={isTyping}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 bg-primary text-primary-foreground"
            disabled={!input.trim() || isTyping}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
