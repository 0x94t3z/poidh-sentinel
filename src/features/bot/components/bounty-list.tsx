"use client";

interface BountyListItem {
  bountyId: string;
  name: string;
  chain?: string;
  status?: string;
  claimCount?: number;
}

interface BountyListProps {
  bounties: BountyListItem[];
}

export function BountyList({ bounties }: BountyListProps) {
  if (bounties.length === 0) {
    return <p className="text-xs text-gray-500">no bounties yet</p>;
  }

  return (
    <div className="space-y-2">
      {bounties.map((bounty) => (
        <div key={bounty.bountyId} className="rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="text-sm font-semibold text-white">{bounty.name}</p>
          <p className="mt-1 text-xs text-gray-400">
            #{bounty.bountyId} {bounty.chain ? `• ${bounty.chain}` : ""}{" "}
            {bounty.status ? `• ${bounty.status}` : ""}
            {typeof bounty.claimCount === "number" ? ` • ${bounty.claimCount} claim(s)` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}
