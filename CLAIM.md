# Poidh Sentinel claim pack

Target bounty: [Build An AI That Pays Humans To Do Things IRL](https://poidh.xyz/arbitrum/bounty/216)

## What this repo does

Poidh Sentinel is an open-source TypeScript bot for Poidh bounty workflows. It creates a bounty from an issuer EOA, watches public claims, evaluates them with deterministic scoring, picks a winner, resolves the bounty on-chain, and publishes a public decision update through a relay.

It supports Poidh on Arbitrum, Base, and Degen Chain by selecting the chain through `TARGET_CHAIN` and using the matching contract and frontend offsets.

## Why it matches

- EOA control: `src/main.ts` and `src/core/poidh.ts`
- Bounty creation: `src/main.ts` (`requirements-flow`)
- Submission monitoring: `src/bot.ts` watcher loop
- Evaluation logic: `src/core/evaluate.ts`
- Winner selection logic: `src/bot.ts` (highest score, duplicate-evidence penalty, earliest-submission tie-break)
- On-chain payout flow: `acceptClaim`, `submitClaimForVote`, and `resolveVote`
- Public reasoning: `src/core/social.ts`, `src/core/artifacts.ts`, `src/runtime/decisionArtifacts.ts`, and `src/runtime/relay*`
- Real-world guard: `src/bot.ts` rejects obvious digital-only bounty prompts before creation

## Autonomy model

- The bot signs transactions from `BOT_PRIVATE_KEY` directly.
- `requirements-flow` creates the bounty if missing, then keeps monitoring automatically.
- `AUTO_FINALIZE_WINNER=true` lets the bot finalize the winning claim without a manual step.
- `MIN_PARTICIPANTS_BEFORE_FINALIZE` and `FIRST_CLAIM_COOLDOWN_SECONDS` keep the bounty open long enough for organic competition. `FIRST_CLAIM_COOLDOWN_SECONDS` is a bot-side delay after the first claim is observed; it is not Poidh's own end timer.
- If `MIN_PARTICIPANTS_BEFORE_FINALIZE=2`, the bot intentionally waits after the first claim and only moves to final action once a second claim appears.
- Decision summaries and follow-up Q/A text are written to artifacts.

## Assumptions and limitations

Social publishing runs through `DECISION_WEBHOOK_URL` and a Farcaster relay that can publish the decision thread with Neynar when the connected account has posting access and credits, while still writing the full decision draft and proof artifacts locally if posting is unavailable. The relay posts one concise decision cast, then thread replies with full winner reasoning and validation details. When `OPENROUTER_API_KEY` is present, the relay can optionally polish the Farcaster copy with `COPY_POLISH_MODEL` (default `openrouter/free`). Native follow-up reply listening via `POST /webhooks/neynar` is supported when Neynar webhook access is enabled and verifies `X-Neynar-Signature` with `WEBHOOK_SIGNATURE_SECRET`; on the free path, the relay still exposes `POST /follow-up` as a manual fallback for forwarded question events. Open-bounty finalization still depends on Poidh voting window timing.

## Runtime outputs for proof

`PRODUCTION_ARTIFACT_DIR=artifacts/production` (default for `requirements-flow` / `watch-bounty`) writes:

- `<bountyId>/production.json|md`
- `<bountyId>/social.json|md`
- `<bountyId>/farcaster.json|md` (social draft only)

Relay payloads are written to `artifacts/relay/<bountyId>/relay.json|md`.

The production report keeps both the declared bounty amount and the current on-chain amount when they differ, so the proof trail stays honest if a bounty is resumed or inspected later.

## Submission checklist

- Public repo link
- Proof of one real end-to-end bounty run on Poidh
- Public Farcaster decision post link
- Matching artifact files from `artifacts/production/<bountyId>/` and `artifacts/relay/<bountyId>/`

## Submission draft

Title:

`Poidh Sentinel`

Description:

`This is my open-source bot for Poidh. It makes the bounty, watches claims, chooses the winner, and posts the result on Farcaster.`

`Repo: https://github.com/0x94t3z/poidh-sentinel.git`

`I also saved the run proof and artifacts in the repo.`
