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

## Why this repo exists

The bounty at `poidh.xyz/arbitrum/bounty/216` asks for a bot that can run poidh end-to-end without human intervention. This repo gives you a reproducible starting point for that automation.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Copy the environment template.

```bash
cp .env.example .env
```

3. Fill in your values.

- `PRIVATE_KEY` must be an EOA private key, not a smart wallet.
- `CLAIM_PRIVATE_KEY` is optional, but it should be a different EOA if you want the bot to submit a proof claim on a bounty it created.
- `RPC_URL` should point at the chain you want to use.
- `POIDH_CHAIN` must be `arbitrum`, `base`, or `degen`.

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

Run a full demo cycle that creates a bounty, submits a claim from the claimant wallet, evaluates the claims, and writes proof artifacts:

```bash
npm run dev -- demo-cycle
```

Or let the bot create and manage its own bounty from env defaults:

```bash
npm run dev -- run
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

If the webhook is unset, the bot prints the decision locally instead.

## Notes

- Poidh requires an EOA wallet. Smart contract wallets will fail on bounty creation and claim acceptance.
- This repo is set up for solo bounties first, because they are the simplest end-to-end proof of autonomy.
- If you want to use the bot for open bounties with external contributors, keep it running so it can submit the winning claim for vote and resolve the vote after the window closes.
- If you create a bounty with the bot's issuer wallet, use a separate claimant wallet for demos. Poidh prevents the issuer from claiming its own bounty.
- Demo runs write JSON and markdown artifacts to `artifacts/` by default. You can override that with `ARTIFACT_DIR`.

## Next step for the bounty

To turn this into a claim package, run a real demo on Arbitrum, capture the repo link, capture a transaction or two, and publish the decision explanation from the bot.
