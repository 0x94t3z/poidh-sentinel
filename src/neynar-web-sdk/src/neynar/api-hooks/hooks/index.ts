/**
 * Neynar API hooks index
 * Exports all Neynar-specific hooks organized by category
 */

// Re-export all SDK response types for convenience
export * from "../sdk-response-types";

// User-related hooks
export {
  useUser,
  useBulkUsers,
  useUserByUsername,
  useUserSearch,
  useUserFollowers,
  useUserFollowing,
  useUserActiveChannels,
  useBulkUsersByAddress,
  useFollowUser,
  useUnfollowUser,
} from "./user";

// Cast-related hooks
export {
  useCast,
  useBulkCasts,
  useCastsByUser,
  usePopularCastsByUser,
  useRepliesAndRecastsByUser,
  useCastConversation,
  useCastConversationSummary,
  useCastReactions,
  useCastQuotes,
  useCastSearch,
  useComposerActions,
  useEmbeddedUrlMetadata,
  usePublishCast,
  useDeleteCast,
  useLikeCast,
  useUnlikeCast,
} from "./cast";

// Channel-related hooks
export {
  useChannels,
  useBulkChannels,
  useChannel,
  useChannelSearch,
  useTrendingChannels,
  useChannelMembers,
  useChannelFollowers,
  useChannelInvites,
  useFollowChannel,
  useUnfollowChannel,
} from "./channel";

// Feed-related hooks
export {
  useFollowingFeed,
  useForYouFeed,
  useTrendingFeed,
  useTrendingGlobalFeed,
  useChannelFeed,
  useChannelAndChildFeed,
  useMultiChannelFeed,
  useParentUrlFeed,
  useFramesFeed,
  useFilteredFeed,
} from "./feed";

// Actions-related hooks
export { usePublishFarcasterAction } from "./actions";

// App Host-related hooks
export {
  useAppHostEvent,
  useAppHostUserState,
  usePostAppHostEvent,
} from "./app-host";

// Auth & Registration-related hooks
export {
  useAuthorizationUrl,
  useDeveloperManagedAuth,
  useRegisterAccount,
  useRegisterAccountOnchain,
  useRegisterDeveloperManagedSignedKey,
  type UseAuthorizationUrlParams,
  type UseRegisterAccountParams,
  type UseRegisterAccountOnchainParams,
  type UseRegisterDeveloperManagedSignedKeyParams,
} from "./auth";

// Bans-related hooks
export { useBanList, usePublishBans, useDeleteBans } from "./bans";

// Blocks-related hooks
export {
  useBlockList,
  useBlockUser,
  useUnblockUser,
  type UseBlockListParams,
  type UseBlockUserParams,
  type UseUnblockUserParams,
} from "./blocks";

// Fname-related hooks
export { useFnameAvailability } from "./fname";

// Frames-related hooks
export {
  usePostFrameAction,
  usePostFrameActionDeveloperManaged,
  useValidateFrameAction,
  useFrameCatalog,
  useFrameMetaTags,
  useRelevantFrames,
  useFrameSearch,
  useFrameAnalytics,
  usePublishNeynarFrame,
  useUpdateNeynarFrame,
  useDeleteNeynarFrame,
  useNeynarFrameLookup,
  useNotificationTokens,
  usePublishFrameNotifications,
} from "./frames";

// Mutes-related hooks
export { useMuteList, useMuteUser, useUnmuteUser } from "./mutes";

// Notifications-related hooks
export {
  useNotifications,
  useNotificationsByParentUrl,
  useChannelNotifications,
  useMarkNotificationsAsSeen,
  useNotificationCampaignStats,
} from "./notifications";

// Onchain-related hooks
export {
  useDeployFungible,
  useRelevantFungibleOwners,
  useSendFungibles,
  useMintNft,
  useSimulateNftMint,
  useNftMint,
  useNftPreview,
  useNftPrice,
  type NftMintRequest,
  type NftMintResponse,
  type NftMintTokenResult,
  type NftPreviewRequest,
  type NftPreviewResponse,
  type NftPriceRequest,
  type NftPriceResponse,
} from "./onchain";

// Reactions-related hooks
export {
  useUserReactions,
  usePublishReaction,
  useDeleteReaction,
} from "./reactions";

// Signers-related hooks
export {
  useSigners,
  useSignerLookup,
  useDeveloperManagedSignerLookup,
  useRegisterSignedKey,
  useCreateAndRegisterSignedKey,
} from "./signers";

// Storage-related hooks
export {
  useBuyStorage,
  useStorageAllocations,
  useStorageUsage,
  useStorageStatus,
} from "./storage";

// Subscriptions-related hooks
export {
  useSubscribedTo,
  useSubscribers,
  useSubscriptionCheck,
  useSubscriptions,
} from "./subscriptions";

// Transactions-related hooks
export {
  useCreateTransactionPayFrame,
  useTransactionPayFrame,
  type UseCreateTransactionPayFrameParams,
  type UseTransactionPayFrameParams,
} from "./transactions";

// Webhooks-related hooks
export {
  useWebhookLookup,
  usePublishWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useUpdateWebhookActiveStatus,
} from "./webhooks";
