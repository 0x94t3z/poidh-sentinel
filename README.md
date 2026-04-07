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

---

## Architecture

```
Farcaster webhook (cast.created)
       |
       v
/api/webhook/farcaster
  - HMAC signature verification (NEYNAR_WEBHOOK_SECRET)
  - Atomic dedup via processedCasts table (INSERT ON CONFLICT DO NOTHING)
  - Priority routing:
      1. Active conversation flow (multi-step bounty creation)
      2. Bounty thread reply / direct reply to bot
      3. Fresh mention -> AI agent

       |
       v
agent.ts  (LLM-powered)
  - Action detection: suggest_bounty | evaluate_submission | pick_winner
    | create_bounty_onchain | wallet_address | general_reply
  - In-context replies (bounty thread or reply-to-bot) skip keyword detection
  - Thread history fetched from Neynar conversation API for context
  - Live pot value fetched from contract when user asks about bounty value
  - Multi-tier LLM: Cerebras llama-3.3-70b -> Groq llama-3.3-70b -> OpenRouter free models
  - Markdown stripped before publishing (Farcaster doesn't render it)

       |
       v
conversation-state.ts  (DB-backed state machine, 2h TTL)
  Steps: awaiting_confirmation -> awaiting_chain -> awaiting_payment -> creating_bounty

       |                                  |
       v                                  v
deposit-checker.ts                 bounty-loop.ts  (cron, every minute)
  - Polls bot wallet on Arbitrum/Base  - Processes open + evaluating bounties
  - Compares against last known balance - Resolves pending-IDs from tx receipts
  - Detects new deposits (>=95% of req) - Checks 48h vote deadline for evaluating bounties
  - Creates open bounty on-chain        - Evaluates claims via submission-evaluator.ts
  - Posts poidh.xyz link as reply       - Resolves winners on-chain (direct or vote)
  - Announces in /poidh channel         - Posts winner announcement in /poidh
  - Saves announcementCastHash for      - Re-nominates next-best if vote rejected
    in-thread bot replies
```

### Cron endpoint

`GET /api/cron/bounty-loop` runs `runBountyLoop()` and `checkDepositsAndCreateBounties()` in parallel every minute. Secured via `CRON_SECRET` bearer token (optional but recommended).

---

## Cast flow

### Bounty lifecycle

```
1. User mentions @poidh-sentinel in /poidh or DM
   -> bot suggests bounty idea + asks for confirmation

2. User confirms -> bot asks which chain (Arbitrum / Base / Degen)

3. User picks chain -> bot asks for deposit to bot wallet
   (unique amount e.g. 0.0010001 ETH to avoid collision)

4. deposit-checker detects payment on-chain
   -> calls createOpenBounty() on poidh contract
   -> posts poidh.xyz link as reply in conversation thread
   -> posts announcement cast to /poidh channel (this hash = announcementCastHash)
   -> registers bounty in DB + bounty_threads table

5. (MIN_OPEN_DURATION_MS = 24h minimum before evaluation)

6. bounty-loop picks up open bounty with claims
   -> runs full evaluation pipeline
   -> on-chain nomination (acceptClaim or submitClaimForVote)

7a. No external contributors (issuer-only):
    -> acceptClaim() — immediate payout
    -> posts winner announcement as NEW top-level /poidh cast with bounty URL

7b. Has external contributors (crowdfunded):
    -> submitClaimForVote() — starts 48h community vote
    -> posts SINGLE reply in announcement thread:
       "scores: #356(100) @danxv | #353(83) @user | ...
        @winner nominated as winner. [reasoning]. contributors have 48h to vote yes/no."
    -> after 48h deadline: resolveVote()
    -> if YES: winner cast as NEW top-level /poidh cast with bounty URL
    -> if NO: re-nominate next-best (score >= 60) from allEvalResults
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
| `createOpenBounty(name, description)` | Creates a crowdfundable open bounty |
| `bounties(id)` | Fetches bounty details (issuer, amount, claimer, createdAt) |
| `getClaimsByBountyId(bountyId, cursor)` | Paginates claims (10 per page, zero-padded) |
| `bountyContributions(bountyId)` | Returns contributor list; falls back to issuer if empty |
| `everHadExternalContributor(bountyId)` | Determines direct-accept vs. community vote path |
| `acceptClaim(bountyId, claimId)` | Direct payout (issuer-only bounty) |
| `submitClaimForVote(bountyId, claimId)` | Nominates winner, starts 48h vote window |
| `bountyVotingTracker(bountyId)` | Returns yesVotes, noVotes, deadline |
| `resolveVote(bountyId)` | Finalizes vote after deadline |

Winner resolution flow:

```
everHadExternalContributor(bountyId)?
|
+-- NO  -> acceptClaim(bountyId, claimId)         — immediate payout
|
+-- YES -> submitClaimForVote(bountyId, claimId)  — 48h community vote
                |
                +-- after deadline -> resolveVote(bountyId)
                      |
                      +-- YES votes > NO votes -> winner paid
                      +-- rejected -> nominate next-best claim (score >= 60)
                                       from stored allEvalResults
