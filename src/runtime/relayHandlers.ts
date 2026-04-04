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
  const secret = process.env.NEYNAR_WEBHOOK_SECRET?.trim();
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

async function buildCastTexts(envelope: DecisionRelayEnvelope): Promise<{ main: string; reply: string }> {
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
    )
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
    reply: truncateText(polished.reply, 280)
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
    const { reply } = await buildCastTexts(body);
    let mainCastHash: string | undefined;
    let replyCastHash: string | undefined;
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
    } catch (error) {
      farcasterError = error instanceof Error ? error.message : "Unknown Farcaster posting error";
      console.error(farcasterError);
    }

    const state: RelayState = {
      generatedAt: new Date().toISOString(),
      sourceIp: request.socket.remoteAddress ?? undefined,
      envelope: body,
      publishedToFarcaster: Boolean(mainCastHash),
      farcasterCastIds: [mainCastHash, replyCastHash].filter(Boolean) as string[],
      farcasterError,
      followUpReplies: []
    };

    await writeRelayArtifacts(state);
    if (mainCastHash) {
      console.log(
        `[relay] posted decision for bounty ${body.decision.bountyId.toString()} as ${mainCastHash}${
          replyCastHash ? ` with reply ${replyCastHash}` : ""
        }`
      );
    } else {
      console.log(`[relay] saved decision draft for bounty ${body.decision.bountyId.toString()}`);
    }
    jsonResponse(response, 200, {
      ok: true,
      publishedToFarcaster: Boolean(mainCastHash),
      farcasterCastIds: state.farcasterCastIds,
      targetCount: body.targets.length,
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
        `[relay] posted follow-up reply for bounty ${bountyId} under ${parentCastHash} as ${farcasterCastHash}`
      );
    } else {
      console.log(`[relay] stored follow-up reply for bounty ${bountyId} (not posted to Farcaster)`);
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

    const parentCastHash = event.data.parent_hash ?? event.data.thread_hash ?? undefined;
    if (!parentCastHash) {
      jsonResponse(response, 200, { ok: true, ignored: true });
      return;
    }

    const relayState = await findRelayStateByCastHash(parentCastHash);
    if (!relayState) {
      jsonResponse(response, 200, { ok: true, ignored: true, reason: "No matching bounty thread." });
      return;
    }

    const productionArtifact = await loadProductionArtifact(relayState.envelope.decision.bountyId.toString());
    const answer = answerFollowUpQuestion(event.data.text, {
      reason: relayState.envelope.decision.reason,
      finalActionTxHash: productionArtifact?.finalActionTxHash
    });

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
        { parentCastHash }
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
          parentCastHash,
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
