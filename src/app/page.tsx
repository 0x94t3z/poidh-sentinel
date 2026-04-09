import { publicConfig } from "@/config/public-config";
import { MiniApp } from "@/features/app/mini-app";
import { getFarcasterPageMetadata } from "@/neynar-farcaster-sdk/src/nextjs/get-farcaster-page-metadata";
import { Metadata } from "next";

type HomePageMetadataProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: HomePageMetadataProps): Promise<Metadata> {
  return getFarcasterPageMetadata({
    title: publicConfig.name,
    description: publicConfig.description,
    homeUrl: publicConfig.homeUrl,
    path: "",
    splashImageUrl: publicConfig.splashImageUrl,
    splashBackgroundColor: publicConfig.splashBackgroundColor,
    buttonTitle: publicConfig.shareButtonTitle,
    searchParams,
  });
}

export default function Home() {
  const botUsername = process.env.BOT_USERNAME ?? "poidh-sentinel";
  return <MiniApp botUsername={botUsername} />;
}