```

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
   - **Tier 2 — OpenAI**: `gpt-4o-mini` (excellent text reading, kicks in when Groq is rate-limited)
   - **Tier 3 — OpenRouter**: `qwen/qwen3.6-plus:free` → `google/gemini-3.1-flash-lite-preview`
   - Images fetched as base64 data URIs (avoids vision model URL-access issues)
   - If OCR text >= 30 chars (`OCR_SUFFICIENT_CHARS`), OCR is appended alongside vision result

Vision is skipped for low-scoring claims to conserve Groq quota. OCR always runs as it's free.

If all vision tiers and OCR fail, the image URL is included for LLM context.

### Stage 3 — LLM final verdict

Structured JSON response: `{ valid: bool, score: 0-100, reasoning: string }`.

LLM priority: Groq `llama-3.3-70b-versatile` → Cerebras → OpenRouter free models.

Reasoning must be specific and concrete (e.g. "outdoor photo shows '5th April 2026 Dan Xv POIDH' on a note") — vague reasoning like "meets requirements" is explicitly banned by the prompt.

Falls back to the deterministic score if all LLMs are exhausted (`fallbackValid = detScore >= 60`). No silent drops.

**Winner** = highest-scoring claim with `valid: true` and `score >= 60`.

---

## LLM stack

All LLM usage targets free-tier endpoints. `OPENAI_API_KEY` is optional — used only as a vision fallback.

### Agent replies (`agent.ts`)

| Tier | Provider   | Model(s)                                                | Notes                        |
|------|------------|---------------------------------------------------------|------------------------------|
| 1    | Cerebras   | `llama-3.3-70b`, `llama3.1-8b`                          | ~2000 tok/s, primary         |
| 2    | Groq       | `llama-3.3-70b-versatile`                               | Fallback when Cerebras fails |
| 3    | OpenRouter | `llama-3.3-70b-instruct:free`, `gpt-oss-120b:free`, ... | Last resort                  |

### Claim evaluation (`submission-evaluator.ts`)

| Tier | Provider   | Model(s)                  | Notes              |
|------|------------|---------------------------|--------------------|
| 1    | Groq       | `llama-3.3-70b-versatile` | Primary (500k TPD) |
| 2    | Cerebras   | `llama-3.3-70b`           | Fallback           |
| 3    | OpenRouter | free models               | Last resort        |

### Vision (claim proof analysis)

| Tier | Provider   | Model(s)                                                              | Cost        |
|------|------------|-----------------------------------------------------------------------|-------------|
| 1    | Groq       | `llama-4-scout-17b-16e-instruct` → `llama-3.2-90b` → `llama-3.2-11b` | Free        |
| 2    | OpenAI     | `gpt-4o-mini`                                                         | ~$0.001/img |
| 3    | OpenRouter | `qwen/qwen3.6-plus:free` → `google/gemini-3.1-flash-lite-preview`    | Free        |

**Groq quota note**: Groq vision and text calls share the same 500k TPD limit. Vision is skipped for claims with deterministic score < 40 to conserve quota. If Groq is rate-limited, OpenAI `gpt-4o-mini` picks it up automatically — set `OPENAI_API_KEY` to enable this fallback.

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
| `bot_log`            | Activity log (last 50 entries shown in dashboard)                |
| `processed_casts`    | Cast dedup — atomic insert prevents duplicate replies            |
| `wallet_balances`    | Last known on-chain balance per chain for deposit detection      |

`allEvalResults` (JSONB on `active_bounties`) stores the full ranked claim scores from each evaluation pass, so the bot can re-nominate the next-best claim if a community vote is rejected.

---

## API routes

| Method | Path                              | Description                                       |
|--------|-----------------------------------|---------------------------------------------------|
| POST   | `/api/webhook/farcaster`          | Neynar webhook receiver                           |
| GET    | `/api/cron/bounty-loop`           | Cron: evaluate bounties + check deposits          |
| GET    | `/api/bot/logs`                   | Dashboard: recent activity log + stats            |
| GET    | `/api/bot/bounties`               | Dashboard: all bounties with live pot values      |
| GET    | `/api/bot/status`                 | Dashboard: bot online / config status             |
| GET    | `/api/bot/state`                  | Dashboard: active conversations                   |
| POST   | `/api/bot/register-threads`       | Backfill: re-register announcement threads        |
| GET    | `/api/bot/migrate`                | One-time DB migration helper                      |
| GET    | `/api/bot/test-evaluate`          | Dev/debug: dry-run evaluation and bot operations  |
| GET    | `/api/neynar/[...route]`          | Neynar passthrough API handler                    |
| GET    | `/.well-known/farcaster.json`     | Farcaster mini app metadata                       |

### Test/debug endpoint params (`/api/bot/test-evaluate`)

| Param | Example | Description |
|-------|---------|-------------|
| `bountyId=<raw_id>&chain=<chain>` | `?bountyId=88&chain=arbitrum` | Dry-run evaluate a bounty by raw contract ID |
| `displayId=<display_id>&chain=<chain>` | `?displayId=268&chain=arbitrum` | Same but using poidh.xyz display ID (offset auto-applied) |
| `probe=1&chain=<chain>&around=<id>` | `?probe=1&chain=arbitrum&around=264` | Scan raw IDs around a value to find valid ones |
| `debug=1&bountyId=<id>&chain=<chain>` | `?debug=1&bountyId=88` | Show raw `getClaimsByBountyId` contract output |
| `vision=1&url=<image_url>` | `?vision=1&url=https://...` | Test vision AI on a single image URL |
| `register=1&bountyId=<id>&chain=<chain>` | `?register=1&bountyId=88&chain=arbitrum` | Register bounty in DB + post /poidh announcement cast |
| `run=1` | `?run=1` | Trigger real bounty loop (real casts + on-chain tx) |
| `reset=1&bountyId=<id>` | `?reset=1&bountyId=88` | Set bounty status back to open for re-evaluation |
| `post=1&parent=<hash>&text=<text>` | `?post=1&parent=0xabc&text=hello` | Post a custom reply under a cast hash |

