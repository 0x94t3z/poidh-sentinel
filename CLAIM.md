# Poidh Sentinel claim pack

Target bounty: [Build An AI That Pays Humans To Do Things IRL](https://poidh.xyz/arbitrum/bounty/216)

## What this repo does

This repo provides a production-style autonomous Poidh bot that:

- Creates a bounty from an issuer EOA
- Watches public claims
- Evaluates claims with deterministic, auditable logic
- Selects a winner automatically
- Executes `acceptClaim` (solo) or open-bounty vote flow on-chain
- Produces a public decision explanation payload for Farcaster publishing or manual handoff when posting access is unavailable

## Why this matches the requirement

- Wallet handling logic: `src/poidh.ts`
- Chain interaction logic: `src/poidh.ts`
- Submission monitoring: `src/bot.ts` watcher loop
- Evaluation logic: `src/evaluate.ts`
- Winner selection logic: `src/bot.ts` (highest score)
- Automation entrypoint: `src/main.ts` (`run`, `watch-bounty`)
- Public reasoning + social payload: `src/social.ts` and `src/artifacts.ts`
- Farcaster relay: `src/relay.ts`
- Real-world guard: `src/bot.ts` rejects obvious digital-only bounty prompts before creation

## Autonomy model

- Bot signs transactions from `PRIVATE_KEY` directly (EOA).
- `run` creates the bounty if missing, then loops automatically.
- No manual acceptance step is needed when `AUTO_ACCEPT=true`.
- Decision summaries and follow-up Q/A text are generated and written to artifacts.

## Assumptions and limitations

- Social publishing is automated through `SOCIAL_POST_WEBHOOK_URL` (relay).
- The relay uses a Neynar signer UUID to publish the decision thread when the connected Farcaster account has posting access/credits.
- If posting is unavailable, the relay records the failure and the bot still generates local artifacts and a complete post draft.
- If `OPENROUTER_API_KEY` is set, Farcaster copy is optionally polished with `OPENROUTER_MODEL` (default `openrouter/free`).
- Native follow-up reply listening via `POST /webhooks/neynar` requires Neynar webhook access and verifies `X-Neynar-Signature` with `NEYNAR_WEBHOOK_SECRET` when enabled.
- On the free plan, the relay still exposes `POST /follow-up` as a manual fallback for forwarding question events.
- Open bounty finalization depends on Poidh voting window timing.

## Runtime outputs for proof

`ARTIFACT_DIR=artifacts/production` (default for `run` / `watch-bounty`) writes:

- `poidh-production-<bountyId>.json|md`
- `poidh-social-<bountyId>.json|md`
- `poidh-farcaster-<bountyId>.json|md` (social draft only)

## Submission checklist

- Public repo link
- Proof of one real end-to-end bounty run on Poidh
- Public Farcaster decision post link
- Matching artifact files from `artifacts/production/`
