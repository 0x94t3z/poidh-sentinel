import { NextRequest, NextResponse } from "next/server";
import { publicConfig } from "@/config/public-config";
import { getShareImageResponse } from "@/neynar-farcaster-sdk/src/nextjs/get-share-image-response";

type RouteContext = {
  params: { type: string };
};

function isPersonalizeEnabled(req: NextRequest): boolean {
  const value = req.nextUrl.searchParams.get("personalize");
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function GET(req: NextRequest, context: RouteContext): Promise<Response> {
  const { type } = context.params;
  const safeType = type === "og" || type === "farcaster" ? type : null;

  if (!safeType) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 404 });
  }

  const personalize = isPersonalizeEnabled(req);
  return getShareImageResponse({
    type: safeType,
    heroImageUrl: publicConfig.heroImageUrl,
    imageUrl: publicConfig.imageUrl,
    showDevWarning: process.env.NODE_ENV !== "production",
    personalize,
  });
}
