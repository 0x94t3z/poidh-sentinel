# poidh bounty bot

An open-source TypeScript bot for Poidh bounty workflows on Arbitrum, Base, and Degen Chain.

It can:

- Create a bounty from an EOA wallet
- Poll claims automatically
- Resolve claim URIs and metadata
- Rank submissions with an auditable scoring model
- Accept the winner on-chain for solo bounties
- Submit a claim for vote and later resolve open bounty votes
- Post a public decision update through a webhook

## Requirement Match

- Creates a real-world-action bounty on Poidh: `run` and `create-bounty`
- Waits for public submissions: `run`
- Evaluates submissions deterministically: `evaluate-bounty`, `explain-bounty`
- Selects a winner autonomously: `actOnBounty`
- Executes payout on-chain: `acceptClaim`, `submitClaimForVote`, `resolveVote`
- Prepares reasoning for publication: `postDecision` plus `SOCIAL_POST_AUTHOR`
- Supports demo and production modes: `demo-cycle` and `run`
- Writes a ready-to-publish social proof draft for X/Farcaster workflows
- Writes a Farcaster-ready cast draft artifact that a relay can publish directly

## Why this repo exists

The bounty at [poidh bounty 216](https://poidh.xyz/arbitrum/bounty/216) asks for a bot that can run Poidh end-to-end without human intervention. This repo gives you a reproducible implementation and a claim pack for that exact challenge.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Copy the environment template that matches the flow you want.

```bash
cp .env.production.example .env
# optional: cp .env.demo.example .env
```

3. Fill in your values.

- `PRIVATE_KEY` must be an EOA private key, not a smart wallet.
- The demo template is optional and only used if you want a repeatable two-wallet test harness.
- Each demo submission slot needs a private key, a title, a description, and a public image or metadata URL for the proof.
- `DEMO_CLAIM_1_EXPECTED_CLAIMANT_ADDRESS` and `DEMO_CLAIM_2_EXPECTED_CLAIMANT_ADDRESS` are optional, but useful if you want to pin each slot to a known wallet.
- The demo template auto-submits both claims so the bot can rank competing submissions and choose the winner.
- `RPC_URL` should point at the chain you want to use.
- `POIDH_CHAIN` must be `arbitrum`, `base`, or `degen`.
- The app loads `.env` automatically, so you can keep secrets in the local file instead of exporting them in your shell.
- `AUTO_SUBMIT_CLAIM` should stay `false` for production bounty-creator mode. Turn it on only for local demo flows that need the bot to auto-submit two demo claims.
- `BOUNTY_STATE_FILE` lets the bot remember the last bounty ID it created. Leave it unset to use `.poidh-state.json`.

The shipped production bounty preset is intentionally requirement-aligned:
- `BOUNTY_NAME=Take a photo of something blue outdoors`
- `BOUNTY_DESCRIPTION=Upload a clear outdoor photo of something blue.`

For production, start from `.env.production.example`.
For a repeatable two-wallet test harness, use `.env.demo.example`.

The same `.env` file can still be reused later if you prefer, but the split templates make the intent clearer:
- `demo-cycle` auto-submits two demo claims when `AUTO_SUBMIT_CLAIM=true`.
- `run` ignores self-claim behavior when `AUTO_SUBMIT_CLAIM=false`.

The bot writes a social proof draft to `artifacts/demo/poidh-social-<bountyId>.md` for demo runs and `artifacts/production/poidh-social-<bountyId>.md` for live runs. You can paste either into X or Farcaster or hand it to a relay.
It also writes `artifacts/demo/poidh-farcaster-<bountyId>.json` and `.md` for demo runs, plus the same structure under `artifacts/production/` for live runs. These contain a ready-to-send cast payload with embeds and should be treated as the main public-proof handoff file.

Practical rule:
- Use `.env.demo.example` when you want the demo/test flow.
- Use `.env.production.example` when you want the production-style bounty creator mode.
- Fill the `DEMO_CLAIM_1_*` and `DEMO_CLAIM_2_*` fields only in the demo template.
- Leave those fields empty and keep `AUTO_SUBMIT_CLAIM=false` in the production template.

## Commands

Create a bounty:

```bash
npm run dev -- create-bounty
```

Evaluate a bounty without sending a transaction:

```bash
npm run dev -- evaluate-bounty --bounty-id 123
```

Submit a claim to a bounty:

```bash
npm run dev -- submit-claim --bounty-id 123
```

Run the watcher loop:

```bash
npm run dev -- watch-bounty --bounty-id 123
```

Run a full demo cycle that creates a bounty, auto-submits two claims from two wallets, evaluates the claims, and writes proof artifacts:

```bash
npm run dev -- demo-cycle
```

Or let the bot create and manage its own bounty from env defaults:

```bash
npm run dev -- run
```

That `run` mode is the production-style path: it creates the bounty, waits for public claims, evaluates them, posts a decision, and accepts or resolves on-chain without submitting a claim itself.

To get a follow-up explanation for a bounty, run:

```bash
npm run dev -- explain-bounty --bounty-id 123
```

## How it works

The code follows the official PoidhV3 flow from the project skill:

- `createSoloBounty` and `createOpenBounty` fund a bounty from an EOA
- `getClaimsByBountyId` fetches public submissions
- `poidhNft().tokenURI(claimId)` resolves the claim NFT metadata
- `acceptClaim` finalizes solo bounties
- `submitClaimForVote` and `resolveVote` handle open bounties with contributors

Claim evaluation is deterministic by default. It uses:

- token and description overlap
- the claim proof URL and metadata
- whether the claim resolves to image, video, or web evidence
- whether the evidence looks like a real-world proof artifact

That makes the reasoning easy to audit, which matters for a bounty like this.

## Social posting

Set `SOCIAL_POST_WEBHOOK_URL` if you want the bot to forward its decision summary to another service, such as a Farcaster or X relay you control.
If you want the post to carry an attribution line, set `SOCIAL_POST_AUTHOR=0x94t3z.eth` or another handle you want displayed.

If the webhook is unset, the bot prints the decision locally instead.

## Notes

- Poidh requires an EOA wallet. Smart contract wallets will fail on bounty creation and claim acceptance.
- This repo is set up for solo bounties first, because they are the simplest end-to-end proof of autonomy.
- If you want to use the bot for open bounties with external contributors, keep it running so it can submit the winning claim for vote and resolve the vote after the window closes.
- If you create a bounty with the bot's issuer wallet, use a separate claimant wallet for demos. Poidh prevents the issuer from claiming its own bounty.
- For test runs, set `EXPECTED_CLAIMANT_ADDRESS` so the bot will not accept or submit claims from any unexpected wallet.
- Demo runs write JSON and markdown artifacts to `artifacts/demo/` by default.
- Production runs write JSON and markdown artifacts to `artifacts/production/` by default.
- You can override either mode with `ARTIFACT_DIR`.
- The social proof artifact includes the exact post text and a few follow-up answers so your public proof stays consistent with the on-chain decision.
- The Farcaster proof artifact is the cast-ready payload for manual posting or a relay, and it is the preferred handoff for public proof.
- If you stop the bot and start it again without `BOUNTY_ID`, it will resume from the last bounty saved in `.poidh-state.json` unless you point `BOUNTY_STATE_FILE` somewhere else.

## Claim pack

See [CLAIM.md](./CLAIM.md) for a short submission-ready summary tied directly to bounty 216.

## Next step for the bounty

To turn this into a claim package, run a real demo on Arbitrum, capture the repo link, capture a transaction or two, and publish the decision explanation from the bot.
