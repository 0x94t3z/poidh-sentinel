# Bounty 216 claim pack

Target bounty: [Build An AI That Pays Humans To Do Things IRL](https://poidh.xyz/arbitrum/bounty/216)

## What this repo does

This repo implements a Poidh bot that can:

- Create a bounty from an EOA wallet
- Observe public claims
- Resolve claim URIs and metadata
- Score submissions deterministically
- Select a winner
- Accept the claim on-chain for solo bounties
- Submit the winning claim for vote and resolve the vote for open bounties
- Publish a decision explanation through a webhook or local log

## Why this matches bounty 216

The bounty asks for an autonomous bot that can run a Poidh bounty end-to-end without human intervention after deployment. This repo provides that flow in code:

- `src/poidh.ts` handles chain calls and contract interaction.
- `src/evaluate.ts` ranks claims using proof content and description overlap.
- `src/bot.ts` orchestrates create, watch, evaluate, and accept actions.
- `src/artifacts.ts` writes demo proof artifacts for submission.
- `src/social.ts` posts a public decision summary through a webhook.

## Demo proof

Run a demo cycle with:

```bash
npm run dev -- demo-cycle
```

That will:

1. Create a bounty
2. Submit a claim from the claimant wallet
3. Evaluate all claims
4. Choose a winner
5. Write a JSON report and markdown report to `artifacts/`

## Submission checklist

- Public repository URL
- Demo artifact files from `artifacts/`
- A transaction hash showing bounty creation and claim submission
- A public post showing the decision explanation

## Notes

- The bot uses EOA wallets because Poidh bounty creation and acceptance require `msg.sender == tx.origin`.
- For a real end-to-end demo, use two wallets: one issuer wallet and one claimant wallet.
- The claimant wallet is configured with `DEMO_CLAIM_PRIVATE_KEY` in `.env.example`.
- The repo is intentionally open source and reproducible from the checked-in files.
