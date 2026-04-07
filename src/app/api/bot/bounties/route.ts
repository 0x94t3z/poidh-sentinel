import { NextResponse } from "next/server";
import { getAllBounties } from "@/features/bot/bounty-store";
import { getBountyDetails, getPublicClient, POIDH_CONTRACTS } from "@/features/bot/poidh-contract";
import { formatEther } from "viem";

export async function GET(): Promise<NextResponse> {
  const bounties = await getAllBounties();

  // For each non-pending bounty, fetch live amount from the contract in parallel
  const enriched = await Promise.all(
    bounties.map(async (b) => {
      if (b.bountyId.startsWith("pending-") || b.status === "closed") {
        return { ...b, liveAmountEth: null };
      }
      try {
        const details = await getBountyDetails(BigInt(b.bountyId), b.chain);
        const liveAmountEth = parseFloat(formatEther(details.amount)).toFixed(6).replace(/\.?0+$/, "");
        return { ...b, liveAmountEth };
      } catch {
        // Contract fetch failed — fall back to stored amount
        return { ...b, liveAmountEth: null };
      }
    }),
  );

  return NextResponse.json({ bounties: enriched });
}
