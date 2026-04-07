/**
 * Shared utilities for API handlers
 *
 * This module exports the core primitives for building Next.js API handlers.
 * Most users should use the high-level factories (createNeynarApiHandler, createCoinGeckoApiHandler),
 * but these primitives are available for building custom handlers.
 */

// Core router function for building custom handlers
export { createRouter } from "./create-api-handler";

// Types for building custom handlers
export type { MethodHandlers, RouteMap } from "./types";