All modes except `run=1`, `register=1`, and `post=1` are dry-runs — no DB writes, no on-chain transactions, no casts posted.

---

## Environment variables

| Variable                 | Required  | Description                                                               |
|--------------------------|-----------|---------------------------------------------------------------------------|
| `DATABASE_URL`           | Yes       | PostgreSQL connection string                                              |
| `NEYNAR_API_KEY`         | Yes       | Neynar API key — cast publishing and Farcaster user lookups               |
| `BOT_SIGNER_UUID`        | Yes       | Neynar managed signer UUID for the bot's Farcaster account                |
| `BOT_WALLET_PRIVATE_KEY` | Yes       | Private key of the bot's EVM wallet (signs all on-chain transactions)     |
| `BOT_WALLET_ADDRESS`     | Yes       | Public address of the bot's wallet (shown to users for deposits)          |
| `NEYNAR_WEBHOOK_SECRET`  | Rec.      | HMAC-SHA512 secret for Neynar webhook signature verification              |
| `GROQ_API_KEY`           | Rec.      | Groq API key — tier 1 LLM (claim eval) + vision (free tier, 500k TPD)    |
| `CEREBRAS_API_KEY`       | Optional  | Cerebras API key — tier 1 agent replies, tier 2 eval (~2000 tok/s)        |
| `OPENAI_API_KEY`         | Optional  | OpenAI API key — tier 2 vision fallback (`gpt-4o-mini`, ~$0.001/image)   |
| `OPENROUTER_API_KEY`     | Optional  | OpenRouter API key — tier 3 LLM and vision fallback (free models)         |
| `OCR_SPACE_API_KEY`      | Optional  | ocr.space key — defaults to the public `helloworld` key if unset          |
| `ARBITRUM_RPC_URL`       | Optional  | Custom Arbitrum RPC — defaults to `https://arb1.arbitrum.io/rpc`          |
| `BASE_RPC_URL`           | Optional  | Custom Base RPC — defaults to `https://mainnet.base.org`                  |
| `CRON_SECRET`            | Optional  | Bearer token to secure the cron endpoint                                  |

