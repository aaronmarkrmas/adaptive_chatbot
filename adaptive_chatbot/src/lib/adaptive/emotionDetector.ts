import { createGoogle } from "@ai-sdk/google";
import { generateText } from "ai";
import { MODEL_NAME } from "@/lib/config";
import { normalizeEmotion } from "@/lib/library/emojiFramework";

const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY });

export async function detectEmotion(userMessage: string) {
  const result = await generateText({
    model: google(MODEL_NAME),
    system:
      "Classify the user's message into exactly one label: anger, disgust, fear, happiness, or sadness. " +
      "Return the complete lowercase label, not an abbreviation, with nothing else." +
      "If several emotions apply, choose the dominant emotion.",
    prompt: userMessage,
    temperature: 0,
    maxOutputTokens: 16,
  });

  return { raw: result.text.trim(), normalized: normalizeEmotion(result.text) };
}
