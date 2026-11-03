import {
  checkCompliance,
  replyEvidence,
  type Guidance,
  type LibraryIndex,
} from "@/lib/library/emojiFramework";

export function auditResponse(
  index: LibraryIndex,
  guidance: Guidance,
  generation: string,
  emotion: string | null,
  reply: string,
) {
  return {
    compliance: checkCompliance(guidance, reply),
    evidence: replyEvidence(index, generation, emotion, reply),
  };
}
