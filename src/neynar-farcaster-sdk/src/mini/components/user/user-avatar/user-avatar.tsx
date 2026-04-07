"use client";

import { Context } from "@farcaster/miniapp-sdk";
import { Avatar, AvatarFallback, AvatarImage, cn } from "@neynar/ui";

type NeynarUser = {
  display_name: string;
  pfp_url: string;
  username: string;
};

// Type guard functions for user type checking
function isNeynarUser(
  user: Context.UserContext | NeynarUser,
): user is NeynarUser {
  return "display_name" in user && "pfp_url" in user;
}

function isFarcasterUser(
  user: Context.UserContext | NeynarUser,
): user is Context.UserContext {
  return "displayName" in user && "pfpUrl" in user;
}

/**
 * Props for the UserAvatar component
 */
export interface UserAvatarProps {
  /** User object from either Farcaster SDK context or Neynar API */
  user: Context.UserContext | NeynarUser;
  /** Additional CSS classes for styling and sizing */
  className?: string;
}

/**
 * UserAvatar - Displays a user's profile picture with fallback to initials
 *
 * A flexible avatar component that works with both Farcaster SDK users and Neynar API users.
 * Uses type guards to safely handle different property name formats (camelCase vs snake_case).
 *
 * @example
 * ```tsx
 * // Basic usage with both user types
 * <UserAvatar user={farcasterUser} className="size-12" />
 * <UserAvatar user={neynarUser} className="size-16" />
 *
 * // In lists with different sizes: size-6 (small), size-8 (default), size-12 (profile), size-16 (hero)
 * {friends.map(friend => (
 *   <UserAvatar key={friend.user.fid} user={friend.user} className="size-10" />
 * ))}
 * ```
 *
 * @param props - The component props
 * @returns A rendered avatar component with image or initials fallback
 */
export function UserAvatar({ user, className }: UserAvatarProps) {
  // Use type guards to safely access properties
  let displayName: string | undefined;
  if (isNeynarUser(user)) {
    displayName = user.display_name;
  } else if (isFarcasterUser(user)) {
    displayName = user.displayName;
  }

  // Fallback to username if no display name is available
  if (!displayName) {
    displayName = user.username;
  }

  let userInitials = "FC";
  if (displayName) {
    userInitials = displayName
      .split(" ")
      .map((name: string) => name[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // Use type guards to safely access pfp properties
  let avatarImageUrl: string | null = null;
  if (isNeynarUser(user)) {
    avatarImageUrl = user.pfp_url || null;
  } else if (isFarcasterUser(user)) {
    avatarImageUrl = user.pfpUrl || null;
  }

  return (
    <Avatar className={cn("size-6 transition-all", className)}>
      {avatarImageUrl && (
        <AvatarImage
          src={avatarImageUrl}
          alt={`${displayName || user.username}'s avatar - Click for menu`}
        />
      )}
      <AvatarFallback className="text-xs group-hover:bg-accent/5">
        {userInitials}
      </AvatarFallback>
    </Avatar>
  );
}
