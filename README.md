# Adaptive Chatbot

This repository contains the adaptive chatbot application. It uses Google
Gemini to generate supportive responses and applies emoji guidance from the
validated rule library in
[`adaptive_chatbot/src/lib/library/library.csv`](./adaptive_chatbot/src/lib/library/library.csv).

The adaptive behavior uses:

1. The receiving user's selected generation: `Gen Z` or `Millennial`.
2. A predefined emotion for one of the five evaluation prompts, or a Gemini
   emotion/guard-rail pre-call for free-text messages.
3. Generation-and-emotion rules from `library.csv`.
4. Hidden emoji guidance added to the final Gemini system prompt.
5. Post-generation compliance and evidence auditing.

## Features

- Single-conversation chat interface.
- Generation onboarding for Gen Z and Millennial users.
- Five controlled starter prompts with deterministic emotion labels.
- Free-text input with emotion detection and an `out_of_scope` guard rail.
- CSV-backed emoji rule lookup.
- Hidden context-specific emoji guidance.
- Streaming Gemini responses.
- Conversation and onboarding persistence in browser `localStorage`.
- Server-side request and audit logs.

## Tech stack

- Next.js 16 App Router
- React 19 and TypeScript
- Vercel AI SDK
- Google Gemini `gemini-2.5-flash`
- Tailwind CSS v4

## Getting started

From the application directory:

```powershell
cd adaptive_chatbot
npm install
```

Create `adaptive_chatbot/.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the application:

```powershell
npm run dev
```

Open <http://localhost:3000>.

## End-to-end workflow

```text
Open application
    |
    v
Select Gen Z or Millennial
    |
    +--> POST /api/adaptive-chat/onboarding
    |       +--> Validate and log generation
    |       +--> Save onboarding state in localStorage
    |
    v
Select a starter prompt or type a message
    |
    +--> Send full conversation history and generation
    |
    +--> Extract the latest user text
    |
    +--> Starter prompt ID supplied?
    |       |
    |       +--> Yes: validate ID and exact text; use predefined emotion
    |       |
    |       +--> No: Gemini classifies emotion or returns out_of_scope
    |
    +--> out_of_scope?
    |       +--> Yes: reject with HTTP 422; do not generate a response
    |
    +--> Query library.csv with generation + emotion
    |
    +--> Render hidden emoji guidance
    |
    +--> Combine base prompt and guidance
    |
    +--> Send system prompt and full conversation to Gemini
    |
    v
Stream response, persist completed messages, and audit the response
```

## Controlled starter prompts

The five starter prompts are registered in
[`starterPrompts.ts`](./adaptive_chatbot/src/lib/adaptive/starterPrompts.ts).
Their emotions are assigned before evaluation and are not detected by Gemini:

| Prompt ID | Emotion |
|---|---|
| `hopeful-marriage` | `happiness` |
| `missed-christmas-gift` | `sadness` |
| `anxious-interview` | `fear` |
| `cookies-dog` | `disgust` |
| `lost-job-anger` | `anger` |

The client sends the stable prompt ID. The server validates both the ID and
the exact prompt text, so the browser cannot select a different emotion by
modifying the request.

## Free-text behavior and guard rail

If no starter prompt ID is supplied, the server calls
[`emotionDetector.ts`](./adaptive_chatbot/src/lib/adaptive/emotionDetector.ts)
once. The detector must return exactly one of:

```text
anger
disgust
fear
happiness
sadness
out_of_scope
```

The first five labels continue to rule lookup. `out_of_scope` rejects the
request with HTTP 422 and prevents the final response call. The guard rail is
intended to reject coding, mathematics, research, current events, general
knowledge, entertainment, and other general-purpose AI requests.

Detector failure returns HTTP 503 and does not produce an unclassified
response.

The five fixed prompts are the controlled evaluation stimuli. Free-text turns
are exploratory and should be analyzed separately from the fixed-prompt
comparison.

## Generation and persistence

The onboarding modal accepts exactly `Gen Z` or `Millennial`. The selection is
validated and logged by
`POST /api/adaptive-chat/onboarding`, then saved in `localStorage`. Refreshing
the browser preserves the selection and saved conversation.

Clicking **New chat**:

1. Clears displayed messages.
2. Removes the saved conversation.
3. Removes onboarding and generation values.
4. Shows the onboarding modal again.

The next message therefore starts with no previous conversation context.

## Rule lookup and guidance

`library.csv` is parsed, validated, and indexed once per server process.
Guidance is selected with:

```text
(user generation, canonical emotion)
```

Preferred rules are ordered by rank and confidence. Avoid rules are ordered
by confidence. Missing rules produce `insufficient` guidance and the base
prompt is still sent without invented recommendations.

The final system prompt is:

```text
Respond naturally to the user's message.

[hidden emoji guidance when valid rules exist]
```

The original user message and complete conversation history remain unchanged.

## Response, persistence, and auditing

The final response uses:

```text
model: gemini-2.5-flash
temperature: 0.7
topP: 0.95
maxOutputTokens: 1024
thinkingBudget: 256
includeThoughts: false
```

Responses stream through `streamText` and
`toUIMessageStreamResponse`. The UI displays only assistant text. Completed
conversation state is saved to `localStorage`; incomplete or failed states are
not intentionally persisted.

After a successful stream, the server records the library version, reply,
compliance result, and emoji evidence. Auditing does not modify the response.

## API routes

| Route | Purpose |
|---|---|
| `POST /api/adaptive-chat/onboarding` | Validate and log generation selection |
| `POST /api/adaptive-chat` | Validate input, classify or assign emotion, retrieve guidance, and stream response |

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
