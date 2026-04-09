import { NextResponse } from "next/server";
import { getBotWalletAddress } from "@/features/bot/poidh-contract";
import { getAllBounties } from "@/features/bot/bounty-store";

export async function GET(): Promise<NextResponse> {
  const hasApiKey = !!process.env.NEYNAR_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasSignerUuid = !!process.env.BOT_SIGNER_UUID;
  const hasWebhookSecret = !!process.env.NEYNAR_WEBHOOK_SECRET;
  const hasWalletKey = !!process.env.BOT_WALLET_PRIVATE_KEY;

  // Ready = all required keys present. Groq is recommended but not strictly required (OpenRouter fallback).
  const ready = hasApiKey && (hasOpenRouter || hasGroq) && hasSignerUuid && hasWalletKey;

  const walletAddress = getBotWalletAddress();
  const bounties = await getAllBounties();
  const openBounties = bounties.filter((b) => b.status === "open" || b.status === "evaluating").length;
  const closedBounties = bounties.filter((b) => b.status === "closed").length;

  return NextResponse.json({
    ready,
    config: {
      neynarApiKey: hasApiKey,
      openRouterKey: hasOpenRouter,
      groqKey: hasGroq,
      signerUuid: hasSignerUuid,
      webhookSecret: hasWebhookSecret,
      walletKey: hasWalletKey,
    },
    wallet: {
      address: walletAddress,
      fundingNote: "send ETH (arbitrum/base) or DEGEN (degen chain) to this address for gas",
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
