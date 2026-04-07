/**
 * Neynar API query key factories
 * Hierarchical structure preserved from the excellent old system for proper cache management
 * Updated to match all routes from buildNeynarRoutes in the new API handler architecture
 */

import {
  createQueryKeyFactory,
  createScopedQueryKeys,
  normalizeFilters,
} from "../../private/api-hooks/query-keys";

// Main Neynar query key factory
export const neynarKeys = createQueryKeyFactory("neynar");

// Scoped query key factories for each Neynar endpoint category
export const actionKeys = createScopedQueryKeys("neynar", "action");
export const appHostKeys = createScopedQueryKeys("neynar", "app-host");
export const authKeys = createScopedQueryKeys("neynar", "auth");
export const banKeys = createScopedQueryKeys("neynar", "ban");
export const blockKeys = createScopedQueryKeys("neynar", "block");
export const castKeys = createScopedQueryKeys("neynar", "cast");
export const channelKeys = createScopedQueryKeys("neynar", "channel");
export const feedKeys = createScopedQueryKeys("neynar", "feed");
export const fnameKeys = createScopedQueryKeys("neynar", "fname");
export const followKeys = createScopedQueryKeys("neynar", "follow");
export const frameKeys = createScopedQueryKeys("neynar", "frame");
export const muteKeys = createScopedQueryKeys("neynar", "mute");
export const notificationKeys = createScopedQueryKeys("neynar", "notification");
export const onchainKeys = createScopedQueryKeys("neynar", "onchain");
export const reactionKeys = createScopedQueryKeys("neynar", "reaction");
export const signerKeys = createScopedQueryKeys("neynar", "signer");
export const storageKeys = createScopedQueryKeys("neynar", "storage");
export const subscriptionKeys = createScopedQueryKeys("neynar", "subscription");
export const transactionKeys = createScopedQueryKeys("neynar", "transaction");
export const userKeys = createScopedQueryKeys("neynar", "user");
export const webhookKeys = createScopedQueryKeys("neynar", "webhook");

