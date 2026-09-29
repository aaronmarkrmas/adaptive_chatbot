export const MODEL_NAME = "gemini-2.5-flash";
export const BASE_PROMPT =
  "You are a friendly, helpful chatbot. Respond naturally to the user.";

export const GENERATION_SETTINGS = {
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 1024,
};

export const GOOGLE_OPTIONS = {
  google: {
    thinkingConfig: { thinkingBudget: 256, includeThoughts: false },
  },
};