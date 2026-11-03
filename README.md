# Adaptive Chatbot

This repository contains a Next.js chatbot powered by Google Gemini. Unlike a vanilla chatbot, it adapts emoji behavior using:

1. The user's selected generation: `Gen Z` or `Millennial`.
2. The emotion detected in the latest user message.
3. Matching rules from `adaptive_chatbot/src/lib/library/library.csv`.

The matched recommendations are added to Gemini's hidden system prompt. The guidance is not shown as a separate message to the user.

## Features

- Single-conversation chat interface.
- Generation onboarding for Gen Z and Millennial users.
- Gemini emotion pre-classification.
- CSV-backed emoji rule lookup.
- Hidden, context-specific emoji guidance.
- Streaming Gemini responses.
- Conversation persistence in browser `localStorage`.
- Server-side logs for each adaptive decision.

## Tech Stack

- Next.js 16 App Router
- React 19 and TypeScript
- Vercel AI SDK
- Google Gemini (`gemini-2.5-flash`)
- Tailwind CSS v4

## Getting Started

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

## Repository Structure

```text
adaptive_chatbot/
├── README.md
├── package.json
├── next.config.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── adaptive-chat/
│   │   │       ├── onboarding/
│   │   │       │   └── route.ts       # Logs generation selection in the Next.js terminal
│   │   │       └── route.ts            # Emotion detection, lookup, prompt construction, streaming
│   │   ├── page.tsx                    # Chat UI and client-side generation/session handling
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── OnboardingModal.tsx         # Generation selection modal
│   ├── lib/
│   │   ├── adaptive/
│   │   │   ├── emotionDetector.ts      # Gemini emotion pre-call and label normalization
│   │   │   ├── guidanceService.ts      # Rule lookup and guidance rendering
│   │   │   ├── promptBuilder.ts        # Hidden system-prompt construction
│   │   │   ├── responseAuditor.ts      # Compliance and evidence auditing
│   │   │   └── turnLogger.ts           # Request IDs, structured logs, offline message
│   │   ├── library/
│   │   │   ├── emojiFramework.ts       # CSV validation, lookup, rendering, auditing
│   │   │   ├── libraryLoader.ts        # Validated library loading and caching
│   │   │   └── library.csv             # Validated generation/emotion rules
│   │   └── config.ts                   # Gemini model and generation settings
│   ├── integrationExample.ts            # Non-streaming integration reference
│   └── annotated_dataset.csv
└── ...
```

## Complete Chatbot Workflow

```text
Open application
    |
    v
Select Gen Z or Millennial
    |
    +--> POST /api/adaptive-chat/onboarding
    |       +--> Log generation in Next.js terminal
    |
    +--> Save generation in sessionStorage
    |
    v
Submit user message
    |
    +--> Send conversation history and generation
    |
    +--> Extract latest user text
    |
    +--> Gemini emotion pre-call
    |       +--> Normalize detected label
    |
    +--> Query library.csv
    |
    +--> Render guidance text
    |
    +--> Combine base prompt and guidance
    |
    +--> Send system prompt and conversation to Gemini
    |
    v
Stream Gemini response to the UI
```

## Decision-Making Behavior

### 1. Generation selection

The onboarding modal presents two choices:

- `Gen Z`
- `Millennial`

When an option is clicked, the browser immediately sends the canonical generation label to `POST /api/adaptive-chat/onboarding`. The route validates the label and logs it in the Next.js terminal. This occurs before the user clicks **Continue** or submits a message.

The selected generation is also saved in `sessionStorage` and included in every chat request. It represents the person receiving the response; it is not inferred from the message.

### 2. User message extraction

The client sends the conversation history to `POST /api/adaptive-chat`. The server searches from the newest message backward and extracts the latest user text.

If no usable user text exists, the server returns HTTP 400 and does not call the emotion detector or response model.

### 3. Emotion detection

Before generating the response, the server makes a separate Gemini pre-call. Gemini is instructed to return exactly one complete lowercase label:

```text
anger
disgust
fear
happiness
sadness
```

The framework normalizes aliases, including:

```text
happy, joy, joyful -> happiness
sad -> sadness
angry, mad -> anger
scared, afraid, fearful -> fear
dis, disgusted -> disgust
```

