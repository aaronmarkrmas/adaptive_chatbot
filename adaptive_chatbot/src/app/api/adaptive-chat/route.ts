import { createGoogle } from "@ai-sdk/google";
import { convertToModelMessages, streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { MODEL_NAME, BASE_PROMPT, GENERATION_SETTINGS, GOOGLE_OPTIONS } from "@/lib/config";

const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const result = streamText({
      model: google(MODEL_NAME),
      system: BASE_PROMPT,
      messages: await convertToModelMessages(messages),
      ...GENERATION_SETTINGS,
      providerOptions: GOOGLE_OPTIONS,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Adaptive chatbot error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}