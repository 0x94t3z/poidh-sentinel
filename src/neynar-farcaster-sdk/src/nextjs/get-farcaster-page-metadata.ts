import { Metadata } from "next";
import { MiniAppEmbedNext } from "@farcaster/miniapp-sdk";
import { parsePageSearchParams } from "./helpers";

type FarcasterPageMetadataProps = {
  title: string;
  description: string;
  homeUrl: string;
  path: string;
  splashImageUrl: string;
  splashBackgroundColor: string;
  buttonTitle: string;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function getFarcasterPageMetadata({
  title,
  description,
  homeUrl,
  path,
  splashImageUrl,
  splashBackgroundColor,
  buttonTitle,
  searchParams,
}: FarcasterPageMetadataProps): Promise<Metadata> {
  const params = await parsePageSearchParams(searchParams);
  const paramKeys = Object.keys(params);
  const isPersonalized = paramKeys.includes("personalize");

  const conditionalQueryString =
    isPersonalized && paramKeys.length > 0
      ? `?${new URLSearchParams(params).toString()}`
      : "";

  // Remove leading slashes from path
  const cleanPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  const pagePath = `${homeUrl}${cleanPath}${conditionalQueryString}`;

  const shareImageRoot = `${homeUrl}/api/share/image`;
  const ogImageUrlValue = `${shareImageRoot}/og${conditionalQueryString}`;
  const farcasterImageUrlValue = `${shareImageRoot}/farcaster${conditionalQueryString}`;

  const embed: MiniAppEmbedNext = {
    version: "next",
    imageUrl: farcasterImageUrlValue,
    button: {
      title: buttonTitle,
      action: {
        type: "launch_miniapp",
        name: title,
        url: pagePath,
        splashImageUrl,
        splashBackgroundColor,
      },
    },
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrlValue, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrlValue],
    },
    other: {
      "fc:miniapp": JSON.stringify(embed),
    },
  };
}
