import { publicConfig } from "@/config/public-config";
import { MiniApp } from "@/features/app/mini-app";
import { getFarcasterPageMetadata } from "@/neynar-farcaster-sdk/src/nextjs/get-farcaster-page-metadata";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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
  const botEnabled = (process.env.BOT_ENABLED ?? "true").toLowerCase() !== "false";
  const redirectUrl = process.env.BOT_REDIRECT_URL;
  if (!botEnabled && redirectUrl) {
    redirect(redirectUrl);
  }

  if (!botEnabled) {
    return (
      <main className="min-h-dvh bg-[#0a0a0a] text-white grid place-items-center p-6">
        <div className="max-w-md w-full rounded-xl border border-white/10 bg-[#111] p-5 text-center">
          <p className="text-sm text-gray-300 mb-2">this deployment is paused</p>
          <p className="text-xs text-gray-500 mb-4">
            set <code>BOT_ENABLED=true</code> to re-enable it.
          </p>
          <p className="text-xs text-gray-500">
            optional: set <code>BOT_REDIRECT_URL</code> to auto-redirect users to your active deployment.
          </p>
          {redirectUrl && (
            <Link href={redirectUrl} className="inline-block mt-4 text-sm text-green-400 underline">
              open active deployment
            </Link>
          )}
        </div>
      </main>
    );
  }

  const botUsername = process.env.BOT_USERNAME ?? "poidh-sentinel";
  return <MiniApp botUsername={botUsername} />;
}
