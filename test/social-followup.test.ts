import assert from "node:assert/strict";
import test from "node:test";
import { answerFollowUpQuestion, summarizeReasonForSocial } from "../src/core/social.js";

test("summarizeReasonForSocial removes low-signal AI scaffolding", () => {
  const reason =
    "Description/evidence overlap matched handwritten, note, poidh. " +
    "AI verdict (model): accept (0.75 confidence). " +
    "AI: Okay, let's tackle this. " +
    "AI: The user wants me to evaluate the bounty submission. " +
    "AI: First, the prompt says the note should have today's full date.";

  const summary = summarizeReasonForSocial(reason, 280);
  assert.match(summary, /Description\/evidence overlap matched handwritten/i);
  assert.doesNotMatch(summary, /let'?s tackle|the user wants me|first, the prompt says/i);
});

test("answerFollowUpQuestion returns concise finalized confirmation", () => {
  const answer = answerFollowUpQuestion("can you confirm this is finalized and accepted?", {
    reason: "Claim is already accepted on-chain.",
    finalActionTxHash: "0xabc123"
  });

  assert.match(answer, /finalized on-chain/i);
  assert.match(answer, /0xabc123/i);
});