// Specific query key patterns for common use cases - matching all API routes
export const neynarQueryKeys = {
  // Actions API
  actions: {
    all: () => actionKeys.all(),
    list: (params?: Record<string, unknown>) =>
      actionKeys.list(normalizeFilters(params)),
    byType: (type: string, params?: Record<string, unknown>) =>
      actionKeys.detail("type", type, normalizeFilters(params)),
  },

  // App Host API
  appHost: {
    all: () => appHostKeys.all(),
    event: (params?: Record<string, unknown>) =>
      appHostKeys.custom("event", normalizeFilters(params)),
    userState: (params?: Record<string, unknown>) =>
      appHostKeys.custom("user-state", normalizeFilters(params)),
  },

  // Auth & Registration API
  auth: {
    all: () => authKeys.all(),
    authorizationUrl: (params?: Record<string, unknown>) =>
      authKeys.custom("authorization-url", normalizeFilters(params)),
    developerManagedAddress: (address: string) =>
      authKeys.detail("developer-managed", address),
  },

  // Bans API
  bans: {
    all: () => banKeys.all(),
    list: (params?: Record<string, unknown>) =>
      banKeys.list(normalizeFilters(params)),
  },

  // Blocks API
  blocks: {
    all: () => blockKeys.all(),
    list: (params?: Record<string, unknown>) =>
      blockKeys.list(normalizeFilters(params)),
  },

  // Cast-related queries - comprehensive coverage
  casts: {
    all: () => castKeys.all(),
    byHash: (hash: string, params?: Record<string, unknown>) =>
      castKeys.detail("hash", hash, normalizeFilters(params)),
    byHashes: (hashes: string[], params?: Record<string, unknown>) =>
      castKeys.list({
        ...normalizeFilters(params),
        hashes: hashes.sort().join(","),
      }),
    byAuthor: (fid: number, params?: Record<string, unknown>) =>
      castKeys.list({ ...normalizeFilters(params), authorFid: fid }),
    conversation: (hash: string, params?: Record<string, unknown>) =>
      castKeys.custom("conversation", hash, normalizeFilters(params)),
    replies: (hash: string, params?: Record<string, unknown>) =>
      castKeys.custom("replies", hash, normalizeFilters(params)),
    likes: (hash: string, params?: Record<string, unknown>) =>
      castKeys.custom("likes", hash, normalizeFilters(params)),
    recasts: (hash: string, params?: Record<string, unknown>) =>
      castKeys.custom("recasts", hash, normalizeFilters(params)),
    search: (query: string, params?: Record<string, unknown>) =>
      castKeys.custom("search", { query, ...normalizeFilters(params) }),
    custom: (
      type: string,
      identifier?: unknown,
      params?: Record<string, unknown>,
    ) => castKeys.custom(type, identifier, normalizeFilters(params)),
  },

  // Channel-related queries - comprehensive coverage
  channels: {
    all: () => channelKeys.all(),
    byId: (id: string, params?: Record<string, unknown>) =>
      channelKeys.detail("id", id, normalizeFilters(params)),
    byIds: (ids: string[], params?: Record<string, unknown>) =>
      channelKeys.list({
        ...normalizeFilters(params),
        ids: ids.sort().join(","),
      }),
    list: (params?: Record<string, unknown>) =>
      channelKeys.list(normalizeFilters(params)),
    search: (query: string, params?: Record<string, unknown>) =>
      channelKeys.custom("search", { query, ...normalizeFilters(params) }),
    members: (channelId: string, params?: Record<string, unknown>) =>
      channelKeys.custom("members", channelId, normalizeFilters(params)),
    followers: (channelId: string, params?: Record<string, unknown>) =>
      channelKeys.custom("followers", channelId, normalizeFilters(params)),
    invites: (channelId: string, params?: Record<string, unknown>) =>
      channelKeys.custom("invites", channelId, normalizeFilters(params)),
    activity: (channelId: string, params?: Record<string, unknown>) =>
      channelKeys.custom("activity", channelId, normalizeFilters(params)),
  },

  // Feed-related queries - all feed variations
  feeds: {
    all: () => feedKeys.all(),
    following: (fid: number, params?: Record<string, unknown>) =>
      feedKeys.custom("following", fid, normalizeFilters(params)),
    forYou: (fid: number, params?: Record<string, unknown>) =>
      feedKeys.custom("for-you", fid, normalizeFilters(params)),
    trending: (params?: Record<string, unknown>) =>
      feedKeys.custom("trending", normalizeFilters(params)),
    trendingGlobal: (params?: Record<string, unknown>) =>
      feedKeys.custom("trending-global", normalizeFilters(params)),
    channel: (channelId: string, params?: Record<string, unknown>) =>
      feedKeys.custom("channel", channelId, normalizeFilters(params)),
    channelAndChild: (channelId: string, params?: Record<string, unknown>) =>
      feedKeys.custom("channel-and-child", channelId, normalizeFilters(params)),
    multiChannel: (channelIds: string[], params?: Record<string, unknown>) =>
      feedKeys.custom("multi-channel", {
        channelIds: channelIds.sort().join(","),
        ...normalizeFilters(params),
      }),
    parentUrl: (url: string, params?: Record<string, unknown>) =>
      feedKeys.custom("parent-url", { url, ...normalizeFilters(params) }),
    frames: (params?: Record<string, unknown>) =>
      feedKeys.custom("frames", normalizeFilters(params)),
    filtered: (params?: Record<string, unknown>) =>
      feedKeys.custom("filtered", normalizeFilters(params)),
  },

  // Fname-related queries
  fname: {
    all: () => fnameKeys.all(),
    availability: (fname: string) => fnameKeys.detail("availability", fname),
  },

  // Follow-related queries
  follows: {
    all: () => followKeys.all(),
    relevantFollowers: (targetFid: number, viewerFid: number) =>
      followKeys.custom("relevant-followers", { targetFid, viewerFid }),
  },

  // Frame-related queries
  frames: {
    all: () => frameKeys.all(),
    validate: (url: string) => frameKeys.custom("validate", { url }),
    catalog: (params?: Record<string, unknown>) =>
      frameKeys.custom("catalog", normalizeFilters(params)),
    metaTags: (url: string) => frameKeys.custom("meta-tags", { url }),
    relevant: (params?: Record<string, unknown>) =>
      frameKeys.custom("relevant", normalizeFilters(params)),
    search: (query: string, params?: Record<string, unknown>) =>
      frameKeys.custom("search", { query, ...normalizeFilters(params) }),
    analytics: (params?: Record<string, unknown>) =>
      frameKeys.custom("analytics", normalizeFilters(params)),
    lookup: (params?: Record<string, unknown>) =>
      frameKeys.custom("lookup", normalizeFilters(params)),
    notificationTokens: (params?: Record<string, unknown>) =>
      frameKeys.custom("notification-tokens", normalizeFilters(params)),
  },

  // Mute-related queries
  mutes: {
    all: () => muteKeys.all(),
    list: (params?: Record<string, unknown>) =>
      muteKeys.list(normalizeFilters(params)),
  },

  // Notification-related queries
  notifications: {
    all: () => notificationKeys.all(),
    byUser: (fid: number, params?: Record<string, unknown>) =>
      notificationKeys.list({ ...normalizeFilters(params), fid }),
    byParentUrl: (parentUrl: string, params?: Record<string, unknown>) =>
      notificationKeys.custom("by-parent-url", {
        parentUrl,
        ...normalizeFilters(params),
      }),
    byChannel: (channelId: string, params?: Record<string, unknown>) =>
      notificationKeys.custom(
        "by-channel",
        channelId,
        normalizeFilters(params),
      ),
    campaignStats: (campaignId?: string, params?: Record<string, unknown>) =>
      notificationKeys.custom("campaign-stats", {
        campaignId,
        ...normalizeFilters(params),
      }),
    markAsRead: (fid: number) => notificationKeys.custom("mark-as-read", fid),
  },

  // Onchain-related queries
  onchain: {
    all: () => onchainKeys.all(),
    relevantFungibleOwners: (params?: Record<string, unknown>) =>
      onchainKeys.custom("relevant-fungible-owners", normalizeFilters(params)),
    deployFungible: (params?: Record<string, unknown>) =>
      onchainKeys.custom("deploy-fungible", normalizeFilters(params)),
    sendFungibles: (params?: Record<string, unknown>) =>
      onchainKeys.custom("send-fungibles", normalizeFilters(params)),
    mintNft: (params?: Record<string, unknown>) =>
      onchainKeys.custom("mint-nft", normalizeFilters(params)),
    simulateNftMint: (params?: Record<string, unknown>) =>
      onchainKeys.custom("simulate-mint-nft", normalizeFilters(params)),
    nftPrice: (params?: Record<string, unknown>) =>
      onchainKeys.custom("nft-price", normalizeFilters(params)),
  },

  // Reaction-related queries
  reactions: {
    all: () => reactionKeys.all(),
    byCast: (hash: string, type?: string, params?: Record<string, unknown>) =>
      reactionKeys.custom("by-cast", hash, {
        type,
        ...normalizeFilters(params),
      }),
    byUser: (fid: number, type?: string, params?: Record<string, unknown>) =>
      reactionKeys.custom("by-user", fid, {
        type,
        ...normalizeFilters(params),
      }),
  },

  // Signer-related queries
  signers: {
    all: () => signerKeys.all(),
    list: (params?: Record<string, unknown>) =>
      signerKeys.list(normalizeFilters(params)),
    lookup: (params?: Record<string, unknown>) =>
      signerKeys.custom("lookup", normalizeFilters(params)),
    developerManagedLookup: (params?: Record<string, unknown>) =>
      signerKeys.custom("developer-managed-lookup", normalizeFilters(params)),
    register: (data: unknown) => signerKeys.custom("register", data),
    createAndRegister: (data: unknown) =>
      signerKeys.custom("create-and-register", data),
    developerManagedRegister: (data: unknown) =>
      signerKeys.custom("developer-managed-register", data),
  },

  // Storage-related queries
  storage: {
    all: () => storageKeys.all(),
    allocations: (fid: number) => storageKeys.custom("allocations", fid),
    usage: (fid: number) => storageKeys.custom("usage", fid),
  },

  // Subscription-related queries
  subscriptions: {
    all: () => subscriptionKeys.all(),
    list: (params?: Record<string, unknown>) =>
      subscriptionKeys.list(normalizeFilters(params)),
    subscribedTo: (fid: number, params?: Record<string, unknown>) =>
      subscriptionKeys.custom("subscribed-to", fid, normalizeFilters(params)),
    subscribers: (fid: number, params?: Record<string, unknown>) =>
      subscriptionKeys.custom("subscribers", fid, normalizeFilters(params)),
    check: (params?: Record<string, unknown>) =>
      subscriptionKeys.custom("check", normalizeFilters(params)),
    created: (fid: number, params?: Record<string, unknown>) =>
      subscriptionKeys.custom("created", fid, normalizeFilters(params)),
  },

  // Transaction-related queries
  transactions: {
    all: () => transactionKeys.all(),
    byId: (id: string, params?: Record<string, unknown>) =>
      transactionKeys.detail("id", id, normalizeFilters(params)),
    payFrames: (params?: Record<string, unknown>) =>
      transactionKeys.custom("pay-frames", normalizeFilters(params)),
  },

  // User-related queries - comprehensive coverage with sorted parameters
  users: {
    all: () => userKeys.all(),
    bulk: (fids: number[], params?: Record<string, unknown>) =>
      userKeys.list({
        ...normalizeFilters(params),
        fids: fids.sort((a, b) => a - b).join(","),
      }),
    byUsername: (username: string, params?: Record<string, unknown>) =>
      userKeys.detail("username", username, normalizeFilters(params)),
    byFid: (fid: number, params?: Record<string, unknown>) =>
      userKeys.detail("fid", fid, normalizeFilters(params)),
    search: (query: string, params?: Record<string, unknown>) =>
      userKeys.custom("search", { query, ...normalizeFilters(params) }),
    followers: (fid: number, params?: Record<string, unknown>) =>
      userKeys.custom("followers", fid, normalizeFilters(params)),
    following: (fid: number, params?: Record<string, unknown>) =>
      userKeys.custom("following", fid, normalizeFilters(params)),
    activeChannels: (fid: number, params?: Record<string, unknown>) =>
      userKeys.custom("active-channels", fid, normalizeFilters(params)),
    powerUsers: (params?: Record<string, unknown>) =>
      userKeys.custom("power-users", normalizeFilters(params)),
    bulkByAddress: (
      addresses: string[],
      addressTypes?: string[],
      params?: Record<string, unknown>,
    ) =>
      userKeys.custom("bulk-by-address", {
        addresses: addresses.sort().join(","),
        addressTypes: addressTypes?.sort().join(","),
        ...normalizeFilters(params),
      }),
  },

  // Webhook-related queries
  webhooks: {
    all: () => webhookKeys.all(),
    list: (params?: Record<string, unknown>) =>
      webhookKeys.list(normalizeFilters(params)),
    byId: (webhookId: string) => webhookKeys.detail("id", webhookId),
  },

  // Custom query key factory for endpoints not covered by specific categories
  custom: (type: string, ...args: unknown[]) =>
    neynarKeys.detail("custom", type, ...args),
} as const;