Decision behavior:

| Detector result | Behavior |
| --- | --- |
| Valid emotion | Continue to library lookup |
| Recognized alias or abbreviation | Convert it to the canonical library emotion |
| Empty, unknown, or unsupported label | Treat the context as insufficient data; inject no emoji guidance |

An unknown emotion does not cause the chatbot to guess a rule. The normal base chatbot prompt is still sent to Gemini, so the user can receive a normal response without unsupported adaptation.

If the emotion pre-call itself fails, the request returns an offline error instead of generating an unclassified response. The chat displays: **“The chatbot is offline. Please reload the page or try contacting the researchers.”**

### 4. Library loading and lookup

`library.csv` is parsed and validated once per server process by `LibraryIndex`. Rules are queried using:

```text
(user generation, detected emotion)
```

Each matching context is divided into:

- **Prefer rules (`Match`)**: responses supported by the study.
- **Avoid rules (`No Match`)**: responses associated with misinterpretation.

Prefer rules are ordered by rank and confidence. Avoid rules are ordered by confidence.

Decision behavior:

| Lookup result | Behavior |
| --- | --- |
| Prefer rules exist | Include preferred emoji recommendations and any avoid rules |
| Only avoid rules exist | Include the avoid list; mark the result `avoid_only` |
| No rules for generation/emotion | Mark the result `insufficient`; inject no emoji guidance |
| Invalid generation | Reject the request instead of silently using another generation |

When no rule can be returned, Gemini still receives `BASE_PROMPT` and the original conversation. The response is therefore generated normally, but without evidence-based emoji adaptation.

The three-input helper (`generation + emotion + emoji`) is for auditing an emoji already used or considered. It is not the pre-generation selector because the candidate emoji is unknown before Gemini generates the response.

### 5. Guidance rendering

For a valid rule context, the framework renders a hidden instruction containing:

- User generation.
- Detected emotion.
- Recommendation sentences from the CSV.
- Confidence level for each recommendation.

If the lookup is `insufficient`, `renderGuidance()` returns an empty string. This prevents the system from inventing or applying unsupported recommendations.

### 6. Final Gemini request

The final system prompt is:

```text
BASE_PROMPT

EMOJI GUIDANCE FOR THIS REPLY
```

The guidance is internal and instructs Gemini not to reveal it. The original user message remains a user message; it is not rewritten into the system prompt.

The server logs each stage using a request ID:

```text
[adaptive-chat][request-id] 0. User generation
[adaptive-chat][request-id] 1. User submitted text
[adaptive-chat][request-id] 2. Emotion detected
[adaptive-chat][request-id] 3. Valid guidance rules selected
[adaptive-chat][request-id] 4. Guidance text rendered
[adaptive-chat][request-id] 5. Final prompt sent to Gemini
```

The final log includes both `systemPrompt` and `userPrompt`, allowing the complete decision and prompt construction to be inspected in the Next.js terminal.

### 7. Response and persistence

After prompt construction, the route converts the conversation with `convertToModelMessages`, calls Gemini with `streamText`, and returns an AI SDK UI-message stream.

The client displays the streamed response and saves completed messages to `localStorage`. Clicking **New chat** clears the saved messages and onboarding session, requiring generation selection again.

## API Routes

| Route | Purpose |
| --- | --- |
| `POST /api/adaptive-chat/onboarding` | Validate and log generation selection immediately |
| `POST /api/adaptive-chat` | Detect emotion, query rules, construct prompt, and stream response |

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Troubleshooting

- **No generation log in the terminal**: check that the development server is running and inspect the server terminal, not only browser DevTools.
- **No reply / HTTP 400**: the request did not contain usable user text.
- **HTTP 500/503 or offline message**: the emotion detector or chatbot service is unavailable. Reload the page or try contacting the researchers, then check the Next.js terminal error.
- **Emotion is `null`**: the detector returned an unsupported label; the chatbot intentionally falls back to `BASE_PROMPT` without emoji guidance.
- **No rules are logged**: there is no matching generation/emotion context in `library.csv`; the chatbot intentionally generates a normal response without adaptive guidance.
- **Conversation does not persist**: storage is browser-local and only saves non-empty completed conversations. Use **New chat** to clear it.
