"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import OnboardingModal from "@/components/OnboardingModal";

const STORAGE_KEY = "chatbot:conversation:v1";
const ONBOARDED_KEY = "chatbot:onboarded:v1";
const GENERATION_KEY = "chatbot:generation:v1";

const STARTERS = [
  "Help me think through something",
  "Brainstorm ideas with me",
  "Help me write something",
  "I just want to talk",
];

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
        window.sessionStorage.getItem(ONBOARDED_KEY) === "true" &&
          Boolean(window.sessionStorage.getItem(GENERATION_KEY)),
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);
  const showOnboarding = onboarded === false;
  const { messages, sendMessage, status, error, setMessages } = useChat({
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
    if (status === "streaming" || messages.length === 0) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* storage full or unavailable — chat still works in-session */
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
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isBusy) return;
      void sendMessage(
        { text: trimmed },
        { body: { generation: window.sessionStorage.getItem(GENERATION_KEY) } },
      );
      setInput("");
      requestAnimationFrame(() => focusInput());
    },
    [isBusy, sendMessage, focusInput],
  );

  const startFresh = () => {
    setMessages([]);
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(ONBOARDED_KEY);
    window.sessionStorage.removeItem(GENERATION_KEY);
    setOnboarded(false);
    focusInput();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-3 py-4 sm:px-6 sm:py-8">
      {showOnboarding && (
        <OnboardingModal
          onComplete={(group) => {
            const generation = group === "genz" ? "Gen Z" : "Millennial";
            window.sessionStorage.setItem(ONBOARDED_KEY, "true");
            window.sessionStorage.setItem(GENERATION_KEY, generation);
            setOnboarded(true);
          }}
        />
      )}
      <main className="flex h-[calc(100vh-2rem)] max-h-[760px] min-h-[560px] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-study sm:h-[calc(100vh-4rem)]">
        <header className="flex items-center gap-3 border-b border-border bg-header px-4 py-4 sm:px-6">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-sm font-semibold text-foreground"
          >
            cb
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold" style={{ fontFamily: "var(--font-outfit)" }}>
              chatbot
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {isBusy ? "Responding…" : "Active session"}
            </p>
          </div>
          <button
            type="button"
            onClick={startFresh}
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
                    Hello, I&apos;m chatbot
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                    Share whatever is on your mind — a question, an idea, or something you&apos;d
                    simply like to talk through.
                  </p>
                </div>
                <div className="grid w-full max-w-sm gap-2 sm:grid-cols-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => send(starter)}
                      className="min-h-10 rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                const text = messageText(message);
                const thoughts = message.parts
                  .filter((part) => part.type === "reasoning")
                  .map((part) => part.text)
                  .join("\n")
                  .trim();

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

                if (!text && !thoughts) return null;

                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="flex max-w-[85%] flex-col gap-2">
                      {thoughts && (
                        <div className="whitespace-pre-wrap rounded-lg rounded-bl-sm border border-dashed border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide opacity-70">
                            Thinking
                          </span>
                          <span className="italic">{thoughts}</span>
                        </div>
                      )}
                      {text && (
                        <div className="whitespace-pre-wrap rounded-lg rounded-bl-sm border border-border bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
                          {text}
                        </div>
                      )}
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
                The chatbot is offline. Please reload the page or try contacting the researchers.
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
              placeholder="Type your message…"
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
