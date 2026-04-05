# Poidh Sentinel

Open-source TypeScript bot for Poidh bounty workflows on Arbitrum, Base, and Degen Chain.

The chain is selected with `TARGET_CHAIN`, and the repo includes the matching contract addresses and frontend offsets for each supported network.

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

- `BOT_PRIVATE_KEY` must be an EOA private key, not a smart wallet
- `CHAIN_RPC_URL` should point at the chain you want to use
- `TARGET_CHAIN` must be `arbitrum`, `base`, or `degen`
- For relay posting, set `DECISION_WEBHOOK_URL=http://127.0.0.1:8787/decision`
- For Farcaster posting, set `NEYNAR_API_KEY`, `FARCASTER_SIGNER_UUID`, and optionally `FARCASTER_CHANNEL_ID=poidh`
- For Farcaster webhook verification, set `WEBHOOK_SIGNATURE_SECRET` only if your Neynar plan includes webhook access
- For optional LLM polish on Farcaster copy, set `OPENROUTER_API_KEY` and optionally `COPY_POLISH_MODEL=openrouter/free`
- To prevent first-claim instant resolution, set `MIN_PARTICIPANTS_BEFORE_FINALIZE` and/or `FIRST_CLAIM_COOLDOWN_SECONDS`

Poidh itself does not end solo bounties on a timer; the creator accepts a claim when they decide it is good enough. Open bounties can move into the contract’s vote flow, which has its own on-chain deadline. `FIRST_CLAIM_COOLDOWN_SECONDS` is only a bot-side safety delay after the first claim is observed, so the bot does not jump on the first valid submission too early.

Recommended defaults in this repo:
- `BOUNTY_MODE=solo`
- `BOUNTY_TITLE=Take a photo of something blue outdoors`
- `BOUNTY_PROMPT=Upload a clear outdoor photo of something blue.`
- `BOUNTY_REWARD_ETH=0.001`

Poidh minimums are documented in the official skill docs:
https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md

## Commands

Requirements flow:

1. Start relay (for Farcaster decision posting).

```bash
npm run relay
```

2. Run autonomous flow.

```bash
npm run dev -- requirements-flow
```

`requirements-flow` follows the target flow:
- Create a real-world bounty
- Wait for public submissions
- Evaluate and pick a winner
- Execute on-chain final action (`acceptClaim` or open-bounty vote path)
- Post public reasoning in the Farcaster thread

If `MIN_PARTICIPANTS_BEFORE_FINALIZE=2`, the bot will deliberately keep waiting after the first claim and will only move to the final action once a second claim appears.

Create a new bounty and stop:

```bash
npm run dev -- create-new-bounty
```

Watch an existing bounty:

```bash
npm run dev -- watch-bounty --bounty-id 123
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
  - duplicate-evidence penalty for later copy submissions
  - tie-breaker that favors earlier submissions over later ones
- Real-world bounty prompts are guarded so obvious digital-only tasks are rejected before creation
- Auto-finalize safeguards can keep the bounty open long enough for organic competition

## Code layout

- `src/core/` holds the reusable chain, evaluation, relay, and artifact helpers
- `src/runtime/` holds the workflow helpers for bounty validation, decision artifacts, and relay state/handlers
- `src/bot.ts` coordinates bounty creation, claim monitoring, scoring, and payout
- `src/main.ts` is the CLI entrypoint
- `src/relay.ts` starts the relay server

## Social posting

Set `DECISION_WEBHOOK_URL` if you want the bot to forward its decision summary to the local Farcaster relay.

If the webhook is unset, the bot prints the decision locally instead.

That free path is enough for local testing: the bot still creates the bounty, monitors claims, scores them, and writes the decision artifacts. Only the public post handoff is skipped.

This repo is intentionally Farcaster-first. The relay posts one concise decision cast, then publishes thread replies with full winner reasoning and validation details. Live auto-replies to other people’s questions work when Neynar webhook access is available. Without webhook access, you can still use `POST /follow-up` as a manual fallback.

Artifacts written to `artifacts/production/`:
- `<bountyId>/production.json|md`
- `<bountyId>/social.json|md`
- `<bountyId>/farcaster.json|md` (social draft only)

Relay payloads are written to `artifacts/relay/<bountyId>/relay.json|md`.

These include winner, reasons, follow-up Q/A text, and both the declared bounty amount and the current on-chain amount when they differ.

## Notes

- Poidh requires EOA wallets for issuer actions.
- If you stop and restart without `BOUNTY_ID`, bot resumes from `BOT_STATE_FILE` (`.poidh-state.json` by default).
- Keep `AUTO_FINALIZE_WINNER=true` for autonomous payout behavior.
- Use `MIN_PARTICIPANTS_BEFORE_FINALIZE` and `FIRST_CLAIM_COOLDOWN_SECONDS` to keep the bounty open long enough for organic competition.
- `MIN_PARTICIPANTS_BEFORE_FINALIZE=2` is a good default for demos where you want more than one claim before payout.
- When that setting is `2`, `Auto-finalize is waiting...` is expected after the first claim.
- In autonomous mode, final public decision posts are sent after the on-chain final action path is reached.

## Claim pack

See [CLAIM.md](./CLAIM.md) and [examples/poidh-proof-sample.md](./examples/poidh-proof-sample.md).
