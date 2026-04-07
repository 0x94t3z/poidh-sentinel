/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RouteMap } from "../../shared/api-handlers";
import type { NeynarAPIClient } from "@neynar/nodejs-sdk";

/**
 * Creates route map for all Neynar SDK methods
 * Organized by API category to match the SDK structure
 *
 * Each route maps to a handler that calls the corresponding SDK method
 * Routes are bound to the provided client via closures
 *
 * Note: Using 'any' types here is intentional - this is a pure proxy layer
 * that passes parameters directly to the strongly-typed Neynar SDK methods.
 * The SDK handles all type validation and safety.
 *
 * @param client - Instantiated NeynarAPIClient to bind to the routes
 * @returns RouteMap with all handlers bound to the client
 */
export function buildNeynarRoutes(client: NeynarAPIClient): RouteMap {
  return {
    // Actions API
    "POST /actions/farcaster": async ({ body }) =>
      client.publishFarcasterAction(body as any),

    // App Host API
    "GET /app-host/event": async ({ query }) =>
      client.appHostGetEvent(query as any),
    "GET /app-host/user-state": async ({ query }) =>
      client.appHostGetUserState(query as any),
    "POST /app-host/event": async ({ body }) =>
      client.appHostPostEvent(body as any),

    // Auth & Registration API
    "GET /auth/authorization-url": async ({ query }) =>
      client.fetchAuthorizationUrl(query as any),
    "POST /auth/register-account": async ({ body }) =>
      client.registerAccount(body as any),
    "POST /auth/register-account-onchain": async ({ body }) =>
      client.registerAccountOnchain(body as any),
    "GET /auth/developer-managed/:address": async ({ path }) =>
      client.lookupDeveloperManagedAuthAddress({ address: path.address }),
    "POST /auth/developer-managed/register-signed-key": async ({ body }) =>
      client.registerSignedKeyForDeveloperManagedAuthAddress(body as any),

    // Bans API
    "DELETE /bans": async ({ body }) => client.deleteBans(body as any),
    "GET /bans": async ({ query }) => client.fetchBanList(query as any),
    "POST /bans": async ({ body }) => client.publishBans(body as any),

    // Blocks API
    "DELETE /blocks": async ({ body }) => client.deleteBlock(body as any),
    "GET /blocks": async ({ query }) => client.fetchBlockList(query as any),
    "POST /blocks": async ({ body }) => client.publishBlock(body as any),

    // Casts API
    "DELETE /casts": async ({ body }) => client.deleteCast(body as any),
    "GET /casts/bulk": async ({ query }) => client.fetchBulkCasts(query as any),
    "GET /casts/quotes": async ({ query }) =>
      client.fetchCastQuotes(query as any),
    "GET /casts/reactions": async ({ query }) =>
      client.fetchCastReactions(query as any),
    "GET /casts/metrics": async ({ query }) =>
      client.fetchCastMetrics(query as any),
    "GET /casts/by-user": async ({ query }) =>
      client.fetchCastsForUser(query as any),
    "GET /casts/popular-by-user": async ({ query }) =>
      client.fetchPopularCastsByUser(query as any),
    "GET /casts/replies-and-recasts": async ({ query }) =>
      client.fetchRepliesAndRecastsForUser(query as any),
    "GET /casts/lookup": async ({ query }) =>
      client.lookupCastByHashOrUrl(query as any),
    "GET /casts/conversation": async ({ query }) =>
      client.lookupCastConversation(query as any),
    "GET /casts/conversation/summary": async ({ query }) =>
      client.lookupCastConversationSummary(query as any),
    "POST /casts": async ({ body }) => client.publishCast(body as any),
    "GET /casts/search": async ({ query }) => client.searchCasts(query as any),
    "GET /casts/composer-actions": async ({ query }) =>
      client.fetchComposerActions(query as any),
    "GET /casts/embedded-url-metadata": async ({ query }) =>
      client.fetchEmbeddedUrlMetadata(query as any),

    // Channels API
    "GET /channels": async ({ query }) => client.fetchAllChannels(query as any),
    "GET /channels/bulk": async ({ query }) =>
      client.fetchBulkChannels(query as any),
    "GET /channels/lookup": async ({ query }) =>
      client.lookupChannel(query as any),
    "GET /channels/search": async ({ query }) =>
      client.searchChannels(query as any),
    "GET /channels/trending": async ({ query }) =>
      client.fetchTrendingChannels(query as any),
    "POST /channels/follow": async ({ body }) =>
      client.followChannel(body as any),
    "DELETE /channels/follow": async ({ body }) =>
      client.unfollowChannel(body as any),
    "GET /channels/followers": async ({ query }) =>
      client.fetchFollowersForAChannel(query as any),
    "GET /channels/relevant-followers": async ({ query }) =>
      client.fetchRelevantFollowersForAChannel(query as any),
    "GET /channels/members": async ({ query }) =>
      client.fetchChannelMembers(query as any),
    "GET /channels/invites": async ({ query }) =>
      client.fetchChannelInvites(query as any),
    "POST /channels/invite": async ({ body }) =>
      client.inviteChannelMember(body as any),
    "DELETE /channels/members": async ({ body }) =>
      client.removeChannelMember(body as any),
    "POST /channels/respond-invite": async ({ body }) =>
      client.respondChannelInvite(body as any),

    // Feed API
    "GET /feed": async ({ query }) => client.fetchFeed(query as any),
    "GET /feed/for-you": async ({ query }) =>
      client.fetchFeedForYou(query as any),
    "GET /feed/following": async ({ query }) =>
      client.fetchUserFollowingFeed(query as any),
    "GET /feed/trending": async ({ query }) =>
      client.fetchTrendingFeed(query as any),
    "GET /feed/by-channel-ids": async ({ query }) =>
      client.fetchFeedByChannelIds(query as any),
    "GET /feed/by-parent-urls": async ({ query }) =>
      client.fetchFeedByParentUrls(query as any),
    "GET /feed/frames-only": async ({ query }) =>
      client.fetchFramesOnlyFeed(query as any),

    // Fname API
    "GET /fname/availability": async ({ query }) =>
      client.isFnameAvailable(query as any),

    // Frames API
    "POST /frames/action": async ({ body }) =>
      client.postFrameAction(body as any),
    "POST /frames/action/developer-managed": async ({ body }) =>
      client.postFrameActionDeveloperManaged(body as any),
    "POST /frames/validate": async ({ body }) =>
      client.validateFrameAction(body as any),
    "GET /frames/catalog": async ({ query }) =>
      client.fetchFrameCatalog(query as any),
    "GET /frames/meta-tags": async ({ query }) =>
      client.fetchFrameMetaTagsFromUrl(query as any),
    "GET /frames/relevant": async ({ query }) =>
      client.fetchRelevantFrames(query as any),
    "GET /frames/search": async ({ query }) =>
      client.searchFrames(query as any),
    "GET /frames/analytics": async ({ query }) =>
      client.fetchValidateFrameAnalytics(query as any),
    "POST /frames/neynar": async ({ body }) =>
      client.publishNeynarFrame(body as any),
    "PUT /frames/neynar": async ({ body }) =>
      client.updateNeynarFrame(body as any),
    "DELETE /frames/neynar": async ({ body }) =>
      client.deleteNeynarFrame(body as any),
    "GET /frames/neynar/lookup": async ({ query }) =>
      client.lookupNeynarFrame(query as any),
    "GET /frames/notification-tokens": async ({ query }) =>
      client.fetchNotificationTokens(query as any),
    "POST /frames/notifications": async ({ body }) =>
      client.publishFrameNotifications(body as any),

    // Mutes API
    "DELETE /mutes": async ({ body }) => client.deleteMute(body as any),
    "GET /mutes": async ({ query }) => client.fetchMuteList(query as any),
    "POST /mutes": async ({ body }) => client.publishMute(body as any),

    // Notifications API
    "GET /notifications": async ({ query }) =>
      client.fetchAllNotifications(query as any),
    "GET /notifications/by-parent-url": async ({ query }) =>
      client.fetchNotificationsByParentUrlForUser(query as any),
    "GET /notifications/channel": async ({ query }) =>
      client.fetchChannelNotificationsForUser(query as any),
    "PUT /notifications/seen": async ({ body }) =>
      client.markNotificationsAsSeen(body as any),
    "GET /notifications/campaign/stats": async ({ query }) =>
      client.getNotificationCampaignStats(query as any),

    // Onchain API
    "POST /onchain/deploy-fungible": async ({ body }) =>
      client.deployFungible(body as any),
    "GET /onchain/relevant-fungible-owners": async ({ query }) =>
      client.fetchRelevantFungibleOwners(query as any),
    "POST /onchain/send-fungibles": async ({ body }) =>
      client.sendFungiblesToUsers(body as any),
    "POST /onchain/mint-nft": async ({ body }) => client.mintNft(body as any),
    "POST /onchain/simulate-mint-nft": async ({ body }) =>
      client.simulateNftMint(body as any),

    // Reactions API
    "DELETE /reactions": async ({ body }) => client.deleteReaction(body as any),
    "POST /reactions": async ({ body }) => client.publishReaction(body as any),
    "GET /reactions/user": async ({ query }) =>
      client.fetchUserReactions(query as any),

    // Signers API
    "GET /signers": async ({ query }) => client.fetchSigners(query as any),
    "GET /signers/lookup": async ({ query }) =>
      client.lookupSigner(query as any),
    "GET /signers/developer-managed/lookup": async ({ query }) =>
      client.lookupDeveloperManagedSigner(query as any),
    "POST /signers/register": async ({ body }) =>
      client.registerSignedKey(body as any),
    "POST /signers/create-and-register": async ({ body }) =>
      client.createSignerAndRegisterSignedKey(body as any),
    "POST /signers/developer-managed/register": async ({ body }) =>
      client.registerSignedKeyForDeveloperManagedSigner(body as any),

    // Storage API
    "POST /storage/buy": async ({ body }) => client.buyStorage(body as any),
    "GET /storage/allocations": async ({ query }) =>
      client.lookupUserStorageAllocations(query as any),
    "GET /storage/usage": async ({ query }) =>
      client.lookupUserStorageUsage(query as any),

    // Subscriptions API - Updated to match actual Neynar API endpoints
    "GET /v2/farcaster/user/subscribed_to": async ({ query }) =>
      client.fetchSubscribedToForFid(query as any),
    "GET /v2/farcaster/user/subscribers": async ({ query }) =>
      client.fetchSubscribersForFid(query as any),
    "GET /v2/stp/subscription_check": async ({ query }) =>
      client.fetchSubscriptionCheck(query as any),
    "GET /v2/farcaster/user/subscriptions_created": async ({ query }) =>
      client.fetchSubscriptionsForFid(query as any),

    // Transaction Frames API
    "POST /transactions/pay-frame": async ({ body }) =>
      client.createTransactionPayFrame(body as any),
    "GET /transactions/pay-frame": async ({ query }) =>
      client.getTransactionPayFrame(query as any),

    // Users API
    "GET /users/bulk": async ({ query }) => client.fetchBulkUsers(query as any),
    "GET /users/bulk-by-address": async ({ query }) =>
      client.fetchBulkUsersByEthOrSolAddress(query as any),
    "GET /users/by-username": async ({ query }) =>
      client.lookupUserByUsername(query as any),
    "GET /users/by-custody-address": async ({ query }) =>
      client.lookupUserByCustodyAddress(query as any),
    "GET /users/by-x-username": async ({ query }) =>
      client.lookupUsersByXUsername(query as any),
    "GET /users/by-location": async ({ query }) =>
      client.fetchUsersByLocation(query as any),
    "GET /users/search": async ({ query }) => client.searchUser(query as any),
    "PUT /users": async ({ body }) => client.updateUser(body as any),
    "GET /users/followers": async ({ query }) =>
      client.fetchUserFollowers(query as any),
    "GET /users/following": async ({ query }) =>
      client.fetchUserFollowing(query as any),
    "GET /users/reciprocal-followers": async ({ query }) =>
      client.fetchUserReciprocalFollowers(query as any),
    "GET /users/relevant-followers": async ({ query }) =>
      client.fetchRelevantFollowers(query as any),

    // V2 User API with path parameters (supporting both /user/:fid/followers and /users/followers patterns)
    "GET /v2/user/:fid/followers": async ({ path, query }) =>
      client.fetchUserFollowers({ fid: parseInt(path.fid), ...(query as any) }),
    "GET /v2/user/:fid/following": async ({ path, query }) =>
      client.fetchUserFollowing({ fid: parseInt(path.fid), ...(query as any) }),
    "GET /v2/user/:fid/reciprocal-followers": async ({ path, query }) =>
      client.fetchUserReciprocalFollowers({
        fid: parseInt(path.fid),
        ...(query as any),
      }),
    "GET /v2/user/:fid/relevant-followers": async ({ path, query }) =>
      client.fetchRelevantFollowers({
        fid: parseInt(path.fid),
        ...(query as any),
      }),
    "POST /users/follow": async ({ body }) => client.followUser(body as any),
    "DELETE /users/follow": async ({ body }) =>
      client.unfollowUser(body as any),
    "GET /users/follow-suggestions": async ({ query }) =>
      client.fetchFollowSuggestions(query as any),
    "GET /users/best-friends": async ({ query }) =>
      client.getUserBestFriends(query as any),
    "GET /users/interactions": async ({ query }) =>
      client.fetchUserInteractions(query as any),
    "GET /users/balance": async ({ query }) =>
      client.fetchUserBalance(query as any),
    "GET /users/channels": async ({ query }) =>
      client.fetchUserChannels(query as any),
    "GET /users/channel-memberships": async ({ query }) =>
      client.fetchUserChannelMemberships(query as any),
    "GET /users/active-channels": async ({ query }) =>
      client.fetchUsersActiveChannels(query as any),
    "POST /users/verification": async ({ body }) =>
      client.publishVerification(body as any),
    "DELETE /users/verification": async ({ body }) =>
      client.deleteVerification(body as any),

    // Webhooks API
    "GET /webhooks": async ({ query }) => client.lookupWebhook(query as any),
    "POST /webhooks": async ({ body }) => client.publishWebhook(body as any),
    "PUT /webhooks": async ({ body }) => client.updateWebhook(body as any),
    "DELETE /webhooks": async ({ body }) => client.deleteWebhook(body as any),
    "PATCH /webhooks/active-status": async ({ body }) =>
      client.updateWebhookActiveStatus(body as any),

    // Message Publishing API
    "POST /farcaster/message": async ({ body }) =>
      client.publishMessageToFarcaster(body as any),
  };
}
