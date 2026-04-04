# Poidh Sentinel

Open-source TypeScript bot for Poidh bounty workflows on Arbitrum, Base, and Degen Chain.

It can:

- Create a bounty from an EOA wallet
- Poll claims automatically
- Resolve claim URIs and metadata
- Rank submissions with auditable scoring
- Accept the winner on-chain for solo bounties
- Submit a claim for vote and later resolve open bounty votes
- Publish a public decision update through a relay

## Why this repo exists

The bounty at `poidh.xyz/arbitrum/bounty/216` asks for a bot that can run Poidh end-to-end without human intervention. This repo gives you a reproducible starting point for that automation.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Copy env template.

```bash
cp .env.example .env
```

3. Fill in your values.

- `PRIVATE_KEY` must be an EOA private key, not a smart wallet
- `RPC_URL` should point at the chain you want to use
- `POIDH_CHAIN` must be `arbitrum`, `base`, or `degen`
- For relay posting, set `SOCIAL_POST_WEBHOOK_URL=http://127.0.0.1:8787/decision`
- For Farcaster posting, set `NEYNAR_API_KEY`, `FARCASTER_SIGNER_UUID`, and optionally `FARCASTER_CHANNEL_ID=poidh`
- For Farcaster webhook verification, set `NEYNAR_WEBHOOK_SECRET` only if your Neynar plan includes webhook access
- For optional LLM polish on Farcaster copy, set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL=openrouter/free`
- To prevent first-claim instant resolution, set `MIN_CLAIMS_BEFORE_ACCEPT` and/or `MIN_DECISION_AGE_SECONDS`

Recommended defaults in this repo:
- `BOUNTY_KIND=solo`
- `BOUNTY_NAME=Take a photo of something blue outdoors`
- `BOUNTY_DESCRIPTION=Upload a clear outdoor photo of something blue.`
- `BOUNTY_AMOUNT_ETH=0.001`

Poidh minimums are documented in the official skill docs:
https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md

## Commands

Create a bounty:

```bash
npm run dev -- create-bounty
```

Evaluate a bounty without sending a transaction:

```bash
npm run dev -- evaluate-bounty --bounty-id 123
```

Run the watcher loop:

```bash
npm run dev -- watch-bounty --bounty-id 123
```

Or let the bot create and manage its own bounty from env defaults:

```bash
npm run dev -- run
```

Explain winner and reasoning:

```bash
npm run dev -- explain-bounty --bounty-id 123
```

Resolve open-bounty vote manually if needed:

```bash
npm run dev -- resolve-vote --bounty-id 123
```

Run the test suite:

```bash
npm test
```

## How it works

- `createSoloBounty` and `createOpenBounty` fund a bounty from an EOA
- `getClaimsByBountyId` fetches public submissions
- `poidhNft().tokenURI(claimId)` resolves the claim NFT metadata
- `acceptClaim` finalizes solo bounties
- `submitClaimForVote` and `resolveVote` handle open bounties with contributors
- Claim evaluation is deterministic by default and uses:
  - token and description overlap
  - the claim proof URL and metadata
  - whether the claim resolves to image, video, or web evidence
  - whether the evidence looks like a real-world proof artifact
- Real-world bounty prompts are guarded so obvious digital-only tasks are rejected before creation
- Auto-accept safeguards can keep the bounty open long enough for organic competition

## Code layout

- `src/core/` holds the reusable chain, evaluation, relay, and artifact helpers
- `src/runtime/` holds the workflow helpers for bounty validation, decision artifacts, and relay state/handlers
- `src/bot.ts` coordinates bounty creation, claim monitoring, scoring, and payout
- `src/main.ts` is the CLI entrypoint
- `src/relay.ts` starts the relay server

Run the relay locally with:

```bash
npm run relay
```

## Social posting

Set `SOCIAL_POST_WEBHOOK_URL` if you want the bot to forward its decision summary to another service, such as a Farcaster or X relay you control.

If the webhook is unset, the bot prints the decision locally instead.

Artifacts written to `artifacts/production/`:
- `poidh-production-<bountyId>.json|md`
- `poidh-social-<bountyId>.json|md`
- `poidh-farcaster-<bountyId>.json|md` (social draft only)

These include winner, reasons, follow-up Q/A text, and both the declared bounty amount and the current on-chain amount when they differ.

## Notes

- Poidh requires EOA wallets for issuer actions.
- If you stop and restart without `BOUNTY_ID`, bot resumes from `BOUNTY_STATE_FILE` (`.poidh-state.json` by default).
- Keep `AUTO_ACCEPT=true` for autonomous payout behavior.
- Use `MIN_CLAIMS_BEFORE_ACCEPT` and `MIN_DECISION_AGE_SECONDS` to keep the bounty open long enough for organic competition.
- `MIN_CLAIMS_BEFORE_ACCEPT=2` is a good default for demos where you want more than one claim before payout.

## Claim pack

See [CLAIM.md](./CLAIM.md) and [examples/poidh-proof-sample.md](./examples/poidh-proof-sample.md).
