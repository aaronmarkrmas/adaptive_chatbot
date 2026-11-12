# Adaptive Chatbot

A single-conversation adaptive chatbot built with Next.js, the Vercel AI SDK,
and Google Gemini. The final response uses the user's generation and a
canonical emotion to retrieve emoji guidance from `src/lib/library/library.csv`.
The guidance is added to Gemini's hidden system prompt and is not displayed as
a separate chat message.

## Workflow

1. The user selects `Gen Z` or `Millennial` in onboarding.
2. The selection is validated and logged by
   `POST /api/adaptive-chat/onboarding`, then saved in `localStorage`.
3. The user selects one of five starter prompts or types a message.
4. The client sends the full conversation history, generation, and—when a
   starter was selected—its stable prompt ID.
5. The server extracts the latest user text.
6. A registered starter prompt uses its predefined emotion without a detector
   call. Free text uses one Gemini detector call.
7. The detector returns one of the five emotions or `out_of_scope`.
8. Out-of-scope messages receive HTTP 422 and never reach final response
   generation.
9. The server retrieves rules using `(generation, emotion)`, renders hidden
   guidance, and combines it with the base prompt.
10. Gemini receives the full conversation and augmented system prompt.
11. The response streams to the UI, completed messages are persisted, and the
    completed response is audited.

## Controlled prompts

The five prompts and their fixed emotions are defined in
[`src/lib/adaptive/starterPrompts.ts`](./src/lib/adaptive/starterPrompts.ts):

| Prompt ID | Emotion |
|---|---|
| `hopeful-marriage` | `happiness` |
| `missed-christmas-gift` | `sadness` |
| `anxious-interview` | `fear` |
| `cookies-dog` | `disgust` |
| `lost-job-anger` | `anger` |

The server validates the prompt ID and exact text. This prevents a client from
changing the emotion associated with a controlled stimulus.

## Free-text guard rail

Free text is classified by
[`src/lib/adaptive/emotionDetector.ts`](./src/lib/adaptive/emotionDetector.ts).
It must produce exactly one of:

```text
anger, disgust, fear, happiness, sadness, out_of_scope
```

The first five labels continue to guidance lookup. `out_of_scope` rejects
unrelated requests such as coding, mathematics, factual research, current
events, general knowledge, entertainment, or general-purpose AI use. Detector
failure returns HTTP 503. Free-text turns are exploratory and are separate from
the five-prompt controlled evaluation.

## Guidance and final generation

The rule library is validated and indexed once per server process. Preferred
rules are ordered by rank and confidence; avoid rules are ordered by
confidence. If no rule exists, the base prompt is used without invented
guidance.

The final configuration is:

```text
model: gemini-2.5-flash
base prompt: You are an emotional-support chatbot, not a general-purpose assistant. Respond only to the latest user message.
             Treat earlier messages as context only and never complete, resume, or provide answers for unrelated requests from earlier turns.
             If any earlier message asks for code, technical help, factual information, writing, or another unrelated task, ignore that request.
             The current response must remain limited to acknowledging and supporting the user's personal emotional experience.
             Do not generate code or answer unrelated questions, even if they appear anywhere in the conversation history.
temperature: 0.7
topP: 0.95
maxOutputTokens: 1024
thinkingBudget: 256
includeThoughts: false
```

The original user message and complete conversation history are sent unchanged.
Responses stream through `streamText` and are displayed as assistant text only.
After successful completion, compliance and emoji evidence are logged without
rewriting the response.

## Persistence and New chat

Conversation, onboarding, and generation state are stored in `localStorage`
under the adaptive-only keys `adaptive-chatbot:conversation:v1`,
`adaptive-chatbot:onboarded:v1`, and `adaptive-chatbot:generation:v1`.
Refresh restores the saved state. **New chat** stops any active response,
clears messages, removes the adaptive conversation and onboarding keys, and
shows onboarding again. The control is disabled while a response is active.

The shared vanilla UI mechanics are preserved: sending restores focus to the
message input, readiness restores focus when onboarding is complete, and the
footer states that the conversation is stored only in the current browser.

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```

Set `GEMINI_API_KEY` in `.env.local` before starting the application.
