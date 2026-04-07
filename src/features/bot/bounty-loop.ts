import "server-only";
import { getClaimsForBounty, resolveBountyWinner, getBountyDetails, getPublicClient, getWalletClient, POIDH_CONTRACTS, POIDH_CONTRACT, POIDH_ABI, resolvePoidhUrl } from "@/features/bot/poidh-contract";
import { pickWinner, type ClaimData, type EvaluationResult } from "@/features/bot/submission-evaluator";
import { updateBounty, getAllBounties } from "@/features/bot/bounty-store";
import { publishReply, publishCast } from "@/features/bot/cast-reply";
import { registerBountyThread } from "@/db/actions/bot-actions";

const BOT_SIGNER_UUID = process.env.BOT_SIGNER_UUID ?? "";

// Minimum time a bounty must be open before evaluation (24h)
const MIN_OPEN_DURATION_MS = 24 * 60 * 60 * 1000;
const MIN_CLAIMS_TO_EVALUATE = 1;

// ---------------------------------------------------------------------------
// Neynar: resolve ETH addresses → Farcaster @usernames
// Uses bulk-by-address endpoint — accepts up to 350 addresses at once.
// Returns a map of lowercase address → "@username" (or shortened address fallback).
// ---------------------------------------------------------------------------
async function resolveAddressesToUsernames(addresses: string[]): Promise<Map<string, string>> {
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

// ---------------------------------------------------------------------------
// Read contributor addresses from the poidh contract
// bountyContributions(bountyId) returns array of { contributor, amount }
// Falls back to the bounty issuer when no external contributions exist.
// ---------------------------------------------------------------------------
async function getContributors(bountyId: string, chain: string, issuerFallback?: string): Promise<string[]> {
  try {
    const publicClient = getPublicClient(chain);
    const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;

    // ABI for bountyContributions view — returns tuple[]
    const contributionsAbi = [{
      name: "bountyContributions",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "bountyId", type: "uint256" }],
      outputs: [{
        name: "",
        type: "tuple[]",
        components: [
          { name: "contributor", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      }],
    }] as const;

    const contributions = await publicClient.readContract({
      address: contractAddress,
      abi: contributionsAbi,
      functionName: "bountyContributions",
      args: [BigInt(bountyId)],
    }) as Array<{ contributor: string; amount: bigint }>;

    if (contributions.length > 0) {
      return contributions.map((c) => c.contributor);
    }
  } catch (err) {
    console.warn(`[bounty-loop] getContributors(${bountyId}) failed:`, err);
  }

  // No external contributions — use the issuer (bounty creator) as the sole funder
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

async function postReply(castHash: string, text: string): Promise<void> {
  if (!BOT_SIGNER_UUID || !castHash) return;
  const trimmed = stripMarkdown(text).slice(0, 400);
  try {
    await publishReply({ text: trimmed, parentHash: castHash, signerUuid: BOT_SIGNER_UUID });
  } catch (err) {
    console.error("[bounty-loop] failed to post reply:", err);
  }
}

async function postChannelWinnerAnnouncement(
  bountyName: string,
  claimCount: number,
  reasoning: string,
  bountyLink: string,
  method: "direct" | "vote_submitted" | "vote_resolved",
  winnerMention: string,          // "@username" or shortened address
  contributorMentions: string[],  // ["@alice", "@bob", ...]
  replyToHash?: string,           // set → reply in thread; unset → new top-level /poidh cast
  allResults?: EvaluationResult[], // for vote_submitted: include ranked scores in the cast
): Promise<string | null> {
  if (!BOT_SIGNER_UUID) return null;
  try {
    const contribLine = contributorMentions.length > 0
      ? ` funded by ${contributorMentions.join(", ")}.`
      : "";

    let text: string;
    if (method === "vote_submitted") {
      // Merged scores + nomination — reply in thread, no URL (parent cast already has the embed)
      const winnerClaimId = allResults?.find((r) => r.valid && r.score === Math.max(...allResults.filter((x) => x.valid).map((x) => x.score)))?.claimId ?? "";
      const scoresSummary = allResults ? buildRankedSummary(allResults, winnerClaimId) : "";
      const scoresLine = scoresSummary ? `scores: ${scoresSummary}. ` : "";
      text = `🗳️ "${bountyName}" — ${scoresLine}${winnerMention} nominated as winner. ${reasoning}${contribLine} contributors have 48h to vote yes/no. if rejected, the next best gets nominated.`;
    } else if (method === "vote_resolved") {
      // Final winner after community vote — new top-level cast in /poidh (needs URL)
      text = `✅ "${bountyName}" — ${winnerMention} wins! community vote passed.${contribLine} ${reasoning} ${bountyLink}`;
    } else {
      // Direct win (issuer-only bounty) — new top-level cast in /poidh (needs URL)
      text = `✅ "${bountyName}" — ${winnerMention} wins from ${claimCount} submission${claimCount !== 1 ? "s" : ""}! ${reasoning} ${bountyLink}`;
    }

    const cleaned = stripMarkdown(text).slice(0, 1024);
    let castHash: string | null | undefined;

    if (replyToHash) {
      // Post as a reply in the original bounty thread
      castHash = await publishReply({ text: cleaned, parentHash: replyToHash, signerUuid: BOT_SIGNER_UUID });
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
// e.g. "ranked 5 submissions: #356 (95) outdoor note ✅ | #354 (72) partial ✅ | #352 (30) ❌ ..."
function buildRankedSummary(allResults: EvaluationResult[], winnerClaimId: string): string {
  const sorted = [...allResults].sort((a, b) => b.score - a.score).slice(0, 5);
  const parts = sorted.map((r) => {
    const star = r.claimId === winnerClaimId ? " ⭐" : "";
    const valid = r.valid ? "✅" : "❌";
    return `#${r.claimId}(${r.score})${star} ${valid}`;
  });
  return parts.join(" | ");
}

// Resolve a pending- bounty ID from the stored txHash receipt logs
// Same approach as local poidh-sentinel: topics[1] of first matching contract log = raw bountyId
async function resolvePendingBountyId(txHash: string, chain: string): Promise<string | null> {
  try {
    const publicClient = getPublicClient(chain);
    const contractAddress = (POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT).toLowerCase();
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === contractAddress && log.topics.length >= 2 && log.topics[1]) {
        const rawId = BigInt(log.topics[1]).toString();
        console.log(`[bounty-loop] resolved pending ${txHash.slice(0,10)} → rawId=${rawId} → url=${resolvePoidhUrl(chain, rawId)}`);
        return rawId;
      }
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

export async function runBountyLoop(): Promise<{ processed: number; winners: number; errors: number }> {
  // getAllBounties includes closed ones — we need to check pending- across all statuses
  const allBounties = await getAllBounties();
  const activeBounties = allBounties.filter((b) => b.status === "open" || b.status === "evaluating");

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
          await postReply(getReplyTarget(bounty), `bounty id resolved — ${url}`);
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

      // --- For evaluating bounties: check if 48h vote window has passed ---
      if (bounty.status === "evaluating" && bounty.winnerClaimId) {
        const publicClient = getPublicClient(bountyChain);
        const contractAddress = POIDH_CONTRACTS[bountyChain] ?? POIDH_CONTRACT;

        try {
          const tracker = await publicClient.readContract({
            address: contractAddress,
            abi: POIDH_ABI,
            functionName: "bountyVotingTracker",
            args: [BigInt(bounty.bountyId)],
          }) as [bigint, bigint, bigint];

          const [yesVotes, noVotes, deadline] = tracker;
          const now = BigInt(Math.floor(Date.now() / 1000));

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
              if (bounty.winnerClaimId) {
                try {
                  const claims = await getClaimsForBounty(BigInt(bounty.bountyId), bountyChain);
                  winnerAddr = claims.find((c) => c.id.toString() === bounty.winnerClaimId)?.issuer;
                } catch { /* non-critical */ }
              }

              const resolvedContributors = await getContributors(bounty.bountyId, bountyChain, bountyIssuer);
              const allAddrs = [...new Set([...(winnerAddr ? [winnerAddr] : []), ...resolvedContributors])];
              const uMap = await resolveAddressesToUsernames(allAddrs);
              const wMention = winnerAddr ? (uMap.get(winnerAddr.toLowerCase()) ?? shortenAddress(winnerAddr)) : `claim #${bounty.winnerClaimId}`;
              const cMentions = resolvedContributors
                .map((a) => uMap.get(a.toLowerCase()) ?? shortenAddress(a))
                .filter((m, i, arr) => arr.indexOf(m) === i)
                .slice(0, 5);
              const contribLine = cMentions.length > 0 ? ` funded by ${cMentions.join(", ")}.` : "";

              // Short pointer reply in original thread
              await postReply(getReplyTarget(bounty), `🏆 vote closed — ${wMention} wins. see /poidh for the full announcement. ${bountyLink}`);

              // Full winner announcement as a NEW top-level cast in /poidh channel
              const resolvedCastHash = await publishCast({
                text: stripMarkdown(`✅ "${bounty.name}" — ${wMention} wins! community vote passed (${yesVotes} yes / ${noVotes} no).${contribLine} ${bounty.winnerReasoning ?? ""} ${bountyLink}`).slice(0, 1024),
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
                  winnerClaimId: bounty.winnerClaimId,
                  winnerIssuer: undefined,
                  winnerReasoning: bounty.winnerReasoning,
                });
              }
            } else {
              // Vote failed — find next best claim from stored results
              const allResults = bounty.allEvalResults ?? [];
              const nextBest = [...allResults]
                .sort((a, b) => b.score - a.score)
                .find((r) => r.valid && r.claimId !== bounty.winnerClaimId && r.score >= 60);

              if (nextBest) {
                await postReply(
                  getReplyTarget(bounty),
                  `vote rejected claim #${bounty.winnerClaimId} (${noVotes} no / ${yesVotes} yes). nominating next best: claim #${nextBest.claimId} (score ${nextBest.score}). ${nextBest.reasoning} ${bountyLink}`,
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
                  `vote rejected claim #${bounty.winnerClaimId}. no other qualifying submissions found — bounty remains open for new submissions. ${bountyLink}`,
                );
                await updateBounty(bounty.bountyId, { status: "open", winnerClaimId: undefined });
              }
            }
            continue; // handled — don't fall through to evaluation
          }
        } catch (voteErr) {
          const msg = voteErr instanceof Error ? voteErr.message : String(voteErr);
          console.warn(`[bounty-loop] vote tracker check failed for ${bounty.bountyId}: ${msg}`);
          // Non-fatal — fall through to normal evaluation
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

      // --- Skip if too new ---
      const age = Date.now() - new Date(bounty.createdAt).getTime();
      if (age < MIN_OPEN_DURATION_MS) continue;

      // --- Fetch claims ---
      const claims = await getClaimsForBounty(BigInt(bounty.bountyId), bountyChain);
      await updateBounty(bounty.bountyId, { claimCount: claims.length });

      if (claims.length < MIN_CLAIMS_TO_EVALUATE) continue;

      await updateBounty(bounty.bountyId, { status: "evaluating" });

      const claimData: ClaimData[] = claims.map((c) => ({
        id: c.id.toString(),
        issuer: c.issuer,
        name: c.name,
        description: c.description,
        uri: c.uri,
      }));

      const result = await pickWinner(bounty.name, bounty.description, claimData, details.createdAt);

      if (!result) {
        await postReply(
          getReplyTarget(bounty),
          `reviewed ${claims.length} submission${claims.length !== 1 ? "s" : ""}, none met the criteria yet. keep trying!`,
        );
        await updateBounty(bounty.bountyId, { status: "open" });
        continue;
      }

      // --- Resolve on-chain ---
      const { txHash, method } = await resolveBountyWinner(
        BigInt(bounty.bountyId),
        BigInt(result.winnerClaimId),
        bountyChain,
      );

      const bountyLink = resolvePoidhUrl(bountyChain, bounty.bountyId);

      // Find the winning claim's issuer address so the bot can explain "why @user won"
      const winnerClaim = claims.find((c) => c.id.toString() === result.winnerClaimId);
      const winnerIssuer = winnerClaim?.issuer ?? undefined;

      // Resolve addresses → Farcaster @mentions in parallel
      // Pass details.issuer as fallback so issuer-only bounties still show a funder mention
      const contributorAddresses = await getContributors(bounty.bountyId, bountyChain, details.issuer);
      const allAddresses = [...new Set([...(winnerIssuer ? [winnerIssuer] : []), ...contributorAddresses])];
      const usernameMap = await resolveAddressesToUsernames(allAddresses);
      const winnerMention = winnerIssuer ? (usernameMap.get(winnerIssuer.toLowerCase()) ?? shortenAddress(winnerIssuer)) : "unknown";
      const contributorMentions = contributorAddresses
        .map((a) => usernameMap.get(a.toLowerCase()) ?? shortenAddress(a))
        .filter((m, i, arr) => arr.indexOf(m) === i) // dedupe
        .slice(0, 5); // cap at 5 to avoid cast length blowout

      if (method === "vote_submitted") {
        // Store full ranked results so re-nomination can use them if vote fails
        await updateBounty(bounty.bountyId, {
          status: "evaluating",
          winnerClaimId: result.winnerClaimId,
          winnerTxHash: txHash,
          winnerReasoning: result.reasoning,
          allEvalResults: result.allResults,
        });

        // Single reply: scores + nomination merged into one cast
        const announcementHash = await postChannelWinnerAnnouncement(bounty.name, claims.length, result.reasoning, bountyLink, "vote_submitted", winnerMention, contributorMentions, getReplyTarget(bounty), result.allResults);
        if (announcementHash) {
          await updateBounty(bounty.bountyId, { announcementCastHash: announcementHash });
          await registerBountyThread({
            castHash: announcementHash,
            bountyId: bounty.bountyId,
            bountyName: bounty.name,
            bountyDescription: bounty.description,
            chain: bountyChain,
            poidhUrl: bountyLink,
            winnerClaimId: result.winnerClaimId,
            winnerIssuer,
            winnerReasoning: result.reasoning,
          });
        }
        winners++;

      } else if (method === "vote_resolved") {
        await updateBounty(bounty.bountyId, {
          status: "closed",
          winnerClaimId: result.winnerClaimId,
          winnerTxHash: txHash,
          winnerReasoning: result.reasoning,
        });

        // Short pointer reply in original thread
        await postReply(getReplyTarget(bounty), `🏆 vote closed — ${winnerMention} wins. see /poidh for the full announcement. ${bountyLink}`);

        // Full winner announcement as a NEW top-level cast in /poidh channel
        const announcementHash = await postChannelWinnerAnnouncement(bounty.name, claims.length, result.reasoning, bountyLink, "vote_resolved", winnerMention, contributorMentions);
        if (announcementHash) {
          await updateBounty(bounty.bountyId, { announcementCastHash: announcementHash });
          await registerBountyThread({
            castHash: announcementHash,
            bountyId: bounty.bountyId,
            bountyName: bounty.name,
            bountyDescription: bounty.description,
            chain: bountyChain,
            poidhUrl: bountyLink,
            winnerClaimId: result.winnerClaimId,
            winnerIssuer,
            winnerReasoning: result.reasoning,
          });
        }
        winners++;

      } else {
        // direct — no voting required (issuer-only bounty)
        await updateBounty(bounty.bountyId, {
          status: "closed",
          winnerClaimId: result.winnerClaimId,
          winnerTxHash: txHash,
          winnerReasoning: result.reasoning,
        });

        // Short pointer reply in original thread
        await postReply(getReplyTarget(bounty), `🏆 ${winnerMention} wins. see /poidh for the full announcement. ${bountyLink}`);

        // Full winner announcement as a NEW top-level cast in /poidh channel
        const announcementHash = await postChannelWinnerAnnouncement(bounty.name, claims.length, result.reasoning, bountyLink, "direct", winnerMention, contributorMentions);
        if (announcementHash) {
          await updateBounty(bounty.bountyId, { announcementCastHash: announcementHash });
          await registerBountyThread({
            castHash: announcementHash,
            bountyId: bounty.bountyId,
            bountyName: bounty.name,
            bountyDescription: bounty.description,
            chain: bountyChain,
            poidhUrl: bountyLink,
            winnerClaimId: result.winnerClaimId,
            winnerIssuer,
            winnerReasoning: result.reasoning,
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
        await updateBounty(bounty.bountyId, { status: "open" });
      }
    }
  }

  return { processed, winners, errors };
}
