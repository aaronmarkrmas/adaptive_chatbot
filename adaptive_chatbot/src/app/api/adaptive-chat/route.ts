import { createGoogle } from "@ai-sdk/google";
import { convertToModelMessages, streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { MODEL_NAME, BASE_PROMPT, GENERATION_SETTINGS, GOOGLE_OPTIONS } from "@/lib/config";
import { detectEmotion } from "@/lib/adaptive/emotionDetector";
import { retrieveGuidance } from "@/lib/adaptive/guidanceService";
import { buildSystemPrompt } from "@/lib/adaptive/promptBuilder";
import { auditResponse } from "@/lib/adaptive/responseAuditor";
import { createRequestId, logStep, OFFLINE_MESSAGE } from "@/lib/adaptive/turnLogger";
import { GENERATIONS } from "@/lib/library/emojiFramework";
import { getLibraryIndex } from "@/lib/library/libraryLoader";

const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY });

function getLatestUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object" || !("role" in message) || message.role !== "user") continue;
    if (!("parts" in message) || !Array.isArray(message.parts)) continue;

    const parts = message.parts as unknown[];
    return parts
      .filter((part: unknown): part is { type: "text"; text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string",
      )
      .map((part: { text: string }) => part.text)
      .join("")
      .trim();
  }

  return "";
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId();

  try {
    const { messages, generation } = await req.json();
    const userMessage = getLatestUserText(messages);

    if (!userMessage) {
      return NextResponse.json({ error: "A user message is required" }, { status: 400 });
    }
    if (typeof generation !== "string" || !GENERATIONS.includes(generation as (typeof GENERATIONS)[number])) {
      return NextResponse.json({ error: "Invalid generation" }, { status: 400 });
    }

    logStep(requestId, "0. User generation", {
      generation,
    });

    logStep(requestId, "1. User submitted text", {
      input: userMessage,
    });

    let detectedEmotion;
    try {
      detectedEmotion = await detectEmotion(userMessage);
    } catch (error) {
      console.error(`[adaptive-chat][${requestId}] Emotion detection failed`, error);
      return NextResponse.json({ error: OFFLINE_MESSAGE }, { status: 503 });
    }

    const emotion = detectedEmotion.normalized;
    logStep(requestId, "2. Emotion detected", {
      input: userMessage,
      detectorOutput: detectedEmotion.raw,
      normalizedEmotion: emotion,
    });

    const index = getLibraryIndex();
    const { guidance, rules, guidanceText } = retrieveGuidance(index, generation, emotion);
    logStep(requestId, "3. Valid guidance rules selected", {
      generation: guidance.generation,
      emotion: guidance.emotion,
      status: guidance.status,
      note: guidance.note,
      rules,
    });

    logStep(requestId, "4. Guidance text rendered", {
      guidanceText: guidanceText || "(no guidance: insufficient data)",
    });

    const systemPrompt = buildSystemPrompt(BASE_PROMPT, guidanceText);
    logStep(requestId, "5. Final prompt sent to Gemini", {
      systemPrompt: systemPrompt ?? "(no system prompt)",
      userPrompt: userMessage,
    });

    const result = streamText({
      model: google(MODEL_NAME),
      system: systemPrompt ?? undefined,
      messages: await convertToModelMessages(messages),
      ...GENERATION_SETTINGS,
      providerOptions: GOOGLE_OPTIONS,
      onFinish: ({ text }) => {
        const { compliance, evidence } = auditResponse(index, guidance, generation, emotion, text);

        logStep(requestId, "6. Final response audit", {
          generation,
          emotion,
          status: guidance.status,
          libraryVersion: index.version,
          reply: text,
          compliance,
          evidence,
        });
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Adaptive chatbot error:", error);
    return NextResponse.json({ error: OFFLINE_MESSAGE }, { status: 500 });
  }
}