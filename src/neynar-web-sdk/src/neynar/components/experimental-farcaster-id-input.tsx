"use client";

import { useState, useEffect } from "react";
import {
  Input,
  Skeleton,
  Button,
  Span,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@neynar/ui";
import { Search } from "lucide-react";
import { useUser, type User } from "../api-hooks/hooks";

/**
 * FarcasterIdInput - Input field with live user lookup and display
 *
 * A specialized input component for Farcaster IDs (FIDs) that automatically
 * fetches and displays the user's avatar and display name as you type.
 * Perfect for user selection, mentions, transfers, or any FID-based interactions.
 *
 * Features:
 * - Live user lookup as you type
 * - Displays user avatar and display name aligned right
 * - Loading state while fetching
 * - Error handling for invalid FIDs
 * - Fully controlled component
 *
 * @example
 * ```tsx
 * // Basic usage
 * const [fid, setFid] = useState("");
 *
 * <FarcasterIdInput
 *   value={fid}
 *   onChange={setFid}
 *   placeholder="Enter FID..."
 * />
 * ```
 *
 * @example
 * ```tsx
 * // With callback when user is found
 * const [fid, setFid] = useState("");
 * const [selectedUser, setSelectedUser] = useState(null);
 *
 * <FarcasterIdInput
 *   value={fid}
 *   onChange={setFid}
 *   onUserFound={(user) => {
 *     setSelectedUser(user);
 *     console.log("Selected:", user.username, user.verified_addresses);
 *   }}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Disabled state
 * <FarcasterIdInput
 *   value={fid}
 *   onChange={setFid}
 *   disabled={isSubmitting}
 *   placeholder="Enter recipient FID..."
 * />
 * ```
 */
type ExperimentalFarcasterIdInputProps = {
  /** Current FID value */
  value: string;
  /** Callback when FID changes */
  onChange: (value: string) => void;
  /** Callback when a valid user is found - receives full user object */
  onUserFound?: (user: User) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Optional CSS classes */
  className?: string;
  /** Input ID for labels */
  id?: string;
};

export function ExperimentalFarcasterIdInput({
  value,
  onChange,
  onUserFound,
  placeholder = "Enter FID...",
  disabled = false,
  className,
  id,
}: ExperimentalFarcasterIdInputProps) {
  // Track the last looked-up FID and the fetched user data
  const [lookedUpFid, setLookedUpFid] = useState<string>("");
  const [shouldFetch, setShouldFetch] = useState(false);
  const [cachedUserData, setCachedUserData] = useState<User | null>(null);

  // Parse FID and fetch user data only when lookup is triggered
  const fidNumber = shouldFetch && value ? parseInt(value, 10) : undefined;
  const { data: userData, isLoading } = useUser(
    fidNumber!,
    {},
    { enabled: !!fidNumber && !isNaN(fidNumber) && shouldFetch },
  );

  // Call onUserFound callback when user data is fetched and cache it
  useEffect(() => {
    if (userData && onUserFound) {
      onUserFound(userData);
      setCachedUserData(userData);
      setLookedUpFid(value);
      setShouldFetch(false);
    }
  }, [userData, onUserFound, value]);

  // Clear cached data when value changes
  useEffect(() => {
    if (value !== lookedUpFid) {
      setCachedUserData(null);
    }
  }, [value, lookedUpFid]);

  // Auto-lookup on mount if there's an initial FID value
  useEffect(() => {
    if (value && !lookedUpFid && !isLoading) {
      handleLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Determine if we should show the lookup button
  const hasValueChanged = value !== lookedUpFid;

  // Handle lookup button click or blur
  const handleLookup = () => {
    if (value && !isNaN(parseInt(value, 10))) {
      setShouldFetch(true);
    }
  };

  // Handle blur - trigger lookup if value has changed
  const handleBlur = () => {
    if (hasValueChanged) {
      handleLookup();
    }
  };
  const showLookupButton =
    value && (!cachedUserData || hasValueChanged) && !isLoading && !disabled;

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        style={{
          MozAppearance: "textfield",
          WebkitAppearance: "none",
        }}
      />

      {/* Lookup button - shows when value hasn't been looked up or has changed, and field is not disabled */}
      {showLookupButton && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleLookup}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
        >
          <Search className="size-4" />
        </Button>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="size-6 rounded-full" />
        </div>
      )}

      {/* User preview - avatar and display name */}
      {cachedUserData && !isLoading && !hasValueChanged && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <Span variant="detail" weight="medium" color="muted">
            @{cachedUserData.username}
          </Span>
          {/* <Span variant="detail" weight="medium">
            {cachedUserData.display_name}
          </Span> */}
          <Avatar className="bg-black/10 dark:bg-white/5 size-6">
            <AvatarImage
              src={cachedUserData.pfp_url}
              alt={cachedUserData.display_name}
            />
            <AvatarFallback className="bg-black/10 dark:bg-white/5">
              <Span variant="detail" weight="semibold" className="uppercase">
                {cachedUserData.display_name?.[0] || "?"}
              </Span>
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
}
