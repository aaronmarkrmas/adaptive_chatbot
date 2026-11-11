import type { Emotion } from "@/lib/library/emojiFramework";

export const STARTER_PROMPTS = [
  {
    id: "hopeful-marriage",
    emotion: "happiness",
    text: "I Felt hopeful when I met my betterhalf for the first time. She gives me hope for my remaining life without saying anything. I feel hopeful after my marriage.",
  },
  {
    id: "missed-christmas-gift",
    emotion: "sadness",
    text: "One year during christmas, i did not get a single gift. It was a rough day for me.",
  },
  {
    id: "anxious-interview",
    emotion: "fear",
    text: "A recent job interview that I had made me feel very anxious because I felt like I didn't come prepared.",
  },
  {
    id: "cookies-dog",
    emotion: "disgust",
    text: "I ate all my kids cookies and blamed it on the dog.",
  },
  {
    id: "lost-job-anger",
    emotion: "anger",
    text: "I once lost my job and got mad.",
  },
] as const satisfies readonly { id: string; emotion: Emotion; text: string }[];

export type StarterPromptId = (typeof STARTER_PROMPTS)[number]["id"];

export function getStarterPrompt(id: unknown) {
  return STARTER_PROMPTS.find((prompt) => prompt.id === id);
}
