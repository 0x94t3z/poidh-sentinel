# Bounty 216 claim pack

Target bounty: [Build An AI That Pays Humans To Do Things IRL](https://poidh.xyz/arbitrum/bounty/216)
Prepared by: `0x94t3z.eth`

## What this repo does

This repo implements a Poidh bot that can:

- Create a bounty from an EOA wallet
- Observe public claims
- Resolve claim URIs and metadata
- Score submissions deterministically
- Select a winner
- Accept the claim on-chain for solo bounties
- Submit the winning claim for vote and resolve the vote for open bounties
- Publish a decision explanation through a webhook-backed relay or local log
- Support an optional two-wallet demo harness and a production path that only watches public submissions

## Why this matches bounty 216

The bounty asks for an autonomous bot that can run a Poidh bounty end-to-end without human intervention after deployment. This repo provides that flow in code:

- `src/poidh.ts` handles chain calls and contract interaction.
- `src/evaluate.ts` ranks claims using proof content and description overlap.
- `src/bot.ts` orchestrates create, watch, evaluate, and accept actions.
- `src/artifacts.ts` writes demo and production proof artifacts for submission.
- `src/social.ts` prepares a public decision summary and X/Farcaster-ready cast draft.
- `src/main.ts` exposes both `demo-cycle` and production-style `run` modes, plus `explain-bounty` for follow-up reasoning.
- The shipped production preset is requirement-aligned: `Take a photo of something blue outdoors`.

## How autonomy is enforced

- The bot uses a dedicated EOA wallet for issuer actions.
- Demo submission slots use separate claimant wallets and never reuse the issuer wallet.
- Production `run` mode does not self-submit claims.
- The bot evaluates claims from on-chain `tokenURI` data and resolves payout actions without manual signing.
- The bot prepares an X/Farcaster-ready cast draft and social proof artifact so the decision can be published cleanly.

## Assumptions and limitations

- Public reasoning is forwarded through a webhook-backed relay or local log rather than a hard-coded X/Farcaster SDK.
- The repo does not hard-code a Farcaster login; it prepares a cast-ready payload for manual posting or a relay that publishes to X/Farcaster.
- For a production claim, the bounty must be completed organically by outside claimants.

## Demo proof

Run a demo cycle with:

```bash
npm run dev -- demo-cycle
```

That will:

1. Create a bounty
2. Auto-submit two claims from two wallets
3. Evaluate all claims
4. Choose a winner
5. Write a JSON report and markdown report to `artifacts/demo/`

For the strongest demo, use two different photos so the bot has to rank competing submissions instead of simply accepting the first valid one.

## Submission checklist

- Public repository URL
- Demo artifact files from `artifacts/demo/`
- Production artifact files from `artifacts/production/`
- Transaction hashes showing bounty creation and both claim submissions
- A public Farcaster post or relay-posted update showing the decision explanation
- A public Farcaster post or relay-posted update optionally attributed to `0x94t3z.eth`
- A demo or production artifact showing the claimant-side payout state

## Notes

- The bot uses EOA wallets because Poidh bounty creation and acceptance require `msg.sender == tx.origin`.
- For a real end-to-end demo, use three wallets total: one issuer wallet and two claimant wallets.
- The claimant wallets are configured in `.env.demo.example` with `DEMO_CLAIM_1_*` and `DEMO_CLAIM_2_*`.
- The repo is intentionally open source and reproducible from the checked-in files.
