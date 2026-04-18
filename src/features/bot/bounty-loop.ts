import "server-only";
import { getClaimsForBounty, resolveBountyWinner, getBountyDetails, getPublicClient, getWalletClient, POIDH_CONTRACTS, POIDH_CONTRACT, POIDH_ABI, resolvePoidhUrl, retryCancelledBountyRefundFromPending, getTxExplorerUrl } from "@/features/bot/poidh-contract";
import { pickWinner, compareEvaluationResults, type ClaimData, type EvaluationResult } from "@/features/bot/submission-evaluator";
import { updateBounty, getAllBounties } from "@/features/bot/bounty-store";
import { publishReply, publishCast } from "@/features/bot/cast-reply";
import { appendLog, hasSuccessfulLog } from "@/features/bot/bot-log";
import {
  registerBountyThread,
  getAnnouncementThreadCastHashForBounty,
  getWinnerAnnouncementThreadCastHashForBounty,
} from "@/db/actions/bot-actions";
import { keccak256, toBytes, parseEther } from "viem";

const BOT_SIGNER_UUID = process.env.BOT_SIGNER_UUID ?? "";

// Minimum time a bounty must be open before evaluation (72h default, env-overridable)
import {
  MIN_OPEN_DURATION_HOURS,
  NO_SUBMISSION_NUDGE_HOURS,
  NO_SUBMISSION_NUDGE_INTERVAL_HOURS,
} from "@/features/bot/constants";
export { MIN_OPEN_DURATION_HOURS };
const MIN_OPEN_DURATION_MS = MIN_OPEN_DURATION_HOURS * 60 * 60 * 1000;
const MIN_CLAIMS_TO_EVALUATE = 1;

// After "none met criteria", wait this long before re-evaluating (prevents spam)
const EVAL_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

// If a bounty has been open this long with zero submissions, post a nudge reminder (default: 168h = 7 days)
const NO_SUBMISSION_NUDGE_MS = NO_SUBMISSION_NUDGE_HOURS * 60 * 60 * 1000;
// Nudge at most once every 48h by default
const NO_SUBMISSION_NUDGE_INTERVAL_MS = NO_SUBMISSION_NUDGE_INTERVAL_HOURS * 60 * 60 * 1000;
const REFUND_RETRY_INTERVAL_MS = parseInt(process.env.REFUND_RETRY_INTERVAL_SECONDS ?? "60", 10) * 1000; // default 60s

// ---------------------------------------------------------------------------
// Neynar: resolve ETH addresses → Farcaster @usernames
// Uses bulk-by-address endpoint — accepts up to 350 addresses at once.
// Returns a map of lowercase address → "@username" (or shortened address fallback).
// ---------------------------------------------------------------------------
export async function resolveAddressesToUsernames(addresses: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (addresses.length === 0) return result;

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    addresses.forEach((a) => result.set(a.toLowerCase(), shortenAddress(a)));
    return result;
  }

  try {
    const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${unique.join(",")}&address_types=custody_address,verified_address`;
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      // Response: { [address]: User[] }
      const data = (await res.json()) as Record<string, Array<{ username?: string; fid?: number }>>;
      for (const [addr, users] of Object.entries(data)) {
        const username = users?.[0]?.username;
        const fid = users?.[0]?.fid;
        console.log(`[bounty-loop] resolved ${addr.slice(0,10)} → ${username ?? "no username"} (fid=${fid})`);
        result.set(addr.toLowerCase(), username ? `@${username}` : shortenAddress(addr));
      }
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(`[bounty-loop] resolveAddressesToUsernames HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }
  } catch (err) {
    console.warn("[bounty-loop] resolveAddressesToUsernames failed:", err);
  }

  // Fallback for any address not resolved
  addresses.forEach((a) => {
    if (!result.has(a.toLowerCase())) result.set(a.toLowerCase(), shortenAddress(a));
  });

  return result;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function buildFundedByLine(mentions: string[], maxChars = 220): string {
  if (mentions.length === 0) return "";

  const prefix = " thank you for your contribution ";
  const suffix = ".";
  const compactOnly = `${prefix}${mentions.length} contributors${suffix}`;

  let included = [...mentions];
  while (included.length > 0) {
    const omitted = mentions.length - included.length;
    const more = omitted > 0 ? ` +${omitted} more` : "";
    const candidate = `${prefix}${included.join(", ")}${more}${suffix}`;
    if (candidate.length <= maxChars) return candidate;
    included.pop();
  }

  return compactOnly;
}

function buildVoteNoRequestLine(mentions: string[], fallback = "contributors"): string {
  if (mentions.length === 0) return fallback;

  const joined = mentions.join(", ");
  const base = `${joined}, please vote no on the current nominee`;
  if (base.length <= 220) return joined;

  const compact = `${mentions[0]} +${mentions.length - 1} more`;
  return compact;
}

// Resolve a single Farcaster FID → @username using the Neynar bulk endpoint
async function resolveFidToUsername(fid: number): Promise<string | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { users?: Array<{ username?: string }> };
    const username = data.users?.[0]?.username;
    return username ? `@${username}` : null;
  } catch {
    return null;
  }
}

// Resolve creator wallet address for automatic refund retry on cancelled bounties.
// Prefers first verified ETH address, falls back to custody address.
async function resolveFidToRefundAddress(fid: number): Promise<string | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      users?: Array<{
        custody_address?: string;
        verified_addresses?: { eth_addresses?: string[] };
      }>;
    };
    const user = data.users?.[0];
    if (!user) return null;
    return user.verified_addresses?.eth_addresses?.[0] ?? user.custody_address ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Read contributor addresses from the poidh contract
// bountyContributions(bountyId) returns array of { contributor, amount }
// Falls back to the bounty issuer when no external contributions exist.
// ---------------------------------------------------------------------------
export async function getContributors(bountyId: string, chain: string, issuerFallback?: string): Promise<string[]> {
  // The contract stores participants as participants[bountyId][index] (individual slot reads).
  // Probe indices 0..N until a revert, collecting all non-zero addresses.
  try {
    const publicClient = getPublicClient(chain);
    const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;
    const participantsAbi = [{
      name: "participants",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "bountyId", type: "uint256" }, { name: "index", type: "uint256" }],
      outputs: [{ name: "", type: "address" }],
    }] as const;

    const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
    const addrs: string[] = [];
    for (let i = 0; i < 50; i++) {
      try {
        const addr = await publicClient.readContract({
          address: contractAddress,
          abi: participantsAbi,
          functionName: "participants",
          args: [BigInt(bountyId), BigInt(i)],
        }) as string;
        if (addr && addr !== ZERO_ADDR) addrs.push(addr);
        // address(0) means withdrawn slot — keep iterating (don't break)
      } catch {
        break; // out-of-bounds revert → no more participants
      }
    }
    if (addrs.length > 0) return addrs;
  } catch (err) {
    console.warn(`[bounty-loop] getContributors(${bountyId}) failed:`, err);
  }

  // Solo bounty or probe failed — fall back to issuer address
  return issuerFallback ? [issuerFallback] : [];
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

async function logBountyLoopEvent(
  bounty: {
    bountyId: string;
    name: string;
    castHash: string;
    announcementCastHash?: string;
  },
  action: string,
  status: "success" | "error",
  replyText: string,
  opts?: { errorMessage?: string; txHash?: string; triggerText?: string },
): Promise<void> {
  await appendLog({
    id: `${action}-${bounty.bountyId}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    triggerCastHash: bounty.announcementCastHash ?? bounty.castHash,
    triggerAuthor: "system",
    triggerText: opts?.triggerText ?? `bounty #${bounty.bountyId} · ${bounty.name}`,
    action,
    replyText,
    status,
    errorMessage: opts?.errorMessage,
    txHash: opts?.txHash,
  });
}

