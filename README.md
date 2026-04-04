# Poidh Sentinel

Open-source TypeScript bot for autonomous Poidh bounty execution.

It creates a bounty from an EOA wallet, monitors claims, scores submissions with auditable logic, picks a winner, executes on-chain resolution, and produces social-proof output for Farcaster publishing or manual handoff when posting access is unavailable.

## Requirement match

- EOA control: issuer actions sign from `PRIVATE_KEY` (no MetaMask/manual prompt flow)
- Bounty creation: `create-bounty` or `run`
- Submission monitoring: polling loop in `run` / `watch-bounty`
- Evaluation logic: deterministic scoring in `src/evaluate.ts`
- Winner selection: highest-score claim in `src/bot.ts`
- Auto-accept safeguards:
  - `MIN_CLAIMS_BEFORE_ACCEPT` can require multiple claims before final action
  - `MIN_DECISION_AGE_SECONDS` can hold acceptance window open to avoid first-claim instant resolution
- On-chain payout flow:
  - Solo bounty: `acceptClaim`
  - Open bounty: `submitClaimForVote` then `resolveVote`
- Real-world guard:
  - bounty creation refuses obvious digital-only prompts
  - default bounty text targets a real-world photo task
- Public reasoning:
  - decision text is generated automatically
  - JSON/markdown artifacts are written to `artifacts/production/`
  - webhook payload includes follow-up Q/A for transparent social replies
  - local relay can auto-post to Farcaster using a Neynar signer when the connected account has posting access/credits
  - `POST /webhooks/neynar` can reply to live Farcaster follow-up casts when Neynar webhook access is available
  - `POST /follow-up` accepts forwarded question webhooks and replies in-thread from the stored reasoning

## Setup

1. Install dependencies.

```bash
npm install
```

2. Copy env template.

```bash
cp .env.example .env
```

3. Fill required values.

- `PRIVATE_KEY` issuer EOA key
- `RPC_URL` chain RPC URL
- `POIDH_CHAIN` one of `arbitrum`, `base`, `degen`
- For relay posting, set `SOCIAL_POST_WEBHOOK_URL=http://127.0.0.1:8787/decision`
- For Farcaster posting, set `NEYNAR_API_KEY`, `FARCASTER_SIGNER_UUID`, and optionally `FARCASTER_CHANNEL_ID=poidh`
- For Farcaster webhook verification, set `NEYNAR_WEBHOOK_SECRET` only if your Neynar plan includes webhook access
- For optional LLM polish on Farcaster copy, set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL=openrouter/free`
- To prevent first-claim instant resolution, set `MIN_CLAIMS_BEFORE_ACCEPT` (e.g. `2`) and/or `MIN_DECISION_AGE_SECONDS` (e.g. `300`)

Recommended defaults in this repo:
- `BOUNTY_KIND=solo`
- `BOUNTY_NAME=Take a photo of something blue outdoors`
- `BOUNTY_DESCRIPTION=Upload a clear outdoor photo of something blue.`
- `BOUNTY_AMOUNT_ETH=0.001`

Poidh minimums are documented in the official skill docs:
https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md

## Commands

Create bounty only:

```bash
npm run dev -- create-bounty
```

Watch and act on an existing bounty:

```bash
npm run dev -- watch-bounty --bounty-id 123
```

Run end-to-end (create if needed, then monitor/evaluate/act):

```bash
npm run dev -- run
```

Evaluate without sending tx:

```bash
npm run dev -- evaluate-bounty --bounty-id 123
```

Explain winner and reasoning:

```bash
npm run dev -- explain-bounty --bounty-id 123
```

Resolve open-bounty vote manually if needed:

```bash
npm run dev -- resolve-vote --bounty-id 123
```

## Social transparency

Social transparency is built into the run: if `SOCIAL_POST_WEBHOOK_URL` is set, the bot sends the full decision payload to a relay that can publish a Farcaster thread through Neynar when signer access and posting credits are available, while still writing the complete decision draft and proof artifacts locally if posting is unavailable. The relay also includes deterministic `followUpAnswers` for reasoning context, supports `POST /webhooks/neynar` for native webhook-driven replies when Neynar webhook access is enabled, and falls back to `POST /follow-up` for forwarded question events on the free path.

Run the relay locally with:

```bash
npm run relay
```

Artifacts written to `artifacts/production/`:
- `poidh-production-<bountyId>.json|md`
- `poidh-social-<bountyId>.json|md`
- `poidh-farcaster-<bountyId>.json|md` (social draft only)

These include winner, reasons, and follow-up Q/A text.

## Notes

- Poidh requires EOA wallets for issuer actions.
- If you stop and restart without `BOUNTY_ID`, bot resumes from `BOUNTY_STATE_FILE` (`.poidh-state.json` by default).
- Keep `AUTO_ACCEPT=true` for autonomous payout behavior.
- Use `MIN_CLAIMS_BEFORE_ACCEPT` and `MIN_DECISION_AGE_SECONDS` to keep the bounty open long enough for organic competition.

## Claim pack

See [CLAIM.md](./CLAIM.md) and [examples/poidh-proof-sample.md](./examples/poidh-proof-sample.md).
