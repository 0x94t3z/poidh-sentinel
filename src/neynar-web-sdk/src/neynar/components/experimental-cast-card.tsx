"use client";

import {
  Card,
  CardContent,
  Avatar,
  AvatarImage,
  AvatarFallback,
  P,
  Small,
  Badge,
  A,
} from "@neynar/ui";
import type { Cast } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Props for the ExperimentalCastCard component
 */
type ExperimentalCastCardProps = {
  /** The cast object to display, containing author info, text, embeds, and engagement metrics */
  cast: Cast;
  /** Optional callback when the cast card is clicked */
  onCastClick?: (cast: Cast) => void;
  /** Optional callback when the author's avatar or name is clicked */
  onAuthorClick?: (cast: Cast) => void;
  /** Optional additional CSS classes to apply to the card */
  className?: string;
  /** Internal flag to indicate if this is a nested/quoted cast (for styling) */
  nested?: boolean;
};

/**
 * ExperimentalCastCard - A comprehensive Farcaster cast display component
 *
 * ⚠️ **EXPERIMENTAL**: This component is under active development and may change.
 *
 * Displays a Farcaster cast with full support for:
 * - Author information (avatar, display name, username, power badge)
 * - Cast text content with proper text wrapping
 * - Image and link embeds
 * - Nested/quoted casts (recursive rendering)
 * - Engagement metrics (likes, recasts, replies)
 * - Interactive click handlers for cast and author
 *
 * Built using @neynar/ui components for consistent styling and supports
 * recursive nesting for quoted casts while maintaining beautiful presentation.
 *
 * @component
 *
 * @example Basic usage with cast feed
 * ```tsx
 * import { ExperimentalCastCard } from "@/neynar-web-sdk/client";
 * import { useCastsByUser } from "@/neynar-web-sdk/neynar-api/hooks";
 *
 * function UserCastFeed({ fid }: { fid: number }) {
 *   const { data: casts, isLoading } = useCastsByUser(fid);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div className="space-y-4">
 *       {casts?.map(cast => (
 *         <ExperimentalCastCard key={cast.hash} cast={cast} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With click handlers
 * ```tsx
 * import { ExperimentalCastCard } from "@/neynar-web-sdk/client";
 * import { useRouter } from "next/navigation";
 *
 * function InteractiveCastFeed() {
 *   const router = useRouter();
 *   const { data: casts } = useChannelFeed("pokemon");
 *
 *   return (
 *     <div className="space-y-4">
 *       {casts?.map(cast => (
 *         <ExperimentalCastCard
 *           key={cast.hash}
 *           cast={cast}
 *           onCastClick={(cast) => router.push(`/cast/${cast.hash}`)}
 *           onAuthorClick={(cast) => router.push(`/user/${cast.author.username}`)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example In a modal dialog
 * ```tsx
 * import { ExperimentalCastCard } from "@/neynar-web-sdk/client";
 * import { Dialog, DialogContent } from "@neynar/ui";
 *
 * function CastModal({ cast, open, onClose }) {
 *   return (
 *     <Dialog open={open} onOpenChange={onClose}>
 *       <DialogContent className="max-w-2xl">
 *         <ExperimentalCastCard cast={cast} />
 *       </DialogContent>
 *     </Dialog>
 *   );
 * }
 * ```
 *
 * @remarks
 * - Uses @neynar/ui Card, Avatar, Badge, and typography components
 * - Automatically handles nested quoted casts recursively
 * - Separates cast embeds from other embeds (images, links)
 * - All engagement metrics use optional chaining for safety
 * - Click events use stopPropagation to prevent bubbling
 *
 * @see {@link Cast} for the cast data structure
 * @see {@link https://docs.neynar.com/docs} for Neynar API documentation
 */
export function ExperimentalCastCard({
  cast,
  onCastClick,
  onAuthorClick,
  className = "",
  nested: _nested = false,
}: ExperimentalCastCardProps) {
  // Extract quoted cast if it exists in embeds
  const castEmbed = cast.embeds?.find((embed) => "cast" in embed && embed.cast);
  const quotedCast =
    castEmbed && "cast" in castEmbed
      ? // todo: fix this assertion
        (castEmbed.cast as unknown as Cast)
      : undefined;

  // Filter out cast embeds to show other embeds (images, links)
  const nonCastEmbeds = cast.embeds?.filter((embed) => !("cast" in embed));

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card
      className={`cursor-pointer hover:bg-accent/50 transition-colors ${className}`}
      onClick={() => onCastClick?.(cast)}
    >
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Avatar
            className="size-10 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onAuthorClick?.(cast);
            }}
          >
            <AvatarImage
              src={cast.author.pfp_url}
              alt={cast.author.display_name}
            />
            <AvatarFallback>
              {getInitials(cast.author.display_name || cast.author.username)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Small
                className="font-semibold cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onAuthorClick?.(cast);
                }}
              >
                {cast.author.display_name}
              </Small>
              <Small color="muted">@{cast.author.username}</Small>
              {cast.author.power_badge && (
                <Badge variant="secondary" className="px-1 py-0 text-xs">
                  ⚡
                </Badge>
              )}
            </div>

            <P className="mt-2 whitespace-pre-wrap break-words">{cast.text}</P>

            {nonCastEmbeds && nonCastEmbeds.length > 0 && (
              <div className="mt-3 space-y-2">
                {nonCastEmbeds.map((embed, idx) => {
                  if ("url" in embed && embed.url) {
                    // Check if it's an image
                    if (
                      embed.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                      ("metadata" in embed &&
                        embed.metadata &&
                        "image" in embed.metadata)
                    ) {
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={idx}
                          src={embed.url}
                          alt="Cast embed"
                          className="rounded-lg max-w-full h-auto"
                        />
                      );
                    }
                    // Link preview
                    return (
                      <A
                        key={idx}
                        href={embed.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 border rounded-lg hover:bg-accent transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Small className="break-all">{embed.url}</Small>
                      </A>
                    );
                  }
                  return null;
                })}
              </div>
            )}

            {quotedCast && (
              <div className="mt-3">
                <ExperimentalCastCard
                  cast={quotedCast}
                  onCastClick={onCastClick}
                  onAuthorClick={onAuthorClick}
                  nested={true}
                />
              </div>
            )}

            <div className="flex gap-6 mt-3">
              <button
                className="flex items-center gap-1.5 hover:text-destructive transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle like action
                }}
              >
                <Small className="text-inherit">❤️</Small>
                <Small color="muted">{cast.reactions?.likes_count || 0}</Small>
              </button>
              <button
                className="flex items-center gap-1.5 hover:text-success transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle recast action
                }}
              >
                <Small className="text-inherit">🔄</Small>
                <Small color="muted">
                  {cast.reactions?.recasts_count || 0}
                </Small>
              </button>
              <button
                className="flex items-center gap-1.5 hover:text-accent transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle reply action
                }}
              >
                <Small className="text-inherit">💬</Small>
                <Small color="muted">{cast.replies?.count || 0}</Small>
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
