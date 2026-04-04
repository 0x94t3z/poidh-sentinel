# Poidh Sentinel

Open-source TypeScript bot for autonomous Poidh bounty execution.

It creates a bounty from an EOA wallet, monitors claims, scores submissions with auditable logic, picks a winner, executes on-chain resolution, and produces social-proof output for X publishing.

## Requirement match

- EOA control: issuer actions sign from `PRIVATE_KEY` (no MetaMask/manual prompt flow)
- Bounty creation: `create-bounty` or `run`
- Submission monitoring: polling loop in `run` / `watch-bounty`
- Evaluation logic: deterministic scoring in `src/evaluate.ts`
- Winner selection: highest-score claim in `src/bot.ts`
- On-chain payout flow:
  - Solo bounty: `acceptClaim`
  - Open bounty: `submitClaimForVote` then `resolveVote`
- Public reasoning:
  - decision text is generated automatically
  - JSON/markdown artifacts are written to `artifacts/production/`
  - webhook payload includes follow-up Q/A for transparent social replies
  - local relay can auto-post to X without manual compose

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
- For X posting, set `X_CONSUMER_KEY`, `X_CONSUMER_SECRET`, `X_ACCESS_TOKEN`, and `X_ACCESS_TOKEN_SECRET`

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

Social post order of execution:
- If `SOCIAL_POST_WEBHOOK_URL` is set, bot sends full decision payload to your relay/poster service.
- The relay can publish the decision to X using your X API credentials.
- If no relay is configured, bot prints the decision locally and still writes proof artifacts.

Relay payload includes a deterministic `followUpAnswers` array so your poster can auto-reply with reasoning context.

Run the relay locally with:

```bash
npm run relay
```

Artifacts written to `artifacts/production/`:
- `poidh-production-<bountyId>.json|md`
- `poidh-social-<bountyId>.json|md`
- `poidh-x-<bountyId>.json|md` (social draft only)

These include winner, reasons, and follow-up Q/A text.

## Notes

- Poidh requires EOA wallets for issuer actions.
- If you stop and restart without `BOUNTY_ID`, bot resumes from `BOUNTY_STATE_FILE` (`.poidh-state.json` by default).
- Keep `AUTO_ACCEPT=true` for autonomous payout behavior.

## Claim pack

See [CLAIM.md](./CLAIM.md) and [examples/poidh-proof-sample.md](./examples/poidh-proof-sample.md).
