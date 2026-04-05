import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const USER_AGENT = "poidh-sentinel/1.0";
const execFileAsync = promisify(execFile);
const ocrCache = new Map<string, Promise<string | undefined>>();
let warnedMissingTesseract = false;

function extensionForContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("png")) {
    return ".png";
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return ".jpg";
  }
  if (normalized.includes("webp")) {
    return ".webp";
  }
  if (normalized.includes("gif")) {
    return ".gif";
  }
  if (normalized.includes("heic") || normalized.includes("heif")) {
    return ".heic";
  }
  return ".img";
}

function normalizeOcrText(input: string): string | undefined {
  const normalized = input
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, 8_000);
}

async function runLocalOcr(imageUrl: string): Promise<string | undefined> {
  const response = await fetch(imageUrl, {
    headers: { "user-agent": USER_AGENT },
    redirect: "follow"
  }).catch(() => undefined);

  if (!response || !response.ok) {
    return undefined;
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    return undefined;
  }

  const tempDir = await mkdtemp(join(tmpdir(), "poidh-ocr-"));
  const imagePath = join(tempDir, `proof${extensionForContentType(contentType)}`);

  try {
    const imageBytes = Buffer.from(await response.arrayBuffer());
    await writeFile(imagePath, imageBytes);

    const { stdout } = await execFileAsync(
      "tesseract",
      [imagePath, "stdout", "--psm", "6", "-l", "eng"],
      {
        timeout: 20_000,
        maxBuffer: 1_000_000
      }
    );

    return normalizeOcrText(stdout);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT" && !warnedMissingTesseract) {
      warnedMissingTesseract = true;
      console.warn("[ocr] local tesseract CLI not found; skipping OCR. Install tesseract to enable OCR-first checks.");
    }
    return undefined;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function extractLocalOcrText(imageUrl: string): Promise<string | undefined> {
  const cached = ocrCache.get(imageUrl);
  if (cached) {
    return cached;
  }

  const task = runLocalOcr(imageUrl).catch(() => undefined);
  ocrCache.set(imageUrl, task);

  const result = await task;
  ocrCache.set(imageUrl, Promise.resolve(result));
  return result;
}

