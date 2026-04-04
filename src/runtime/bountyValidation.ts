function normalizePrompt(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function validateRealWorldBounty(name: string, description: string): string[] {
  const combined = normalizePrompt(`${name} ${description}`);
  const requiredSignals = [
    "photo",
    "picture",
    "image",
    "video",
    "physical",
    "outdoor",
    "outdoors",
    "proof",
    "irl",
    "real world",
    "show",
    "capture",
    "record",
    "take a photo",
    "take a picture"
  ];
  const digitalSignals = [
    "github",
    "repo",
    "website",
    "web site",
    "json",
    "csv",
    "api",
    "code",
    "program",
    "script",
    "click",
    "like",
    "follow",
    "retweet",
    "star",
    "mint",
    "online only",
    "digital only"
  ];

  const matchedRequired = requiredSignals.filter((signal) => combined.includes(signal));
  const matchedDigital = digitalSignals.filter((signal) => combined.includes(signal));

  const reasons: string[] = [];
  if (matchedRequired.length === 0) {
    reasons.push(
      "The bounty text must clearly ask for a real-world action such as a photo, video, physical task, or proof of action."
    );
  }
  if (matchedDigital.length > 0 && matchedRequired.length === 0) {
    reasons.push(
      `The bounty text looks digital-only because it includes: ${matchedDigital.join(", ")}.`
    );
  }

  return reasons;
}
