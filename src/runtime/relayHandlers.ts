import { createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  answerAssistantQuestion,
  answerFollowUpQuestion,
  buildDecisionMessage,
  buildDecisionReply,
  buildFollowUpAnswers,
  postCastViaNeynar,
  polishDecisionCopy,
  type DecisionRelayEnvelope
} from "../core/social.js";
import { getBool, getEnv, requireEnv } from "../config.js";
import { resolveFrontendBountyUrl } from "../core/chains.js";
import { PoidhClient } from "../core/poidh.js";
import { validateRealWorldBounty } from "./bountyValidation.js";
import {
  type AssistantRequest,
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

function getTargetChainName(): "arbitrum" | "base" | "degen" {
  const value = getEnv("TARGET_CHAIN", "arbitrum").toLowerCase();
  if (value === "arbitrum" || value === "base" || value === "degen") {
    return value;
  }
  throw new Error(`Unsupported TARGET_CHAIN value: ${value}`);
}

function mentionsAreEnabled(): boolean {
  return getBool("ENABLE_GENERAL_MENTION_REPLIES", false);
}

function getBotHandle(): string {
  return getEnv("BOT_FARCASTER_HANDLE", "poidh-sentinel").replace(/^@/, "").toLowerCase();
}

function getBotFid(): number | undefined {
  const value = getEnv("BOT_FID", "");
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getBotWalletAddress(): `0x${string}` | undefined {
  const privateKey = getEnv("BOT_PRIVATE_KEY", "");
  if (!privateKey) {
    return undefined;
  }
  try {
    const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    return privateKeyToAccount(normalized as `0x${string}`).address;
  } catch {
    return undefined;
  }
}

function isBotMention(text: string): boolean {
  const handle = getBotHandle();
  return new RegExp(`(^|\\s)@${handle}(\\b|\\s|$)`, "i").test(text);
}

function isExplicitBotMention(event: NeynarWebhookEvent): boolean {
  const text = event.data?.text ?? "";
  const botHandle = getBotHandle();
  if (isBotMention(text)) {
    return true;
  }

  const mentionedProfiles = event.data?.mentioned_profiles ?? [];
  return mentionedProfiles.some((profile) => {
    if (profile.username && profile.username.toLowerCase() === botHandle) {
      return true;
    }
    const botFid = getBotFid();
    if (botFid && profile.fid && profile.fid === botFid) {
      return true;
    }
    return false;
  });
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

function resolveReasonFromProductionArtifact(
  artifact: Awaited<ReturnType<typeof loadProductionArtifact>>
): string | undefined {
  if (!artifact?.evaluations || artifact.evaluations.length === 0) {
    return undefined;
  }

  const winnerId = artifact.winnerClaimId?.toString();
  const winnerEvaluation =
    (winnerId
      ? artifact.evaluations.find((item) => item.claimId?.toString() === winnerId)
      : undefined) ?? artifact.evaluations[0];

  const reasons = winnerEvaluation?.reasons ?? [];
  if (reasons.length === 0) {
    return undefined;
  }

  return reasons.join(" ");
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
    const bountyId = body.decision.bountyId.toString();
    const existingState = await loadRelayState(bountyId);
    if (existingState?.publishedToFarcaster) {
      jsonResponse(response, 200, {
        ok: true,
        ignored: true,
        reason: `Decision thread already posted for bounty ${bountyId}.`
      });
      return;
    }

    const { reply, detailReplies } = await buildCastTexts(body);
    const detailRepliesToPost = detailReplies.slice(0, 1);
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
      for (const detailReply of detailRepliesToPost) {
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
        const postedDetailReplies = detailRepliesToPost.slice(0, detailCastHashes.length);
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

    if (!question) {
      jsonResponse(response, 400, {
        ok: false,
        error: "follow-up payload requires question."
      });
      return;
    }

    if (!bountyId) {
      const parentCastHash = body.replyToCastHash?.trim() || body.parentCastHash?.trim();
      const answer = answerAssistantQuestion(question, {
        botWalletAddress: getBotWalletAddress(),
        mentionsEnabled: mentionsAreEnabled(),
        freeTierMode: !mentionsAreEnabled()
      });
      let farcasterCastHash: string | undefined;
      let farcasterError: string | undefined;

      try {
        farcasterCastHash = await postCastViaNeynar(
          {
            text: answer,
            embeds: []
          },
          { parentCastHash }
        );
      } catch (error) {
        farcasterError = error instanceof Error ? error.message : "Unknown Farcaster reply error";
        console.error(farcasterError);
      }

      jsonResponse(response, 200, {
        ok: true,
        mode: "assistant-general",
        question,
        answer,
        postedToFarcaster: Boolean(farcasterCastHash),
        farcasterCastHash,
        farcasterError
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
    const reason =
      resolveReasonFromProductionArtifact(productionArtifact) ?? state.envelope.decision.reason;
    const answer = answerFollowUpQuestion(question, {
      reason,
      finalActionTxHash: productionArtifact?.finalActionTxHash,
      botWalletAddress: getBotWalletAddress(),
      mentionsEnabled: mentionsAreEnabled(),
      freeTierMode: !mentionsAreEnabled()
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
      farcasterError: farcasterError ?? undefined,
      envelope: {
        ...current.envelope,
        decision: {
          ...current.envelope.decision,
          reason
        },
        followUpAnswers: buildFollowUpAnswers(reason)
      },
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

export async function handleAssistant(request: IncomingMessage, response: ServerResponse) {
  try {
    const { json } = await readRequestBody(request);
    if (!json || typeof json !== "object") {
      jsonResponse(response, 400, { ok: false, error: "Invalid assistant payload." });
      return;
    }

    const body = json as AssistantRequest;
    const question = body.question?.trim() || body.text?.trim() || body.message?.trim();
    const createOpenBounty = Boolean(body.createOpenBounty);
    const parentCastHash = body.replyToCastHash?.trim() || body.parentCastHash?.trim();
    const botWalletAddress = getBotWalletAddress();

    if (!question && !createOpenBounty) {
      jsonResponse(response, 400, {
        ok: false,
        error: "assistant payload requires question or createOpenBounty=true."
      });
      return;
    }

    const chainName = getTargetChainName();
    const fallbackRewardEth = getEnv("BOUNTY_REWARD_ETH", "0.001");
    let answer =
      question && question.length > 0
        ? answerAssistantQuestion(question, {
            botWalletAddress,
            mentionsEnabled: mentionsAreEnabled(),
            freeTierMode: !mentionsAreEnabled(),
            minBountyEth: fallbackRewardEth
          })
        : "ready to create an open bounty.";

    let createdBounty:
      | {
          bountyId: string;
          bountyUrl: string;
          txHash: string;
          bountyTitle: string;
          bountyDescription: string;
          bountyRewardEth: string;
        }
      | undefined;

    if (createOpenBounty) {
      const enabled = getBool("ASSISTANT_ENABLE_CREATE_OPEN_BOUNTY", false);
      if (!enabled) {
        jsonResponse(response, 403, {
          ok: false,
          error:
            "Assistant creation is disabled. Set ASSISTANT_ENABLE_CREATE_OPEN_BOUNTY=true to allow on-chain open bounty creation."
        });
        return;
      }

      const bountyTitle = body.bountyTitle?.trim() || getEnv("BOUNTY_TITLE", "");
      const bountyDescription = body.bountyDescription?.trim() || getEnv("BOUNTY_PROMPT", "");
      const bountyRewardEth = body.bountyRewardEth?.trim() || fallbackRewardEth;

      if (!bountyTitle || !bountyDescription) {
        jsonResponse(response, 400, {
          ok: false,
          error: "createOpenBounty requires bountyTitle and bountyDescription (or defaults in .env)."
        });
        return;
      }

      const validationErrors = validateRealWorldBounty(bountyTitle, bountyDescription);
      if (validationErrors.length > 0) {
        jsonResponse(response, 400, {
          ok: false,
          error: `Real-world bounty validation failed: ${validationErrors.join(" ")}`
        });
        return;
      }

      const client = new PoidhClient(chainName, requireEnv("CHAIN_RPC_URL"), requireEnv("BOT_PRIVATE_KEY"));
      const createResult = await client.createBounty(
        "open",
        bountyTitle,
        bountyDescription,
        parseEther(bountyRewardEth)
      );
      createdBounty = {
        bountyId: createResult.bountyId.toString(),
        bountyUrl: resolveFrontendBountyUrl(chainName, createResult.bountyId),
        txHash: createResult.hash,
        bountyTitle,
        bountyDescription,
        bountyRewardEth
      };
      answer = `${answer} created open bounty ${createdBounty.bountyId}: ${createdBounty.bountyUrl}`;
    }

    let farcasterCastHash: string | undefined;
    let farcasterError: string | undefined;

    try {
      farcasterCastHash = await postCastViaNeynar(
        {
          text: answer,
          embeds: createdBounty?.bountyUrl ? [{ url: createdBounty.bountyUrl }] : []
        },
        { parentCastHash }
      );
    } catch (error) {
      farcasterError = error instanceof Error ? error.message : "Unknown Farcaster assistant reply error";
      console.error(farcasterError);
    }

    jsonResponse(response, 200, {
      ok: true,
      chainName,
      question,
      answer,
      botWalletAddress,
      createdBounty,
      postedToFarcaster: Boolean(farcasterCastHash),
      farcasterCastHash,
      farcasterError
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown assistant error";
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
      if (!mentionsAreEnabled() || !isExplicitBotMention(event)) {
        jsonResponse(response, 200, {
          ok: true,
          ignored: true,
          reason: "No matching bounty thread or explicit bot mention."
        });
        return;
      }

      if (getBotFid() && event.data.author?.fid && event.data.author.fid === getBotFid()) {
        jsonResponse(response, 200, {
          ok: true,
          ignored: true,
          reason: "Ignoring self-authored mention."
        });
        return;
      }

      const answer = answerAssistantQuestion(event.data.text, {
        botWalletAddress: getBotWalletAddress(),
        mentionsEnabled: true,
        freeTierMode: false,
        minBountyEth: getEnv("BOUNTY_REWARD_ETH", "0.001")
      });
      const replyParentHash = event.data.hash?.trim();
      if (!replyParentHash) {
        jsonResponse(response, 200, { ok: true, ignored: true, reason: "Missing parent hash for mention reply." });
        return;
      }

      let farcasterCastHash: string | undefined;
      let farcasterError: string | undefined;
      try {
        farcasterCastHash = await postCastViaNeynar(
          {
            text: answer,
            embeds: []
          },
          { parentCastHash: replyParentHash }
        );
      } catch (error) {
        farcasterError = error instanceof Error ? error.message : "Unknown Farcaster mention reply error";
        console.error(farcasterError);
      }

      jsonResponse(response, 200, {
        ok: true,
        mode: "assistant-general",
        question: event.data.text,
        answer,
        postedToFarcaster: Boolean(farcasterCastHash),
        farcasterCastHash,
        farcasterError
      });
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
    const reason =
      resolveReasonFromProductionArtifact(productionArtifact) ?? relayState.envelope.decision.reason;
    const answer = answerFollowUpQuestion(event.data.text, {
      reason,
      finalActionTxHash: productionArtifact?.finalActionTxHash,
      botWalletAddress: getBotWalletAddress(),
      mentionsEnabled: mentionsAreEnabled(),
      freeTierMode: !mentionsAreEnabled()
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
      farcasterError: farcasterError ?? undefined,
      envelope: {
        ...current.envelope,
        decision: {
          ...current.envelope.decision,
          reason
        },
        followUpAnswers: buildFollowUpAnswers(reason)
      },
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
    note: "The latest decision payload is written by the relay after each Farcaster post attempt. Follow-up replies can be posted through /follow-up. General assistant chat is available through /assistant."
  });
}
