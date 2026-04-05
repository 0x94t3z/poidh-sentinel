# Poidh Proof Sample

This is a sanitized example of the proof artifacts the bot produces after a bounty run.
It shows the same decision package that gets written to disk and can be shared through a relay or posted manually.

## Summary

- Chain: `arbitrum`
- Bounty: `Take a photo of a clock showing the current time outdoors`
- Winner claim: `341`
- Status: `accepted on-chain`
- Proof folders: `artifacts/production/83` and `artifacts/relay/83`

## What the production report includes

- Description/evidence overlap matched `time`
- Proof resolved to an image
- Metadata included an image URL
- Vision summary captured the visible handwritten text from the image
- The evidence text looked like a real-world proof artifact
- Winner state was confirmed as already accepted on-chain

## Example production output shape

```json
{
  "bountyId": "83",
  "winnerClaimId": "341",
  "score": 61,
  "reasons": [
    "Description/evidence overlap matched time.",
    "Proof resolves to an image, which is strong evidence for a real-world task.",
    "Metadata includes an image URL.",
    "Vision summary: Visible handwritten text: Sunday 5th April 2026, @lorah24, poidh.",
    "The evidence text looks like a real-world proof artifact.",
    "Claim is already accepted on-chain.",
    "Claim is already accepted on-chain, so it is treated as final-valid regardless of strict signal mismatches."
  ]
}
```

## Example relay output shape

```json
{
  "targets": ["farcaster"],
  "decision": {
    "bountyId": "83",
    "bountyTitle": "Take a photo of a clock showing the current time outdoors",
    "winningClaimId": "341",
    "url": "https://poidh.xyz/arbitrum/bounty/263"
  },
  "followUpAnswers": [
    {
      "question": "Why did this claim win?",
      "answer": "Description/evidence overlap matched time. Proof resolves to an image..."
    }
  ]
}
```

## Notes

- Runtime reports are written to `artifacts/production/<bountyId>/`.
- Relay payloads are written to `artifacts/relay/<bountyId>/`.
- The report keeps both the declared bounty amount and the current chain amount when they differ.
- For submission, selected proof bundles can be committed to git for reviewer verification.
- The sample above is redacted enough to show the workflow without exposing secrets.
