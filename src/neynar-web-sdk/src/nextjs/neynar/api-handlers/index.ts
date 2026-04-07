import { createRouter } from "../../shared/api-handlers";
import { buildNeynarRoutes } from "./routes";
import type { MethodHandlers } from "../../shared/api-handlers";
import type { NeynarAPIClient } from "@neynar/nodejs-sdk";

/**
 * Creates Neynar-specific API handlers with an instantiated Neynar SDK client
 *
 * This is a Neynar-specific wrapper around the generic createRouter that:
 * - Provides sensible Neynar-specific CORS defaults
 * - Maps to all 126 Neynar SDK methods via dependency injection
 * - Provides type safety for NeynarAPIClient
 * - Handles Neynar-specific error responses
 *
 * @param client - Instantiated NeynarAPIClient with API key (dependency injection for testability)
 * @returns Object with HTTP method handlers (GET, POST, PUT, DELETE, etc.)
 *
 * @example Complete API route setup (app/api/neynar/[...route]/route.ts)
 * ```typescript
 * import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
 * import { createNeynarApiHandler } from "@/neynar-web-sdk/nextjs";
 * import { privateConfig } from "@/config/private-config";
 *
 * const client = new NeynarAPIClient(
 *   new Configuration({
 *     apiKey: privateConfig.neynarApiKey,
 *   })
 * );
 *
 * export const { GET, POST, PUT, DELETE, OPTIONS } = createNeynarApiHandler(client);
 * ```
 *
 * @remarks
 * Routes are organized by API category:
 * - `/actions/*` - Cross-app user actions
 * - `/app-host/*` - Mini app hosting events
 * - `/auth/*` - Authentication and registration
 * - `/bans/*` - User banning functionality
 * - `/blocks/*` - User blocking functionality
 * - `/casts/*` - Cast operations (create, search, metrics)
 * - `/channels/*` - Channel operations (follow, search, members)
 * - `/feed/*` - Various feed types (for-you, trending, following)
 * - `/frames/*` - Frame actions and analytics
 * - `/mutes/*` - User muting functionality
 * - `/notifications/*` - Notification management
 * - `/onchain/*` - Onchain operations (NFTs, tokens)
 * - `/reactions/*` - Cast reactions (likes, recasts)
 * - `/signers/*` - Signer key management
 * - `/storage/*` - User storage management
 * - `/subscriptions/*` - Subscription management
 * - `/transactions/*` - Transaction pay frames
 * - `/users/*` - User operations (profile, follow, search)
 * - `/webhooks/*` - Webhook management
 */
export function createNeynarApiHandler(
  client: NeynarAPIClient,
): MethodHandlers {
  const routes = buildNeynarRoutes(client);

  return createRouter({
    routes,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-API-Key, X-Neynar-API-Key",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

// No type exports needed - consumers import NeynarAPIClient directly from @neynar/nodejs-sdk
// and don't need to know about internal API handler types
