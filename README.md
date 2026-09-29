A minimal, single-conversation chatbot built with Next.js (App Router) and the Vercel AI SDK, powered by Google Gemini. It streams the model's reply — and its "thinking" — live, and keeps every response in your browser via localStorage.

Features
- Single conversation chat UI with a warm, study-friendly palette.
- Token streaming — Gemini replies appear as they are generated.
- Live "Thinking" box — the model's chain-of-thought streams into a subtle, dashed panel above each answer.
- Session persistence — the conversation is saved to localStorage and restored on reload ("New chat" clears it).
- Starter prompts for quick conversation, plus keyboard controls (Enter to send, Shift+Enter for newline).

Tech Stack
- Next.js 16 (https://nextjs.org) (App Router, "use client" page)
- Vercel AI SDK (https://ai-sdk.dev) — ai v7, @ai-sdk/react, @ai-sdk/google
- Google Gemini (https://ai.google.dev) (gemini-2.5-flash)
- Tailwind CSS v4
- TypeScript


Getting Started
1. Install dependencies
npm install

2. Set up your Gemini API key
Create a .env.local file in the project root with:
GEMINI_API_KEY=your_gemini_api_key_here
Get a free key at <https://ai.google.dev>.

3. Run the dev server
npm run dev
Open http://localhost:3000 (http://localhost:3000) and start chatting.




Project Structure
src/
├── app/
│   ├── api/
│   │   └── vanilla_chat/
│   │       └── route.ts      # Server route: streams Gemini replies (NDJSON UI-message stream)
│   ├── page.tsx              # Chat UI; useChat + DefaultChatTransport
│   ├── layout.tsx
│   └── globals.css           # Theme tokens (Tailwind v4)
├── components/               # (optional) shared UI components
├── lib/                       # Utility helpers
└── types/




How It Works
1. page.tsx uses <useChat>, which sends the conversation history to POST /api/vanilla_chat via DefaultChatTransport.
2. The route converts those messages with convertToModelMessages, streams a response with streamText, and returns it with toUIMessageStreamResponse().
3. thinkingConfig.includeThoughts: true makes Gemini include its reasoning, which arrives as reasoning parts and is rendered live in the "Thinking" panel.
4. The page persists the conversation to localStorage (only when the message list is non-empty) and restores it on load.



Available Scripts
Command
npm run dev
npm run build
npm run start
npm run lint



Troubleshooting
- No reply appears / 400 in the Network tab — the page calls /api/vanilla_chat and the route speaks the AI SDK wire protocol, not a plain { reply } JSON. If you changed one side, keep both in sync.
- "Failed to generate response" (500) — your GEMINI_API_KEY is missing, invalid, or the model is unavailable (you can try a newer model ID in route.ts).
- No "Thinking" box — the featured model must be a reasoning-capable Gemini model, and thinkingConfig.includeThoughts must stay enabled in route.ts.
- Conversation does not persist — storage only writes when the message list is non-empty; use the "New chat" button to clear.