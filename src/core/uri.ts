import type { ClaimEvidence } from "./types.js";
import { extractLocalOcrText } from "./ocr.js";

const USER_AGENT = "poidh-sentinel/1.0";

function normalizeUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  if (uri.startsWith("ar://")) {
    return uri.replace("ar://", "https://arweave.net/");
  }
  return uri;
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeJson(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

async function withLocalOcr(evidence: ClaimEvidence): Promise<ClaimEvidence> {
  if (!evidence.contentType.toLowerCase().startsWith("image/")) {
    return evidence;
  }

  const imageUrl = evidence.imageUrl ?? evidence.contentUri;
  if (!imageUrl) {
    return evidence;
  }

  const ocrText = await extractLocalOcrText(imageUrl);
  if (!ocrText) {
    return evidence;
  }

  return {
    ...evidence,
    ocrText
  };
}

export async function resolveClaimEvidence(tokenUri: string): Promise<ClaimEvidence> {
  const contentUri = normalizeUri(tokenUri);
  const response = await fetch(contentUri, {
    headers: { "user-agent": USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch claim evidence: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("image/") || contentType.startsWith("video/")) {
    return withLocalOcr({
      tokenUri: contentUri,
      contentUri,
      contentType,
      text: "",
      imageUrl: contentType.startsWith("image/") ? contentUri : undefined,
      animationUrl: contentType.startsWith("video/") ? contentUri : undefined
    });
  }

  const body = await response.text();

  let text = "";
  let title: string | undefined;
  let imageUrl: string | undefined;
  let animationUrl: string | undefined;
  let rawMetadata: unknown;
  let resolvedContentUri = contentUri;

  if (contentType.includes("application/json") || looksLikeJson(body)) {
    try {
      const metadata = JSON.parse(body) as Record<string, unknown>;
      rawMetadata = metadata;
      title = typeof metadata.name === "string" ? metadata.name : undefined;
      imageUrl = typeof metadata.image === "string" ? normalizeUri(metadata.image) : undefined;
      animationUrl =
        typeof metadata.animation_url === "string" ? normalizeUri(metadata.animation_url) : undefined;
      const maybeContentUri = animationUrl ?? imageUrl ?? contentUri;
      resolvedContentUri = maybeContentUri;

      if (maybeContentUri !== contentUri) {
        const nested = await fetch(maybeContentUri, {
          headers: { "user-agent": USER_AGENT }
        });
        if (!nested.ok) {
          throw new Error(`Failed to fetch nested claim evidence: ${nested.status} ${nested.statusText}`);
        }
        const nestedType = nested.headers.get("content-type") ?? "";
        if (nestedType.startsWith("image/") || nestedType.startsWith("video/")) {
          return withLocalOcr({
            tokenUri: contentUri,
            contentUri: maybeContentUri,
            contentType: nestedType || contentType,
            title,
            text: "",
            imageUrl: nestedType.startsWith("image/") ? maybeContentUri : imageUrl,
            animationUrl: nestedType.startsWith("video/") ? maybeContentUri : animationUrl,
            rawMetadata
          });
        }
        const nestedBody = await nested.text();
        text = nestedType.includes("text/html") ? stripHtml(nestedBody) : nestedBody.trim();
        return {
          tokenUri: contentUri,
          contentUri: maybeContentUri,
          contentType: nestedType || contentType,
          title,
          text: text.slice(0, 20_000),
          imageUrl,
          animationUrl,
          rawMetadata
        };
      }

      text = stripHtml(body);
    } catch {
      text = body.trim();
    }
  } else if (contentType.includes("text/html")) {
    text = stripHtml(body);
  } else {
    text = body.trim();
  }

  return {
    tokenUri: contentUri,
    contentUri: resolvedContentUri,
    contentType,
    title,
    text: text.slice(0, 20_000),
    imageUrl,
    animationUrl,
    rawMetadata
  };
}

export function buildClaimTokenUri(params: {
  name: string;
  description: string;
  imageUrl: string;
  animationUrl?: string;
}): string {
  const metadata: Record<string, string> = {
    name: params.name,
    description: params.description,
    image: params.imageUrl
  };

  if (params.animationUrl) {
    metadata.animation_url = params.animationUrl;
  }

  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(metadata))}`;
}

export function isJsonMetadataTokenUri(tokenUri: string): boolean {
  return tokenUri.startsWith("data:application/json") || tokenUri.endsWith(".json");
}
