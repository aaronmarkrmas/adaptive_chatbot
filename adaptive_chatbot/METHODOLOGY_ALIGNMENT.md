# Methodology-to-Implementation Alignment

This document records the behavior implemented by the adaptive chatbot. The
five fixed starter prompts are the controlled evaluation stimuli. Free-text
messages remain available for exploratory use and are not mixed with the
fixed-stimulus comparison.

## Experimental workflow

1. The user selects `Gen Z` or `Millennial` in the onboarding modal.
2. The browser sends the selection to
   `POST /api/adaptive-chat/onboarding`.
3. The server validates and logs the selection. The browser stores the
   onboarding and generation values in `localStorage` under adaptive-only
   keys.
4. The user selects one of five starter prompts or enters free text.
5. The client sends the full conversation history, generation, and an optional
   starter-prompt ID to `POST /api/adaptive-chat`.
6. The server extracts the newest user message.
7. If a starter ID is present, the server validates the ID and exact text and
   uses its predefined emotion. No emotion detector call is made.
8. If no starter ID is present, one Gemini pre-call classifies the free-text
   message as one of the five emotions or `out_of_scope`.
9. An `out_of_scope` result is rejected with HTTP 422 before final generation.
10. The server retrieves rules using `(generation, canonical emotion)`.
11. The rules are rendered into hidden emoji guidance and appended to the base
    system prompt.
12. Gemini receives the full conversation and augmented system prompt.
13. The response streams to the UI. On successful completion, the response is
    persisted and audited.

## Controlled stimuli

The registered prompt-to-emotion mappings are:

| Prompt ID | Intended context | Emotion |
|---|---|---|
| `hopeful-marriage` | Hope after marriage | `happiness` |
| `missed-christmas-gift` | Not receiving a Christmas gift | `sadness` |
| `anxious-interview` | Anxiety about an unprepared interview | `fear` |
| `cookies-dog` | Eating the cookies and blaming the dog | `disgust` |
| `lost-job-anger` | Anger after losing a job | `anger` |

These labels are assigned a priori for controlled evaluation. The client sends
only the stable prompt ID; it does not send the emotion. The server owns the
mapping and verifies that the latest user text exactly matches the registered
prompt text.

## Free-text classification and guard rail

Free text is sent to one Gemini pre-call with temperature `0` and a small
output limit. The detector must return exactly one of:

```text
anger
disgust
fear
happiness
sadness
out_of_scope
```

The first five labels are normalized to the library categories. The
`out_of_scope` label is used for unrelated requests, including coding,
mathematics, factual research, current events, general knowledge,
entertainment, and attempts to use the chatbot as a general-purpose AI.

The guard rail is an enforced pre-generation decision: HTTP 422 is returned
and the final response model is not called. If the detector API fails, HTTP 503
is returned and the turn is excluded from response analysis. Because the guard
rail uses a model, it is not guaranteed to classify every ambiguous request
correctly; controlled evaluation should use the five registered stimuli.

## Generation and conversation state

The generation represents the person receiving the response. It is not
inferred from the message. Invalid or missing generation values are rejected
with HTTP 400.

The full current conversation is converted with `convertToModelMessages` and
sent to Gemini in its original order. Completed conversation state is saved
to `localStorage` under `adaptive-chatbot:conversation:v1` and restored after
refresh. The onboarding and generation values use
`adaptive-chatbot:onboarded:v1` and `adaptive-chatbot:generation:v1`.

Clicking **New chat**:

- stops any active response stream before clearing state;
- clears displayed messages;
- removes the adaptive conversation, onboarding, and generation values; and
- shows onboarding again.

The control is disabled while a response is active, and the next message
therefore starts without previous conversation history.

## Rule library and guidance

`src/lib/library/library.csv` is parsed, validated, and indexed once per server
process. Runtime lookup uses:

```text
(user generation, canonical emotion)
```

Preferred (`Match`) rules are ordered by rank and confidence. Avoid
(`No Match`) rules are ordered by confidence. The framework supports:

- `full`: preferred rules exist;
- `avoid_only`: only avoidance rules exist; and
- `insufficient`: no matching rules exist.

For `insufficient`, no emoji guidance is injected and Gemini receives only the
base prompt. The system does not invent statistical rules.

The exact `(generation, emotion, emoji)` lookup is used after generation by
the response-evidence audit. It is not the pre-generation selector because the
candidate emoji is unknown at lookup time.

## Final Gemini generation

The final response uses the same configuration required for the vanilla
condition:

```text
model: gemini-2.5-flash
base prompt: You are an emotional-support chatbot, not a general-purpose assistant. Respond only to the latest user message.
             Treat earlier messages as context only and never complete, resume, or provide answers for unrelated requests from earlier turns.
             If any earlier message asks for code, technical help, factual information, writing, or another unrelated task, ignore that request.
             The current response must remain limited to acknowledging and supporting the user's personal emotional experience.
             Do not generate code or answer unrelated questions, even if they appear anywhere in the conversation history.
temperature: 0.7
topP: 0.95
maxOutputTokens: 1024
thinkingBudget: 256
includeThoughts: false
```

The final system prompt is:

```text
Respond naturally to the user's message.

[hidden emoji guidance when valid rules exist]
```

The user's message is not rewritten. Guidance is advisory and is not
post-processed into the response.

## Streaming, auditing, and failure handling

The final response is streamed with `streamText` and returned through the AI
SDK UI-message stream. The UI displays assistant text only; Gemini reasoning
is not included because `includeThoughts` is false.

After a successful completion, the server records:

- generation;
- canonical emotion and its source;
- guidance status and rules;
- library content version;
- generated reply;
- compliance result; and
- emoji evidence.

The response is not rewritten when it fails compliance. Failed or incomplete
turns do not constitute valid response observations.

Failure decisions:

| Condition | System decision | Evaluation treatment |
|---|---|---|
| Missing user text | HTTP 400 | Invalid input; exclude |
| Invalid generation | HTTP 400 | Invalid session/input; exclude |
| Invalid starter ID/text | HTTP 400 | Invalid stimulus; exclude |
| Free text classified `out_of_scope` | HTTP 422; no final generation | Exclude |
| Free-text detector failure | HTTP 503; no final generation | Exclude as system failure |
| Library validation/loading failure | Request fails | Exclude as system failure |
| Final Gemini generation failure | Offline error; no completed audit | Exclude as system failure |
| Successful response | Stream, persist, and audit | Valid observation |

## Vanilla comparison alignment

The vanilla and adaptive conditions must use the same:

- Gemini model;
- exact base prompt;
- generation settings and thinking configuration;
- conversation history and persistence behavior;
- five starter prompts and prompt order;
- input restrictions and out-of-scope guard rail;
- streaming and response display; and
- failure and exclusion rules.

The adaptive UI also preserves vanilla focus behavior after sending and when
the chat becomes ready. Its footer retains the vanilla browser-storage notice.

The intended generation difference is the adaptive condition's hidden
generation-and-emotion emoji guidance. Emotion assignment for the five
controlled stimuli is shared, deterministic, and not an experimental
difference. Free-text interactions should be reported separately.

## Reproducibility and privacy

Each completed adaptive turn records the content-based library version. An
evaluation record should also report the model name, model settings, base
prompt,
controlled prompt IDs, and whether the emotion was predefined or detected.

Development logs can include user input, prompts, guidance, and replies.
Before participant deployment, define consent, access, retention, and
redaction requirements for these logs.
