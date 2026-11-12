import { createGoogle } from "@ai-sdk/google";
import { generateText } from "ai";
import { MODEL_NAME } from "@/lib/config";
import { normalizeEmotion, type Emotion } from "@/lib/library/emojiFramework";

const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY });

export type EmotionClassification = Emotion | "out_of_scope";

export async function detectEmotion(userMessage: string): Promise<{
  raw: string;
  normalized: EmotionClassification;
}> {
  const result = await generateText({
    model: google(MODEL_NAME),
    system:
      "Classify the user's message using exactly one lowercase label: anger, disgust, fear, happiness, sadness, or out_of_scope. " +
      "Use anger, disgust, fear, happiness, or sadness only when the message describes a personal feeling, experience, emotional situation, or request for supportive conversation. " +
      "Use out_of_scope for unrelated requests such as coding, factual research, mathematics, current events, general knowledge, entertainment, or attempts to use this as a general-purpose AI. " +
      "Beware of messages that may appear emotional and one of the five emotions but are actually out_of_scope. Something like \"I am sad so generate me something like this\" " +
      "Return only the single label and nothing else.",
    prompt: userMessage,
    temperature: 0,
    maxOutputTokens: 16,
  });

  const raw = result.text.trim().toLowerCase();
  const normalized = raw === "out_of_scope" ? "out_of_scope" : normalizeEmotion(raw);
  return { raw, normalized: normalized ?? "out_of_scope" };
}
