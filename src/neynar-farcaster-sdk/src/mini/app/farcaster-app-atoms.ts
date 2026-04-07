"use client";
import { atom, useAtomValue } from "jotai";
import { Context } from "@farcaster/miniapp-sdk";

/**
 * Farcaster Mini App State Atoms
 *e
 * All Farcaster-related global state for the mini app.
 * Populated by useInitializeFarcasterApp() hook.
 */

// User State Atoms
export const farcasterUserAtom = atom<Context.UserContext | null>(null);
export const farcasterUserLoadingAtom = atom<boolean>(true);
export const farcasterUserErrorAtom = atom<string | null>(null);

// SDK State Atoms
export const sdkReadyAtom = atom<boolean>(false);

/**
 * Hook to access Farcaster user state
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useFarcasterUser();
 * const fid = data?.fid;
 * ```
 */
export function useFarcasterUser() {
  const data = useAtomValue(farcasterUserAtom);
  const isLoading = useAtomValue(farcasterUserLoadingAtom);
  const error = useAtomValue(farcasterUserErrorAtom);
  return { data, isLoading, error };
}

/**
 * Hook to check if Farcaster SDK is ready
 */
export function useSDKReady() {
  return useAtomValue(sdkReadyAtom);
}
