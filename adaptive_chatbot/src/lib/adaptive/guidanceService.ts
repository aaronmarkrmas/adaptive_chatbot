import {
  getGuidance,
  LibraryIndex,
  renderGuidance,
  rulesUsed,
  type Guidance,
} from "@/lib/library/emojiFramework";

export function retrieveGuidance(index: LibraryIndex, generation: string, emotion: string | null) {
  const guidance = getGuidance(index, generation, emotion);
  return {
    guidance,
    rules: rulesUsed(guidance),
    guidanceText: renderGuidance(guidance),
  };
}

export type { Guidance };
