import { NextRequest, NextResponse } from "next/server";
import { getClaimsForBounty, getBountyDetails, resolvePoidhUrl, POIDH_FRONTEND_OFFSETS, POIDH_CONTRACTS, POIDH_ABI, getPublicClient } from "@/features/bot/poidh-contract";
import { evaluateClaim, deterministicScore, type ClaimData } from "@/features/bot/submission-evaluator";
import { addActiveBounty } from "@/features/bot/bounty-store";
import { runBountyLoop } from "@/features/bot/bounty-loop";
import { fetchCastThread } from "@/features/bot/cast-reply";
import { detectAiImage } from "@/features/bot/agent";
import { checkAdminAuth } from "@/lib/admin-auth";

/**
 * Dry-run evaluation endpoint — no DB writes, no on-chain transactions, no casts posted.
 *
 * Evaluate a specific bounty:
 *   GET /api/bot/test-evaluate?bountyId=84&chain=arbitrum   (raw contract ID)
 *   GET /api/bot/test-evaluate?displayId=264&chain=arbitrum (poidh.xyz display ID, offset auto-reversed)
 *
 * Probe raw contract IDs to find the right one (when offset is uncertain):
 *   GET /api/bot/test-evaluate?probe=1&chain=arbitrum&around=264
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;

  const { searchParams } = req.nextUrl;
  const chain = (searchParams.get("chain") ?? "arbitrum").toLowerCase();

  // --- Probe mode: scan raw IDs around a given value to find valid ones ---
  if (searchParams.get("probe") === "1") {
    const around = parseInt(searchParams.get("around") ?? "84", 10);
    const rangeParam = parseInt(searchParams.get("range") ?? "10", 10);
    const results: Array<{ rawId: number; name?: string; error?: string }> = [];

    for (let rawId = Math.max(1, around - rangeParam); rawId <= around + rangeParam; rawId++) {
      try {
        const details = await getBountyDetails(BigInt(rawId), chain);
        results.push({ rawId, name: details.name || "(unnamed)" });
      } catch {
        results.push({ rawId, error: "not found / out of bounds" });
      }
    }

    return NextResponse.json({ probe: true, chain, around, results });
  }

  // --- Raw debug mode: show exactly what the contract returns for getClaimsByBountyId ---
  if (searchParams.get("debug") === "1") {
    const rawId = searchParams.get("bountyId") ?? "88";
    const publicClient = getPublicClient(chain);
    const contractAddress = POIDH_CONTRACTS[chain];
    const debugResults: Array<{ cursor: number; raw?: unknown; error?: string }> = [];

    for (const cursor of [0, 1, 10, 100]) {
      try {
        const result = await publicClient.readContract({
          address: contractAddress,
          abi: POIDH_ABI,
          functionName: "getClaimsByBountyId",
          args: [BigInt(rawId), BigInt(cursor)],
        });
        debugResults.push({ cursor, raw: JSON.parse(JSON.stringify(result, (_, v) => typeof v === "bigint" ? v.toString() : v)) });
      } catch (err) {
        debugResults.push({ cursor, error: err instanceof Error ? err.message.slice(0, 200) : String(err) });
      }
    }
    return NextResponse.json({ debug: true, bountyId: rawId, chain, results: debugResults });
  }

  // --- Vision debug: test vision AI on a single image URL ---
  if (searchParams.get("vision") === "1") {
    const imageUrl = searchParams.get("url") ?? "https://beige-impossible-dragon-883.mypinata.cloud/ipfs/QmPtSTCaNm6QUpHLWHQCQZKraDtzpvC4TfQAfHJcGghvDK";

    // Try to fetch image as base64
    let base64Result: { dataUrl: string; mimeType: string } | null = null;
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
      const mimeType = (imgRes.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
      const buffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      base64Result = { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
    } catch (err) {
      return NextResponse.json({ error: "failed to fetch image", detail: String(err) });
    }

    const results: Array<{ model: string; status?: number; content?: string; error?: string }> = [];

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      for (const gModel of ["meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"]) {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: gModel,
              messages: [{ role: "user", content: [
                { type: "text", text: "describe what text is written in this image. list every word you can read." },
                { type: "image_url", image_url: { url: base64Result.dataUrl } },
              ]}],
              max_tokens: 200,
            }),
          });
          const data = (await res.json()) as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
          results.push({
            model: `groq/${gModel}`,
            status: res.status,
            content: data.choices?.[0]?.message?.content ?? undefined,
            error: data.error?.message ?? (!res.ok ? `HTTP ${res.status}` : undefined),
          });
        } catch (err) {
          results.push({ model: `groq/${gModel}`, error: String(err) });
        }
      }
    } else {
      results.push({ model: "groq", error: "GROQ_API_KEY not set" });
    }

    return NextResponse.json({
      imageUrl,
      imageSizeKb: Math.round(base64Result.dataUrl.length / 1024),
      mimeType: base64Result.mimeType,
      groqKeySet: !!groqKey,
      visionResults: results,
    });
  }

  // --- AI image detection mode (dry-run, no casting) ---
  // GET /api/bot/test-evaluate?ai-detect=1&url=<image_url>
  // GET /api/bot/test-evaluate?ai-detect=1&url=<image_url>&thread=<cast_hash>  ← includes live community context
  if (searchParams.get("ai-detect") === "1") {
    const imageUrl = searchParams.get("url");
    if (!imageUrl) return NextResponse.json({ error: "url param required" }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });

    // Optionally load thread discussion to prime the prompt with community observations
    const threadHash = searchParams.get("thread");
    let threadDiscussion: Array<{ username: string; text: string }> | undefined;
    if (threadHash) {
      try {
        threadDiscussion = await fetchCastThread(threadHash);
      } catch {
        // non-critical — continue without context
      }
    }

    const raw = await detectAiImage(imageUrl, { threadDiscussion, debug: true });
    if (!raw) {
      return NextResponse.json({ error: "analysis failed — check OPENAI_API_KEY or image URL" }, { status: 500 });
    }

    // debug:true returns a JSON string — parse it back
    let debugResult: Record<string, unknown>;
    try {
      debugResult = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      debugResult = { botReply: raw };
    }

    return NextResponse.json({
      imageUrl,
      threadHash: threadHash ?? null,
      threadMessagesLoaded: threadDiscussion?.length ?? 0,
      model: "gpt-4o (two-pass)",
      ...debugResult,
    });
  }

  // --- Register + Announce mode: register bounty into DB and post announcement cast ---
  // GET /api/bot/test-evaluate?register=1&bountyId=88&chain=arbitrum
  if (searchParams.get("register") === "1") {
    const rawId = searchParams.get("bountyId");
    if (!rawId) return NextResponse.json({ error: "bountyId required" }, { status: 400 });

    const details = await getBountyDetails(BigInt(rawId), chain);
    const poidhUrl = resolvePoidhUrl(chain, rawId);
    const signerUuid = process.env.BOT_SIGNER_UUID ?? "";

    // Post announcement cast to /poidh channel
    let announcementCastHash: string | null = null;
    if (signerUuid) {
      try {
        const { publishCast } = await import("@/features/bot/cast-reply");
        const amountEth = (Number(details.amount) / 1e18).toFixed(6).replace(/\.?0+$/, "");
        const text = `🎯 new bounty: "${details.name}" — ${details.description.slice(0, 120)}${details.description.length > 120 ? "..." : ""} pot: ${amountEth} ETH. submit your proof at ${poidhUrl}`;
        announcementCastHash = await publishCast({
          text: text.slice(0, 1024),
          signerUuid,
          channelId: "poidh",
          embedUrl: poidhUrl,
        });
      } catch (err) {
        console.error("[test-evaluate] failed to post announcement:", err);
      }
    }

    // Register in DB — use announcement cast hash as the thread to reply into
    const castHash = announcementCastHash ?? "0x0000000000000000000000000000000000000000";
    await addActiveBounty({
      bountyId: rawId,
      txHash: "0x0000000000000000000000000000000000000000",
      name: details.name,
      description: details.description,
      amountEth: (Number(details.amount) / 1e18).toFixed(6).replace(/\.?0+$/, ""),
      chain,
      castHash,
      announcementCastHash: announcementCastHash ?? undefined,
      bountyType: "open",
      status: "open",
      claimCount: 0,
      createdAt: details.createdAt
        ? new Date(Number(details.createdAt) * 1000).toISOString()
        : new Date().toISOString(),
    });

    // Register the announcement thread so replies wake the bot up
    if (announcementCastHash) {
      const { registerBountyThread } = await import("@/db/actions/bot-actions");
      await registerBountyThread({
        castHash: announcementCastHash,
        bountyId: rawId,
        bountyName: details.name,
        bountyDescription: details.description,
        chain,
        poidhUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      registered: { bountyId: rawId, name: details.name, chain, poidhUrl },
      announcementCastHash,
      next: announcementCastHash
        ? `announcement posted! once submissions come in, call /api/bot/test-evaluate?run=1 to evaluate`
        : `registered in DB (no announcement — BOT_SIGNER_UUID not set). call ?run=1 to evaluate`,
    });
  }

  // --- Run mode: trigger the actual bounty loop (real casts + on-chain tx) ---
  // GET /api/bot/test-evaluate?run=1
  if (searchParams.get("run") === "1") {
    const result = await runBountyLoop();
    return NextResponse.json({ ok: true, loopResult: result });
  }

  // --- Post mode: post a custom reply under a cast ---
  // GET /api/bot/test-evaluate?post=1&parent=<hash>&text=<text>
  if (searchParams.get("post") === "1") {
    const parentHash = searchParams.get("parent");
    const text = searchParams.get("text");
    if (!parentHash || !text) return NextResponse.json({ error: "parent and text required" }, { status: 400 });
    const { publishReply } = await import("@/features/bot/cast-reply");
    const signerUuid = process.env.BOT_SIGNER_UUID ?? "";
    if (!signerUuid) return NextResponse.json({ error: "BOT_SIGNER_UUID not set" }, { status: 500 });
    const castHash = await publishReply({ text: text.slice(0, 1024), parentHash, signerUuid });
    return NextResponse.json({ ok: true, castHash });
  }

  // --- Reset mode: set a bounty back to open so it can be re-evaluated ---
  // GET /api/bot/test-evaluate?reset=1&bountyId=88
  if (searchParams.get("reset") === "1") {
    const rawId = searchParams.get("bountyId");
    if (!rawId) return NextResponse.json({ error: "bountyId required" }, { status: 400 });
    const { updateBounty } = await import("@/features/bot/bounty-store");
    await updateBounty(rawId, { status: "open", winnerClaimId: undefined });
    return NextResponse.json({ ok: true, reset: { bountyId: rawId, status: "open" } });
  }

  // --- Normal evaluation mode ---
  let rawBountyId: string | null = searchParams.get("bountyId");

  const displayId = searchParams.get("displayId");
  if (!rawBountyId && displayId) {
    const offset = POIDH_FRONTEND_OFFSETS[chain] ?? 0;
    rawBountyId = (BigInt(displayId) - BigInt(offset)).toString();
  }

  if (!rawBountyId) {
    return NextResponse.json(
      { error: "pass ?bountyId=<raw_id>&chain=<chain>  OR  ?displayId=<display_id>&chain=<chain>  OR  ?probe=1&chain=<chain>&around=<display_id>" },
      { status: 400 },
    );
  }

  const bountyIdBig = BigInt(rawBountyId);

  try {
    // --- Fetch bounty count to sanity check ---
    const publicClient = getPublicClient(chain);
    const contractAddress = POIDH_CONTRACTS[chain];
    let bountyCount: string | null = null;
    try {
      const count = await publicClient.readContract({
        address: contractAddress,
        abi: POIDH_ABI,
        functionName: "bountyCount",
        args: [],
      }) as bigint;
      bountyCount = count.toString();
    } catch {
      // non-critical
    }

    const details = await getBountyDetails(bountyIdBig, chain);
    const offset = POIDH_FRONTEND_OFFSETS[chain] ?? 0;
    const poidhUrl = resolvePoidhUrl(chain, rawBountyId);

    const createdAtDate = details.createdAt
      ? new Date(Number(details.createdAt) * 1000).toISOString().slice(0, 10)
      : null;

    const bountyInfo = {
      rawId: rawBountyId,
      displayId: String(bountyIdBig + BigInt(offset)),
      chain,
      name: details.name,
      description: details.description,
      issuer: details.issuer,
      amountEth: (Number(details.amount) / 1e18).toFixed(6).replace(/\.?0+$/, ""),
      claimer: details.claimer,
      createdAt: createdAtDate,
      poidhUrl,
      bountyCount,
    };

    // --- Fetch claims ---
    const claims = await getClaimsForBounty(bountyIdBig, chain);

    if (claims.length === 0) {
      return NextResponse.json({
        bounty: bountyInfo,
        claimCount: 0,
        evaluations: [],
        winner: null,
        note: "DRY RUN — no claims to evaluate yet",
      });
    }

    // --- Run full evaluation pipeline on each claim ---
    const evaluations = await Promise.all(
      claims.map(async (c) => {
        const claimData: ClaimData = {
          id: c.id.toString(),
          issuer: c.issuer,
          name: c.name,
          description: c.description,
          uri: c.uri,
        };

        const detScore = deterministicScore(details.name, details.description, claimData);

        if (detScore < 15) {
          return {
            claimId: claimData.id,
            issuer: claimData.issuer,
            name: claimData.name,
            description: claimData.description,
            uri: claimData.uri,
            deterministicScore: detScore,
            score: 0,
            valid: false,
            reasoning: "rejected by deterministic pre-filter",
            skippedFullEval: true,
          };
        }

        const result = await evaluateClaim(details.name, details.description, claimData, details.createdAt);
        return {
          claimId: claimData.id,
          issuer: claimData.issuer,
          name: claimData.name,
          description: claimData.description,
          uri: claimData.uri,
          deterministicScore: result.deterministicScore ?? detScore,
          score: result.score,
          valid: result.valid,
          reasoning: result.reasoning,
          skippedFullEval: false,
          openaiVisionCost: result.openaiVisionCost ?? null,
        };
      }),
    );

    const validResults = evaluations.filter((r) => r.valid && r.score >= 60);
    validResults.sort((a, b) => b.score - a.score);
    const winner = validResults[0] ?? null;

    // Aggregate OpenAI vision cost across all claims
    const totalOpenAICost = evaluations.reduce((sum, e) => sum + (e.openaiVisionCost?.estimatedCostUsd ?? 0), 0);
    const openAIClaimsCount = evaluations.filter((e) => e.openaiVisionCost).length;

    return NextResponse.json({
      bounty: bountyInfo,
      claimCount: claims.length,
      evaluations,
      winner: winner
        ? {
            claimId: winner.claimId,
            issuer: winner.issuer,
            name: winner.name,
            score: winner.score,
            reasoning: winner.reasoning,
          }
        : null,
      costSummary: {
        openaiVisionCalls: openAIClaimsCount,
        totalOpenAICostUsd: Math.round(totalOpenAICost * 100000) / 100000,
        note: openAIClaimsCount > 0
          ? `gpt-4o vision fired ${openAIClaimsCount}/${claims.length} claims (groq was rate-limited). total: $${totalOpenAICost.toFixed(4)}`
          : `groq vision handled all ${claims.length} claims — $0 openai cost`,
      },
      note: "DRY RUN — no on-chain tx, no DB writes, no casts posted",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[test-evaluate] error:", message);
    return NextResponse.json({ error: message, hint: "Try ?probe=1&chain=" + chain + "&around=264 to find valid raw IDs" }, { status: 500 });
  }
}
