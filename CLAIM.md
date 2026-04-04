# Bounty 216 claim pack

Target bounty: [Build An AI That Pays Humans To Do Things IRL](https://poidh.xyz/arbitrum/bounty/216)

## What this repo does

This repo provides a production-style autonomous Poidh bot that:

- Creates a bounty from an issuer EOA
- Watches public claims
- Evaluates claims with deterministic, auditable logic
- Selects a winner automatically
- Executes `acceptClaim` (solo) or open-bounty vote flow on-chain
- Produces a public decision explanation payload for X publishing

## Why this matches the requirement

- Wallet handling logic: `src/poidh.ts`
- Chain interaction logic: `src/poidh.ts`
- Submission monitoring: `src/bot.ts` watcher loop
- Evaluation logic: `src/evaluate.ts`
- Winner selection logic: `src/bot.ts` (highest score)
- Automation entrypoint: `src/main.ts` (`run`, `watch-bounty`)
- Public reasoning + social payload: `src/social.ts` and `src/artifacts.ts`
- X relay: `src/relay.ts`

## Autonomy model

- Bot signs transactions from `PRIVATE_KEY` directly (EOA).
- `run` creates the bounty if missing, then loops automatically.
- No manual acceptance step is needed when `AUTO_ACCEPT=true`.
- Decision summaries and follow-up Q/A text are generated and written to artifacts.

## Assumptions and limitations

- Social publishing is automated through `SOCIAL_POST_WEBHOOK_URL` (relay).
- The relay uses X API credentials to publish the decision thread.
- If the relay is unset, output is still generated locally in artifacts and stdout.
- Open bounty finalization depends on Poidh voting window timing.

## Runtime outputs for proof

`ARTIFACT_DIR=artifacts/production` (default for `run` / `watch-bounty`) writes:

- `poidh-production-<bountyId>.json|md`
- `poidh-social-<bountyId>.json|md`
- `poidh-farcaster-<bountyId>.json|md` (social draft only)

## Submission checklist

- Public repo link
- Proof of one real end-to-end bounty run on Poidh
- Public X decision post link
- Matching artifact files from `artifacts/production/`
