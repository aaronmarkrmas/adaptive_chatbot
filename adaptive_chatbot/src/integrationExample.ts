/**
 * How to plug the lookup into YOUR existing adaptive chatbot. The vanilla chatbot stays exactly as it is.
 *
 * Methodology alignment (Section 4.4.4): the lookup key is the user's generation + the detected emotion, nothing else.
 * The two chatbots must be identical except for the injected guidance:
 *   - if your vanilla chatbot sends the user's message to Gemini with NO system prompt, pass baseSystemPrompt = null here
 *     (the guidance block is then the whole system prompt);
 *   - if your vanilla chatbot has a system prompt, pass exactly the same text here.
 * The user message itself is never modified.
 */
import {
  buildSystemPrompt, checkCompliance, getGuidance, normalizeEmotion, renderGuidance, replyEvidence, toLog,
  type LibraryIndex,
} from "./lib/library/emojiFramework";

/** Your existing Gemini call: (system prompt or null, user message) -> reply text. Use the SAME function (model, temperature) for both chatbots. */
export type CallGemini = (systemPrompt: string | null, userMessage: string) => Promise<string>;

export async function adaptiveReply(
  index: LibraryIndex, // LibraryIndex.fromCsvText(...), built ONCE at start-up
  userMessage: string,
  userGeneration: string, // exactly 'Gen Z' or 'Millennial' (your onboarding answer)
  detectorOutput: string, // whatever your emotion pre-call returned
  baseSystemPrompt: string | null, // identical to the vanilla chatbot's system prompt, or null for both
  callGemini: CallGemini,
) {
  const emotion = normalizeEmotion(detectorOutput); // one of the five library labels, or null
  const g = getGuidance(index, userGeneration, emotion); // all rules for (generation, emotion); throws on an invalid generation BEFORE any reply
  const systemPrompt = buildSystemPrompt(baseSystemPrompt, renderGuidance(g)); // '' (nothing added) when there is insufficient data
  const reply = await callGemini(systemPrompt, userMessage); // guidance goes in the SYSTEM prompt only
  const log = {
    ...toLog(g),
    libraryVersion: index.version,
    reply,
    compliance: checkCompliance(g, reply),
    evidence: replyEvidence(index, userGeneration, emotion, reply),
  };
  return { reply, log };
}
