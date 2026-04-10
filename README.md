# Poidh Sentinel

An autonomous bounty agent for [poidh (pics or it didn't happen)](https://poidh.xyz), deployed as a Farcaster mini app.

The bot lives in the `/poidh` channel on Farcaster. Mention `@poidh-sentinel` to suggest a bounty, fund it, and have the bot create it on-chain. A cron loop continuously evaluates submissions and picks winners automatically — no human in the loop after deployment.

Built for the [poidh SKILL challenge](https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md).

---

## What it does

1. **Suggests bounties** — responds to Farcaster mentions with creative, real-world bounty ideas (validated to reject digital-only tasks)
2. **Creates bounties on-chain** — deploys open bounties on Arbitrum, Base, or Degen Chain via the poidh smart contract
3. **Monitors submissions** — cron polls every minute for new claims on all active bounties
4. **Evaluates proof with AI** — deterministic pre-scorer + OCR + vision AI (Groq + OpenAI) + LLM final verdict
5. **Selects a winner autonomously** — scores all claims 0-100, picks highest scoring valid claim (score >= 60)
6. **Executes payout on-chain** — calls `acceptClaim` or `submitClaimForVote` → `resolveVote` with no human step
7. **Announces winners publicly** — posts to `/poidh` channel with score breakdown and reasoning
8. **Handles community voting** — re-nominates next-best claim if a community vote is rejected
9. **Detects AI-generated images** — mention `@poidh-sentinel` under any image cast asking "is this AI?" and the bot runs a two-pass forensic analysis using `gpt-4o`, primed with community discussion already in the thread

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Farcaster Network                                                           │
│  @mention / reply in bounty thread / reply to bot                           │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │  cast.created webhook
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  /api/webhook/farcaster                                                      │
│  • HMAC-SHA512 signature verification (NEYNAR_WEBHOOK_SECRET)               │
│  • Atomic dedup via processedCasts (INSERT ON CONFLICT DO NOTHING)           │
│  • Extract image URLs from cast embeds + parent cast embeds                  │
│  • Priority routing:                                                         │
│      1. Active conversation flow (multi-step bounty creation state)          │
│      2. Bounty thread reply or direct reply to bot                           │
│      3. Fresh @mention -> AI agent                                           │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  agent.ts  (LLM-powered intent router)                                      │
│  • Actions: suggest_bounty | create_bounty_onchain | wallet_address         │
│             | evaluate_submission | pick_winner | general_reply              │
│  • "is this AI?" + image present -> detectAiImage() (two-pass gpt-4o)       │
│  • In-context replies (bounty thread / reply-to-bot): skip detection        │
│  • suggest_bounty detection via LLM classifier (not keywords) — only fires  │
│    when someone explicitly asks to create a bounty, not in passing mentions  │
│  • Thread history fetched from Neynar conversation API                      │
│  • Live pot value fetched from contract for "how much is the pot?"          │
│  • LLM tier: Cerebras -> Groq -> OpenRouter free models                     │
│  • Markdown stripped before publishing (Farcaster doesn't render it)        │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  conversation-state.ts  (DB-backed state machine, 2h TTL)                   │
│  awaiting_confirmation -> awaiting_chain -> awaiting_bounty_type ->          │
│  awaiting_payment -> done                                                    │
│  awaiting_cancel_confirmation -> done                                        │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │
       ┌─────────┴──────────┐
       ▼                    ▼
┌─────────────────┐   ┌──────────────────────────────────────────────────────┐
│ deposit-        │   │  bounty-loop.ts  (cron, runs every minute)           │
│ checker.ts      │   │                                                      │
│                 │   │  • Resolve pending-{txHash} IDs from receipt logs    │
│ • Poll bot      │   │  • Check 48h vote deadline -> resolveVote()          │
│   wallet on     │   │  • Evaluate claims via submission-evaluator.ts       │
│   3 chains      │   │  • No ext. contributors: acceptClaim() -> thread     │
│ • Detect new    │   │  • Vote win: submitClaimForVote() -> thread reply    │
│   deposits      │   │  • Re-nominate next-best if vote rejected            │
│   (>=95%)       │   │  • Zero-submission nudge @creator at 72h / 7d       │
│ • Create open   │   │    (announcement thread only)                        │
│   bounty on-    │   │                                                      │
│   chain         │   └──────────────────────────────────────────────────────┘
│ • Reply in DM   │
│   thread with   │
│   poidh.xyz     │
│ • Announce in   │
│   /poidh        │
│ • Save          │
│   announcement  │
│   CastHash      │
└─────────────────┘
```

### Cron endpoint

`GET /api/cron/bounty-loop` runs `runBountyLoop()` and `checkDepositsAndCreateBounties()` in parallel every minute. Secured via `CRON_SECRET` bearer token (Vercel cron convention — optional but recommended). Admin endpoints (`state`, `test-evaluate`) are secured via `ADMIN_SECRET` — set both to the same value.

### Timing reference

| Event | Trigger | Target |
|-------|---------|--------|
| Bounty live reply | Deposit detected by cron | DM / conversation thread |
| Bounty announcement cast | Same cron tick as deposit | `/poidh` channel (new top-level) |
| First evaluation | 72h after `createdAt` | Announcement thread |
| Re-evaluation cooldown | 6h after "none qualified" reply | — |
| Vote window | 48h after `submitClaimForVote` tx | Contributors vote on poidh.xyz |
| Zero-submission nudge (1st) | 72h with zero claims | Announcement thread only |
| Zero-submission nudge (repeat) | Every 48h after 7 days open | Announcement thread only |
| Winner announcement (no external contributors) | After `acceptClaim` tx confirmed | Announcement thread reply only |
| Winner announcement (vote) | After `resolveVote` tx confirmed | New `/poidh` top-level cast |
| Vote pointer reply | Same cron tick as vote winner cast | Announcement thread |

---

## Cast flow

### Bounty lifecycle

```
── CREATION (DM or /poidh thread) ─────────────────────────────────────────

1. User mentions @poidh-sentinel
   -> bot suggests a bounty idea and asks for confirmation
   -> "how about finding a street performer in action — want me to post this on-chain?"

2. User confirms — any natural phrasing works ("yes", "sure!", "yes, let's do that on Arbitrum!", etc.)
   Intent is detected via LLM — handles any language, case, or wording.
   If the user mentions a chain in the same message, the bot skips straight to step 4.
   Otherwise it asks:
   -> "which chain — arbitrum, base, or degen? and how much do you want to put up?
      minimums: arbitrum/base = 0.001 ETH, degen = 1000 DEGEN."

3. User picks chain + amount (LLM-parsed — handles "the cheap one", "half an ETH", etc.)
   -> bot asks for bounty type:
   -> "got it — Arbitrum, 0.001 ETH. open or solo bounty?
      • open (default) — anyone can contribute funds, community votes on winner.
      • solo — only you decide the winner directly.
      reply 'open' or 'solo' (or just continue and i'll default to open)."

4. User replies with bounty type — or says nothing clear (defaults to open)
   -> bot replies with exact deposit instructions:
   -> "open bounty — send exactly 0.001025 ETH to 0x5186...7199 on Arbitrum —
      0.001 bounty + 0.000025 platform fee (2.5%). your wallet handles gas.
      once i see the deposit i'll create the bounty — submissions stay open
      for 72h before i pick a winner."
      (unique amount e.g. 0.001025 to avoid collision with other pending payments)

5. deposit-checker detects payment on-chain (cron, every minute)
   -> calls createOpenBounty() on poidh contract
   -> replies in DM/conversation thread with the bounty link:
      "bounty is live — poidh.xyz/arbitrum/bounty/268"
   -> posts announcement cast to /poidh channel:
      open: "new open bounty: "[name]" ... winner chosen by vote."
      solo: "new solo bounty: "[name]" ... winner chosen directly by the creator."
   -> registers announcementCastHash in DB + bounty_threads table
      (all future bot activity targets the announcement thread, not the DM)

   NOTE: the DM thread stays conversational — if the user replies "thanks!" the bot
   responds naturally. but the bot never initiates back in the DM thread after creation.
   all proactive activity goes to the announcement thread.

── WAITING FOR SUBMISSIONS ─────────────────────────────────────────────────

6. Bounty open for 72h minimum (MIN_OPEN_DURATION_HOURS, env-overridable)

   6a. Zero submissions at 72h (first cron check after window):
       -> bot posts in announcement thread only (never DM thread):
          "@kenny 72h in — no submissions yet. bounty stays open until someone
           submits proof or you cancel it. to cancel and get your deposit back,
           reply 'cancel bounty' in this thread."
          [embed: poidh.xyz/arbitrum/bounty/268]
       (@kenny = creator's @username resolved from creatorFid via Neynar)

   6b. Still zero submissions after 7 days (NO_SUBMISSION_NUDGE_HOURS):
       -> bot posts every 48h in announcement thread:
          "@kenny 7 days open, still no submissions. share the link to attract
           submitters — or reply 'cancel bounty' in this thread to cancel and
           get your deposit back."
          [embed: poidh.xyz/arbitrum/bounty/268]

   Bounty stays open indefinitely — does NOT auto-close or auto-refund.
   Creator can cancel at any time for a full deposit refund.

── EVALUATION ──────────────────────────────────────────────────────────────

7. bounty-loop picks up open bounty with >= 1 claim after 72h window
   -> runs full evaluation pipeline (deterministic → OCR → vision AI → LLM)
   -> if no claim scores >= 60 (none qualified):
      -> posts in announcement thread:
         "reviewed 3 submissions, none qualified yet:
          claim #362 (40/100): outdoor photo but missing username and poidh text
          claim #353 (20/100): indoor photo, date visible but off-topic
          fix the issues above and resubmit — i'll re-evaluate in 6h."
         [embed: poidh.xyz/arbitrum/bounty/268]
      -> sets 6h cooldown before re-evaluating (EVAL_COOLDOWN_MS)

── WINNER RESOLUTION ───────────────────────────────────────────────────────

8a. Open bounty with no external contributors (everHadExternalContributor = false):
    -> acceptClaim() — immediate on-chain payout
    -> posts reply in ANNOUNCEMENT thread (no /poidh channel cast):
       "🏆 @winner wins 0.001 ETH! [reasoning]"
       [embed: poidh.xyz/arbitrum/bounty/268]

8b. Open bounty with external contributors (everHadExternalContributor = true):
    -> submitClaimForVote() — starts 48h community vote
    -> posts reply in ANNOUNCEMENT thread:
       "🗳️ "[name]" — @winner nominated as winner. [reasoning] thanks @kenny, @mr94t3z!
        contributors have 48h to vote yes/no. if rejected, next best gets nominated.
        results: #356 @winner (70)⭐ ✅ | #362 @user2 (40) ❌ — missing poidh text | ..."
       [embed: poidh.xyz/arbitrum/bounty/268]

    -> after 48h: resolveVote()

    YES (yesVotes > noVotes, abstentions don't count):
       -> pointer reply in announcement thread:
          "🏆 vote closed — @winner wins. see /poidh for the full announcement."
          [embed: poidh.xyz/arbitrum/bounty/268]
       -> NEW top-level cast in /poidh channel:
          "✅ "[name]" — @winner wins! community vote passed. thanks @kenny, @mr94t3z! [reasoning]"
          [embed: poidh.xyz/arbitrum/bounty/268]

    NO (vote rejected):
       -> if next-best claim exists (score >= 60):
          "vote rejected claim #356. nominating next best: claim #362 (score 60). [reasoning]"
          [embed: poidh.xyz/arbitrum/bounty/268]
          -> submitClaimForVote() for runner-up, 48h vote restarts
       -> if no next-best:
          "vote rejected claim #356. no other qualifying submissions found —
           bounty remains open for new submissions."
          [embed: poidh.xyz/arbitrum/bounty/268]

── THREAD REPLIES (announcement thread) ────────────────────────────────────

9. Anyone replies in the announcement thread:
   -> bot responds with full context:
      - if replier is a submitter: addresses their specific claim by score + reasoning
        ("your claim #362 scored 40 — outdoor photo but missing username and poidh text")
      - if replier asks about another user: "@user2's claim #362 scored 40 — ..."
      - if replier asks about a specific claim: "#362 scored 40 — ..."
      - all claim scores + reasons always available to the bot (stored in allEvalResults)
```

### Cancel flow

```
User replies in /poidh announcement thread: "cancel bounty" (no @mention required)
  |
  v
webhook detects: inBountyThread + isCancelRequest()
  -> resolves creator's refund address via Neynar upfront (blocks if unresolvable)
  -> saves awaiting_cancel_confirmation conversation state
  -> bot replies: "you want to cancel "[name]"? refund will go to 0xabc...def.
                  reply yes to confirm or no to keep it open."

User confirms — any natural phrasing ("yes", "yes cancel", "go ahead", etc.)
Intent detected via LLM.
  |
  v
handleConversationFlow() (awaiting_cancel_confirmation step)
  -> calls cancelBounty(bountyId, chain, preResolvedAddress) in poidh-contract.ts:

  KEY INSIGHT: the original depositor (bounty creator) sent ETH directly to the bot
  wallet — the poidh contract has no record of them. refund is a plain native token transfer (ETH on arbitrum/base, DEGEN on degen chain)
  from the bot wallet, NOT a poidh contract call. withdrawTo() only drains
  pendingWithdrawals[msg.sender] (the bot wallet's own balance) — it cannot send
  to an arbitrary third party on behalf of the creator.

  REFUND AMOUNT = parseEther(bountyRecord.amountEth) from DB
    → exact bounty reward the creator put up (no 2.5% fee)
    → pendingWithdrawals delta (before/after cancel) logged as sanity check
    → DB value is definitive — immune to contract state edge cases

  SOLO BOUNTY path (3 txs):
       1. cancelSoloBounty(bountyId)
          → credits pendingWithdrawals[botWallet] with bountyAmount
       2. withdraw() → ETH back to bot wallet
       3. sendTransaction(to=creatorAddress, value=amountEth from DB)
          → plain native token transfer: bot wallet → creator's custody/verified address
          (fallback: token stays in bot wallet if Neynar can't resolve creator's address)

  OPEN BOUNTY path (4 txs):
       1. cancelOpenBounty(bountyId)
          → marks bounty cancelled; does NOT auto-refund anyone
       2. claimRefundFromCancelledOpenBounty(bountyId)
          → bot claims its own issuer contribution into pendingWithdrawals[botWallet]
       3. withdraw() → native token back to bot wallet
       4. sendTransaction(to=creatorAddress, value=amountEth from DB)
          → plain native token transfer: bot wallet → creator's custody/verified address
       ⚠️  other contributors must call claimRefundFromCancelledOpenBounty themselves
           on poidh.xyz — requires their own msg.sender (bot cannot do it for them)
       → bot resolves each contributor address → @username via Neynar bulk-by-address
       → posts a follow-up reply tagging each contributor:
         "heads up @alice @bob — this bounty was cancelled. go to poidh.xyz to claim
          your refund via 'claim refund from cancelled bounty'."

  OLD BOUNTIES (creatorFid = null):
       → cancel blocked: "DM @{BOT_OWNER_HANDLE} to arrange manually"
       → evaluation + winner selection still runs fully autonomous

  -> updateBounty(bountyId, { status: "closed", winnerReasoning: "bounty cancelled by @{authorUsername}" })
  -> bot replies: '"[name]" cancelled — your deposit refunded to 0x1a2b...5f6e. pinging contributors to claim their refunds.'
  -> clears conversation state

Edge cases:
  - vote in progress: contract reverts → "can't cancel — a vote is in progress. wait for it to resolve first."
  - user says "no": "ok, bounty stays open. good luck!"
  - FID address resolution fails: ETH withdrawn to bot wallet (user contacts support)
  - pendingWithdrawals = 0 after cancel: cancel tx still confirmed, no withdraw sent
  - cancel tx fails: error posted in thread, state cleared
```

The cancel instructions are included in every bounty announcement cast posted to `/poidh`:
`"to cancel this bounty, reply 'cancel bounty' in this thread — no @mention required."`

### AI image detection flow

```
User tags @poidh-sentinel under a cast with an image:
  "@poidh-sentinel is this AI?" / "is this ai generated?" / "fake?" / etc.
       |
       v
webhook extracts image URLs:
  - from the triggering cast's embeds (zero extra API calls — in the payload)
  - from the parent cast's embeds (combined with the isReplyToBot check)
       |
       v
runAgent() detects isAskingAboutAI() + imageUrls present
  -> fetchCastThread() loads the full thread discussion
  -> detectAiImage(imageUrl, { threadDiscussion }) runs two passes in parallel:
       Pass 1: gpt-4o, temperature 0.2 (deterministic)
       Pass 2: gpt-4o, temperature 0.8 (exploratory)
  -> community observations in the thread prime the prompt
     (shadow comments, background flags, etc. improve accuracy significantly)
  -> most cautious verdict wins: AI > UNCERTAIN > REAL
  -> if passes disagree, confidence capped at 65%
  -> single clean sentence reply, all lowercase, no cut-off
       |
       v
example reply:
  "🤔 hard to tell (65% confident). shadow of the person is not parallel
   to other shadows, suggesting possible compositing."
```

### Reply targeting

All bot replies inside a bounty thread use `getReplyTarget(bounty)`:
- Prefers `announcementCastHash` (the /poidh channel cast)
- Falls back to `castHash` (original conversation thread cast)

This ensures all bot replies are visible inside the /poidh channel post, not just in the user's DM thread.

---

## Smart contracts

| Chain     | Contract address                             | Min bounty   |
|-----------|----------------------------------------------|--------------|
| Arbitrum  | `0x5555Fa783936C260f77385b4E153B9725feF1719` | 0.001 ETH    |
| Base      | `0x5555Fa783936C260f77385b4E153B9725feF1719` | 0.001 ETH    |
| Degen     | `0x18E5585ca7cE31b90Bc8BB7aAf84152857cE243f` | 1000 DEGEN   |

**poidh.xyz frontend ID offset** — poidh.xyz displays bounty IDs with a per-chain offset on top of the raw contract ID:

| Chain    | Offset |
|----------|--------|
| Arbitrum | 180    |
| Base     | 986    |
| Degen    | 1197   |

Key contract functions used:

| Function | Purpose |
|----------|---------|
| `createOpenBounty(name, description)` | Creates a crowdfundable open bounty (creator added as first participant) — default |
| `createSoloBounty(name, description)` | Creates a solo bounty (issuer decides winner directly, no community vote) |
| `bounties(id)` | Fetches bounty details (issuer, amount, claimer, createdAt) |
| `getClaimsByBountyId(bountyId, cursor)` | Paginates claims (10 per page, zero-padded) |
| `participants(bountyId, index)` | Returns participant address at index; reverts if out-of-bounds |
| `acceptClaim(bountyId, claimId)` | Direct payout — used when `everHadExternalContributor` is false (no vote needed) |
| `submitClaimForVote(bountyId, claimId)` | Nominates winner, starts 48h vote window — open bounties only |
| `voteClaim(bountyId, vote)` | Contributors vote yes/no weighted by their ETH contribution |
| `bountyVotingTracker(bountyId)` | Returns yesVotes, noVotes, deadline |
| `bountyCurrentVotingClaim(bountyId)` | Returns currently nominated claimId (0 if no vote active) |
| `resolveVote(bountyId)` | Finalizes vote after deadline; accepts if yes > 50% weighted |
| `cancelSoloBounty(bountyId)` | Issuer cancels solo bounty — credits `pendingWithdrawals[issuer]` |
| `cancelOpenBounty(bountyId)` | Issuer cancels open bounty — credits `pendingWithdrawals` for all participants |
| `pendingWithdrawals(address)` | Returns claimable ETH balance (credited by acceptClaim/resolveVote/cancelSoloBounty) |
| `withdraw()` | Pulls `pendingWithdrawals[msg.sender]` to caller |
| `withdrawTo(address)` | Pulls `pendingWithdrawals[msg.sender]` to any address — useful for contracts that can't receive ETH directly |
| `withdrawFromOpenBounty(bountyId)` | Contributor exits a live open bounty and reclaims their contribution |
| `claimRefundFromCancelledOpenBounty(bountyId)` | Each participant claims their refund after `cancelOpenBounty` — NOT automatic |

**Bounty type** — set by the creator during the conversation flow:
- `open` (default) → `createOpenBounty` — bot evaluates submissions and picks winner autonomously via `submitClaimForVote` / `resolveVote` (or `acceptClaim` if no external contributors joined)
- `solo` → `createSoloBounty` — bot creates the bounty and steps back; creator picks the winner manually on poidh.xyz. Bot never evaluates or calls any winner resolution function.

**Winner resolution path for open bounties** — depends on `everHadExternalContributor(bountyId)`:
- returns `false` → creator is the only participant → `acceptClaim` directly (immediate payout, no vote)
- returns `true` → has/had external contributors → `submitClaimForVote` / `resolveVote` (48h community vote)

This works identically on arbitrum, base, and degen (selector `0xb04f5ebd` present in all three contracts). The `participants(uint256,uint256)` function (selector `0x81fb1fb4`) is used separately when collecting contributor addresses to notify after a cancel.

Winner resolution flow:

```
bountyType == "solo"  -> bot skips evaluation entirely. creator picks winner on poidh.xyz.

bountyType == "open"  -> bot evaluates + resolves autonomously:

everHadExternalContributor(bountyId)
|
+-- false (creator only)  -> acceptClaim(bountyId, claimId)  — immediate payout, no vote
|
+-- true (has contributors) -> bountyCurrentVotingClaim(bountyId)?
                          |
                          +-- 0 -> submitClaimForVote()       — starts 48h vote
                          |
                          +-- >0 -> bountyVotingTracker deadline passed?
                                      |
                                      +-- YES -> resolveVote()
                                      |           yes > 50% weighted -> winner paid
                                      |           rejected -> nominate next-best (score >= 60)
                                      |
                                      +-- NO  -> "vote in progress, Xh remaining" (skip)
```

**New claims during a vote** — `createClaim` has no voting gate; submissions come in freely during the 48h window. They are picked up in the next evaluation cycle after the current vote resolves.

---

## Submission evaluator

`submission-evaluator.ts` runs a three-stage pipeline per claim:

### Stage 1 — Deterministic pre-scorer (no API cost)

Token overlap (Jaccard-style) between bounty text and claim text, with penalties:
- Spam signals ("test submission", "placeholder", etc.) → -40 pts each
- Digital-only signals ("nft link", "screenshot of", etc.) → -25 pts each
- Suspiciously short description (< 10 chars) → -20 pts

Claims scoring < 15 are rejected immediately without any API calls.

### Stage 2 — Proof resolution

Fetches the claim's `tokenURI` from the poidh NFT contract, then:

1. **OCR** via [ocr.space](https://ocr.space) (free; `OCR_SPACE_API_KEY` optional, defaults to `helloworld` public key) — always runs, extracts text from images
2. **Vision AI** (only if deterministic score >= 40, `VISION_SCORE_GATE`):
   - **Tier 1 — Groq**: `llama-4-scout-17b-16e-instruct` → `llama-3.2-90b-vision-preview` → `llama-3.2-11b-vision-preview`
   - **Tier 2 — OpenAI**: `gpt-4o` (best vision quality, kicks in when Groq is rate-limited)
   - **Tier 3 — OpenRouter**: `qwen/qwen3.6-plus:free` → `google/gemini-3.1-flash-lite-preview`
   - Images fetched as base64 data URIs (avoids vision model URL-access issues)
   - If OCR text >= 30 chars (`OCR_SUFFICIENT_CHARS`), OCR is appended alongside vision result

Vision is skipped for low-scoring claims to conserve Groq quota. OCR always runs as it's free.

**AI image detection during evaluation** — `detectAiImage()` runs in parallel with vision for every image that passes the vision score gate. If the image is flagged as AI-generated or uncertain, the result is appended to the proof summary and the LLM evaluator is instructed to penalize accordingly:
- `AI DETECTION WARNING` (likely AI) → `valid=false`, score capped at 20
- `AI DETECTION: authenticity uncertain` → score reduced by 20-30 points
- `REAL` verdict → no note added, no effect on score

This runs in parallel with vision so it adds zero extra latency to evaluation. Requires `OPENAI_API_KEY` and `AI_IMAGE_DETECTION` not set to `false`.

If all vision tiers and OCR fail, the image URL is included for LLM context.

### Stage 3 — LLM final verdict

Structured JSON response: `{ valid: bool, score: 0-100, reasoning: string }`.

LLM priority: Groq `llama-3.3-70b-versatile` → Cerebras → OpenRouter free models.

Reasoning must be specific and concrete (e.g. "outdoor photo shows '5th April 2026 Dan Xv POIDH' on a note") — vague reasoning like "meets requirements" is explicitly banned by the prompt.

**Date window** — the prompt tells the LLM the bounty creation date and deadline (creation + 72h). Any date within that window is accepted for date-based bounties. Submissions made on April 6th for a bounty created April 5th are valid; the evaluator will not reject them for "wrong date".

**Vision prompt** — all vision tiers (Groq, OpenAI, OpenRouter) receive the full bounty description and are instructed to explicitly check every stated requirement, report all visible text, and note what is missing. This catches partial submissions (e.g. note has date but no username).

Falls back to the deterministic score if all LLMs are exhausted (`fallbackValid = detScore >= 60`). No silent drops.

**Duplicate detection** — before evaluation, `pickWinner` runs two dedup passes:
1. **URI dedup** — exact same proof URI submitted by multiple claimants → later submissions disqualified immediately (no API cost)
2. **Perceptual dedup (dHash)** — different IPFS URIs but visually identical images → computed via 8x8 difference hash using `sharp`, Hamming distance ≤ 10/64 bits flags as duplicate → earlier claim wins, later disqualified. Catches re-uploads, minor crops, and compression artifacts without false positives.

**Winner** = highest-scoring claim with `valid: true` and `score >= 60`.

---

## AI image detection

`detectAiImage()` in `agent.ts` analyzes a single image URL for AI generation artifacts using `gpt-4o`.

### How it works

1. Fetches the image as base64 (avoids URL-access issues with vision models)
2. Builds a context section from thread discussion — other people's observations (shadow comments, background flags) are filtered and injected into the prompt, dramatically improving accuracy vs. a cold prompt
3. Runs **two passes in parallel** at different temperatures (0.2 deterministic + 0.8 exploratory)
4. Most cautious verdict wins: `AI > UNCERTAIN > REAL`
5. If passes disagree (one says REAL, the other doesn't), confidence is capped at 65%
6. Returns a single lowercase sentence with emoji, verdict, confidence, and one specific observation

### Why two passes

`gpt-4o` is nondeterministic — a cold prompt on an ambiguous image can flip between REAL and UNCERTAIN run-to-run. Running two passes and taking the most cautious result eliminates false-confident REAL verdicts on borderline cases.

### Why community context matters

Without thread context, `gpt-4o` tends to default to REAL on ambiguous images. With thread observations primed in the prompt (e.g. "@downshift.eth: shadows should be parallel"), the model correctly focuses on the flagged artifacts and returns UNCERTAIN or AI instead.

### Cost

~$0.007 per call (two `gpt-4o` passes, ~2,500 tokens total). OpenAI caches the image between passes so the second call costs roughly half of the first.

Requires `OPENAI_API_KEY`. If unset, AI detection is skipped and the bot falls through to its normal LLM conversation handler.

---

## LLM stack

All LLM usage targets free-tier endpoints where possible.

### Agent replies (`agent.ts`)

| Tier | Provider   | Model(s)                                                | Notes                        |
|------|------------|---------------------------------------------------------|------------------------------|
| 1    | Cerebras   | `llama-3.3-70b`, `llama3.1-8b`                          | ~2000 tok/s, primary         |
| 2    | Groq       | `llama-3.3-70b-versatile`                               | Fallback when Cerebras fails |
| 3    | OpenRouter | `llama-3.3-70b-instruct:free`, `gpt-oss-120b:free`, ... | Last resort                  |

### AI image detection (`agent.ts` — `detectAiImage`)

| Pass | Provider | Model    | Temperature | Notes                        |
|------|----------|----------|-------------|------------------------------|
| 1    | OpenAI   | `gpt-4o` | 0.2         | Deterministic, primary       |
| 2    | OpenAI   | `gpt-4o` | 0.8         | Exploratory, runs in parallel |

### Claim evaluation (`submission-evaluator.ts`)

Text LLM (final verdict — `valid`, `score`, `reasoning`):

| Tier | Provider   | Model(s)                  | Notes                                              |
|------|------------|---------------------------|----------------------------------------------------|
| 1    | Groq       | `llama-3.3-70b-versatile` | Primary — uses `response_format: json_object`      |
| 2    | Cerebras   | `llama-3.3-70b`           | Fallback — no JSON mode, regex parses output       |
| 3    | OpenRouter | free models               | Last resort                                        |

> Groq leads here (not Cerebras) because it supports `response_format: json_object`, which guarantees valid JSON output for `valid/score/reasoning` parsing. Cerebras is faster but lacks JSON mode, so it's a fallback.

### Vision — claim proof analysis (`submission-evaluator.ts`)

| Tier | Provider   | Model(s)                                                              | Cost        |
|------|------------|-----------------------------------------------------------------------|-------------|
| 1    | Groq       | `llama-4-scout-17b-16e-instruct` → `llama-3.2-90b` → `llama-3.2-11b` | Free        |
| 2    | OpenAI     | `gpt-4o`                                                              | ~$0.01/img  |
| 3    | OpenRouter | `qwen/qwen3.6-plus:free` → `google/gemini-3.1-flash-lite-preview`    | Free        |

**Groq quota note**: Groq vision and text calls share the same 500k TPD limit. Vision is skipped for claims with deterministic score < 40 to conserve quota. If Groq is rate-limited, OpenAI `gpt-4o` picks it up automatically.

---

## Database schema

PostgreSQL via Drizzle ORM (`src/db/schema.ts`):

| Table                | Purpose                                                          |
|----------------------|------------------------------------------------------------------|
| `kv`                 | Generic key-value store (built-in, do not modify)                |
| `conversation_state` | Multi-step bounty creation state per thread (2h TTL)             |
| `pending_payments`   | Threads awaiting a deposit before bounty creation                |
| `active_bounties`    | All bounties created by the bot, with evaluation results         |
| `bounty_threads`     | Maps announcement cast hashes to bounties for in-thread replies  |
| `bot_log`            | Activity log — paginated in dashboard (10 initial, +20 per page) |
| `processed_casts`    | Cast dedup — atomic insert prevents duplicate replies            |
| `wallet_balances`    | Last known on-chain balance per chain for deposit detection      |

`allEvalResults` (JSONB on `active_bounties`) stores the full ranked claim scores from each evaluation pass. Each entry includes `claimId`, `score`, `valid`, `reasoning`, `issuer` (EVM address), and `issuerUsername` (resolved Farcaster handle). Used for: re-nominating the next-best claim if a community vote is rejected, building the per-claim score summary in winner announcements, and enabling the bot to identify and address individual submitters by name in follow-up thread replies.

---

## API routes

| Method | Path                              | Auth           | Description                                       |
|--------|-----------------------------------|----------------|---------------------------------------------------|
| POST   | `/api/webhook/farcaster`          | HMAC signature | Neynar webhook receiver                           |
| GET    | `/api/cron/bounty-loop`           | `CRON_SECRET`  | Cron: evaluate bounties + check deposits (Vercel auto-calls every minute) |
| GET    | `/api/bot/bounties`               | none           | Dashboard: all bounties with live pot values (public — powers UI) |
| GET    | `/api/bot/logs`                   | none           | Recent activity log + stats (public — powers dashboard) |
| GET    | `/api/bot/status`                 | none           | Bot online / config status (public — powers dashboard) |
| GET    | `/api/bot/state`                  | `ADMIN_SECRET` | Active conversations + pending payments           |
| GET    | `/api/bot/test-evaluate`          | `ADMIN_SECRET` | Dry-run evaluation and bot operations (no DB writes, no on-chain tx, no casts) |

### Test/debug endpoint params (`/api/bot/test-evaluate`)

| Param | Example | Description |
|-------|---------|-------------|
| `bountyId=<id>&chain=<chain>` | `?bountyId=88&chain=arbitrum` | Dry-run evaluate a bounty by raw contract ID |
| `displayId=<id>&chain=<chain>` | `?displayId=268&chain=arbitrum` | Same but using poidh.xyz display ID (offset auto-applied) |
| `probe=1&chain=<chain>&around=<id>` | `?probe=1&chain=arbitrum&around=264` | Scan raw IDs around a value to find valid ones |
| `debug=1&bountyId=<id>&chain=<chain>` | `?debug=1&bountyId=88` | Show raw `getClaimsByBountyId` contract output |
| `vision=1&url=<image_url>` | `?vision=1&url=https://...` | Test Groq vision models on a single image URL |
| `ai-detect=1&url=<image_url>` | `?ai-detect=1&url=https://...` | Dry-run AI image detection (gpt-4o two-pass, no cast posted) |
| `ai-detect=1&url=<url>&thread=<hash>` | `?ai-detect=1&url=https://...&thread=0xabc` | Same but loads thread discussion for context |
| `register=1&bountyId=<id>&chain=<chain>` | `?register=1&bountyId=88&chain=arbitrum` | Register bounty in DB + post /poidh announcement cast |
| `run=1` | `?run=1` | Trigger real bounty loop (real casts + on-chain tx) |
| `reset=1&bountyId=<id>` | `?reset=1&bountyId=88` | Set bounty status back to open for re-evaluation |
| `post=1&parent=<hash>&text=<text>` | `?post=1&parent=0xabc&text=hello` | Post a custom reply under a cast hash |

`ai-detect` returns full debug info including per-pass verdicts, token counts, and estimated cost:

```json
{
  "botReply": "🤔 hard to tell (65% confident). shadow of the person is not parallel to other shadows.",
  "pass1": { "verdict": "UNCERTAIN", "confidence": 65, "reasons": [...], "usage": { "total_tokens": 1297 } },
  "pass2": { "verdict": "UNCERTAIN", "confidence": 60, "reasons": [...], "usage": { "total_tokens": 1279 } },
  "chosen": "UNCERTAIN",
  "disagreement": false,
  "finalConfidence": 65,
  "totalTokens": 2576,
  "promptTokens": 2448,
  "completionTokens": 128,
  "estimatedCostUsd": 0.0074
}
```

All modes except `run=1`, `register=1`, and `post=1` are dry-runs — no DB writes, no on-chain transactions, no casts posted.

---

## Environment variables

| Variable                 | Required  | Description                                                                        |
|--------------------------|-----------|------------------------------------------------------------------------------------|
| `DATABASE_URL`           | Yes       | PostgreSQL connection string                                                       |
| `NEYNAR_API_KEY`         | Yes       | Neynar API key — cast publishing and Farcaster user lookups                        |
| `BOT_SIGNER_UUID`        | Yes       | Neynar managed signer UUID for the bot's Farcaster account                         |
| `BOT_WALLET_PRIVATE_KEY` | Yes       | Private key of the bot's EVM wallet — hex, with or without `0x` prefix. The public address is derived automatically. |
| `NEYNAR_WEBHOOK_SECRET`  | Rec.      | HMAC-SHA512 secret for Neynar webhook signature verification                       |
| `GROQ_API_KEY`           | Rec.      | Groq API key — tier 1 LLM (claim eval) + vision (free tier, 500k TPD)             |
| `OPENAI_API_KEY`         | Optional  | OpenAI API key — AI image detection (`gpt-4o`, ~$0.007/call) + vision fallback    |
| `AI_IMAGE_DETECTION`     | Optional  | Set to `false` to disable AI image detection entirely (even if `OPENAI_API_KEY` is set) |
| `CEREBRAS_API_KEY`       | Optional  | Cerebras API key — tier 1 agent replies, tier 2 eval (~2000 tok/s)                 |
| `OPENROUTER_API_KEY`     | Optional  | OpenRouter API key — tier 3 LLM and vision fallback (free models)                  |
| `OCR_SPACE_API_KEY`      | Optional  | ocr.space key — defaults to the public `helloworld` key if unset                   |
| `ARBITRUM_RPC_URL`       | Optional  | Custom Arbitrum RPC — defaults to `https://arb1.arbitrum.io/rpc`                   |
| `BASE_RPC_URL`           | Optional  | Custom Base RPC — defaults to `https://mainnet.base.org`                           |
| `DEGEN_RPC_URL`          | Optional  | Custom Degen Chain RPC — defaults to `https://rpc.degen.tips`                      |
| `BOT_FID`                | Required  | Farcaster FID of the bot account (e.g. `3273077`)                                  |
| `BOT_USERNAME`           | Required  | Farcaster username of the bot (e.g. `poidh-sentinel`) — used in casts, system prompt, and UI |
| `BOT_APP_URL`            | Optional  | Public URL of this app — used as HTTP-Referer for OpenRouter (e.g. `https://poidh-sentinel.neynar.app`) |
| `BOT_OWNER_HANDLE`       | Optional  | Your Farcaster handle — shown in blocked-cancel DM message (e.g. `0x94t3z.eth`)    |
| `CRON_SECRET`            | Required  | Bearer token to secure `/api/cron/bounty-loop` — set in Vercel env vars (Vercel injects it automatically for cron routes) |
| `ADMIN_SECRET`           | Required  | Bearer token to secure admin endpoints (`state`, `test-evaluate`) — set to same value as `CRON_SECRET` |
| `NEXT_PUBLIC_USER_FID`   | Optional  | Your Farcaster FID — used for admin view gating in the dashboard                   |

---

## Mini app dashboard

The Farcaster mini app renders a live dashboard at the root route (`src/features/bot/components/dashboard.tsx`):

- **Bot status** — online/offline, wallet address (copy icon), signer configured
- **Activity stats** — total interactions, success/error counts, last activity timestamp
- **On-chain bounties** — sorted open → evaluating → closed → cancelled; live pot values, claim counts, poidh.xyz links, winner `@username` + reasoning, canceller `@username`
- **How it works** — step-by-step guide for new users
- **Activity feed** — paginated log (10 initial, load 20 at a time); filter by errors; accurate error count from full history

Dashboard auto-refreshes every 15 seconds.

---

## Setup

### Prerequisites
- Node.js 18+, npm
- Neynar account ([dev.neynar.com](https://dev.neynar.com)) — Farcaster webhook + managed signer
- Groq account — free-tier LLM + vision inference ([console.groq.com](https://console.groq.com))
- EVM wallet for gas — 0.005 ETH on Arbitrum/Base, or ~500 DEGEN on Degen Chain (whichever chains you plan to use)
- PostgreSQL database (Neon recommended — [neon.tech](https://neon.tech))

### Neynar webhook setup

1. Go to [dev.neynar.com](https://dev.neynar.com) → your app → Webhooks
2. Create a webhook pointing to `https://your-app.vercel.app/api/webhook/farcaster`
3. Subscribe to `cast.created` events, filter: `mentioned_fids=[YOUR_BOT_FID]`
4. Copy the webhook secret to `NEYNAR_WEBHOOK_SECRET`

The bot's FID and username are read from `BOT_FID` and `BOT_USERNAME` env vars — update those if the bot account changes.

### Run locally

**Prerequisites:** Node.js 18+, npm, PostgreSQL database (Neon free tier works great)

```bash
git clone <your-repo-url>
cd <repo>
npm install
```

Create a `.env` file in the project root:

```bash
# --- Required ---

# PostgreSQL connection string (Neon: https://neon.tech)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Neynar API key — cast publishing + Farcaster lookups (https://dev.neynar.com)
NEYNAR_API_KEY=

# Neynar managed signer UUID — controls which Farcaster account posts
BOT_SIGNER_UUID=

# Bot EVM wallet — signs all on-chain transactions
# hex private key, with or without 0x prefix (generate one: `cast wallet new` or any ETH wallet tool)
# the public address is derived automatically — no need to set BOT_WALLET_ADDRESS
BOT_WALLET_PRIVATE_KEY=

# Bot Farcaster identity
BOT_FID=
BOT_USERNAME=
BOT_APP_URL=
BOT_OWNER_HANDLE=

# --- Recommended ---

# Webhook HMAC secret — from dev.neynar.com -> your app -> Webhooks
NEYNAR_WEBHOOK_SECRET=

# Groq API key — free tier, tier-1 LLM + vision (https://console.groq.com)
GROQ_API_KEY=

# OpenAI API key — AI image detection (gpt-4o, ~$0.007/call) + vision fallback for claim eval
# Leave unset to skip both features entirely (fully free operation)
OPENAI_API_KEY=

# Set to false to disable AI image detection even if OPENAI_API_KEY is set
# AI_IMAGE_DETECTION=false

# --- Optional LLM fallbacks ---

# Cerebras — tier-1 agent replies, tier-2 eval (https://cloud.cerebras.ai)
CEREBRAS_API_KEY=

# OpenRouter — tier-3 LLM + vision fallback (https://openrouter.ai)
OPENROUTER_API_KEY=

# ocr.space — image OCR; defaults to public "helloworld" key if unset
OCR_SPACE_API_KEY=

# --- Optional infrastructure ---

# Custom RPC URLs — public endpoints used if unset
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
BASE_RPC_URL=https://mainnet.base.org
DEGEN_RPC_URL=https://rpc.degen.tips

# Bearer token to protect /api/cron/bounty-loop (Vercel cron convention)
CRON_SECRET=
# Bearer token to protect admin/maintenance endpoints — set to same value as CRON_SECRET
ADMIN_SECRET=

# Your Farcaster FID (used for admin view gating)
NEXT_PUBLIC_USER_FID=
```

Start the dev server:

```bash
npm run dev
# -> http://localhost:3000
```

The dev server automatically runs `drizzle-kit push` on start to create/migrate the database schema.

**Verify it's working:**

```bash
# Bot config + status (requires ADMIN_SECRET)
curl http://localhost:3000/api/bot/status \
  -H "Authorization: Bearer $ADMIN_SECRET"

# Trigger the bounty loop manually (requires CRON_SECRET locally)
curl http://localhost:3000/api/cron/bounty-loop \
  -H "Authorization: Bearer $CRON_SECRET"

# Dry-run AI image detection (no cast posted)
curl "http://localhost:3000/api/bot/test-evaluate?ai-detect=1&url=<image_url>" \
  -H "Authorization: Bearer $ADMIN_SECRET"

# Same with thread context loaded
curl "http://localhost:3000/api/bot/test-evaluate?ai-detect=1&url=<image_url>&thread=<cast_hash>" \
  -H "Authorization: Bearer $ADMIN_SECRET"

# Send a test webhook (replace BOT_FID and BOT_USERNAME with your values)
curl -X POST http://localhost:3000/api/webhook/farcaster \
  -H "Content-Type: application/json" \
  -d '{
    "created_at": 1700000000,
    "type": "cast.created",
    "data": {
      "hash": "0xtest123",
      "thread_hash": "0xtest123",
      "parent_hash": null,
      "author": { "fid": 1, "username": "testuser", "display_name": "Test" },
      "text": "@<BOT_USERNAME> suggest a bounty",
      "timestamp": "2024-01-01T00:00:00Z",
      "mentioned_profiles": [{ "fid": <BOT_FID>, "username": "<BOT_USERNAME>" }]
    }
  }'
```

**Webhook testing with a tunnel:**

```bash
# localtunnel
npx localtunnel --port 3000

# or ngrok
ngrok http 3000
```

Point your Neynar webhook to `https://<your-tunnel-url>/api/webhook/farcaster`.

**Run the cron loop manually on a schedule (local, no Vercel):**

```bash
watch -n 60 curl -s http://localhost:3000/api/cron/bounty-loop -H "Authorization: Bearer $CRON_SECRET"
```

### Deploy to Vercel

```bash
vercel deploy --prod
```

Vercel Cron is pre-configured in `vercel.json` to run the bounty loop every minute automatically.

---

## Implementation notes

- **Bounty type selection** — during creation, after the user picks chain + amount, the bot asks "open or solo?". `open` (default) calls `createOpenBounty` — bot evaluates submissions autonomously and picks winner via community vote. `solo` calls `createSoloBounty` — bot creates the bounty then steps back completely; the creator picks the winner manually on poidh.xyz. The bounty-loop skips evaluation for solo bounties entirely. `bountyType` is stored on `ConversationState`, passed to `createBountyOnChain`, and persisted on `active_bounties` so the loop can check it every cron tick. If the user skips or gives an unclear answer, it defaults to `"open"`.
- **Pending bounty IDs** — `pending-{txHash}` is used as a provisional ID until the real on-chain ID is extracted from the transaction receipt log topics. The bounty-loop resolves these on the next cron run.
- **Unique deposit amounts** — `makeUniqueAmount()` adds a tiny suffix (e.g. `0.0010001`) to disambiguate simultaneous pending payments on the same chain. The suffix is used only for deposit matching — the announced bounty amount always shows the round requested amount.
- **Conversation state duplication** — state is written under both `threadHash` and `castHash` to handle Farcaster's behavior where the first cast in a thread has `thread_hash === hash`.
- **State before reply** — conversation state is written to DB before the reply is published to prevent race conditions on fast follow-up casts.
- **Address resolution** — `resolveAddressesToUsernames()` uses Neynar's bulk-by-address endpoint (up to 350 addresses) to convert contributor wallet addresses to `@usernames` in winner announcements. Falls back to truncated address if resolution fails.
- **Contributor detection** — the bot probes `participants[bountyId][0..N]` sequentially until an out-of-bounds revert, collecting all non-zero addresses. `address(0)` slots (withdrawn participants) are skipped without stopping iteration. Falls back to the bounty issuer address if the probe fails or returns nothing.
- **MIN_OPEN_DURATION_HOURS** — default 72h. A bounty must be open at least this long before the bot evaluates it, giving everyone fair time to submit. Override via `MIN_OPEN_DURATION_HOURS` env var. The value is printed in the bounty announcement cast so submitters know the window.
- **NO_SUBMISSION_NUDGE_HOURS** — default 168h (7 days). Timeline for zero-submission bounties: at 72h the bot posts a one-time "no submissions yet — stays open, cancel for refund" reply. After 7 days it switches to a repeat nudge every 48h suggesting sharing or cancelling. The bounty never auto-closes — it stays open indefinitely until someone submits or the creator cancels.
- **Video submissions** — vision AI can only evaluate images. Video proof is scored on submission name/description text only.
- **Degen Chain** — fully supported end-to-end: conversation, deposit detection (`getBalance` via `https://rpc.degen.tips`), bounty creation (`0x18E5585ca7cE31b90Bc8BB7aAf84152857cE243f`), claim evaluation, and winner resolution. Bot wallet needs DEGEN tokens for gas (native token on Degen Chain). Set `DEGEN_RPC_URL` for a custom RPC; the public endpoint is used by default.
- **Announcement cast embed** — every cast the bot posts includes the bounty URL as a Farcaster embed (renders as a link preview card). This applies to: nomination/scores reply in thread, winner pointer reply, vote-rejected replies, no-winner feedback, "still waiting" nudge, bounty ID resolved reply, and all top-level `/poidh` channel announcements. The URL is never repeated in the text body when it's present as an embed.
- **Winner cast contributor tags** — for bounties with external contributors (`vote_submitted` / `vote_resolved` path), all on-chain participants from `participants[bountyId]` are tagged in winner announcements (`thanks @kenny, @mr94t3z!`), with the bot wallet filtered out and the winner excluded (already the star). The bounty creator (`creatorFid` → `@username`) always appears first. Tags are capped at 5. The contract provides no per-voter records so all contributors are tagged regardless of whether they voted. When `everHadExternalContributor` returns `false` (creator is the only participant), the bot uses `acceptClaim` directly and posts only a winner reply in the announcement thread — no `/poidh` channel cast, no contributor tags.
- **Cancelled vs won detection** — the bounty-loop checks `claimer != 0x000...` to detect closed bounties. If `claimer == issuer`, the bounty was cancelled (`cancelSoloBounty` / `cancelOpenBounty`) and funds were refunded; if `claimer != issuer`, a winner was accepted. Both set status to `closed` in the DB. Only the bot wallet (EOA issuer) can cancel bounties it created.
- **Cancel flow** — the original depositor sent native tokens (ETH or DEGEN) directly to the bot wallet, so the poidh contract has no record of them. `withdrawTo()` only pulls `pendingWithdrawals[msg.sender]` (bot wallet's own balance) — it cannot route tokens to a third party. The actual creator refund is a **plain native token transfer** (`sendTransaction`) from the bot wallet to the creator's Farcaster custody/verified address resolved via Neynar. Solo cancel: `cancelSoloBounty` → `withdraw()` → `sendTransaction(creatorAddress)`. Open cancel: `cancelOpenBounty` → `claimRefundFromCancelledOpenBounty` → `withdraw()` → `sendTransaction(creatorAddress)`. Other open bounty contributors call `claimRefundFromCancelledOpenBounty` themselves on poidh.xyz — bot cannot do it for them. Bot pings all contributors by @username in the announcement thread after cancel. `creatorFid` stored on `active_bounties` at creation time. **Refund amount** = `parseEther(bountyRecord.amountEth)` from DB — the exact bounty reward the creator put up (no fee). The `pendingWithdrawals` delta (before/after cancel) is computed as a sanity log but the DB value is the definitive source for the actual transfer. **Cancel auth**: only the creator (`creatorFid` match) can trigger cancel. If `creatorFid` is null (bounties created before this field was added), cancel is blocked and the user is directed to DM `@{BOT_OWNER_HANDLE}` for manual handling.
- **Cron parallelism** — `runBountyLoop()` and `checkDepositsAndCreateBounties()` run in parallel via `Promise.allSettled`. A failure in deposit checking does not block bounty evaluation and vice versa.
- **Claim identity in thread replies** — when someone replies in the announcement thread, the bot matches the author's Farcaster username against `allEvalResults.issuerUsername` to detect if they submitted a claim. If matched, the prompt includes their specific claim score and reasoning so the bot can address them directly ("your claim #356 scored 70 — outdoor note, date and poidh text present"). For third-party questions (e.g. "why did @user lose?" or "why did claim #362 not win?"), the bot detects `@mentions` and `#claimId` patterns in the cast text and surfaces the relevant claim details. The full `allEvalResults` list is always included in the agent context so any arbitrary question about any claim can be answered accurately.
- **OpenAI vision cost** — `gpt-4o` charges ~$0.01 per image for claim evaluation. It only activates when all Groq vision models are rate-limited. For a typical bounty with 5-10 submissions, this costs less than $0.10 total.
- **AI detection cost** — `gpt-4o` charges ~$0.007 per two-pass detection call. OpenAI caches the image between the two passes so the second call costs roughly half. Only triggered when someone explicitly asks "is this AI?" with an image present.
- **Pot value accuracy** — when answering "how much is the pot?" in a bounty thread, the agent resolves the live contract value using the exact `bountyId` stored in `bounty_threads`, not by name/chain lookup. This prevents returning the wrong pot value when multiple bounties exist on the same chain.
- **Image URL extraction** — the webhook extracts image URLs from both the triggering cast's embeds (free, in the payload) and the parent cast's embeds (one Neynar API call, combined with the existing `isReplyToBot` check). Parent images come first since the submission image is typically on the parent cast, not the reply.
- **AI detection accuracy** — `gpt-4o` is nondeterministic on ambiguous images. Thread context (community observations already in the cast thread) primes the model to look at the right things. Without context, borderline images may still return REAL. The two-pass + most-cautious-wins approach reduces false-confident REAL verdicts significantly.