async function postVoteCorrectionIfNeeded(
  bounty: {
    bountyId: string;
    name: string;
    castHash: string;
    announcementCastHash?: string;
    creatorFid?: number;
  },
  bountyChain: string,
  activeVotingClaimId: string,
  allResults: AnnotatedResult[],
  issuerFallback?: string,
): Promise<void> {
  const rankedValidResults = [...allResults]
    .filter((r) => r.valid)
    .sort(compareEvaluationResults);
  const expectedWinner = rankedValidResults[0];
  if (!expectedWinner || expectedWinner.claimId === activeVotingClaimId) return;

  const expectedWinnerMention = expectedWinner.issuerUsername
    ? expectedWinner.issuerUsername
    : expectedWinner.issuer
      ? (await resolveAddressesToUsernames([expectedWinner.issuer])).get(expectedWinner.issuer.toLowerCase()) ?? shortenAddress(expectedWinner.issuer)
      : `claim #${expectedWinner.claimId}`;
  const creatorMention = bounty.creatorFid ? (await resolveFidToUsername(bounty.creatorFid)) : null;
  const contributorAddresses = await getContributors(bounty.bountyId, bountyChain, issuerFallback);
  const contributorMap = await resolveAddressesToUsernames(contributorAddresses);
  let botAddr = "";
  try { botAddr = (await import("@/features/bot/poidh-contract")).getBotWalletAddress().toLowerCase(); } catch { /* non-critical */ }
  const contributorMentions = contributorAddresses
    .filter((a) => a.toLowerCase() !== botAddr && a.toLowerCase() !== (expectedWinner.issuer ?? "").toLowerCase())
    .map((a) => contributorMap.get(a.toLowerCase()) ?? shortenAddress(a))
    .filter((m, i, arr) => arr.indexOf(m) === i);
  const voterMentions = [
    ...(creatorMention ? [creatorMention] : []),
    ...contributorMentions,
  ].filter((m, i, arr) => m !== expectedWinnerMention && arr.indexOf(m) === i);
  const voteTarget = buildVoteNoRequestLine(voterMentions);
  const correctionText = stripMarkdown(
    `i was wrong earlier — ${voteTarget}, please vote no on the current nominee so i can reject this vote and nominate the correct winner, ${expectedWinnerMention}.`,
  ).slice(0, 1024);

  const correctionAlreadyPosted = await hasSuccessfulLog(
    getReplyTarget(bounty),
    "vote_correction_posted",
    correctionText,
  );

  if (correctionAlreadyPosted) return;

  const bountyLink = resolvePoidhUrl(bountyChain, bounty.bountyId);
  await postReply(getReplyTarget(bounty), correctionText, bountyLink);
  await logBountyLoopEvent(
    bounty,
    "vote_correction_posted",
    "success",
    correctionText,
    {
      triggerText: `bounty #${bounty.bountyId} corrected an active wrong vote nominee`,
    },
  );
}

async function postReply(castHash: string, text: string, embedUrl?: string): Promise<void> {
  if (!BOT_SIGNER_UUID || !castHash) return;
  const trimmed = stripMarkdown(text).slice(0, 400);
  try {
    await publishReply({ text: trimmed, parentHash: castHash, signerUuid: BOT_SIGNER_UUID, embedUrl });
  } catch (err) {
    console.error("[bounty-loop] failed to post reply:", err);
  }
}

async function postChannelWinnerAnnouncement(
  bountyName: string,
  claimCount: number,
  reasoning: string,
  bountyLink: string,
  method: "vote_submitted" | "vote_resolved" | "direct",
  winnerMention: string,          // "@username" or shortened address
  creatorMention: string | null,  // bounty creator @username
  contributorMentions: string[],  // all on-chain contributors (bot wallet already filtered out)
  chain: string,                  // for currency label (ETH vs DEGEN)
  potAmount?: bigint,             // total bounty pot in wei/native units
  yesVotes?: bigint,              // vote yes weight (wei)
  noVotes?: bigint,               // vote no weight (wei)
  replyToHash?: string,           // set → reply in thread; unset → new top-level /poidh cast
  allResults?: AnnotatedResult[], // for vote_submitted: include ranked scores in the cast
): Promise<string | null> {
  if (!BOT_SIGNER_UUID) return null;
  try {
    // Tag creator + all contributors, dedupe, exclude the winner
    const allThanks = [
      ...(creatorMention ? [creatorMention] : []),
      ...contributorMentions,
    ]
      .filter((m, i, arr) => m !== winnerMention && arr.indexOf(m) === i);
    const fundedByLine = buildFundedByLine(allThanks);

    // Currency label + pot amount
    const currency = chain === "degen" ? "DEGEN" : "ETH";
    const formatAmt = (wei: bigint) => {
      if (chain === "degen") {
        // DEGEN has 18 decimals — show as integer if whole, else 2dp
        const val = Number(wei) / 1e18;
        return val % 1 === 0 ? `${val}` : val.toFixed(2).replace(/\.?0+$/, "");
      }
      return Number(wei) / 1e18 === 0 ? "0" : (Number(wei) / 1e18).toFixed(4).replace(/\.?0+$/, "");
    };
    let text = "";
    const winnerClaimId = allResults
      ? [...allResults]
          .filter((r) => r.valid)
          .sort(compareEvaluationResults)[0]?.claimId ?? ""
      : "";
    const scoresSummary = allResults ? buildRankedSummary(allResults, winnerClaimId) : "";
    const scoresLine = scoresSummary ? `\nresults: ${scoresSummary}.` : "";

    const reasonClean = reasoning.trim().replace(/[.!\s]+$/g, "");

    if (method === "vote_submitted") {
      // Merged scores + nomination — reply in thread, no URL (parent cast already has the embed)
      text = `🗳️ "${bountyName}" — ${winnerMention} nominated as winner. ${reasonClean}.${fundedByLine} contributors have 48h to vote yes/no. if rejected, the next best gets nominated.${scoresLine}`;
    } else {
      // Final winner announcement format.
      const submissionLabel = `${claimCount} submission(s)`;
      // Keep vote metadata compact while prioritizing "because ... thank you ..."
      const voteMeta = yesVotes !== undefined && noVotes !== undefined ? ` (${formatAmt(yesVotes)} ${currency} yes / ${formatAmt(noVotes)} ${currency} no)` : "";
      const potMeta = potAmount !== undefined ? ` ${formatAmt(potAmount)} ${currency}` : "";
      const voteLine = method === "vote_resolved" ? ` community vote passed${voteMeta}.` : "";
      text = `✅ "${bountyName}" — ${winnerMention} wins from ${submissionLabel} because ${reasonClean}.${fundedByLine}${potMeta ? ` pot:${potMeta}` : ""}${voteLine}${scoresLine}`;
    }

    const cleaned = stripMarkdown(text).slice(0, 1024);
    let castHash: string | null | undefined;

    if (replyToHash) {
      // Post as a reply in the original bounty thread — always embed the bounty link
      castHash = await publishReply({ text: cleaned, parentHash: replyToHash, signerUuid: BOT_SIGNER_UUID, embedUrl: bountyLink });
    } else {
      // Post as a new top-level cast in /poidh channel
      castHash = await publishCast({ text: cleaned, signerUuid: BOT_SIGNER_UUID, channelId: "poidh", embedUrl: bountyLink });
    }

    console.log(`[bounty-loop] posted announcement hash=${castHash} method=${method} replyTo=${replyToHash ?? "none"}`);
    return castHash ?? null;
  } catch (err) {
    console.error("[bounty-loop] failed to post channel winner announcement:", err);
    return null;
  }
}

