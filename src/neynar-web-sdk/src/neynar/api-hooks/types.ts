/**
 * Neynar API hook types
 *
 * Re-exports of strongly-typed interfaces from the Neynar SDK.
 * Also defines wrapper types for raw SDK responses to support zero-data-loss architecture.
 *
 * ARCHITECTURE: Hooks receive raw SDK responses and use select() to extract data.
 * These wrapper types help hooks understand the SDK response structure.
 */

/**
 * Neynar SDK Response Wrappers
 *
 * The Neynar Node.js SDK returns responses in this structure:
 * { result: { [collection]: T[], next?: { cursor: string } } }
 */

// Re-export core types from the Neynar SDK
// NOTE: User and related user types are exported from hooks/user.ts with comprehensive TSDoc
export type {
  Cast,
  Channel,
  Frame,
  Notification,
  Signer,
  Webhook,
  NextCursor,
  User,
  // Response types
  BulkUsersResponse,
  CastsResponse,
  ChannelListResponse,
  NotificationsResponse,
  ReactionsResponse,
  FollowersResponse,
  FeedResponse,
  FollowResponse,
  CastsSearchResponse,
  ChannelSearchResponse,
  // Request body types
  PostCastReqBody,
  DeleteCastReqBody,
  FollowReqBody,
  ReactionReqBody,
  ChannelFollowReqBody,
  FrameActionReqBody,
  BanReqBody,
  BlockReqBody,
  MuteReqBody,
  // Storage-related types
  BuyStorageReqBody,
  StorageAllocationsResponse,
  StorageUsageResponse,
  StorageAllocation,
  StorageObject,
} from "@neynar/nodejs-sdk/build/api/models";

/**
 * Common parameter types for Neynar API queries
 * Using generic types for cleaner, more maintainable parameter definitions
 */
type PaginationParams = {
  /** Pagination cursor for fetching specific page (automatically managed in infinite queries) */
  cursor?: string;
  /** Number of results to fetch per page (default and max values vary by endpoint) */
  limit?: number;
  [key: string]: unknown;
};

/**
 * Generic API parameters that combine pagination with specific endpoint params
 */
export type ApiParams<T = Record<string, unknown>> = PaginationParams & T;

/**
 * Response wrapper types for API hooks
 */
export type NeynarApiResponse<T> = {
  data: T;
  pagination?: {
    cursor?: string;
    hasMore?: boolean;
  };
};
