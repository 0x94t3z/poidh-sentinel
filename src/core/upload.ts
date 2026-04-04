import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

export type PinataUploadResult = {
  id: string;
  cid: string;
  name: string;
  mimeType: string;
  gatewayUrl: string;
};

const DEFAULT_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs";

function detectMimeType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}

function normalizeGatewayUrl(gatewayUrl: string): string {
  return gatewayUrl.replace(/\/+$/, "");
}

async function uploadBlobToPinata(
  blob: Blob,
  fileName: string,
  jwt: string,
  gatewayUrl = DEFAULT_GATEWAY_URL
): Promise<PinataUploadResult> {
  const form = new FormData();
  form.append("network", "public");
  form.append("name", fileName);
  form.append("file", blob, fileName);

  const response = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: {
      authorization: `Bearer ${jwt}`
    },
    body: form
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Pinata upload failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`
    );
  }

  const payload = (await response.json()) as {
    data?: {
      id?: string;
      cid?: string;
      name?: string;
      mime_type?: string;
    };
  };

  const data = payload.data;
  if (!data?.cid) {
    throw new Error("Pinata upload succeeded but no CID was returned.");
  }

  const gatewayBase = normalizeGatewayUrl(gatewayUrl);
  return {
    id: data.id ?? "",
    cid: data.cid,
    name: data.name ?? fileName,
    mimeType: (data.mime_type ?? blob.type) || "application/octet-stream",
    gatewayUrl: `${gatewayBase}/${data.cid}`
  };
}

export async function uploadProofFileToPinata(
  filePath: string,
  jwt: string,
  gatewayUrl = DEFAULT_GATEWAY_URL
): Promise<PinataUploadResult> {
  const fileName = basename(filePath);
  const mimeType = detectMimeType(filePath);
  const fileContents = await readFile(filePath);
  const blob = new Blob([fileContents], { type: mimeType });
  return uploadBlobToPinata(blob, fileName, jwt, gatewayUrl);
}

export async function uploadClaimMetadataToPinata(
  metadata: Record<string, unknown>,
  jwt: string,
  gatewayUrl = DEFAULT_GATEWAY_URL,
  fileName = "claim-metadata.json"
): Promise<PinataUploadResult> {
  const json = JSON.stringify(metadata);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  return uploadBlobToPinata(blob, fileName, jwt, gatewayUrl);
}