// Build a short ranked summary for contributors to review before voting
// e.g. "#356 @dan_xv (95) ⭐✅ | #362 @user2 (40) ❌ missing username+poidh | ..."
type AnnotatedResult = EvaluationResult & { issuerUsername?: string };
function buildRankedSummary(allResults: AnnotatedResult[], winnerClaimId: string): string {
  const sorted = [...allResults].sort(compareEvaluationResults).slice(0, 5);
  const parts = sorted.map((r) => {
    const star = r.claimId === winnerClaimId ? "⭐" : "";
    const valid = r.valid ? "✅" : "❌";
    const who = r.issuerUsername ? `@${r.issuerUsername.replace("@", "")} ` : "";
    // Include a short rejection reason for failed claims so it's self-explanatory
    const reason = !r.valid && r.reasoning ? ` — ${r.reasoning.slice(0, 60)}` : "";
    return `#${r.claimId} ${who}(${r.score})${star ? " " + star : ""} ${valid}${reason}`;
  });
  return parts.join(" | ");
}

async function hydrateActiveVoteContext(
  bounty: {
    bountyId: string;
    name: string;
    description: string;
    allEvalResults?: EvaluationResult[];
  },
  bountyChain: string,
  createdAt: bigint,
  activeVotingClaimId: string,
): Promise<{
  recoveredResult?: AnnotatedResult;
  hydratedResults?: AnnotatedResult[];
}> {
  const existingResults = (bounty.allEvalResults as AnnotatedResult[] | undefined) ?? [];
  const existingRecovered = existingResults.find((r) => r.claimId === activeVotingClaimId);
  if (existingRecovered) {
    return {
      recoveredResult: existingRecovered,
      hydratedResults: existingResults,
    };
  }

  try {
    const claims = await getClaimsForBounty(BigInt(bounty.bountyId), bountyChain);
    if (claims.length === 0) return {};

    const claimData: ClaimData[] = claims.map((c) => ({
      id: c.id.toString(),
      issuer: c.issuer,
      name: c.name,
      description: c.description,
      uri: c.uri,
    }));

    const evaluation = await pickWinner(
      bounty.name,
      bounty.description,
      claimData,
      createdAt,
      { returnAllResultsIfNoWinner: true },
    );

    const rawResults = evaluation?.allResults ?? [];
    if (rawResults.length === 0) return {};

    const issuerAddresses = [...new Set(rawResults.map((r) => r.issuer).filter((a): a is string => !!a))];
    const usernameMap = await resolveAddressesToUsernames(issuerAddresses);
    const hydratedResults = rawResults.map((r) => ({
      ...r,
      issuerUsername: r.issuer
        ? (usernameMap.get(r.issuer.toLowerCase()) ?? shortenAddress(r.issuer))
        : undefined,
    }));

    return {
      recoveredResult: hydratedResults.find((r) => r.claimId === activeVotingClaimId),
      hydratedResults,
    };
  } catch (err) {
    console.warn(`[bounty-loop] failed to hydrate active vote context for ${bounty.bountyId}:`, err);
    return {};
  }
}

// Build a "none won" reply that includes per-claim reasoning so submitters
// know exactly why their proof was rejected. Reuses allResults from pickWinner()
// to avoid duplicate API calls.
function buildNoWinnerFeedback(
  claimData: ClaimData[],
  results: EvaluationResult[],
): string {
  // Cap at 5 feedback lines to stay under cast limit
  const lines = results.slice(0, 5).map((r) => `claim #${r.claimId} (${r.score}/100): ${r.reasoning}`);
  const header = `reviewed ${claimData.length} submission${claimData.length !== 1 ? "s" : ""}, none qualified yet:\n`;
  const footer = `\nfix the issues above and resubmit — i'll re-evaluate in 6h.`;
  return (header + lines.join("\n") + footer).slice(0, 1024);
}

function selectWinnerFromStoredResults(
  allResults?: EvaluationResult[],
): { winnerClaimId: string; reasoning: string; allResults: EvaluationResult[] } | null {
  if (!allResults?.length) return null;
  const validResults = allResults
    .filter((r) => r.valid && r.score >= 60)
    .sort(compareEvaluationResults);
  if (validResults.length === 0) return null;
  const winner = validResults[0];
  return {
    winnerClaimId: winner.claimId,
    reasoning: winner.reasoning,
    allResults,
  };
}

function hasSameClaimSet(
  claims: ClaimData[],
  allResults?: EvaluationResult[],
): boolean {
  if (!allResults?.length || claims.length !== allResults.length) return false;
  const claimIds = new Set(claims.map((claim) => claim.id));
  return allResults.every((result) => claimIds.has(result.claimId));
}

// Resolve a pending- bounty ID from the stored txHash receipt logs
// Prefer strict BountyCreated event signature matching; fall back to first matching log topic
// for backwards compatibility with edge-case receipts.
async function resolvePendingBountyId(txHash: string, chain: string): Promise<string | null> {
  try {
    const publicClient = getPublicClient(chain);
    const contractAddress = (POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT).toLowerCase();
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    const bountyCreatedSig = keccak256(toBytes("BountyCreated(uint256,address,string,string,uint256)")).toLowerCase();

    let fallbackTopic: string | null = null;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== contractAddress || log.topics.length < 2 || !log.topics[1]) continue;

      // Save first candidate as a fallback
      if (!fallbackTopic) fallbackTopic = log.topics[1];

      // Strict match: exact event signature
      const topic0 = log.topics[0]?.toLowerCase();
      if (topic0 === bountyCreatedSig) {
        const rawId = BigInt(log.topics[1]).toString();
        console.log(`[bounty-loop] resolved pending ${txHash.slice(0,10)} via BountyCreated sig → rawId=${rawId} → url=${resolvePoidhUrl(chain, rawId)}`);
        return rawId;
      }
    }

    if (fallbackTopic) {
      const rawId = BigInt(fallbackTopic).toString();
      console.warn(`[bounty-loop] BountyCreated sig not found for ${txHash.slice(0,10)} — using fallback topic rawId=${rawId}`);
      return rawId;
    }

    console.warn(`[bounty-loop] no matching log in receipt for ${txHash.slice(0,10)}`);
  } catch (err) {
    console.warn(`[bounty-loop] could not resolve pending bounty ID from receipt:`, err);
  }
  return null;
}

// Returns the best cast hash to reply under — prefers announcement cast over private thread cast
function getReplyTarget(bounty: { castHash: string; announcementCastHash?: string }): string {
  return bounty.announcementCastHash ?? bounty.castHash;
}

function chainLabel(chain: string): string {
  if (chain === "base") return "Base";
  if (chain === "degen") return "Degen Chain";
  return "Arbitrum";
}

function chainCurrency(chain: string): string {
  return chain === "degen" ? "DEGEN" : "ETH";
}

