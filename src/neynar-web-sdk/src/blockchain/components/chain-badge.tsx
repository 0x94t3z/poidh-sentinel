"use client";

import { Badge } from "@neynar/ui";
import { ChainIdentifier, getChainInfo } from "../types";

type ChainBadgeProps = {
  chain: ChainIdentifier;
  className?: string;
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "destructive"
    | "success"
    | "warning"
    | "info";
};

export function ChainBadge({
  chain,
  className,
  variant = "secondary",
}: ChainBadgeProps) {
  const { chain: vchain, iconUrl } = getChainInfo(chain);

  return (
    <Badge variant={variant} className={className}>
      <div className="flex items-center gap-1.5">
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt={vchain.name}
            className="size-3.5 rounded-full"
          />
        )}
        <span>{vchain.name}</span>
      </div>
    </Badge>
  );
}
