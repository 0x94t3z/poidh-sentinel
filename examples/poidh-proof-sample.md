# Poidh Proof Sample

This is a sanitized example of the proof artifacts the bot produces after a bounty run.
It shows the same decision package that gets written to disk and can be shared through a relay or posted manually.

## Summary

- Chain: `arbitrum`
- Bounty: `Take a photo of something blue outdoors`
- Winner claim: `331`
- Status: `accepted on-chain`

## What the bot reported

- Name overlap matched `blue`
- Description/evidence overlap matched `blue`
- Proof resolved to an image
- Metadata included an image URL
- The evidence text looked like a real-world proof artifact

## Example output shape

```json
{
  "bountyId": "80",
  "winnerClaimId": "331",
  "score": 82,
  "reasons": [
    "Name overlap matched blue.",
    "Description/evidence overlap matched blue.",
    "Proof resolves to an image, which is strong evidence for a real-world task.",
    "Metadata includes an image URL.",
    "The evidence text looks like a real-world proof artifact.",
    "Claim is already accepted on-chain."
  ]
}
```

## Notes

- Real runtime reports are written to `artifacts/production/`.
- Generated folders stay out of git on purpose.
- The sample above is redacted enough to show the workflow without exposing live runtime files.