export async function runBountyLoop(): Promise<{ processed: number; winners: number; errors: number }> {
  // getAllBounties includes closed ones — we need to check pending- across all statuses
  const allBounties = await getAllBounties();
  const activeBounties = allBounties.filter((b) => b.status === "open" || b.status === "evaluating");

  // Auto-heal missing announcementCastHash on active bounties without double-announcing.
  // Guardrails:
  // 1) Recover from existing bounty_threads first (no new cast).
  // 2) Publish only if still missing.
  const missingAnnouncement = allBounties.filter(
    (b) =>
      (b.status === "open" || b.status === "evaluating") &&
      !b.bountyId.startsWith("pending-") &&
      !b.announcementCastHash,
  );
  for (const bounty of missingAnnouncement) {
    try {
      const existingThreadHash = await getAnnouncementThreadCastHashForBounty(bounty.bountyId);
      if (existingThreadHash) {
        await updateBounty(bounty.bountyId, { announcementCastHash: existingThreadHash });
        console.log(`[bounty-loop] restored announcementCastHash for ${bounty.bountyId} from bounty_threads: ${existingThreadHash}`);
        continue;
      }

      if (!BOT_SIGNER_UUID) continue;

      const chain = bounty.chain ?? "arbitrum";
      const bountyLink = resolvePoidhUrl(chain, bounty.bountyId);
      const type = bounty.bountyType ?? "open";
      const modeLine = type === "solo"
        ? "solo bounty — creator picks the winner directly on poidh."
        : "open bounty — anyone can add funds and vote on the winner.";
      const announcementText =
        `new ${type} bounty: "${bounty.name}"\n\n${bounty.description}\n\nreward: ${bounty.amountEth} ${chainCurrency(chain)} on ${chainLabel(chain)}. ${modeLine}`;

      const announcementHash = await publishCast({
        text: announcementText.slice(0, 1024),
        signerUuid: BOT_SIGNER_UUID,
        channelId: "poidh",
        embedUrl: bountyLink,
      });

      // Persist hash first so re-runs cannot re-announce the same bounty.
      await updateBounty(bounty.bountyId, { announcementCastHash: announcementHash });
      await registerBountyThread({
        castHash: announcementHash,
        bountyId: bounty.bountyId,
        bountyName: bounty.name,
        bountyDescription: bounty.description,
        chain,
        poidhUrl: bountyLink,
        winnerClaimId: bounty.winnerClaimId,
        winnerIssuer: bounty.winnerIssuer,
        winnerReasoning: bounty.winnerReasoning,
      });

      console.log(`[bounty-loop] backfilled missing announcement for ${bounty.bountyId}: ${announcementHash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[bounty-loop] failed to backfill announcement for ${bounty.bountyId}: ${msg}`);
    }
  }

  // Backfill missing winner announcement casts for closed non-cancelled bounties.
  // Guardrails:
  // 1) Skip cancelled rows.
  // 2) Skip if winner thread already exists for this bounty/claim.
  const closedMissingWinnerAnnouncement = allBounties.filter((b) => {
    const isClosed = b.status === "closed";
    const hasWinner = !!b.winnerClaimId;
    const isCancelled = (b.winnerReasoning ?? "").toLowerCase().startsWith("bounty cancelled by");
    return isClosed && hasWinner && !isCancelled && !b.bountyId.startsWith("pending-");
  });

  for (const bounty of closedMissingWinnerAnnouncement) {
    try {
      const winnerThreadHash = await getWinnerAnnouncementThreadCastHashForBounty(
        bounty.bountyId,
        bounty.winnerClaimId,
      );
      if (winnerThreadHash) {
        continue;
      }
      if (!BOT_SIGNER_UUID) continue;

      const chain = bounty.chain ?? "arbitrum";
      const bountyLink = resolvePoidhUrl(chain, bounty.bountyId);
      const details = await getBountyDetails(BigInt(bounty.bountyId), chain).catch(() => null);
      const contributorAddresses = await getContributors(
        bounty.bountyId,
        chain,
        details?.issuer,
      ).catch(() => []);
      const creatorMention = bounty.creatorFid ? (await resolveFidToUsername(bounty.creatorFid)) : null;

      const addressPool = [...new Set([
        ...(bounty.winnerIssuer ? [bounty.winnerIssuer] : []),
        ...contributorAddresses,
      ])];
      const mentionMap = await resolveAddressesToUsernames(addressPool);
      const winnerMention = bounty.winnerIssuer
        ? (mentionMap.get(bounty.winnerIssuer.toLowerCase()) ?? shortenAddress(bounty.winnerIssuer))
        : "winner";

      let botAddr = "";
      try { botAddr = (await import("@/features/bot/poidh-contract")).getBotWalletAddress().toLowerCase(); } catch { /* non-critical */ }
      const contributorMentions = contributorAddresses
        .filter((a) => a.toLowerCase() !== botAddr && a.toLowerCase() !== (bounty.winnerIssuer ?? "").toLowerCase())
        .map((a) => mentionMap.get(a.toLowerCase()) ?? shortenAddress(a))
        .filter((m, i, arr) => arr.indexOf(m) === i);
      const allThanks = [
        ...(creatorMention ? [creatorMention] : []),
        ...contributorMentions,
      ]
        .filter((m, i, arr) => m !== winnerMention && arr.indexOf(m) === i);
      const fundedByLine = buildFundedByLine(allThanks);

      const submissionLabel = `${bounty.claimCount > 0 ? bounty.claimCount : 1} submission(s)`;
      const reason = (bounty.winnerReasoning ?? "winner selected").trim().replace(/[.!\s]+$/g, "");
      const winnerText = `✅ "${bounty.name}" — ${winnerMention} wins from ${submissionLabel} because ${reason}.${fundedByLine}`;

      const winnerAnnouncementHash = await publishCast({
        text: winnerText.slice(0, 1024),
        signerUuid: BOT_SIGNER_UUID,
        channelId: "poidh",
        embedUrl: bountyLink,
      });

      await registerBountyThread({
        castHash: winnerAnnouncementHash,
        bountyId: bounty.bountyId,
        bountyName: bounty.name,
        bountyDescription: bounty.description,
        chain,
        poidhUrl: bountyLink,
        winnerClaimId: bounty.winnerClaimId,
        winnerIssuer: bounty.winnerIssuer,
        winnerReasoning: bounty.winnerReasoning,
      });

      // Keep latest public thread target on record.
      await updateBounty(bounty.bountyId, {
        announcementCastHash: winnerAnnouncementHash,
        lastCheckedAt: new Date().toISOString(),
      });

      console.log(`[bounty-loop] backfilled missing winner announcement for ${bounty.bountyId}: ${winnerAnnouncementHash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[bounty-loop] failed to backfill winner announcement for ${bounty.bountyId}: ${msg}`);
    }
  }

  // Auto-retry cancelled refunds marked as pending so creators don't need to manually reply "refund".
  // This runs before the normal open/evaluating loop.
  const nowMs = Date.now();
  const pendingRefundBounties = allBounties.filter((b) => {
    const reason = (b.winnerReasoning ?? "").toLowerCase();
    const isCancelled = reason.includes("bounty cancelled by");
    const alreadySent = reason.includes("refund sent");
    const needsTx = !b.winnerTxHash;
    const isClosed = b.status === "closed";
    const notPendingId = !b.bountyId.startsWith("pending-");
    const lastAttemptMs = b.lastCheckedAt ? new Date(b.lastCheckedAt).getTime() : 0;
    const staleEnough = !lastAttemptMs || nowMs - lastAttemptMs >= REFUND_RETRY_INTERVAL_MS;
    return isClosed && isCancelled && !alreadySent && needsTx && notPendingId && staleEnough;
  });

  for (const bounty of pendingRefundBounties) {
    try {
      const currentReason = bounty.winnerReasoning ?? "bounty cancelled by creator";
      if (!/refund pending/i.test(currentReason)) {
        const nextReason = `${currentReason} (refund pending - auto)`;
        await updateBounty(bounty.bountyId, { winnerReasoning: nextReason }).catch(() => {});
      }

      if (!bounty.creatorFid) {
        await updateBounty(bounty.bountyId, { lastCheckedAt: new Date().toISOString() });
        continue;
      }

      const creatorRefundAddress = await resolveFidToRefundAddress(bounty.creatorFid);
      if (!creatorRefundAddress) {
        await updateBounty(bounty.bountyId, { lastCheckedAt: new Date().toISOString() });
        continue;
      }

      const amountWei = parseEther(bounty.amountEth);
      const retry = await retryCancelledBountyRefundFromPending(
        BigInt(bounty.bountyId),
        bounty.chain ?? "arbitrum",
        creatorRefundAddress,
        amountWei,
        { allowDirectWalletFallback: false },
      );

      if (retry.refundTxHash) {
        const nextReasoning = (bounty.winnerReasoning ?? "bounty cancelled")
          .replace(/\(refund pending[^)]*\)/i, "(refund sent)");
        await updateBounty(bounty.bountyId, {
          winnerTxHash: retry.refundTxHash,
          winnerReasoning: nextReasoning,
          lastCheckedAt: new Date().toISOString(),
        });
        const explorer = getTxExplorerUrl(bounty.chain ?? "arbitrum", retry.refundTxHash);
        await postReply(
          getReplyTarget(bounty),
          `refund retry succeeded — ${explorer}`,
          explorer,
        );
      } else {
        await updateBounty(bounty.bountyId, { lastCheckedAt: new Date().toISOString() });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[bounty-loop] auto refund retry failed for ${bounty.bountyId}: ${msg}`);
      await updateBounty(bounty.bountyId, { lastCheckedAt: new Date().toISOString() }).catch(() => {});
    }
  }

  let processed = 0;
  let winners = 0;
  let errors = 0;

  for (const bounty of activeBounties) {
    const bountyChain = bounty.chain ?? "arbitrum";

    // --- Handle pending- bounties: try to resolve the real ID ---
    if (bounty.bountyId.startsWith("pending-")) {
      try {
        const realId = await resolvePendingBountyId(bounty.txHash, bountyChain);
        if (realId) {
          await updateBounty(bounty.bountyId, { newBountyId: realId });
          console.log(`[bounty-loop] updated DB: ${bounty.bountyId} → ${realId}`);
          // Post the poidh link now that we have the real ID
          const url = resolvePoidhUrl(bountyChain, realId);
          await postReply(getReplyTarget(bounty), `bounty id resolved — ${url}`, url);
        } else {
          console.log(`[bounty-loop] ${bounty.bountyId} still unresolvable, skipping`);
        }
      } catch (err) {
        console.error(`[bounty-loop] error resolving pending bounty:`, err);
      }
      continue;
    }

    try {
      processed++;
      await updateBounty(bounty.bountyId, { lastCheckedAt: new Date().toISOString() });

      // --- For evaluating bounties: recover / resolve on-chain vote state ---
      if (bounty.bountyType !== "solo") {
        const publicClient = getPublicClient(bountyChain);
        const contractAddress = POIDH_CONTRACTS[bountyChain] ?? POIDH_CONTRACT;
        let observedActiveVotingClaimId: string | null = null;

        try {
          const currentVotingClaim = await publicClient.readContract({
            address: contractAddress,
            abi: POIDH_ABI,
            functionName: "bountyCurrentVotingClaim",
            args: [BigInt(bounty.bountyId)],
          }) as bigint;

          const activeVotingClaimId = currentVotingClaim > BigInt(0)
            ? currentVotingClaim.toString()
            : null;
          observedActiveVotingClaimId = activeVotingClaimId;

          const shouldRecoverVoteState =
            !!activeVotingClaimId && (
              bounty.status !== "evaluating" ||
              bounty.winnerClaimId !== activeVotingClaimId ||
              !bounty.winnerReasoning
            );

          if (shouldRecoverVoteState) {
            const activeVoteDetails = await getBountyDetails(BigInt(bounty.bountyId), bountyChain);
            const {
              recoveredResult,
              hydratedResults,
            } = await hydrateActiveVoteContext(
              bounty,
              bountyChain,
              activeVoteDetails.createdAt,
              activeVotingClaimId,
            );

            await updateBounty(bounty.bountyId, {
              status: "evaluating",
              winnerClaimId: activeVotingClaimId,
              winnerIssuer: recoveredResult?.issuer,
              winnerReasoning: recoveredResult?.reasoning ?? bounty.winnerReasoning,
              ...(hydratedResults ? { allEvalResults: hydratedResults } : {}),
            });

            // If an on-chain vote already exists but the DB/UI missed the original nomination,
            // backfill the nomination reply once so the announcement thread reflects reality.
            if (recoveredResult) {
              try {
                const creatorMention = bounty.creatorFid ? (await resolveFidToUsername(bounty.creatorFid)) : null;
                const bountyIssuer = activeVoteDetails.issuer;
                const contributorAddresses = await getContributors(bounty.bountyId, bountyChain, bountyIssuer);
                const contributorMap = await resolveAddressesToUsernames(contributorAddresses);
                let botAddr = "";
                try { botAddr = (await import("@/features/bot/poidh-contract")).getBotWalletAddress().toLowerCase(); } catch { /* non-critical */ }
                const contributorMentions = contributorAddresses
                  .filter((a) => a.toLowerCase() !== botAddr && a.toLowerCase() !== (recoveredResult.issuer ?? "").toLowerCase())
                  .map((a) => contributorMap.get(a.toLowerCase()) ?? shortenAddress(a))
                  .filter((m, i, arr) => arr.indexOf(m) === i);
                const rankedValidResults = (hydratedResults ?? bounty.allEvalResults as AnnotatedResult[] | undefined ?? [])
                  .filter((r) => r.valid)
                  .sort(compareEvaluationResults);
                const expectedWinner = rankedValidResults[0];
                const bountyLink = resolvePoidhUrl(bountyChain, bounty.bountyId);

                if (expectedWinner && expectedWinner.claimId !== activeVotingClaimId) {
                  await postVoteCorrectionIfNeeded(
                    bounty,
                    bountyChain,
                    activeVotingClaimId,
                    hydratedResults ?? bounty.allEvalResults as AnnotatedResult[] | undefined ?? [],
                    bountyIssuer,
                  );
                } else {
                  const winnerMention = recoveredResult.issuerUsername
                    ? recoveredResult.issuerUsername
                    : recoveredResult.issuer
                      ? (await resolveAddressesToUsernames([recoveredResult.issuer])).get(recoveredResult.issuer.toLowerCase()) ?? shortenAddress(recoveredResult.issuer)
                      : `claim #${activeVotingClaimId}`;
                  await postChannelWinnerAnnouncement(
                    bounty.name,
                    Math.max(bounty.claimCount, hydratedResults?.length ?? bounty.allEvalResults?.length ?? 0, 1),
                    recoveredResult.reasoning,
                    bountyLink,
                    "vote_submitted",
                    winnerMention,
                    creatorMention,
                    contributorMentions,
                    bountyChain,
                    activeVoteDetails.amount,
                    undefined,
                    undefined,
                    getReplyTarget(bounty),
                    hydratedResults ?? bounty.allEvalResults as AnnotatedResult[] | undefined,
                  );
                  await logBountyLoopEvent(
                    bounty,
                    "vote_nomination_backfilled",
                    "success",
                    `backfilled nomination for claim #${activeVotingClaimId}`,
                    {
                      triggerText: `bounty #${bounty.bountyId} recovered a missing vote nomination reply`,
                    },
                  );
                }
              } catch (recoveryErr) {
                const msg = recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr);
                await logBountyLoopEvent(
                  bounty,
                  "vote_nomination_backfilled",
                  "error",
                  `failed to backfill nomination for claim #${activeVotingClaimId}`,
                  {
                    triggerText: `bounty #${bounty.bountyId} failed to recover a missing vote nomination reply`,
                    errorMessage: msg,
                  },
                );
                console.warn(`[bounty-loop] failed to backfill vote-submitted reply for ${bounty.bountyId}: ${msg}`);
              }
            }
          }

          if (!activeVotingClaimId) {
            // No vote in progress — continue to normal evaluation below.
          } else {
          const tracker = await publicClient.readContract({
            address: contractAddress,
            abi: POIDH_ABI,
            functionName: "bountyVotingTracker",
            args: [BigInt(bounty.bountyId)],
          }) as [bigint, bigint, bigint];

          const [yesVotes, noVotes, deadline] = tracker;
          const now = BigInt(Math.floor(Date.now() / 1000));
          const currentWinnerClaimId = activeVotingClaimId ?? bounty.winnerClaimId;
          if (bounty.allEvalResults?.length && currentWinnerClaimId) {
            try {
              const voteDetails = await getBountyDetails(BigInt(bounty.bountyId), bountyChain);
              await postVoteCorrectionIfNeeded(
                bounty,
                bountyChain,
                currentWinnerClaimId,
                bounty.allEvalResults as AnnotatedResult[],
                voteDetails.issuer,
              );
            } catch (correctionErr) {
              const msg = correctionErr instanceof Error ? correctionErr.message : String(correctionErr);
              console.warn(`[bounty-loop] failed to post vote correction for ${bounty.bountyId}: ${msg}`);
            }
          }

          if (deadline > BigInt(0) && now >= deadline) {
            console.log(`[bounty-loop] vote deadline passed for ${bounty.bountyId} — yes=${yesVotes} no=${noVotes}, calling resolveVote`);
            const { client, account } = getWalletClient(bountyChain);
            const resolveTxHash = await client.writeContract({
              address: contractAddress,
              abi: POIDH_ABI,
              functionName: "resolveVote",
              args: [BigInt(bounty.bountyId)],
              account,
            });

            const bountyLink = resolvePoidhUrl(bountyChain, bounty.bountyId);
            const yesWon = yesVotes > noVotes;

            await updateBounty(bounty.bountyId, {
              status: "closed",
              winnerTxHash: resolveTxHash,
            });

            if (yesWon) {
              // Fetch on-chain details: issuer (contributor fallback) + winner's wallet address
              let bountyIssuer: string | undefined;
              let winnerAddr: string | undefined;
              try {
                const onChainDetails = await getBountyDetails(BigInt(bounty.bountyId), bountyChain);
                bountyIssuer = onChainDetails.issuer;
              } catch { /* non-critical */ }

              // Resolve winner wallet from stored winnerClaimId via claims list
              if (currentWinnerClaimId) {
                try {
                  const claims = await getClaimsForBounty(BigInt(bounty.bountyId), bountyChain);
                  winnerAddr = claims.find((c) => c.id.toString() === currentWinnerClaimId)?.issuer;
                } catch { /* non-critical */ }
              }

              const resolvedContributors = await getContributors(bounty.bountyId, bountyChain, bountyIssuer);
              const allVAddrs = [...new Set([...(winnerAddr ? [winnerAddr] : []), ...resolvedContributors])];
              const uMap = await resolveAddressesToUsernames(allVAddrs);
              const wMention = winnerAddr ? (uMap.get(winnerAddr.toLowerCase()) ?? shortenAddress(winnerAddr)) : `claim #${currentWinnerClaimId}`;
              const creatorTag = bounty.creatorFid ? (await resolveFidToUsername(bounty.creatorFid)) : null;
              let botAddrV = "";
              try { botAddrV = (await import("@/features/bot/poidh-contract")).getBotWalletAddress().toLowerCase(); } catch { /* non-critical */ }
              const humanContribsV = resolvedContributors
                .filter((a) => a.toLowerCase() !== botAddrV && a.toLowerCase() !== (winnerAddr ?? "").toLowerCase())
                .map((a) => uMap.get(a.toLowerCase()) ?? shortenAddress(a))
                .filter((m, i, arr) => arr.indexOf(m) === i);
              const allThanksV = [
                ...(creatorTag ? [creatorTag] : []),
                ...humanContribsV,
              ].filter((m, i, arr) => m !== wMention && arr.indexOf(m) === i);
              const fundedByLineV = buildFundedByLine(allThanksV);

              // Short pointer reply in original thread
              await postReply(getReplyTarget(bounty), `🏆 vote closed — ${wMention} wins. see /poidh for the full announcement.`, bountyLink);

              // Full winner announcement as a NEW top-level cast in /poidh channel
              const currency = bountyChain === "degen" ? "DEGEN" : "ETH";
              const fmtV = (wei: bigint) => (Number(wei) / 1e18).toFixed(4).replace(/\.?0+$/, "") || "0";
              let potLineV = "";
              try {
                const onChainAmt = (await getBountyDetails(BigInt(bounty.bountyId), bountyChain)).amount;
                potLineV = ` ${fmtV(onChainAmt)} ${currency}`;
              } catch { /* non-critical */ }
              const voteLineV = ` (${fmtV(yesVotes)} ${currency} yes / ${fmtV(noVotes)} ${currency} no)`;
              const reasonV = (bounty.winnerReasoning ?? "winner selected").trim().replace(/[.!\s]+$/g, "");
              const submissionCountV = bounty.claimCount > 0 ? bounty.claimCount : 1;
              const resolvedCastHash = await publishCast({
                text: stripMarkdown(`✅ "${bounty.name}" — ${wMention} wins from ${submissionCountV} submission(s) because ${reasonV}.${fundedByLineV}${potLineV ? ` pot:${potLineV}` : ""} community vote passed${voteLineV}.`).slice(0, 1024),
                signerUuid: BOT_SIGNER_UUID,
                channelId: "poidh",
                embedUrl: bountyLink,
              });
              if (resolvedCastHash) {
                await registerBountyThread({
                  castHash: resolvedCastHash,
                  bountyId: bounty.bountyId,
                  bountyName: bounty.name,
                  bountyDescription: bounty.description,
                  chain: bountyChain,
                  poidhUrl: bountyLink,
                  winnerClaimId: currentWinnerClaimId,
                  winnerIssuer: undefined,
                  winnerReasoning: bounty.winnerReasoning,
                });
              }
            } else {
              // Vote failed — find next best claim from stored results
              const allResults = bounty.allEvalResults ?? [];
              const nextBest = [...allResults]
                .sort(compareEvaluationResults)
                .find((r) => r.valid && r.claimId !== currentWinnerClaimId && r.score >= 60);

              if (nextBest) {
                await postReply(
                  getReplyTarget(bounty),
                  `vote rejected claim #${currentWinnerClaimId}. nominating next best: claim #${nextBest.claimId} (score ${nextBest.score}). ${nextBest.reasoning}`,
                  bountyLink,
                );
                // Nominate runner-up
                const { client: c2, account: a2 } = getWalletClient(bountyChain);
                await c2.writeContract({
                  address: contractAddress,
                  abi: POIDH_ABI,
                  functionName: "submitClaimForVote",
                  args: [BigInt(bounty.bountyId), BigInt(nextBest.claimId)],
                  account: a2,
                });
                await updateBounty(bounty.bountyId, {
                  status: "evaluating",
                  winnerClaimId: nextBest.claimId,
                  winnerReasoning: nextBest.reasoning,
                });
              } else {
                await postReply(
                  getReplyTarget(bounty),
                  `vote rejected claim #${currentWinnerClaimId}. no other qualifying submissions found — bounty remains open for new submissions.`,
                  bountyLink,
                );
                await updateBounty(bounty.bountyId, { status: "open", winnerClaimId: undefined });
              }
            }
            continue; // handled — don't fall through to evaluation
          }

            console.log(`[bounty-loop] bounty ${bounty.bountyId} vote in progress for claim #${activeVotingClaimId} — waiting for deadline`);
            continue;
          }
        } catch (voteErr) {
          const msg = voteErr instanceof Error ? voteErr.message : String(voteErr);
          console.warn(`[bounty-loop] vote tracker check failed for ${bounty.bountyId}: ${msg}`);
          if (observedActiveVotingClaimId) {
            console.log(`[bounty-loop] bounty ${bounty.bountyId} still has on-chain vote for claim #${observedActiveVotingClaimId} — waiting for next tracker check`);
            continue;
          }
          // Non-fatal — fall through to normal evaluation only if we couldn't confirm a live vote.
        }
      }

      // --- Check on-chain status first ---
      const details = await getBountyDetails(BigInt(bounty.bountyId), bountyChain);
      const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

      if (details.claimer !== ZERO_ADDR) {
        // claimer set — either cancelled (claimer == issuer) or won (claimer == winner)
        const wasCancelled = details.claimer.toLowerCase() === details.issuer.toLowerCase();
        await updateBounty(bounty.bountyId, {
          status: "closed",
          winnerReasoning: wasCancelled ? "bounty cancelled by issuer" : undefined,
        });
        if (wasCancelled) {
          console.log(`[bounty-loop] bounty ${bounty.bountyId} was cancelled by issuer`);
        } else {
          console.log(`[bounty-loop] bounty ${bounty.bountyId} already resolved on-chain, claimer=${details.claimer}`);
        }
        continue;
      }

      // --- Solo bounty: creator picks winner on poidh.xyz — bot never evaluates ---
      if (bounty.bountyType === "solo") {
        console.log(`[bounty-loop] bounty ${bounty.bountyId} is solo — skipping evaluation (creator picks winner)`);
        continue;
      }

      // --- Skip if too new ---
      const age = Date.now() - new Date(bounty.createdAt).getTime();
      if (age < MIN_OPEN_DURATION_MS) continue;

      // --- Cooldown: skip re-evaluation if we already posted "none met" recently ---
      if (bounty.lastCheckedAt) {
        const elapsed = Date.now() - new Date(bounty.lastCheckedAt).getTime();
        if (elapsed < EVAL_COOLDOWN_MS) {
          console.log(`[bounty-loop] bounty ${bounty.bountyId} in cooldown — ${Math.round((EVAL_COOLDOWN_MS - elapsed) / 60000)}m remaining`);
          continue;
        }
      }

      // --- Fetch claims ---
      const claims = await getClaimsForBounty(BigInt(bounty.bountyId), bountyChain);
      await updateBounty(bounty.bountyId, { claimCount: claims.length });

      if (claims.length < MIN_CLAIMS_TO_EVALUATE) {
        const age = Date.now() - new Date(bounty.createdAt).getTime();
        const lastNudge = bounty.lastCheckedAt ? Date.now() - new Date(bounty.lastCheckedAt).getTime() : Infinity;
        const bountyLink = resolvePoidhUrl(bountyChain, bounty.bountyId);
        const neverNudged = !bounty.lastCheckedAt;
        const botUsername = process.env.BOT_USERNAME ?? "poidh-sentinel";

        if (age >= MIN_OPEN_DURATION_MS && neverNudged) {
          // First check after the 72h window — zero submissions, tag creator and explain options
          const creatorMention = bounty.creatorFid ? (await resolveFidToUsername(bounty.creatorFid)) : null;
          const tag = creatorMention ? `${creatorMention} ` : "";
          const daysOpen = Math.floor(age / (24 * 60 * 60 * 1000));
          const nudgeText = `${tag}${daysOpen > 3 ? `${daysOpen} days` : "72h"} in — no submissions yet. bounty stays open until someone submits proof or you cancel it. to cancel and get your deposit back, reply "cancel bounty" in this thread.`;
          // Only post in the announcement thread — the @mention notifies the creator
          await postReply(getReplyTarget(bounty), nudgeText, bountyLink);
          await updateBounty(bounty.bountyId, { lastCheckedAt: new Date().toISOString() });
        } else if (age >= NO_SUBMISSION_NUDGE_MS && lastNudge >= NO_SUBMISSION_NUDGE_INTERVAL_MS) {
          // Repeat nudge every 48h after 7 days — tag creator, suggest sharing or cancelling
          const creatorMention = bounty.creatorFid ? (await resolveFidToUsername(bounty.creatorFid)) : null;
          const tag = creatorMention ? `${creatorMention} ` : "";
          const daysOpen = Math.floor(age / (24 * 60 * 60 * 1000));
          const nudgeText = `${tag}${daysOpen} days open, still no submissions. share the link to attract submitters — or reply "cancel bounty" in this thread to cancel and get your deposit back.`;
          // Only post in the announcement thread — the @mention notifies the creator
          await postReply(getReplyTarget(bounty), nudgeText, bountyLink);
          await updateBounty(bounty.bountyId, { lastCheckedAt: new Date().toISOString() });
        }
        continue;
      }

      await updateBounty(bounty.bountyId, { status: "evaluating" });

      const claimData: ClaimData[] = claims.map((c) => ({
        id: c.id.toString(),
        issuer: c.issuer,
        name: c.name,
        description: c.description,
        uri: c.uri,
      }));

      await logBountyLoopEvent(
        bounty,
        "winner_evaluation_started",
        "success",
        `evaluating ${claimData.length} claim(s) for winner selection`,
        {
          triggerText: `bounty #${bounty.bountyId} entered winner evaluation`,
        },
      );

      const result = await pickWinner(
        bounty.name,
        bounty.description,
        claimData,
        details.createdAt,
        { returnAllResultsIfNoWinner: true },
      );

      const previousWinnerResult = hasSameClaimSet(claimData, bounty.allEvalResults)
        ? selectWinnerFromStoredResults(bounty.allEvalResults)
        : null;
      const effectiveResult = result?.winnerClaimId
        ? result
        : previousWinnerResult;

      if (!effectiveResult || !effectiveResult.winnerClaimId) {
        // Build per-claim feedback from the already-computed evaluation results
        const noWinnerFeedback = buildNoWinnerFeedback(claimData, result?.allResults ?? []);
        const bountyLinkForFeedback = resolvePoidhUrl(bountyChain, bounty.bountyId);
        await postReply(getReplyTarget(bounty), noWinnerFeedback, bountyLinkForFeedback);
        await logBountyLoopEvent(
          bounty,
          "no_winner_found",
          "success",
          noWinnerFeedback,
          { triggerText: `bounty #${bounty.bountyId} evaluated with no winner` },
        );
        // Stamp lastCheckedAt so cooldown prevents re-posting every minute
        await updateBounty(bounty.bountyId, {
          status: "open",
          allEvalResults: result?.allResults ?? bounty.allEvalResults,
          lastCheckedAt: new Date().toISOString(),
        });
        continue;
      }

      await logBountyLoopEvent(
        bounty,
        "winner_candidate_selected",
        "success",
        result?.winnerClaimId
          ? `candidate claim #${effectiveResult.winnerClaimId} selected: ${effectiveResult.reasoning}`
          : `reusing prior candidate claim #${effectiveResult.winnerClaimId}: ${effectiveResult.reasoning}`,
        {
          triggerText: result?.winnerClaimId
            ? `bounty #${bounty.bountyId} picked winner candidate`
            : `bounty #${bounty.bountyId} reused a previously valid winner candidate`,
        },
      );

      // --- Resolve on-chain ---
      let txHash: `0x${string}`;
      let method: "direct" | "vote_submitted" | "vote_resolved";
      try {
        ({ txHash, method } = await resolveBountyWinner(
          BigInt(bounty.bountyId),
          BigInt(effectiveResult.winnerClaimId),
          bountyChain,
        ));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logBountyLoopEvent(
          bounty,
          "winner_resolution_failed",
          "error",
          `failed to resolve candidate claim #${effectiveResult.winnerClaimId}`,
          {
            triggerText: `bounty #${bounty.bountyId} failed during on-chain resolution`,
            errorMessage: msg,
          },
        );
        throw err;
      }

      await logBountyLoopEvent(
        bounty,
        "winner_resolution_started",
        "success",
        `${method} submitted for claim #${effectiveResult.winnerClaimId}`,
        {
          triggerText: `bounty #${bounty.bountyId} submitted on-chain winner action`,
          txHash,
        },
      );

      const bountyLink = resolvePoidhUrl(bountyChain, bounty.bountyId);

      // Find the winning claim's issuer address so the bot can explain "why @user won"
      const winnerClaim = claims.find((c) => c.id.toString() === effectiveResult.winnerClaimId);
      const winnerIssuer = winnerClaim?.issuer ?? undefined;

      // Resolve ALL claim issuer addresses → Farcaster usernames in one batch
      // This lets the bot match "who is replying" → "their claim" in thread conversations
      const contributorAddresses = await getContributors(bounty.bountyId, bountyChain, details.issuer);
      const claimIssuerAddresses = effectiveResult.allResults.map((r) => r.issuer).filter((a): a is string => !!a);
      const allAddresses = [...new Set([...(winnerIssuer ? [winnerIssuer] : []), ...contributorAddresses, ...claimIssuerAddresses])];
      const usernameMap = await resolveAddressesToUsernames(allAddresses);

      // Annotate each eval result with the resolved username so it's persisted in DB
      const annotatedResults = effectiveResult.allResults.map((r) => ({
        ...r,
        issuerUsername: r.issuer ? (usernameMap.get(r.issuer.toLowerCase()) ?? shortenAddress(r.issuer)) : undefined,
      }));
      const winnerMention = winnerIssuer
        ? (usernameMap.get(winnerIssuer.toLowerCase()) ?? shortenAddress(winnerIssuer))
        : (effectiveResult.winnerClaimId ? `claim #${effectiveResult.winnerClaimId}` : "winner");
      const creatorMention = bounty.creatorFid ? (await resolveFidToUsername(bounty.creatorFid)) : null;

      // On-chain contributors excluding the bot wallet (participant[0]) and the winner
      let botAddr = "";
      try { botAddr = (await import("@/features/bot/poidh-contract")).getBotWalletAddress().toLowerCase(); } catch { /* non-critical */ }
      const humanContributorMentions = contributorAddresses
        .filter((a) => a.toLowerCase() !== botAddr && a.toLowerCase() !== (winnerIssuer ?? "").toLowerCase())
        .map((a) => usernameMap.get(a.toLowerCase()) ?? shortenAddress(a))
        .filter((m, i, arr) => arr.indexOf(m) === i);

      if (method === "vote_submitted") {
        // Store full ranked results (with resolved usernames) so re-nomination + thread replies can use them
        await updateBounty(bounty.bountyId, {
          status: "evaluating",
          winnerClaimId: effectiveResult.winnerClaimId,
          winnerIssuer,
          winnerTxHash: txHash,
          winnerReasoning: effectiveResult.reasoning,
          allEvalResults: annotatedResults,
        });

        // Single reply: scores + nomination merged into one cast
        const announcementHash = await postChannelWinnerAnnouncement(bounty.name, claims.length, effectiveResult.reasoning, bountyLink, "vote_submitted", winnerMention, creatorMention, humanContributorMentions, bountyChain, details.amount, undefined, undefined, getReplyTarget(bounty), annotatedResults);
        if (announcementHash) {
          await updateBounty(bounty.bountyId, { announcementCastHash: announcementHash });
          await registerBountyThread({
            castHash: announcementHash,
            bountyId: bounty.bountyId,
            bountyName: bounty.name,
            bountyDescription: bounty.description,
            chain: bountyChain,
            poidhUrl: bountyLink,
            winnerClaimId: effectiveResult.winnerClaimId,
            winnerIssuer,
            winnerReasoning: effectiveResult.reasoning,
          });
        }
        winners++;

      } else if (method === "vote_resolved") {
        await updateBounty(bounty.bountyId, {
          status: "closed",
          winnerClaimId: effectiveResult.winnerClaimId,
          winnerIssuer,
          winnerTxHash: txHash,
          winnerReasoning: effectiveResult.reasoning,
          allEvalResults: annotatedResults,
        });

        // Short pointer reply in original thread
        await postReply(getReplyTarget(bounty), `🏆 vote closed — ${winnerMention} wins. see /poidh for the full announcement.`, bountyLink);

        // Full winner announcement as a NEW top-level cast in /poidh channel
        const announcementHash = await postChannelWinnerAnnouncement(bounty.name, claims.length, effectiveResult.reasoning, bountyLink, "vote_resolved", winnerMention, creatorMention, humanContributorMentions, bountyChain, details.amount, undefined, undefined, undefined, annotatedResults);
        if (announcementHash) {
          await updateBounty(bounty.bountyId, { announcementCastHash: announcementHash });
          await registerBountyThread({
            castHash: announcementHash,
            bountyId: bounty.bountyId,
            bountyName: bounty.name,
            bountyDescription: bounty.description,
            chain: bountyChain,
            poidhUrl: bountyLink,
            winnerClaimId: effectiveResult.winnerClaimId,
            winnerIssuer,
            winnerReasoning: effectiveResult.reasoning,
          });
        }
        winners++;

      } else {
        // direct — issuer-only bounty, no community vote required
        // close the bounty, post a short thread reply, and post a /poidh winner announcement
        await updateBounty(bounty.bountyId, {
          status: "closed",
          winnerClaimId: effectiveResult.winnerClaimId,
          winnerIssuer,
          winnerTxHash: txHash,
          winnerReasoning: effectiveResult.reasoning,
          allEvalResults: annotatedResults,
        });

        const currency = bountyChain === "degen" ? "DEGEN" : "ETH";
        const fmtD = (wei: bigint) => {
          if (bountyChain === "degen") {
            const val = Number(wei) / 1e18;
            return val % 1 === 0 ? `${val}` : val.toFixed(2).replace(/\.?0+$/, "");
          }
          return Number(wei) / 1e18 === 0 ? "0" : (Number(wei) / 1e18).toFixed(4).replace(/\.?0+$/, "");
        };
        const potLineD = details?.amount !== undefined ? ` ${fmtD(details.amount)} ${currency}` : "";
        await postReply(getReplyTarget(bounty), `🏆 ${winnerMention} wins${potLineD}! ${effectiveResult.reasoning}`, bountyLink);

        const directAnnouncementHash = await postChannelWinnerAnnouncement(
          bounty.name,
          claims.length,
          effectiveResult.reasoning,
          bountyLink,
          "direct",
          winnerMention,
          creatorMention,
          humanContributorMentions,
          bountyChain,
          details.amount,
          undefined,
          undefined,
          undefined,
          annotatedResults,
        );
        if (directAnnouncementHash) {
          await updateBounty(bounty.bountyId, { announcementCastHash: directAnnouncementHash });
          await registerBountyThread({
            castHash: directAnnouncementHash,
            bountyId: bounty.bountyId,
            bountyName: bounty.name,
            bountyDescription: bounty.description,
            chain: bountyChain,
            poidhUrl: bountyLink,
            winnerClaimId: effectiveResult.winnerClaimId,
            winnerIssuer,
            winnerReasoning: effectiveResult.reasoning,
          });
        }
        winners++;
      }

      console.log(`[bounty-loop] bounty ${bounty.bountyId} resolved via ${method}, tx ${txHash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("vote in progress")) {
        console.log(`[bounty-loop] bounty ${bounty.bountyId}: ${msg}`);
      } else {
        errors++;
        console.error(`[bounty-loop] error on bounty ${bounty.bountyId}:`, msg);
        await logBountyLoopEvent(
          bounty,
          "bounty_loop_failed",
          "error",
          `bounty loop failed before resolution completed for bounty #${bounty.bountyId}`,
          {
            triggerText: `bounty #${bounty.bountyId} failed inside runBountyLoop`,
            errorMessage: msg,
          },
        );
        await updateBounty(bounty.bountyId, { status: "open" });
      }
    }
  }

  return { processed, winners, errors };
}
