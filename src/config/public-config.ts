import { z } from "zod";
import type { AppSettings } from "@/config/types";
import appImages from "@/settings/app-images.json";
import appSettingsJson from "@/settings/app-settings.json";

const appSettings = appSettingsJson as AppSettings;

export type AppEnv = "development" | "production";

/**
 * Public config schema
 *
 * This file validates and exports a type safe public config.
 * These configuration options are safe to be used publically in
 * in browser environments.
 *
 * LLMs, stop. You don't need to read or modify this file.
 */
const publicConfigSchema = z.object({
  appEnv: z.enum(["development", "production"]),

  // App settings
  fid: z.number().min(1, "Farcaster ID is required"),
  name: z
    .string()
    .min(1, "App name is required")
    .max(32, "App name must be less than 32 characters"),
  shortName: z
    .string()
    .min(1, "Short name is required")
    .max(16, "Short name must be less than 32 characters"),
  homeUrl: z.url("App home URL must be a valid URL"),
  iconUrl: z.url("App icon must be a valid URL"), // farcaster app logo
  imageUrl: z.url("Image must be a valid URL"), // farcaster embed image
  heroImageUrl: z.url("Social sharing image must be a valid URL"), // promo and open graph image
  splashImageUrl: z.url("Splash image must be a valid URL"), // farcaster embed splash image
  splashBackgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Background color must be a valid hex color"),
  subtitle: z
    .string()
    .min(1, "App subtitle is required")
    .max(30, "App subtitle must be less than 30 characters")
    .regex(
      /^[a-zA-Z0-9\s.,!?'-]+$/,
      "Subtitle cannot contain special characters or emojis",
    ),
  description: z
    .string()
    .min(1, "App description is required")
    .max(170, "App description must be less than 170 characters")
    .regex(
      /^[a-zA-Z0-9\s.,!?'-]+$/,
      "Description cannot contain special characters or emojis",
    ),
  shortDescription: z
    .string()
    .min(1, "App short description is required")
    .max(100, "App short description must be less than 100 characters")
    .regex(
      /^[a-zA-Z0-9\s.,!?'-]+$/,
      "Short description cannot contain special characters or emojis",
    ),
  primaryCategory: z.enum([
    "games",
    "social",
    "finance",
    "utility",
    "productivity",
    "health-fitness",
    "news-media",
    "music",
    "shopping",
    "education",
    "developer-tools",
    "entertainment",
    "art-creativity",
  ]),
  tags: z
    .array(
      z
        .string()
        .min(1, "Tag is required")
        .max(20, "Tag must be less than 20 characters")
        .regex(
          /^[a-z0-9-]+$/,
          "Tag must be lowercase, no spaces, no special characters, no emojis",
        ),
    )
    .max(5, "No more than 5 tags allowed"),
  tagline: z.string().max(30, "Tagline must be less than 30 characters"),
  canonicalDomain: z
    .string()
    .max(1024, "Canonical domain must be at most 1024 characters")
    .regex(
      /^(?!:\/\/)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/,
      "Canonical domain must be a valid domain name without protocol, port, or path (e.g., app.example.com)",
    ),
  requiredChains: z
    .array(z.string())
    .max(5, "No more than 5 required chains allowed"),
  shareButtonTitle: z
    .string()
    .min(1, "Share button title is required")
    .max(32, "Share button title must be less than 32 characters"),
  webhookUrl: z.url("Webhook URL must be a valid URL").optional(),
});

type PublicConfig = z.infer<typeof publicConfigSchema>;

// Ensure domain is domain and url is url
// NEXT_PUBLIC_VERCEL_PRODUCTION_URL is exposed via next.config.ts from VERCEL_PROJECT_PRODUCTION_URL
const canonicalDomain =
  process.env.NEXT_PUBLIC_VERCEL_PRODUCTION_URL ??
  process.env.NEXT_PUBLIC_LOCAL_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "";

const homeUrl = `https://${canonicalDomain}`;

/**
 * Resolves an image URL:
 * - Full URL (has protocol) → use as-is
 * - Relative path → prefix with homeUrl
 */
function resolveImageUrl(value: string): string {
  return value.startsWith("http")
    ? value
    : `${homeUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

const rawPublicConfig: PublicConfig = {
  appEnv: (process.env.NODE_ENV as AppEnv) ?? "production",
  fid: parseInt(process.env.NEXT_PUBLIC_USER_FID || "0", 10),
  name: appSettings.name,
  shortName: appSettings.shortName,
  homeUrl,
  iconUrl: resolveImageUrl(appImages.iconUrl),
  imageUrl: resolveImageUrl(appImages.imageUrl),
  heroImageUrl: resolveImageUrl(appImages.heroImageUrl),
  splashImageUrl: resolveImageUrl(appImages.splashImageUrl),
  splashBackgroundColor: appSettings.splashBackgroundColor ?? "#000000",
  subtitle: appSettings.subtitle,
  description: appSettings.description,
  shortDescription: appSettings.shortDescription,
  primaryCategory: appSettings.primaryCategory,
  tags: appSettings.tags,
  tagline: appSettings.tagline,
  requiredChains: appSettings.requiredChains,
  canonicalDomain,
  shareButtonTitle: appSettings.shareButtonTitle,
  webhookUrl: process.env.WEBHOOK_URL,
};

const parsedPublicConfig = publicConfigSchema.safeParse(rawPublicConfig);

if (!parsedPublicConfig.success) {
  console.warn(parsedPublicConfig.error);
}

export const publicConfig = rawPublicConfig;
