# Adaptive Chatbot

A single-conversation adaptive chatbot built with **Next.js (App Router)** and the **Vercel AI SDK**, powered by **Google Gemini**. Before each response, it detects the user's emotion, looks up the matching generation/emotion rules in `library.csv`, and injects the resulting emoji guidance into Gemini's system prompt.

## Features

- **Single conversation chat UI** with a warm, study-friendly palette.
- **Token streaming** — Gemini replies appear as they are generated.
- **Live "Thinking" box** — the model's chain-of-thought streams into a subtle, dashed panel above each answer.
- **Session persistence** — the conversation is saved to `localStorage` and restored on reload ("New chat" clears it).
- **Starter prompts** for quick conversation, plus keyboard controls (Enter to send, Shift+Enter for newline).
- **Emoji adaptation** based on the user's onboarding generation and detected emotion.

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, `"use client"` page)
- [Vercel AI SDK](https://ai-sdk.dev) — `ai` v7, `@ai-sdk/react`, `@ai-sdk/google`
- [Google Gemini](https://ai.google.dev) (`gemini-2.5-flash`)
- Tailwind CSS v4
- TypeScript

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up your Gemini API key

Create a `.env.local` file in the project root with:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get a free key at <https://ai.google.dev>.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start chatting.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── adaptive-chat/
│   │       ├── onboarding/
│   │       │   └── route.ts  # Logs generation selection in the Next.js terminal
│   │       └── route.ts      # Emotion detection, lookup, prompt construction, streaming
│   ├── page.tsx              # Chat UI; useChat + DefaultChatTransport
│   ├── layout.tsx
│   └── globals.css           # Theme tokens (Tailwind v4)
├── components/
│   └── OnboardingModal.tsx   # Generation selection modal
├── lib/
│   └── config.ts             # Gemini model and generation settings
├── emojiFramework.ts         # CSV validation, rule lookup, rendering, and audit helpers
├── integrationExample.ts     # Non-streaming integration reference
├── library.csv               # Validated Phase 2 rule library
└── annotated_dataset.csv
```

## How It Works

The chatbot uses the user's generation and the emotion detected in the latest message to select emoji guidance. The guidance is an internal instruction for Gemini; it is not displayed as a separate chatbot message.

### End-to-end workflow

```text
Open chat
   |
   v
Choose generation in onboarding
   |
   +--> Log selection through /api/adaptive-chat/onboarding
   |
   v
Continue to chat
   |
   v
Submit message
   |
   +--> Extract latest user text
   |
   +--> Gemini emotion pre-call
   |       |
   |       +--> Normalize to anger, disgust, fear, happiness, or sadness
   |       |
   |       +--> Unknown label becomes insufficient data
   |
   +--> Query library using generation + emotion
   |
   +--> Render matching recommendations
   |
   +--> Combine base prompt + hidden emoji guidance
   |
   +--> Send conversation and system prompt to Gemini
   |
   v
Stream response to the chat UI
```

### Step-by-step decision process

#### 1. Generation selection

The onboarding modal asks the user to select **Gen Z** or **Millennial**. The selected value is:

1. Logged immediately through the server-side onboarding endpoint.
2. Saved in `sessionStorage`.
3. Converted to the library labels `Gen Z` or `Millennial`.
4. Sent with every subsequent chat request.

The generation is the profile of the person receiving the chatbot's response. It is not inferred from the message and is not changed by the emotion detector.

#### 2. User message extraction

When the user submits a message, the client sends the full conversation history and the selected generation to `POST /api/adaptive-chat`.

The server searches the messages from newest to oldest and extracts the latest user text. If no usable text is found, the request stops with HTTP 400 because there is nothing to classify or answer.

#### 3. Emotion detection

The server makes a separate Gemini pre-call before generating the response. The detector is instructed to return exactly one of these labels:

```text
anger
disgust
fear
happiness
sadness
```

The detector output is normalized before lookup. For example, aliases such as `happy`, `joy`, `sad`, `angry`, and `scared` are converted to the corresponding library category.

Decision:

| Detector result | Action |
| --- | --- |
| Valid library emotion | Continue with a generation/emotion lookup |
| Recognized alias | Convert it to a valid library emotion, then continue |
| Unknown or empty label | Mark the context as insufficient data and do not inject emoji guidance |

#### 4. Library loading and rule lookup

`library.csv` is loaded and validated once per server process by `LibraryIndex`. Each rule contains the generation, emotion, response choice, statistical values, recommendation, and confidence level.

The runtime lookup key is:

```text
(user generation, detected emotion)
```

This retrieves all rules for that context. Rules are divided into:

- **Prefer rules** (`Match`): emoji responses supported by the library.
- **Avoid rules** (`No Match`): emoji responses associated with misinterpretation.

Prefer rules are ordered by rank and confidence. Avoid rules are ordered by confidence.

Decision:

| Lookup result | Action |
| --- | --- |
| Prefer and/or avoid rules exist | Use the matching rules as guidance |
| Only avoid rules exist | Tell Gemini what to avoid; mark the context `avoid_only` |
| No rules exist | Mark the context `insufficient` and use the base prompt only |
| Invalid generation | Reject the lookup rather than silently using the wrong demographic |

The three-input helper in `emojiFramework.ts` (`generation + emotion + emoji`) is used for auditing candidate/output emojis. It is not used to select guidance before generation because the chatbot does not know which emoji Gemini will produce yet.

#### 5. Guidance rendering

The selected library recommendations are converted into natural-language instructions. The rendered block includes:

- The user's generation.
- The detected emotion.
- The library's recommendation sentences.
- The confidence level attached to each recommendation.

If the lookup returned insufficient data, the rendered guidance is empty. This prevents unsupported assumptions from being injected into the model prompt.

#### 6. Final Gemini prompt

The final system prompt is composed of:

1. `BASE_PROMPT`, which defines the chatbot's general behavior.
2. The rendered emoji guidance, when valid rules were found.

The user's original message is not rewritten or merged into the system prompt. It remains a user message in the converted conversation sent to Gemini.

The server logs the complete decision chain for every request:

```text
[adaptive-chat][request-id] 0. User generation
[adaptive-chat][request-id] 1. User submitted text
[adaptive-chat][request-id] 2. Emotion detected
[adaptive-chat][request-id] 3. Valid guidance rules selected
[adaptive-chat][request-id] 4. Guidance text rendered
[adaptive-chat][request-id] 5. Final prompt sent to Gemini
[adaptive-chat][request-id] 6. Final response audit
```

The final audit log contains `libraryVersion`, the generated `reply`, `compliance`, and `evidence`. The previous prompt log contains both `systemPrompt` and `userPrompt`, allowing the complete prompt and response behavior to be inspected in the Next.js terminal.

#### 7. Response generation and persistence

After the pre-call and lookup complete, the route converts the conversation with `convertToModelMessages`, calls Gemini with `streamText`, and returns the AI SDK UI-message stream. The client displays the streamed response and saves completed conversation history to `localStorage`.

Clicking **New chat** clears the saved conversation and onboarding session so the user must select a generation again.

## Available Scripts

| Command          | Description               |
| ---------------- | ------------------------- |
| `npm run dev`    | Start the dev server      |
| `npm run build`  | Production build          |
| `npm run start`  | Start the production server |
| `npm run lint`   | Run ESLint                |

## Troubleshooting

- **No reply appears / 400 in the Network tab** — the page calls `/api/adaptive-chat` and the route speaks the AI SDK wire protocol, not a plain `{ reply }` JSON. If you changed one side, keep both in sync.
- **"Failed to generate response" (500)** — your `GEMINI_API_KEY` is missing, invalid, or the model is unavailable (you can try a newer model ID in `route.ts`).
- **No "Thinking" box** — the featured model must be a reasoning-capable Gemini model, and `thinkingConfig.includeThoughts` must stay enabled in `route.ts`.
- **Conversation does not persist** — storage only writes when the message list is non-empty; use the "New chat" button to clear.