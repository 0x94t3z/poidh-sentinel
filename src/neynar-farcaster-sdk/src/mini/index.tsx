/**
 * Neynar Farcaster Mini App SDK - Core
 *
 * Core SDK exports for Farcaster integration, layouts, and essential components.
 *
 * For feature-specific exports:
 * - Audio: import from '@/neynar-farcaster-sdk/mini/audio'
 * - Game: import from '@/neynar-farcaster-sdk/mini/game'
 */

// Initialization hook (call inside providers wrapper)
export { useInitializeFarcasterApp } from "./app/use-initialize-farcaster-app";
export { InitializeFarcasterMiniApp } from "./app/initialize-farcaster-mini-app";

// Farcaster state hooks
export { useFarcasterUser, useSDKReady } from "./app/farcaster-app-atoms";

// Layout components
export { StandardMiniLayout } from "./layout/standard-mini-layout";
export { MiniappHeader } from "./layout/miniapp-header";

// User components
export { UserAvatar } from "./components/user/user-avatar/user-avatar";

// Share components
export {
  ShareButton,
  type ShareButtonProps,
} from "./components/share/share-button";
export {
  useShare,
  type ShareOptions,
  type ShareResult,
} from "./components/share/use-share";
