"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import OnboardingModal from "@/components/OnboardingModal";
import { STARTER_PROMPTS, type StarterPromptId } from "@/lib/adaptive/starterPrompts";

const STORAGE_KEY = "adaptive-chatbot:conversation:v1";
const ONBOARDED_KEY = "adaptive-chatbot:onboarded:v1";
const GENERATION_KEY = "adaptive-chatbot:generation:v1";

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UIMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);


  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setOnboarded(
        window.localStorage.getItem(ONBOARDED_KEY) === "true" &&
          Boolean(window.localStorage.getItem(GENERATION_KEY)),
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);
  const showOnboarding = onboarded === false;
  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    id: "chatbot-single-conversation",
    transport: new DefaultChatTransport({ api: "/api/adaptive-chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  // Restore the saved conversation on the client (avoids server/client mismatch).
  useEffect(() => {
    const saved = loadMessages();
    if (saved.length) setMessages(saved);
  }, [setMessages]);

  useEffect(() => {
    if (status !== "ready" || messages.length === 0) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      
    }
  }, [messages, status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const focusInput = useCallback(() => textareaRef.current?.focus(), []);

  useEffect(() => {
    if (status === "ready" && !showOnboarding) focusInput();
  }, [status, showOnboarding, focusInput]);

  const send = useCallback(
    (text: string, promptId?: StarterPromptId) => {
      const trimmed = text.trim();
      if (!trimmed || isBusy) return;
      void sendMessage(
        { text: trimmed },
        { body: { generation: window.localStorage.getItem(GENERATION_KEY), ...(promptId ? { promptId } : {}) } },
      );
      setInput("");
      requestAnimationFrame(() => focusInput());
    },
    [isBusy, sendMessage, focusInput],
  );

  const startFresh = () => {
    stop();
    setMessages([]);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDED_KEY);
    window.localStorage.removeItem(GENERATION_KEY);
    setOnboarded(false);
    focusInput();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-3 py-4 sm:px-6 sm:py-8">
      {showOnboarding && (
        <OnboardingModal
          onComplete={async (group) => {
            const generation = group === "genz" ? "Gen Z" : "Millennial";
            const response = await fetch("/api/adaptive-chat/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ generation }),
            });
            if (!response.ok) {
              throw new Error(`Onboarding request failed with status ${response.status}`);
            }
            window.localStorage.setItem(ONBOARDED_KEY, "true");
            window.localStorage.setItem(GENERATION_KEY, generation);
            setOnboarded(true);
          }}
        />
      )}
      <main className="flex h-[calc(100vh-2rem)] max-h-[760px] min-h-[560px] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-study sm:h-[calc(100vh-4rem)]">
        <header className="flex items-center gap-3 border-b border-border bg-header px-4 py-4 sm:px-6">

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold" style={{ fontFamily: "var(--font-outfit)" }}>
              Aiva
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {isBusy ? "Responding…" : "Active session"}
            </p>
          </div>
          <button
            type="button"
            onClick={startFresh}
            disabled={isBusy}
            className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary/40"
          >
            New chat
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col gap-5 px-4 py-6 sm:px-6">
            {isEmpty ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
                <div>
                  <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-outfit)" }}>
                    Hello, I&apos;m Aiva!
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                    Pick one of the following starters to begin your conversation
                  </p>
                </div>
                <div className="grid w-full max-w-sm gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((starter) => (
                    <button
                      key={starter.id}
                      type="button"
                      onClick={() => send(starter.text, starter.id)}
                      className="min-h-10 rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                    >
                      {starter.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                const text = messageText(message);

                if (isUser) {
                  if (!text) return null;
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                        {text}
                      </div>
                    </div>
                  );
                }

                if (!text) return null;

                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-bl-sm border border-border bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
                      {text}
                    </div>
                  </div>
                );
              })
            )}

            {status === "submitted" && (
              <p className="text-sm text-muted-foreground">Preparing a response…</p>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error.message.includes("limited to emotional")
                  ? "This chatbot is limited to emotional and supportive conversations."
                  : "The chatbot is offline. Please reload the page or try contacting the researchers."}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-card px-3 py-3 sm:px-6 sm:py-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
            className="rounded-lg border border-border bg-input-surface"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              placeholder="Type an emotional or supportive message…"
              className="w-full resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex justify-end px-2 pb-2">
              <button
                type="submit"
                disabled={isBusy || !input.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Your conversation is stored only in this browser.
          </p>
        </div>
      </main>
    </div>
  );
}
