# Poidh Sentinel claim pack

Target bounty: [Build An AI That Pays Humans To Do Things IRL](https://poidh.xyz/arbitrum/bounty/216)

## What this repo does

Poidh Sentinel is a production-style autonomous Poidh bot that creates a bounty from an issuer EOA, watches public claims, evaluates them with deterministic and auditable logic, selects a winner automatically, executes `acceptClaim` for solo bounties or the open-bounty vote flow on-chain, and publishes a Farcaster decision thread or a local handoff draft when posting access is unavailable.

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

Social publishing is handled through `SOCIAL_POST_WEBHOOK_URL` and a Farcaster relay that can publish the decision thread with Neynar when the connected account has posting access and credits, while still writing the full decision draft and proof artifacts locally if posting is unavailable. When `OPENROUTER_API_KEY` is present, the relay can optionally polish the Farcaster copy with `OPENROUTER_MODEL` (default `openrouter/free`). Native follow-up reply listening via `POST /webhooks/neynar` is supported when Neynar webhook access is enabled and verifies `X-Neynar-Signature` with `NEYNAR_WEBHOOK_SECRET`; on the free path, the relay still exposes `POST /follow-up` as a manual fallback for forwarded question events. Open-bounty finalization still depends on Poidh voting window timing.

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
