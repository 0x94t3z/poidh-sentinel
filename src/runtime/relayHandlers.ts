import { createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  answerFollowUpQuestion,
  buildDecisionMessage,
  buildDecisionReply,
  postCastViaNeynar,
  polishDecisionCopy,
  type DecisionRelayEnvelope
} from "../core/social.js";
import {
  findRelayStateByCastHash,
  loadProductionArtifact,
  loadRelayState,
  recordRelayStateUpdate,
  relayOutputDir,
  relayStateCastHashes,
  writeRelayArtifacts,
  type FollowUpRequest,
  type NeynarWebhookEvent,
  type RelayState,
  truncateText
} from "./relayState.js";

function jsonResponse(
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>
) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function isRelayEnvelope(value: unknown): value is DecisionRelayEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DecisionRelayEnvelope>;
  return (
    Array.isArray(candidate.targets) &&
    typeof candidate.message === "string" &&
    typeof candidate.castDraft?.text === "string" &&
    Array.isArray(candidate.castDraft?.embeds) &&
    Array.isArray(candidate.followUpAnswers)
  );
}

function verifyNeynarWebhookSignature(rawBody: string, signature?: string | null): boolean {
  const secret = process.env.WEBHOOK_SIGNATURE_SECRET?.trim();
  if (!secret) {
    return true;
  }
  if (!signature) {
    return false;
  }

  const hmac = createHmac("sha512", secret);
  hmac.update(rawBody);
  return hmac.digest("hex") === signature;
}

async function readRequestBody(request: IncomingMessage): Promise<{ raw: string; json?: unknown }> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return { raw };
  }
  return { raw, json: JSON.parse(raw) as unknown };
}

function splitForThread(text: string, maxLength = 260): string[] {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return [];
  }
  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf(" ", maxLength);
    if (splitAt < maxLength / 2) {
      splitAt = maxLength;
    }
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  return chunks;
}

function previewLogText(text: string, maxLength = 140): string {
  return truncateText(text.trim().replace(/\s+/g, " "), maxLength);
}

function buildDetailReplies(envelope: DecisionRelayEnvelope): string[] {
  const reasonChunks = splitForThread(envelope.decision.reason, 230);
  const reasonReplies = reasonChunks.map((chunk, index) =>
    truncateText(index === 0 ? `Why this claim won:\n${chunk}` : `More detail:\n${chunk}`, 280)
  );

  const checks = envelope.followUpAnswers.find((item) =>
    item.question.toLowerCase().includes("evidence")
  )?.answer;
  const autonomy = envelope.followUpAnswers.find((item) =>
    item.question.toLowerCase().includes("automatically")
  )?.answer;
  const summary = truncateText(["Validation:", checks, autonomy].filter(Boolean).join("\n"), 280);

  return [...reasonReplies, summary].filter((entry) => entry.trim().length > 0);
}

async function buildCastTexts(
  envelope: DecisionRelayEnvelope
): Promise<{ main: string; reply: string; detailReplies: string[] }> {
  const deterministic = {
    main: truncateText(buildDecisionMessage(envelope.decision, envelope.castDraft.author), 280),
    reply: truncateText(
      buildDecisionReply(
        envelope.decision,
        envelope.decision.reason,
        envelope.castDraft.author,
        envelope.followUpAnswers
      ),
      280
    ),
    detailReplies: buildDetailReplies(envelope)
  };

  const polished = await polishDecisionCopy(
    envelope.decision,
    envelope.followUpAnswers,
    envelope.castDraft.author
  );

  if (!polished) {
    return deterministic;
  }

  return {
    main: truncateText(polished.main, 280),
    reply: truncateText(polished.reply, 280),
    detailReplies: deterministic.detailReplies
  };
}

