"use client";
import sdk from "@farcaster/miniapp-sdk";
import { useEffect, useRef } from "react";
import { useSetAtom } from "jotai";
import { publicConfig } from "@/config/public-config";
import {
  farcasterUserAtom,
  farcasterUserLoadingAtom,
  farcasterUserErrorAtom,
  sdkReadyAtom,
} from "./farcaster-app-atoms";

/**
 * Initialize Farcaster SDK and populate user atoms
 *
 * Call this hook once at the app root level (in your main App component).
 *
 * Handles:
 * - SDK initialization (sdk.actions.ready())
 * - Back button setup (if creator context)
 * - User context loading from Farcaster SDK
 * - Error handling for guest users
 *
 * @example
 * ```tsx
 * function App() {
 *   useInitializeFarcasterApp();
 *
 *   return <YourApp />;
 * }
 * ```
 */
export function useInitializeFarcasterApp() {
  const setFarcasterUser = useSetAtom(farcasterUserAtom);
  const setFarcasterUserLoading = useSetAtom(farcasterUserLoadingAtom);
  const setFarcasterUserError = useSetAtom(farcasterUserErrorAtom);
  const setSdkReady = useSetAtom(sdkReadyAtom);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    async function initialize() {
      // Step 1: Back button setup (if creator context)
      const isCreator = publicConfig.fid;
      const returnUrl = `https://ai.neynar.com/studio`;
      const backButtonEnabled = Boolean(returnUrl && isCreator);

      if (backButtonEnabled && returnUrl) {
        try {
          const handleBack = () => {
            try {
              sdk.actions.openMiniApp({ url: returnUrl });
            } catch (e) {
              console.error("[Back Navigation] Failed:", e);
            }
          };
          sdk.back.onback = handleBack;
          await sdk.back.show();
        } catch (e) {
          console.error("Failed to enable back navigation:", e);
        }
      }

      // Step 2: Mark SDK as ready
      await sdk.actions.ready();
      setSdkReady(true);

      // Step 3: Load user context
      try {
        setFarcasterUserLoading(true);
        setFarcasterUserError(null);

        const context = await sdk.context;
        if (context?.user) {
          setFarcasterUser(context.user);
        } else {
          console.info(
            "No Farcaster user context available - running as guest",
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to get user context";
        console.error("Failed to get Farcaster user context:", error);
        setFarcasterUserError(errorMessage);
      } finally {
        setFarcasterUserLoading(false);
      }
    }

    initialize();
  }, [
    setFarcasterUser,
    setFarcasterUserLoading,
    setFarcasterUserError,
    setSdkReady,
  ]);
}
