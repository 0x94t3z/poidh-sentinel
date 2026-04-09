import { NextRequest, NextResponse } from "next/server";
import { getBotWalletAddress } from "@/features/bot/poidh-contract";
import { getAllBounties } from "@/features/bot/bounty-store";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;
  const hasApiKey = !!process.env.NEYNAR_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasSignerUuid = !!process.env.BOT_SIGNER_UUID;
  const hasWebhookSecret = !!process.env.NEYNAR_WEBHOOK_SECRET;
  const hasWalletKey = !!process.env.BOT_WALLET_PRIVATE_KEY;

  const ready = hasApiKey && hasOpenRouter && hasSignerUuid && hasWalletKey;

  const walletAddress = getBotWalletAddress();
  const bounties = await getAllBounties();
  const openBounties = bounties.filter((b) => b.status === "open" || b.status === "evaluating").length;
  const closedBounties = bounties.filter((b) => b.status === "closed").length;

  return NextResponse.json({
    ready,
    config: {
      neynarApiKey: hasApiKey,
      openRouterKey: hasOpenRouter,
      signerUuid: hasSignerUuid,
      webhookSecret: hasWebhookSecret,
      walletKey: hasWalletKey,
    },
    wallet: {
      address: walletAddress,
      chain: "arbitrum",
      contractAddress: "0x5555Fa783936C260f77385b4E153B9725feF1719",
      fundingNote: "send ETH on arbitrum or base to this address to fund bounties",
    },
    bounties: {
      total: bounties.length,
      open: openBounties,
      closed: closedBounties,
    },
    botFid: parseInt(process.env.BOT_FID ?? "0", 10),
    botUsername: process.env.BOT_USERNAME ?? "poidh-sentinel",
    webhookEndpoint: "/api/webhook/farcaster",
    cronEndpoint: "/api/cron/bounty-loop",
  });
}
