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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
}

const suggestions = [
  { icon: Lightbulb, text: "How can I improve my morning routine?" },
  { icon: TrendingUp, text: "Why did my streak drop last week?" },
  { icon: Clock, text: "What is the best time to meditate?" },
  { icon: Sparkles, text: "Give me a motivation boost" },
];

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hey Alex! I am your AI habit coach. I have been analyzing your recent progress -- you are doing great with a 85% consistency score this week! How can I help you today?",
    time: "Just now",
  },
];

const coachResponses: Record<string, string> = {
  "How can I improve my morning routine?":
    "Based on your data, your morning habits have a 72% completion rate. Here are my suggestions:\n\n1. Start with your easiest habit (drinking water) to build momentum\n2. Move your alarm 15 minutes earlier\n3. Pair your run with a podcast you enjoy\n\nYour best mornings happen when you complete habits before 8 AM. Try setting a gentle reminder at 6:30 AM!",
  "Why did my streak drop last week?":
    "Looking at your data from last week, I noticed a dip on Thursday and Friday. This coincided with your late sleep times (past midnight both nights). When your sleep habit breaks, it creates a domino effect on your morning habits.\n\nMy recommendation: prioritize your \"Sleep by 11 PM\" habit. It is the keystone habit that influences 4 of your other 5 habits!",
  "What is the best time to meditate?":
    "Based on your completion patterns, you are most consistent with habits done before 9 AM. However, your meditation success rate is actually higher in the evening (78% vs 62%).\n\nI recommend trying a short 5-minute meditation right after your morning run (when your focus is peak) and a longer 10-minute session before bed.",
  "Give me a motivation boost":
    "Here is what is amazing about your journey:\n\n- You have completed 247 habits this month\n- Your water intake streak is 24 days -- that is in the top 10% of users!\n- You have been more consistent than 73% of people your age\n\nRemember: progress is not always linear. The fact that you are here asking for help shows incredible self-awareness. You have got this!",
};

export function AiCoach() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      time: "Just now",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const response =
        coachResponses[text.trim()] ||
        "That is a great question! Based on your habit data, I would recommend starting small and building consistency first. Would you like me to create a personalized plan for you?";

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        time: "Just now",
      };

      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 1200);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
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
        <div className="mx-auto max-w-lg px-4 py-4">
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
          className="mx-auto flex max-w-lg items-center gap-2"
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
