/**
 * Neynar Web SDK - Next.js (Server-Only) Exports
 *
 * This module provides Next.js API route handlers for proxying
 * Neynar APIs, plus primitives for building custom API handlers.
 *
 * Import from: @/neynar-web-sdk/nextjs
 */

// High-level API handler factories (recommended for most use cases)
export { createNeynarApiHandler } from "./neynar/api-handlers";

// Core primitive for building custom handlers
export { createRouter } from "./shared/api-handlers";

// Types for building custom handlers
export type { MethodHandlers, RouteMap } from "./shared/api-handlers";

// NFT handler factories (Layer 1)
export {
  createNftMintHandler,
  createNftPreviewHandler,
  createNftPriceHandler,
} from "./nft";

// NFT standalone utilities (Layer 2)
export {
  generateNftImage,
  mintNft,
  uploadNftMetadata,
  estimateNftMintCost,
} from "./nft";

// NFT types
export type {
  NftHandlerConfig,
  NftCallbackContext,
  NftTokenMetadata,
  GenerateNftImageOptions,
  CreateNftMintHandlerOptions,
  CreateNftPreviewHandlerOptions,
  CreateNftPriceHandlerOptions,
} from "./nft";
