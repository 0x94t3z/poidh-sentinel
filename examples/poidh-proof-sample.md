# Poidh Proof Sample

This is a sanitized example of the proof artifacts the bot produces after a bounty run.
It shows the same decision package that gets written to disk and can be shared through a relay or posted manually.

## Summary

- Chain: `arbitrum`
- Bounty: `Photo of a handwritten note with today’s date`
- Winner claim: `346`
- Status: `evaluated; winner already accepted on-chain`
- Proof folders: `artifacts/production/84` and `artifacts/relay/84`

## What the production report includes

- Description/evidence overlap matched `handwritten`, `note`, and `poidh`
- Proof resolved to an image
- Metadata included an image URL
- Local OCR captured readable evidence text
- The evidence text looked like a real-world proof artifact
- Winner state was recorded as already accepted on-chain
- Strict signal notes were preserved in the artifact output

## Example production output shape

```json
{
  "bountyId": "84",
  "winnerClaimId": "346",
  "score": 73,
  "accepted": true,
  "proof": "https://beige-impossible-dragon-883.mypinata.cloud/ipfs/QmXTLL43tt1PYgkwnRQ3vd6bEZjSsnwbaJxwEp8UX2ibs5",
  "reasons": [
    "Description/evidence overlap matched handwritten, note, poidh.",
    "Proof resolves to an image, which is strong evidence for a real-world task.",
    "Metadata includes an image URL.",
    "The evidence text looks like a real-world proof artifact.",
    "Local OCR extracted readable text from the image proof.",
    "Claim is already accepted on-chain.",
    "Strict deterministic signal check flagged: missing clear date signal, missing clear username signal.",
    "Claim is already accepted on-chain, so it is treated as final-valid regardless of strict signal mismatches."
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
      "answer": "Description/evidence overlap matched handwritten, note, poidh. Proof resolves to an image, which is strong evidence for a real-world task. Metadata includes an image URL."
    },
    {
      "question": "What evidence did the bot check?",
      "answer": "It checked the claim tokenURI, claim metadata, resolved content type, and the submission text."
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
