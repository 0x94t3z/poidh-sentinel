import { NextResponse } from "next/server";
import { publicConfig } from "@/config/public-config";
import accountAssociation from "@/config/account-association.json";

export async function GET() {
  try {
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error generating metadata:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

const config = {
  accountAssociation,
  miniapp: {
    version: "1",
    name: publicConfig.name.slice(0, 32),
    homeUrl: publicConfig.homeUrl,
    iconUrl: publicConfig.iconUrl,
    splashImageUrl: publicConfig.splashImageUrl,
    splashBackgroundColor: publicConfig.splashBackgroundColor,
    subtitle: publicConfig.subtitle.slice(0, 30),
    description: publicConfig.description.slice(0, 170),
    primaryCategory: publicConfig.primaryCategory,
    tags: publicConfig.tags.slice(0, 5).map((tag) => tag.slice(0, 20)),
    heroImageUrl: publicConfig.heroImageUrl,
    tagline: publicConfig.tagline.slice(0, 30),
    ogTitle: publicConfig.name.slice(0, 32),
    ogDescription: publicConfig.shortDescription.slice(0, 100),
    ogImageUrl: publicConfig.heroImageUrl,
    canonicalDomain: publicConfig.canonicalDomain.slice(0, 1024),
    requiredChains: publicConfig.requiredChains,
    webhookUrl: publicConfig.webhookUrl,
  },
};
