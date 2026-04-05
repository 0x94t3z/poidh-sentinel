# Poidh Proof Sample

This is a sanitized example of the proof artifacts the bot produces after a bounty run.
It shows the same decision package that gets written to disk and can be shared through a relay or posted manually.

## Summary

- Chain: `arbitrum`
- Bounty: `Photo of a handwritten note with today’s date`
- Winner claim: `346`
- Status: `evaluated; final on-chain action deferred`
- Proof folders: `artifacts/production/84` and `artifacts/relay/84`

## What the production report includes

- Description/evidence overlap matched `handwritten`, `note`, and `poidh`
- Proof resolved to an image
- Metadata included an image URL
- AI summary captured the OCR/text-based evidence summary
- The evidence text looked like a real-world proof artifact
- Winner state was recorded in the decision artifacts

## Example production output shape

```json
{
  "bountyId": "84",
  "winnerClaimId": "346",
  "score": 23,
  "reasons": [
    "Description/evidence overlap matched handwritten, note, poidh.",
    "Proof resolves to an image, which is strong evidence for a real-world task.",
    "Metadata includes an image URL.",
    "AI summary: OCR output is garbled and does not contain any readable date, username, or the word 'poidh'.",
    "The evidence text looks like a real-world proof artifact.",
    "Local OCR extracted readable text from the image proof.",
    "Strict deterministic signal check flagged: missing clear date signal, missing clear username signal.",
    "AI evaluator unavailable; used deterministic scoring."
  ]
}
```

## Example relay output shape

```json
{
  "targets": ["farcaster"],
  "decision": {
    "bountyId": "84",
    "bountyTitle": "Photo of a handwritten note with today’s date",
    "winningClaimId": "346",
    "url": "https://poidh.xyz/arbitrum/bounty/264"
  },
  "followUpAnswers": [
    {
      "question": "Why did this claim win?",
      "answer": "Description/evidence overlap matched handwritten, note, poidh. Proof resolves to an image..."
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