export async function handleDecision(request: IncomingMessage, response: ServerResponse) {
  try {
    const { json } = await readRequestBody(request);
    if (!isRelayEnvelope(json)) {
      jsonResponse(response, 400, { ok: false, error: "Invalid decision payload." });
      return;
    }

    const body = json;
    const { reply, detailReplies } = await buildCastTexts(body);
    let mainCastHash: string | undefined;
    let replyCastHash: string | undefined;
    const detailCastHashes: string[] = [];
    let farcasterError: string | undefined;

    try {
      mainCastHash = await postCastViaNeynar(body.castDraft);
      replyCastHash = mainCastHash
        ? await postCastViaNeynar(
            {
              text: reply,
              embeds: []
            },
            { parentCastHash: mainCastHash }
          )
        : undefined;

      const detailParentCastHash = replyCastHash ?? mainCastHash;
      for (const detailReply of detailReplies) {
        if (!detailParentCastHash) {
          break;
        }
        const detailCastHash = await postCastViaNeynar(
          {
            text: detailReply,
            embeds: []
          },
          { parentCastHash: detailParentCastHash }
        );
        if (!detailCastHash) {
          break;
        }
        detailCastHashes.push(detailCastHash);
      }
    } catch (error) {
      farcasterError = error instanceof Error ? error.message : "Unknown Farcaster posting error";
      console.error(farcasterError);
    }

    const state: RelayState = {
      generatedAt: new Date().toISOString(),
      sourceIp: request.socket.remoteAddress ?? undefined,
      envelope: body,
      publishedToFarcaster: Boolean(mainCastHash),
      farcasterCastIds: [mainCastHash, replyCastHash, ...detailCastHashes].filter(Boolean) as string[],
      farcasterError,
      followUpReplies: []
    };

    await writeRelayArtifacts(state);
    if (mainCastHash) {
      console.log(
        `[relay] posted decision for bounty ${body.decision.bountyId.toString()}: ${previewLogText(body.castDraft.text)}`
      );
      if (replyCastHash) {
        console.log(`[relay] main reply: ${previewLogText(reply)}`);
      }
      if (detailCastHashes.length > 0) {
        const postedDetailReplies = detailReplies.slice(0, detailCastHashes.length);
        console.log(`[relay] posted ${detailCastHashes.length} detail replies:`);
        for (const [index, detailReply] of postedDetailReplies.entries()) {
          console.log(`  ${index + 1}. ${previewLogText(detailReply)}`);
        }
      }
    } else {
      console.log(
        `[relay] saved decision draft for bounty ${body.decision.bountyId.toString()}: ${previewLogText(body.castDraft.text)}`
      );
    }
    jsonResponse(response, 200, {
      ok: true,
      publishedToFarcaster: Boolean(mainCastHash),
      farcasterCastIds: state.farcasterCastIds,
      targetCount: body.targets.length,
      detailReplyCount: detailCastHashes.length,
      farcasterError
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown relay error";
    jsonResponse(response, 500, { ok: false, error: message });
  }
}

export async function handleFollowUp(request: IncomingMessage, response: ServerResponse) {
  try {
    const { json } = await readRequestBody(request);
    if (!json || typeof json !== "object") {
      jsonResponse(response, 400, { ok: false, error: "Invalid follow-up payload." });
      return;
    }

    const body = json as FollowUpRequest;
    const bountyId = body.bountyId?.toString().trim();
    const question = body.question?.trim() || body.text?.trim() || body.message?.trim();

    if (!bountyId || !question) {
      jsonResponse(response, 400, {
        ok: false,
        error: "follow-up payload requires bountyId and question."
      });
      return;
    }

    const state = await loadRelayState(bountyId);
    if (!state) {
      jsonResponse(response, 404, {
        ok: false,
        error: `No decision thread stored for bounty ${bountyId}.`
      });
      return;
    }

    const productionArtifact = await loadProductionArtifact(bountyId);
    const answer = answerFollowUpQuestion(question, {
      reason: state.envelope.decision.reason,
      finalActionTxHash: productionArtifact?.finalActionTxHash
    });
    const parentCastHash = body.replyToCastHash?.trim() || body.parentCastHash?.trim() || state.farcasterCastIds[0];

    let farcasterCastHash: string | undefined;
    let farcasterError: string | undefined;

    try {
      farcasterCastHash = await postCastViaNeynar(
        {
          text: answer,
          embeds: [],
          author: state.envelope.castDraft.author,
          parentUrl: state.envelope.castDraft.parentUrl
        },
        { parentCastHash }
      );
    } catch (error) {
      farcasterError = error instanceof Error ? error.message : "Unknown Farcaster reply error";
      console.error(farcasterError);
    }

    const generatedAt = new Date().toISOString();
    const nextState = await recordRelayStateUpdate(bountyId, (current) => ({
      ...current,
      farcasterError: farcasterError ?? current.farcasterError,
      followUpReplies: [
        ...current.followUpReplies,
        {
          generatedAt,
          question,
          answer,
          postedToFarcaster: Boolean(farcasterCastHash),
          farcasterCastHash,
          parentCastHash,
          source: body.source?.trim()
        }
      ]
    }));

    if (farcasterCastHash) {
      console.log(
        `[relay] posted follow-up for bounty ${bountyId}: Q="${previewLogText(question, 100)}" A="${previewLogText(answer, 120)}"`
      );
    } else {
      console.log(
        `[relay] stored follow-up for bounty ${bountyId} (not posted to Farcaster): Q="${previewLogText(question, 100)}"`
      );
    }

    jsonResponse(response, 200, {
      ok: true,
      bountyId,
      question,
      answer,
      postedToFarcaster: Boolean(farcasterCastHash),
      farcasterCastHash,
      farcasterError,
      followUpReplies: nextState.followUpReplies.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown follow-up error";
    jsonResponse(response, 500, { ok: false, error: message });
  }
}

export async function handleNeynarWebhook(request: IncomingMessage, response: ServerResponse) {
  try {
    const signature = request.headers["x-neynar-signature"];
    const { raw, json } = await readRequestBody(request);

    if (!verifyNeynarWebhookSignature(raw, Array.isArray(signature) ? signature[0] : signature)) {
      jsonResponse(response, 401, { ok: false, error: "Invalid Neynar webhook signature." });
      return;
    }

    if (!json || typeof json !== "object") {
      jsonResponse(response, 400, { ok: false, error: "Invalid Neynar webhook payload." });
      return;
    }

    const event = json as NeynarWebhookEvent;
    if (event.type !== "cast.created" || !event.data?.text) {
      jsonResponse(response, 200, { ok: true, ignored: true });
      return;
    }

    const threadCastHash = event.data.thread_hash?.trim() || undefined;
    const parentCastHash = event.data.parent_hash?.trim() || undefined;
    const candidateThreadHashes = [...new Set([threadCastHash, parentCastHash].filter(Boolean))];
    if (candidateThreadHashes.length === 0) {
      jsonResponse(response, 200, { ok: true, ignored: true });
      return;
    }

    let relayState: RelayState | undefined;
    let matchedThreadHash: string | undefined;
    for (const candidate of candidateThreadHashes) {
      if (!candidate) {
        continue;
      }
      relayState = await findRelayStateByCastHash(candidate);
      if (relayState) {
        matchedThreadHash = candidate;
        break;
      }
    }

    if (!relayState) {
      jsonResponse(response, 200, { ok: true, ignored: true, reason: "No matching bounty thread." });
      return;
    }

    console.log(
      `[relay] matched webhook reply to bounty ${relayState.envelope.decision.bountyId.toString()}: ${previewLogText(event.data.text, 120)}`
    );

    if (event.data.hash && relayStateCastHashes(relayState).includes(event.data.hash)) {
      jsonResponse(response, 200, {
        ok: true,
        ignored: true,
        reason: "Webhook cast was already posted by this relay."
      });
      return;
    }

    const productionArtifact = await loadProductionArtifact(relayState.envelope.decision.bountyId.toString());
    const answer = answerFollowUpQuestion(event.data.text, {
      reason: relayState.envelope.decision.reason,
      finalActionTxHash: productionArtifact?.finalActionTxHash
    });

    const replyParentHash =
      event.data.hash?.trim() || matchedThreadHash || threadCastHash || parentCastHash;

    let farcasterCastHash: string | undefined;
    let farcasterError: string | undefined;

    try {
      farcasterCastHash = await postCastViaNeynar(
        {
          text: answer,
          embeds: [],
          author: relayState.envelope.castDraft.author,
          parentUrl: relayState.envelope.castDraft.parentUrl
        },
        { parentCastHash: replyParentHash }
      );
    } catch (error) {
      farcasterError = error instanceof Error ? error.message : "Unknown Farcaster reply error";
      console.error(farcasterError);
    }

    const bountyId = relayState.envelope.decision.bountyId.toString();
    const generatedAt = new Date().toISOString();
    const nextState = await recordRelayStateUpdate(bountyId, (current) => ({
      ...current,
      farcasterError: farcasterError ?? current.farcasterError,
      followUpReplies: [
        ...current.followUpReplies,
        {
          generatedAt,
          question: event.data?.text ?? "",
          answer,
          postedToFarcaster: Boolean(farcasterCastHash),
          farcasterCastHash,
          parentCastHash: replyParentHash,
          source: `neynar-webhook:${event.data?.author?.fid ?? "unknown"}`
        }
      ]
    }));

    jsonResponse(response, 200, {
      ok: true,
      bountyId,
      question: event.data.text,
      answer,
      postedToFarcaster: Boolean(farcasterCastHash),
      farcasterCastHash,
      farcasterError,
      followUpReplies: nextState.followUpReplies.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Neynar webhook error";
    jsonResponse(response, 500, { ok: false, error: message });
  }
}

export async function handleExplain(response: ServerResponse) {
  jsonResponse(response, 200, {
    ok: true,
    outputDir: relayOutputDir(),
    note: "The latest decision payload is written by the relay after each Farcaster post attempt. Follow-up replies can be posted through /follow-up."
  });
}
