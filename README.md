# poidh-sentinel

Autonomous Farcaster bounty agent + mini app dashboard for [poidh.xyz](https://poidh.xyz).

This project is now a **Next.js 14 App Router** app (not the old CLI relay flow).  
It handles:

- Farcaster mention/reply webhook intake
- Multi-step bounty creation conversation
- On-chain open bounty creation
- Cron-based claim evaluation and winner resolution
- Public status dashboard in the mini app

---

## Stack

- Next.js 14 + TypeScript
- Drizzle ORM + Postgres (Neon-compatible)
- Neynar API (webhook + casts + user lookup)
- viem (contract read/write)
- Groq / Cerebras / OpenRouter / OpenAI (LLM + vision fallback)
- OCR.Space (text extraction from image proofs)

---

## How It Works

### 1) Webhook intake
`POST /api/webhook/farcaster`

- Verifies `x-neynar-signature` with `NEYNAR_WEBHOOK_SECRET` (if set)
- De-dupes casts through `processed_casts`
- Skips self-casts from bot FID `3273077`
- Routes by priority:
  1. Active conversation state
  2. Known bounty thread reply or reply-to-bot
  3. Fresh bot mention

### 2) Conversation state machine
`awaiting_confirmation -> awaiting_chain -> awaiting_payment -> creating_bounty`

State is persisted in DB (`conversation_state`, TTL 2h).

### 3) Deposit checker
Runs in cron path via `checkDepositsAndCreateBounties()`:

- Reads pending payment intents
- Checks wallet balances on Arbitrum/Base
- Accepts deposit when `availableBalance >= required * 95%`
- Calls `createOpenBounty` on-chain
- Posts announcement reply + channel cast
- Registers announcement cast thread for follow-up bot replies

### 4) Bounty loop
Runs in cron path via `runBountyLoop()`:

- Handles open/evaluating bounties
- Resolves pending bounty IDs from tx receipt logs
- Fetches claims, evaluates all claims, picks best valid claim
- Resolves winner by direct accept or vote flow
- Posts in-thread pointer + channel winner cast

---

## AI Evaluation Pipeline

Implemented in `src/features/bot/submission-evaluator.ts`.

### Stage 1: deterministic pre-score

- Token overlap between bounty and claim text
- Penalties for spam and digital-only signals
- Rejects immediately if score `< 15`

### Stage 2: proof resolution

- URI normalization (`ipfs://`, `ar://`)
- OCR via OCR.Space
- Vision (gated by score):
  - Groq models first
  - OpenAI `gpt-4o-mini` fallback
  - OpenRouter vision models fallback

### Stage 3: LLM verdict

- Returns structured JSON: `valid`, `score`, `reasoning`
- Text LLM fallback order:
  1. Groq (`llama-3.3-70b-versatile`)
  2. Cerebras (`llama-3.3-70b`)
  3. OpenRouter free models

If all LLMs fail, evaluator falls back to deterministic score.

---

## Contract + Chain Config

| Chain | Contract |
|---|---|
| Arbitrum | `0x5555Fa783936C260f77385b4E153B9725feF1719` |
| Base | `0x5555Fa783936C260f77385b4E153B9725feF1719` |
| Degen | `0x18E5585ca7cE31b90Bc8BB7aAf84152857cE243f` |

poidh display ID offsets used by `resolvePoidhUrl`:

- Arbitrum: `+180`
- Base: `+986`
- Degen: `+1197`

---

## API Routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/webhook/farcaster` | Farcaster cast webhook receiver |
| `GET` | `/api/cron/bounty-loop` | Runs bounty loop + deposit checker |
| `GET` | `/api/bot/status` | Bot/env readiness + wallet + bounty counts |
| `GET` | `/api/bot/logs` | Recent bot activity feed |
| `GET` | `/api/bot/bounties` | Active bounty list for dashboard |
| `GET` | `/api/bot/state` | Conversation/pending payment state |
| `GET` | `/api/bot/migrate` | One-shot DB migration helper |
| `GET` | `/api/bot/test-evaluate` | Debug, dry-run, vision test, manual post/reset |
| `POST` | `/api/bot/register-threads` | Backfill/register announcement threads |
| `GET` | `/api/neynar/[...route]` | SDK Neynar passthrough API handler |
| `GET` | `/.well-known/farcaster.json` | Mini app Farcaster metadata |

---

## Environment Variables

Use `.env.example` as the source of truth.

### Required

- `DATABASE_URL`
- `NEYNAR_API_KEY`
- `BOT_SIGNER_UUID`
- `BOT_WALLET_PRIVATE_KEY`
- `BOT_WALLET_ADDRESS`

### Recommended

- `NEYNAR_WEBHOOK_SECRET`
- `GROQ_API_KEY`

### Optional (fallbacks + infra)

- `CEREBRAS_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `OCR_SPACE_API_KEY`
- `ARBITRUM_RPC_URL`
- `BASE_RPC_URL`
- `CRON_SECRET`
- `NEXT_PUBLIC_USER_FID`
- `BOT_FID`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_LOCAL_URL`
- `NEXT_PUBLIC_VERCEL_PRODUCTION_URL`
- `WEBHOOK_URL`

Notes:

- Bot FID is currently hardcoded to `3273077` in the webhook route.
- `/api/bot/status` marks `ready=true` only when core keys are present.

---

## Local Development

```bash
npm install
npm run dev
```

App runs on `http://localhost:3000`.

This repo is configured for npm (`"packageManager": "npm@10"`).  
`.npmrc` includes `legacy-peer-deps=true` to avoid peer resolution issues with current UI deps.

---

## Webhook Setup (Neynar)

Set webhook destination to:

`https://<your-domain>/api/webhook/farcaster`

Event:

- `cast.created`

Recommended filters:

- Mentioned users: `poidh-sentinel`
- Parent cast authors: `poidh-sentinel`

If using local development, expose your local app/tunnel URL and point Neynar webhook to that URL.

---

## Cron

`vercel.json` runs:

- `GET /api/cron/bounty-loop` every minute (`* * * * *`)

If `CRON_SECRET` is set, include header:

`Authorization: Bearer <CRON_SECRET>`

---

## Helpful Debug Calls

`/api/bot/test-evaluate` supports:

- `?bountyId=<raw>&chain=<chain>`
- `?displayId=<display>&chain=<chain>`
- `?probe=1&chain=<chain>&around=<id>`
- `?debug=1&bountyId=<id>&chain=<chain>`
- `?vision=1&url=<image_url>`
- `?register=1&bountyId=<id>&chain=<chain>`
- `?run=1`
- `?reset=1&bountyId=<id>`
- `?post=1&parent=<castHash>&text=<text>`

---

## Important Behavior Notes

- Only **open** bounties are created (`createOpenBounty`).
- Deposit checking currently skips Degen balance detection.
- Replies are targeted to `announcementCastHash` when available, otherwise original `castHash`.
- Claim evaluation uses OCR + vision + LLM, with deterministic fallback on provider outages.
- Cast text is sanitized/stripped and clipped before publishing.

---

## License

MIT (see `LICENSE`).
