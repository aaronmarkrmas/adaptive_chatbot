"use client";

import { useState } from "react";

export type AgeGroup = "genz" | "millennial";

const OPTIONS: { value: AgeGroup; label: string; range: string }[] = [
  { value: "genz", label: "Gen Z", range: "Born 1997–2012" },
  { value: "millennial", label: "Millennial", range: "Born 1981–1996" },
];

export default function OnboardingModal({
  onComplete,
}: {
  onComplete: (group: AgeGroup) => void;
}) {
  const [selected, setSelected] = useState<AgeGroup | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-study">
        <h2
          id="onboarding-title"
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-outfit)" }}
        >
          Before we begin
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Which age group do you belong to?
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected === option.value}
              onClick={() => {
                setSelected(option.value);
                void fetch("/api/adaptive-chat/onboarding", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ generation: option.label }),
                }).catch((error: unknown) => {
                  console.error("[adaptive-chat][onboarding] Failed to send generation selection", error);
                });
              }}
              className={`rounded-md border px-3 py-3 text-left text-sm transition-colors ${
                selected === option.value
                  ? "border-primary bg-secondary"
                  : "border-border bg-card hover:bg-secondary"
              }`}
            >
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.range}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onComplete(selected)}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}