---

## Mini app dashboard

The Farcaster mini app renders a live dashboard at the root route (`src/features/bot/components/dashboard.tsx`):

- **Bot status** — online/offline, wallet configured, signer configured
- **Activity stats** — total interactions, success/error counts, last activity timestamp
- **On-chain bounties** — all bounties with live pot values fetched from the contract, claim counts, status (open/evaluating/closed/cancelled), poidh.xyz links, winner reasoning
- **How it works** — step-by-step guide for new users
- **Recent activity** — last 50 log entries with action type and reply text

Dashboard auto-refreshes every 15 seconds.

---

## Setup

### Prerequisites
- Node.js 18+, npm
- Neynar account ([dev.neynar.com](https://dev.neynar.com)) — Farcaster webhook + managed signer
- Groq account — free-tier LLM + vision inference ([console.groq.com](https://console.groq.com))
- EVM wallet with ETH on Arbitrum or Base for gas (0.005 ETH recommended minimum)
- PostgreSQL database (Neon recommended — [neon.tech](https://neon.tech))

### Neynar webhook setup

1. Go to [dev.neynar.com](https://dev.neynar.com) → your app → Webhooks
2. Create a webhook pointing to `https://your-app.vercel.app/api/webhook/farcaster`
3. Subscribe to `cast.created` events, filter: `mentioned_fids=[YOUR_BOT_FID]`
4. Copy the webhook secret to `NEYNAR_WEBHOOK_SECRET`

The bot's FID is hardcoded as `3273077` in `src/app/api/webhook/farcaster/route.ts` — update this if the bot account changes.

### Local development

```bash
npm install
cp .env.example .env   # fill in your keys
npm run dev            # starts Next.js on http://localhost:3000
```

### Deploy to Vercel

```bash
vercel deploy --prod
```

Vercel Cron is pre-configured in `vercel.json` to run the bounty loop every minute automatically.

---

## Implementation notes

- **Pending bounty IDs** — `pending-{txHash}` is used as a provisional ID until the real on-chain ID is extracted from the transaction receipt log topics. The bounty-loop resolves these on the next cron run.
- **Unique deposit amounts** — `makeUniqueAmount()` adds a tiny suffix (e.g. `0.0010001`) to disambiguate simultaneous pending payments on the same chain.
- **Conversation state duplication** — state is written under both `threadHash` and `castHash` to handle Farcaster's behavior where the first cast in a thread has `thread_hash === hash`.
- **State before reply** — conversation state is written to DB before the reply is published to prevent race conditions on fast follow-up casts.
- **Address resolution** — `resolveAddressesToUsernames()` uses Neynar's bulk-by-address endpoint (up to 350 addresses) to convert contributor wallet addresses to `@usernames` in winner announcements. Falls back to truncated address if resolution fails.
- **Contributor fallback** — if `bountyContributions()` returns an empty list, the bounty issuer address is used as the sole contributor for @mention purposes.
- **MIN_OPEN_DURATION_MS** — set to 24 hours in production. A bounty must be open for at least this long before the bot evaluates it, giving submitters time to respond to the announcement.
- **Video submissions** — vision AI can only evaluate images. Video proof is scored on submission name/description text only.
- **Degen Chain** — fully supported for conversation and bounty creation; deposit detection not implemented (ETH balance detection only covers Arbitrum and Base).
- **Announcement cast embed** — nomination replies in thread do not include the bounty URL (it's already embedded in the parent announcement cast). Top-level winner announcements include the full URL as an embed.
- **Cron parallelism** — `runBountyLoop()` and `checkDepositsAndCreateBounties()` run in parallel via `Promise.allSettled`. A failure in deposit checking does not block bounty evaluation and vice versa.
- **OpenAI vision cost** — `gpt-4o-mini` charges ~$0.001 per image. It only activates when all Groq vision models are rate-limited. For a typical bounty with 5-10 submissions, this costs less than $0.01 total.
- **Pot value accuracy** — when answering "how much is the pot?" in a bounty thread, the agent resolves the live contract value using the exact `bountyId` stored in `bounty_threads`, not by name/chain lookup. This prevents returning the wrong pot value when multiple bounties exist on the same chain.
