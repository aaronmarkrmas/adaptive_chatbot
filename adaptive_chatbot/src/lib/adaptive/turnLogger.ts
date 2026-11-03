export const OFFLINE_MESSAGE =
  "The chatbot is offline. Please reload the page or try contacting the researchers.";

export function createRequestId() {
  return crypto.randomUUID();
}

export function logStep(requestId: string, step: string, details: Record<string, unknown>) {
  console.info(`[adaptive-chat][${requestId}] ${step}`, details);
}
