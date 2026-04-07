/**
 * SDK Response Types - Comprehensive Type Documentation
 *
 * This file contains all response types from the Neynar Node.js SDK used by our hooks,
 * with comprehensive TSDoc documentation extracted from SDK sources and hook documentation.
 *
 * **Architecture:**
 * - Single source of truth for SDK type definitions
 * - All hooks import from this file instead of direct SDK imports
 * - Documentation combines SDK JSDoc + hook inline docs
 * - 162+ types covering all SDK functionality
 *
 * **Type Categories:**
 * - User Types: User, UserProfile, UserVerifiedAddresses, UserDehydrated, etc.
 * - Location Types: Location, LocationAddress
 * - Cast Types: Cast, CastResponse, CastReactions, CastEmbedded, CastMetrics, etc.
 * - Channel Types: Channel, ChannelResponse, ChannelMember, ChannelActivity, etc.
 * - Feed Types: FeedResponse
 * - Notification Types: Notification, NotificationsResponse, NotificationType
 * - App Host Types: AppHostEventType, AppHostGetEventResponse, AppHostUserStateResponse, etc.
 * - Auth & Registration Types: AuthorizationUrlResponse, RegisterUserResponse, NonceResponse, etc.
 * - Ban Types: BanRecord, BanListResponse, BanResponse
 * - Block Types: BlockRecord, BlockListResponse
 * - Reaction Types: ReactionType, ReactionWithCastInfo, ReactionsResponse, ReactionsCastResponse
 * - Fname Types: FnameAvailabilityResponse
 * - Frame Types: Frame, FrameAction, FrameSignaturePacket, NeynarFrame, NeynarFramePage, etc.
 * - Farcaster Action Types: FarcasterActionReqBody, FarcasterActionReqBodyAction, FarcasterActionResponse
 * - Signer Types: Signer, SignerListResponse, DeveloperManagedSigner, SignedKeyRequestSponsor
 * - Storage Types: StorageAllocationsResponse, StorageUsageResponse
 * - Subscription Types: SubscribedToResponse, SubscribersResponse, SubscriptionCheckResponse, etc.
 * - Transaction Types: TransactionFrame, TransactionFrameResponse, TransactionFrameConfig, TransactionSendFungiblesResponse, etc.
 * - Webhook Types: Webhook, WebhookResponse, WebhookListResponse, WebhookSubscription, etc.
 * - Onchain Types: DeployFungibleResponse, MintNft200Response, MintNftRequest, BalanceResponse, etc.
 * - Embed Types: Embed, EmbedUrl, EmbedCast, EmbedUrlMetadata, etc.
 * - Conversation Types: Conversation, ConversationSummary
 * - Follow Types: Follower, FollowersResponse, FollowResponse, BulkFollowResponse, BestFriendsResponse, etc.
 * - Mute Types: MuteListResponse, MuteResponse
 * - Pagination Types: NextCursor
 * - Request Body Types: PostCastReqBodyEmbeds, UpdateUserReqBodyLocation, RegisterUserReqBodyMetadata, etc.
 * - Additional Response Types: FetchCastQuotes200Response, FetchFrameMetaTagsFromUrl200Response, etc.
 * - Supporting Types: TextRange, CastId, ChannelDehydrated, ErrorRes, UserFIDResponse, VerificationChainId, VerificationType
 *
 * @module sdk-response-types
 */

// ============================================================================
// User Types
// ============================================================================

/**
 * Farcaster user profile from Neynar SDK
 *
 * Complete user profile with social metadata, verifications, and optional viewer context.
 *
 * **Properties:**
 * - `fid: number` - Unique Farcaster identifier
 * - `username: string` - User's handle (without @ prefix)
 * - `display_name?: string` - User's display name
 * - `pfp_url?: string` - Profile picture URL
 * - `profile:` {@link UserProfile} - Contains bio (with mentioned profiles/channels), location, banner
 * - `custody_address: string` - Ethereum custody address
 * - `follower_count: number` - Number of followers
 * - `following_count: number` - Number of users being followed
 * - `verifications: Array<string>` - Verified addresses
 * - `verified_addresses:` {@link UserVerifiedAddresses} - Structured verified addresses (eth_addresses, sol_addresses, primary)
 * - `verified_accounts:` {@link UserVerifiedAccountsInner}`[]` - Connected social accounts
 * - `auth_addresses:` {@link UserAuthAddressesInner}`[]` - Authentication addresses
 * - `power_badge: boolean` - Power badge status
 * - `viewer_context?:` {@link UserViewerContext} - Present when viewer_fid provided (shows relationship status)
 * - `score?: number` - Spam probability score (present when x_neynar_experimental enabled)
 * - `experimental?:` {@link UserExperimental} - Experimental features data
 * - `pro?:` {@link UserPro} - Pro subscription status
 */
export type { User } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User profile information
 *
 * Contains user bio, location, and banner image.
 *
 * **Properties:**
 * - `bio:` {@link UserProfileBio} - User bio with mentioned profiles and channels
 * - `location?:` {@link Location} - User's location (city, state, country)
 * - `banner?:` {@link UserProfileBanner} - Banner image data
 */
export type { UserProfile } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User bio with mentions
 *
 * Bio text with structured mentions of other users and channels.
 *
 * **Properties:**
 * - `text: string` - Bio text content
 * - `mentioned_profiles?: Array<UserDehydrated>` - Users mentioned in bio
 * - `mentioned_profiles_ranges?: Array<TextRange>` - Position ranges for user mentions (inclusive start, exclusive end)
 * - `mentioned_channels?: Array<ChannelDehydrated>` - Channels mentioned in bio
 * - `mentioned_channels_ranges?: Array<TextRange>` - Position ranges for channel mentions (inclusive start, exclusive end)
 *
 * **Referenced Types:**
 *
 * {@link UserDehydrated} - Minimal user data for mentions
 *
 * {@link ChannelDehydrated} - Minimal channel data for mentions
 *
 * {@link TextRange} - Text position range (start, end)
 */
export type { UserProfileBio } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User profile banner
 *
 * Banner image for user profile.
 *
 * **Properties:**
 * - `url?: string` - URL of the user's banner image
 */
export type { UserProfileBanner } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User verified addresses
 *
 * Contains all verified blockchain addresses for the user.
 *
 * **Properties:**
 * - `eth_addresses: Array<string>` - Verified Ethereum addresses (oldest to newest)
 * - `sol_addresses: Array<string>` - Verified Solana addresses (oldest to newest)
 * - `primary:` {@link UserVerifiedAddressesPrimary} - Primary verified addresses
 */
export type { UserVerifiedAddresses } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Primary verified addresses
 *
 * The user's primary Ethereum and Solana addresses.
 *
 * **Properties:**
 * - `eth_address: string | null` - Primary Ethereum address
 * - `sol_address: string | null` - Primary Solana address
 */
export type { UserVerifiedAddressesPrimary } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User verified account
 *
 * A connected and verified social media account (e.g., Twitter, GitHub).
 *
 * **Properties:**
 * - `platform?: 'x' | 'github'` - Platform name
 * - `username?: string` - Username on the platform
 */
export type { UserVerifiedAccountsInner } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User authentication address
 *
 * An address used for user authentication.
 *
 * **Properties:**
 * - `address: string` - Ethereum address
 * - `app:` {@link UserDehydrated} - App associated with this auth address
 */
export type { UserAuthAddressesInner } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User viewer context
 *
 * Relationship status between the viewing user and this user.
 * Only present when `viewer_fid` parameter is provided.
 *
 * **Properties:**
 * - `following: boolean` - Viewer follows this user
 * - `followed_by: boolean` - This user follows viewer
 * - `blocking: boolean` - Viewer blocks this user
 * - `blocked_by: boolean` - This user blocks viewer
 */
export type { UserViewerContext } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User experimental features
 *
 * Experimental feature data for the user.
 * Only present when `x_neynar_experimental` parameter is enabled.
 *
 * **Properties:**
 * - `deprecation_notice?: string` - Notice about deprecated features
 * - `neynar_user_score: number` - Score representing probability that account is not spam
 */
export type { UserExperimental } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User Pro subscription
 *
 * Information about the user's Pro subscription status.
 *
 * **Properties:**
 * - `status: 'subscribed' | 'unsubscribed'` - Pro subscription status
 * - `subscribed_at: string` - ISO timestamp when Pro was subscribed
 * - `expires_at: string` - ISO timestamp when Pro expires
 */
export type { UserPro } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Minimal user data
 *
 * Lightweight user object with core identification fields.
 * Used for mentions, relationships, and nested references.
 *
 * **Properties:**
 * - `object: 'user_dehydrated'` - Object type identifier
 * - `fid: number` - Unique Farcaster identifier
 * - `username?: string` - User's handle (without @ prefix)
 * - `display_name?: string` - User's display name
 * - `pfp_url?: string` - Profile picture URL
 * - `custody_address?: string` - Ethereum custody address
 * - `score?: number` - Spam probability score
 */
export type { UserDehydrated } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User response
 *
 * Response containing a single user object.
 *
 * **Properties:**
 * - `user:` {@link User} - The user object
 */
export type { UserResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Bulk users response
 *
 * Response containing multiple user objects.
 *
 * **Properties:**
 * - `users: Array<User>` - Array of user objects
 */
export type { BulkUsersResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User search response
 *
 * Paginated response for user search results.
 *
 * **Properties:**
 * - `result:` {@link UsersResponse} - Users matching the search
 */
export type { UserSearchResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Users response
 *
 * Paginated list of users.
 *
 * **Properties:**
 * - `users: Array<User>` - Array of user objects
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { UsersResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Bulk users by address response
 *
 * Response containing users indexed by their addresses.
 *
 * **Properties:**
 * - `[address: string]: Array<User>` - Map of addresses to user arrays
 */
export type { BulkUsersByAddressResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Users active channels response
 *
 * Response containing channels where users are active.
 *
 * **Properties:**
 * - `channels: Array<Channel>` - Channels where the user is active
 */
export type { UsersActiveChannelsResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Location Types
// ============================================================================

/**
 * Geographic location
 *
 * Coordinates and place names for a location.
 *
 * **Properties:**
 * - `latitude: number` - Latitude coordinate
 * - `longitude: number` - Longitude coordinate
 * - `address?:` {@link LocationAddress} - Structured address (city, state, country)
 * - `radius?: number` - Radius in meters for location search
 */
export type { Location } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Location address
 *
 * Structured address information.
 *
 * **Properties:**
 * - `city?: string` - City name
 * - `state?: string` - State/province name
 * - `country?: string` - Country name
 */
export type { LocationAddress } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Cast Types
// ============================================================================

/**
 * Farcaster cast
 *
 * A post on Farcaster with text, embeds, reactions, and metadata.
 *
 * **Core Properties:**
 * - `object: 'cast'` - Object type identifier
 * - `hash: string` - Unique cast identifier
 * - `author:` {@link User} - User who created the cast
 * - `text: string` - Cast text content
 * - `timestamp: string` - ISO timestamp when cast was created
 *
 * **Threading & Replies:**
 * - `parent_hash: string | null` - Hash of parent cast if this is a reply
 * - `parent_url: string | null` - URL of parent if replying to URL
 * - `root_parent_url: string | null` - URL of root parent in thread
 * - `thread_hash: string | null` - Hash of thread root
 * - `parent_author:` {@link CastEmbeddedParentAuthor} - Author of parent cast
 *
 * **Content & Embeds:**
 * - `embeds: Array<Embed>` - Embedded content (images, videos, URLs, casts)
 * - `frames?: Array<Frame>` - Interactive frames attached to cast
 *
 * **Mentions:**
 * - `mentioned_profiles: Array<User>` - Users mentioned in text
 * - `mentioned_profiles_ranges: Array<TextRange>` - Position ranges for user mentions
 * - `mentioned_channels: Array<ChannelDehydrated>` - Channels mentioned in text
 * - `mentioned_channels_ranges: Array<TextRange>` - Position ranges for channel mentions
 *
 * **Engagement & Context:**
 * - `reactions:` {@link CastReactions} - Counts of likes and recasts
 * - `replies:` {@link CastReplies} - Reply count
 * - `channel:` {@link ChannelOrChannelDehydrated} `| null` - Channel where cast was posted
 * - `viewer_context?:` {@link CastViewerContext} - Viewer's relationship to cast (liked, recasted, etc.)
 * - `author_channel_context?:` {@link ChannelUserContext} - Author's role in the channel
 *
 * **Optional Properties:**
 * - `app?:` {@link UserDehydrated} - App used to create the cast
 * - `type?:` {@link CastNotificationType} - Notification type if applicable
 */
export type { Cast } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast response
 *
 * Response containing a single cast object.
 *
 * **Properties:**
 * - `cast:` {@link Cast} - The cast object
 */
export type { CastResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Bulk casts response
 *
 * Response containing multiple cast objects.
 *
 * **Properties:**
 * - `result: Array<Cast>` - Array of cast objects
 */
export type { BulkCastsResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Casts response
 *
 * Paginated list of casts.
 *
 * **Properties:**
 * - `casts: Array<Cast>` - Array of cast objects
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { CastsResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Casts search response
 *
 * Paginated response for cast search results.
 *
 * **Properties:**
 * - `casts: Array<Cast>` - Array of cast objects matching search
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { CastsSearchResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Post cast response
 *
 * Response after publishing a new cast.
 *
 * **Properties:**
 * - `cast:` {@link Cast} - The newly created cast
 */
export type { PostCastResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Operation response
 *
 * Generic response for mutation operations.
 *
 * **Properties:**
 * - `success: boolean` - Whether the operation succeeded
 * - `message?: string` - Optional message providing details
 */
export type { OperationResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast reactions
 *
 * Counts of reactions on a cast.
 *
 * **Properties:**
 * - `likes_count: number` - Number of likes
 * - `recasts_count: number` - Number of recasts
 * - `likes: Array<ReactionWithUserInfo>` - Like reactions with user info
 * - `recasts: Array<ReactionWithUserInfo>` - Recast reactions with user info
 */
export type { CastReactions } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast replies
 *
 * Reply count for a cast.
 *
 * **Properties:**
 * - `count: number` - Number of replies
 */
export type { CastReplies } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast viewer context
 *
 * Viewer's relationship to a cast.
 *
 * **Properties:**
 * - `liked: boolean` - Viewer has liked this cast
 * - `recasted: boolean` - Viewer has recasted this cast
 */
export type { CastViewerContext } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast notification type
 *
 * Type of notification associated with a cast.
 *
 * **Values:**
 * - `'follows'` - Follow notification
 * - `'recasts'` - Recast notification
 * - `'likes'` - Like notification
 * - `'mention'` - Mention notification
 * - `'reply'` - Reply notification
 */
export type { CastNotificationType } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast embedded parent author
 *
 * Author information for parent cast.
 *
 * **Properties:**
 * - `fid?: number` - Farcaster ID of parent author
 */
export type { CastEmbeddedParentAuthor } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast dehydrated
 *
 * Minimal cast data for nested references.
 *
 * **Properties:**
 * - `object: 'cast_dehydrated'` - Object type identifier
 * - `hash: string` - Cast hash
 * - `author:` {@link UserDehydrated} - Cast author (minimal data)
 */
export type { CastDehydrated } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast embedded
 *
 * Embedded cast within another cast.
 *
 * **Properties:**
 * - `cast:` {@link Cast} - The embedded cast
 */
export type { CastEmbedded } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast ID
 *
 * Unique identifier for a cast.
 *
 * **Properties:**
 * - `fid: number` - Farcaster ID of cast author
 * - `hash: string` - Cast hash
 */
export type { CastId } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast and conversations
 *
 * Cast with its conversation threads.
 *
 * **Properties:**
 * - `cast:` {@link Cast} - The main cast
 * - `conversation:` {@link Conversation} - Conversation containing the cast
 */
export type { CastAndConversations } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Casts metrics response
 *
 * Response containing engagement metrics for casts.
 *
 * **Properties:**
 * - `metrics: Array<CastsMetrics>` - Array of cast metrics
 */
export type { CastsMetricsResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Casts metrics
 *
 * Engagement metrics for a cast.
 *
 * **Properties:**
 * - `cast_hash: string` - Hash of the cast
 * - `likes: number` - Number of likes
 * - `recasts: number` - Number of recasts
 * - `replies: number` - Number of replies
 * - `watches: number` - Number of watches
 */
export type { CastsMetrics } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast composer actions list response
 *
 * Response containing available composer actions.
 *
 * **Properties:**
 * - `actions: Array<CastComposerActionsListResponseActionsInner>` - Available actions
 */
export type { CastComposerActionsListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast embed crawl response
 *
 * Response from crawling an embedded URL.
 *
 * **Properties:**
 * - `url: string` - The crawled URL
 * - `metadata:` {@link EmbedUrlMetadata} - Metadata extracted from URL
 */
export type { CastEmbedCrawlResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Cast composer actions list response actions inner
 *
 * An individual composer action available to users.
 *
 * **Properties:**
 * - `name?: string` - The name of the action
 * - `icon?: string` - The icon representing the action
 * - `description?: string` - A brief description of the action
 * - `about_url?: string` - URL to learn more about the action
 * - `image_url?: string` - URL of the action's image
 * - `action_url?: string` - URL to perform the action
 * - `action?:` {@link CastComposerActionsListResponseActionsInnerAction} - Action configuration details
 * - `octicon?: string` - Icon name for the action
 * - `added_count?: number` - Number of times the action has been added
 * - `app_name?: string` - Name of the application providing the action
 * - `author_fid?: number` - Author's Farcaster ID
 * - `category?: string` - Category of the action
 * - `object?: string` - Object type, which is "composer_action"
 *
 * **Usage Context:**
 * - Returned by {@link CastComposerActionsListResponse}
 * - Used to display available composer actions in the UI
 */
export type { CastComposerActionsListResponseActionsInner } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Farcaster channel
 *
 * A topic-based community on Farcaster.
 *
 * **Core Properties:**
 * - `object: 'channel'` - Object type identifier
 * - `id: string` - Unique channel identifier
 * - `url: string` - Channel URL
 * - `name?: string` - Channel name
 * - `description?: string` - Channel description
 * - `image_url?: string` - Channel image URL
 * - `created_at: string` - ISO timestamp when channel was created
 *
 * **Community & Moderation:**
 * - `follower_count?: number` - Number of followers
 * - `member_count?: number` - Number of members
 * - `lead?:` {@link User} - Channel lead/owner
 * - `moderator_fids?: Array<number>` - FIDs of channel moderators
 *
 * **Content & Links:**
 * - `parent_url?: string` - Parent URL for the channel
 * - `pinned_cast_hash?: string` - Hash of pinned cast
 * - `external_link?:` {@link ChannelExternalLink} - External link for channel
 *
 * **Mentions:**
 * - `description_mentioned_profiles?: Array<UserDehydrated>` - Users mentioned in description
 * - `description_mentioned_profiles_ranges?: Array<TextRange>` - Position ranges for mentions
 *
 * **Viewer Context:**
 * - `viewer_context?:` {@link ChannelUserContext} - Viewer's relationship to channel (following, role, etc.)
 */
export type { Channel } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel dehydrated
 *
 * Minimal channel data for nested references.
 *
 * **Properties:**
 * - `object: 'channel_dehydrated'` - Object type identifier
 * - `id: string` - Channel identifier
 * - `url: string` - Channel URL
 * - `name?: string` - Channel name
 * - `image_url?: string` - Channel image URL
 */
export type { ChannelDehydrated } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel or channel dehydrated
 *
 * Union type for full or minimal channel data.
 */
export type { ChannelOrChannelDehydrated } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel response
 *
 * Response containing a single channel object.
 *
 * **Properties:**
 * - `channel:` {@link Channel} - The channel object
 */
export type { ChannelResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel response bulk
 *
 * Response containing multiple channel objects.
 *
 * **Properties:**
 * - `channels: Array<Channel>` - Array of channel objects
 */
export type { ChannelResponseBulk } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel list response
 *
 * Paginated list of channels.
 *
 * **Properties:**
 * - `channels: Array<Channel>` - Array of channel objects
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { ChannelListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel search response
 *
 * Paginated response for channel search results.
 *
 * **Properties:**
 * - `channels: Array<Channel>` - Array of channel objects matching search
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { ChannelSearchResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Trending channel response
 *
 * Response containing trending channels.
 *
 * **Properties:**
 * - `channels: Array<Channel>` - Array of trending channel objects
 */
export type { TrendingChannelResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel member
 *
 * A member of a channel with role information.
 *
 * **Properties:**
 * - `user:` {@link ChannelMemberUser} - The user who is a member
 * - `role:` {@link ChannelMemberRole} - Member's role in the channel
 * - `channel:` {@link ChannelMemberChannel} - The channel
 */
export type { ChannelMember } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel member list response
 *
 * Paginated list of channel members.
 *
 * **Properties:**
 * - `members: Array<ChannelMember>` - Array of channel members
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { ChannelMemberListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel user context
 *
 * User's relationship to a channel.
 *
 * **Properties:**
 * - `following: boolean` - User is following the channel
 * - `role?: string` - User's role in the channel
 */
export type { ChannelUserContext } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel external link
 *
 * External link associated with a channel.
 *
 * **Properties:**
 * - `title?: string` - Link title
 * - `url?: string` - Link URL
 */
export type { ChannelExternalLink } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel member role
 *
 * Role of a member in a channel.
 *
 * **Values:**
 * - `'member'` - Regular member
 * - `'moderator'` - Channel moderator
 * - `'lead'` - Channel lead/owner
 */
export type { ChannelMemberRole } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel member user
 *
 * User information for a channel member.
 */
export type { ChannelMemberUser } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel member channel
 *
 * Channel information for a channel member.
 */
export type { ChannelMemberChannel } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel member invite
 *
 * Invitation to join a channel.
 *
 * **Properties:**
 * - `channel:` {@link Channel} - The channel
 * - `invited_by:` {@link User} - User who sent the invitation
 * - `created_at: string` - ISO timestamp when invite was created
 */
export type { ChannelMemberInvite } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel member invite list response
 *
 * Paginated list of channel invitations.
 *
 * **Properties:**
 * - `invites: Array<ChannelMemberInvite>` - Array of invitations
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { ChannelMemberInviteListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Channel activity
 *
 * Activity metrics for a channel.
 *
 * **Properties:**
 * - `channel_id: string` - Channel identifier
 * - `casts: number` - Number of casts
 * - `unique_users: number` - Number of unique users
 */
export type { ChannelActivity } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Feed Types
// ============================================================================

/**
 * Feed response
 *
 * Paginated list of casts in a feed.
 *
 * **Properties:**
 * - `casts: Array<Cast>` - Array of cast objects in the feed
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { FeedResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Notification
 *
 * A notification about activity related to the user.
 *
 * **Core Properties:**
 * - `object: 'notification'` - Object type identifier
 * - `type:` {@link NotificationTypeEnum} - Type of notification (follows, likes, recasts, mention, reply)
 * - `most_recent_timestamp: string` - ISO timestamp of most recent activity
 * - `seen: boolean` - Whether notification has been seen
 *
 * **Content (varies by type):**
 * - `follows?: Array<Follower>` - Follow notifications (when type is 'follows')
 * - `reactions?: Array<ReactionWithUserInfo>` - Reaction notifications (when type is 'likes' or 'recasts')
 * - `cast?:` {@link Cast} - Cast notifications (when type is 'mention', 'reply', or 'quote')
 *
 * **Aggregation:**
 * - `count?: number` - Number of notifications bundled together
 */
export type { Notification } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Notifications response
 *
 * Paginated list of notifications with unseen count.
 *
 * **Properties:**
 * - `unseen_notifications_count: number` - Number of unseen notifications
 * - `notifications: Array<Notification>` - Array of notification objects
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { NotificationsResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// App Host Types
// ============================================================================

/**
 * App host event type enum
 *
 * Types of events that can occur between a user and an app host (mini app).
 *
 * **Values:**
 * - `'frame_added'` - User adds a mini app to their account
 * - `'frame_removed'` - User removes a mini app from their account
 * - `'notifications_enabled'` - User enables notifications for a mini app
 * - `'notifications_disabled'` - User disables notifications for a mini app
 */
export type { AppHostEventType } from "@neynar/nodejs-sdk/build/api/models";

/**
 * App host event response
 *
 * Response from fetching app host event data.
 *
 * **Properties:**
 * - `event: string` - Legacy event type string corresponding to the requested event type
 * - `notificationDetails?:` {@link AppHostGetEventResponseNotificationDetails} - Notification setup details (only present when event is notifications_enabled)
 */
export type { AppHostGetEventResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * App host notification details
 *
 * Details for notification setup, only present when event is notifications_enabled.
 *
 * **Properties:**
 * - `url: string` - URL endpoint for sending notifications
 * - `token: string` - Token to use when sending notifications to this user
 */
export type { AppHostGetEventResponseNotificationDetails } from "@neynar/nodejs-sdk/build/api/models";

/**
 * App host post event request body
 *
 * Request body for app host events.
 * Can either provide a signed_message or a signer_uuid with event details.
 *
 * **Union Type:**
 * - Option 1: Signed message variant (AppHostPostEventReqBodyOneOf)
 * - Option 2: Signer UUID variant (AppHostPostEventReqBodyOneOf1)
 */
export type { AppHostPostEventReqBody } from "@neynar/nodejs-sdk/build/api/models";

/**
 * App host post event response
 *
 * Response from posting an app host event.
 *
 * **Properties:**
 * - `success: boolean` - Indicates if the event was posted successfully
 * - `message?: string` - Optional message providing additional details
 */
export type { AppHostPostEventResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * App host user state response
 *
 * Response containing user's app host state and notification preferences.
 *
 * **Properties:**
 * - `notifications_enabled: Array<AppHostUserStateResponseNotificationsEnabledInner>` - List of domains for which notifications are enabled for this user
 */
export type { AppHostUserStateResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Auth & Registration Types
// ============================================================================

/**
 * Authorization URL response
 *
 * Response containing authorization URL for OAuth flow.
 *
 * **Properties:**
 * - `authorization_url: string` - URL to redirect user for authorization
 */
export type { AuthorizationUrlResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Register user response
 *
 * Response after registering a new Farcaster user.
 *
 * **Properties:**
 * - `signer_uuid: string` - UUID of the created signer
 * - `user:` {@link User} - The newly registered user
 */
export type { RegisterUserResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Register user on chain response
 *
 * Response after registering a user on-chain.
 *
 * **Properties:**
 * - `success: boolean` - Whether registration succeeded
 * - `message?: string` - Optional message with details
 */
export type { RegisterUserOnChainResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Nonce response
 *
 * Response containing a nonce for authentication.
 *
 * **Properties:**
 * - `nonce: string` - The nonce value
 * - `expires_at: string` - ISO timestamp when nonce expires
 */
export type { NonceResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Ban Types
// ============================================================================

/**
 * Ban record
 *
 * Represents a ban relationship between two Farcaster users.
 *
 * **Properties:**
 * - `object: 'ban'` - Object type identifier (always 'ban')
 * - `banned?:` {@link User} - User who is banned
 * - `banner?:` {@link User} - User who created the ban
 * - `banned_at: string` - ISO timestamp when the ban was created
 */
export type { BanRecord } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Ban list response
 *
 * Paginated list of bans.
 *
 * **Properties:**
 * - `bans: Array<BanRecord>` - Array of ban records
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { BanListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Ban response
 *
 * Response after creating or removing a ban.
 *
 * **Properties:**
 * - `success: boolean` - Whether the operation succeeded
 * - `message?: string` - Optional message providing details
 */
export type { BanResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Block Types
// ============================================================================

/**
 * Block record
 *
 * Represents a block relationship between two Farcaster users.
 *
 * **Properties:**
 * - `object: 'block'` - Object type identifier (always 'block')
 * - `blocked?:` {@link User} - User who is blocked
 * - `blocker?:` {@link User} - User who created the block
 * - `blocked_at: string` - ISO timestamp when the block was created
 */
export type { BlockRecord } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Block list response
 *
 * Paginated list of blocks.
 *
 * **Properties:**
 * - `blocks: Array<BlockRecord>` - Array of block records
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { BlockListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Block request body
 *
 * Request body for blocking a user.
 *
 * **Properties:**
 * - `signer_uuid: string` - UUID of the signer (paired with API key)
 * - `blocked_fid: number` - The unique identifier of a farcaster user or app (unsigned integer)
 */
export type { BlockReqBody } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Reaction Types
// ============================================================================

/**
 * Reaction with cast information
 *
 * Represents a user reaction (like or recast) with full cast details.
 *
 * **Properties:**
 * - `reaction_type: 'like' | 'recast'` - Type of reaction
 * - `app?:` {@link UserDehydrated} - App through which the reaction was made
 * - `cast:` {@link Cast} - The cast that was reacted to
 * - `reaction_timestamp: string` - ISO timestamp when the reaction was made
 * - `object: 'likes' | 'recasts'` - Object type identifier
 * - `user:` {@link UserDehydrated} - User who made the reaction
 */
export type { ReactionWithCastInfo } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Reaction with user information
 *
 * Represents a user reaction with user details.
 *
 * **Properties:**
 * - `fid: number` - Farcaster ID of user who reacted
 * - `fname?: string` - Username of user who reacted
 */
export type { ReactionWithUserInfo } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Reactions response
 *
 * Paginated list of reactions with cast information.
 *
 * **Properties:**
 * - `reactions: Array<ReactionWithCastInfo>` - Array of reactions with cast details
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { ReactionsResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Reactions cast response
 *
 * Response containing reactions to a specific cast.
 *
 * **Properties:**
 * - `cast:` {@link Cast} - The cast that was reacted to
 * - `reactions:` {@link CastReactions} - Reaction counts and details
 */
export type { ReactionsCastResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Reaction for cast
 *
 * Represents a single reaction on a cast with user information.
 *
 * **Properties:**
 * - `reaction_type:` {@link ReactionType} - Type of reaction ('like' or 'recast')
 * - `app?:` {@link UserDehydrated} - App through which the reaction was made
 * - `reaction_timestamp: string` - ISO timestamp when the reaction was made
 * - `object: 'likes' | 'recasts'` - Object type identifier
 * - `user:` {@link User} - User who made the reaction
 *
 * **Usage Context:**
 * - Used in cast reaction listings
 * - Includes full user data (unlike {@link ReactionWithUserInfo} which has minimal data)
 */
export type { ReactionForCast } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Fname Types
// ============================================================================

/**
 * Fname availability response
 *
 * Response indicating whether a Farcaster username (fname) is available for registration.
 *
 * **Properties:**
 * - `available: boolean` - Whether the fname is available for registration
 */
export type { FnameAvailabilityResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Frame Types
// ============================================================================

/**
 * Frame
 *
 * Interactive frame embedded in a cast.
 *
 * **Properties:**
 * - `version: string` - Frame version
 * - `title?: string` - Frame title
 * - `image: string` - Frame image URL
 * - `buttons?: Array<FrameButton>` - Interactive buttons
 * - `input?: FrameInput` - Input field configuration
 * - `state?: FrameState` - Frame state data
 * - `post_url?: string` - URL for frame actions
 * - `frames_url?: string` - URL for frame manifest
 */
export type { Frame } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame action
 *
 * Action performed on a frame.
 *
 * **Properties:**
 * - `action_index: number` - Index of the button clicked
 * - `cast_id:` {@link CastId} - Cast containing the frame
 * - `address: string` - Address of user performing action
 * - `message_hash: string` - Hash of the action message
 */
export type { FrameAction } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame action request body
 *
 * Request body for posting frame actions.
 */
export type { FrameActionReqBody } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame signature packet
 *
 * Signed frame action data.
 *
 * **Properties:**
 * - `untrusted_data:` {@link FrameSignaturePacketUntrustedData} - Unverified action data
 * - `trusted_data:` {@link FrameSignaturePacketTrustedData} - Verified signed data
 */
export type { FrameSignaturePacket } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Validate frame action response
 *
 * Response from validating a frame action.
 *
 * **Properties:**
 * - `valid: boolean` - Whether the action is valid
 * - `action:` {@link ValidatedFrameAction} - The validated action details
 */
export type { ValidateFrameActionResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Validated frame action
 *
 * Validated frame action with full details.
 *
 * **Properties:**
 * - `object: 'validated_frame_action'` - Object type identifier
 * - `interactor:` {@link User} - User who performed the action
 * - `tapped_button:` {@link ValidatedFrameActionTappedButton} - Button that was tapped
 * - `cast:` {@link Cast} - Cast containing the frame
 * - `input?: string` - Text input from user
 */
export type { ValidatedFrameAction } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame catalog response
 *
 * Response containing catalog of available frames.
 *
 * **Properties:**
 * - `frames: Array<Frame>` - Array of frame objects
 */
export type { FrameCatalogResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame validate analytics response
 *
 * Response containing frame analytics data.
 *
 * **Properties:**
 * - `total_interactions: number` - Total number of interactions
 * - `unique_interactors: number` - Number of unique users
 * - `interactions_per_cast:` {@link FrameValidateAnalyticsInteractionsPerCast} - Breakdown by cast
 */
export type { FrameValidateAnalyticsResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame validate list response
 *
 * Response containing list of frame validations.
 *
 * **Properties:**
 * - `validations: Array<ValidatedFrameAction>` - Array of validated actions
 * - `next:` {@link NextCursor} - Cursor for pagination
 */
export type { FrameValidateListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Delete frame response
 *
 * Response after deleting a frame.
 *
 * **Properties:**
 * - `success: boolean` - Whether deletion succeeded
 */
export type { DeleteFrameResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame notification tokens
 *
 * Tokens for sending frame notifications.
 *
 * **Properties:**
 * - `notification_tokens: Array<FrameNotificationTokensNotificationTokensInner>` - Array of notification tokens
 */
export type { FrameNotificationTokens } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame notification token item
 *
 * Individual notification token for a frame.
 *
 * **Properties:**
 * - `object?: "notification_token"` - Type identifier
 * - `url?: string` - Frame URL
 * - `token?: string` - Notification token
 * - `status?: "enabled" | "disabled"` - Token status
 * - `fid?: number` - Farcaster user ID
 * - `created_at?: string` - Creation timestamp
 * - `updated_at?: string` - Last update timestamp
 */
export type { FrameNotificationTokensNotificationTokensInner } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Mini app v2 object with full user object
 *
 * Frame v2 (mini app) with complete author information.
 *
 * **Properties:**
 * - `version: string` - Version of the mini app ('next' for v2, 'vNext' for v1)
 * - `image: string` - URL of the frame image
 * - `frames_url: string` - Launch URL of the mini app
 * - `title?: string` - Button title of the mini app
 * - `manifest?:` {@link FarcasterManifest} - Farcaster manifest object
 * - `author?:` {@link User} - Full user object of the frame author
 * - `metadata?: FetchRelevantFrames200ResponseRelevantFramesInnerFrameMetadata` - Frame metadata
 */
export type { FrameV2WithFullAuthor } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Relevant frame item
 *
 * Frame with relevant user information.
 *
 * **Properties:**
 * - `frame: FetchRelevantFrames200ResponseRelevantFramesInnerFrame` - Frame object
 * - `top_relevant_users:` {@link User}`[]` - Array of the most relevant users
 * - `remaining_relevant_users:` {@link UserDehydrated}`[]` - Array of remaining relevant users in dehydrated form
 */
export type { FetchRelevantFrames200ResponseRelevantFramesInner } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Send frame notifications response
 *
 * Response after sending frame notifications.
 *
 * **Properties:**
 * - `campaign_id: string` - ID of the notification campaign
 * - `success: boolean` - Whether notifications were sent successfully
 */
export type { SendFrameNotificationsResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Farcaster Action Types
// ============================================================================

/**
 * Farcaster action request body
 *
 * Request body for publishing a Farcaster action.
 *
 * **Properties:**
 * - `signer_uuid: string` - The signer_uuid of the user on behalf of whom the action is being performed
 * - `base_url: string` - The base URL of the app on which the action is being performed
 * - `action:` {@link FarcasterActionReqBodyAction} - Action details including type and payload
 */
export type { FarcasterActionReqBody } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Farcaster action details
 *
 * Details of the action being performed.
 *
 * **Properties:**
 * - `type: string` - The type of action being performed
 * - `payload?: object` - The payload of the action being performed
 */
export type { FarcasterActionReqBodyAction } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Farcaster action response
 *
 * Dynamic response from publishing a Farcaster action.
 * The SDK returns a generic object with dynamic properties based on the action type.
 *
 * **Properties:**
 * - `[key: string]: unknown` - Dynamic properties based on action type
 */
export type FarcasterActionResponse = {
  [key: string]: unknown;
};

// ============================================================================
// Signer Types
// ============================================================================

/**
 * Signer
 *
 * A signer key for performing actions on behalf of a user.
 *
 * **Core Properties:**
 * - `object?: 'signer'` - Object type identifier
 * - `signer_uuid: string` - UUID of the signer (paired with API key)
 * - `public_key: string` - Ed25519 public key
 * - `status:` {@link SignerStatusEnum} - Signer status (generated, pending_approval, approved, revoked)
 *
 * **Optional Properties:**
 * - `signer_approval_url?: string` - URL for user to approve signer
 * - `fid?: number` - Farcaster ID associated with signer
 * - `permissions?: Array<SharedSignerPermission>` - Permissions granted to signer
 */
export type { Signer } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Signer list response
 *
 * Response containing list of signers.
 *
 * **Properties:**
 * - `signers: Array<Signer>` - Array of signer objects
 */
export type { SignerListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Developer managed signer
 *
 * Signer managed by the developer.
 *
 * **Properties:**
 * - `signer_uuid: string` - UUID of the signer
 * - `public_key: string` - Ed25519 public key
 * - `status: string` - Signer status
 * - `fid: number` - Farcaster ID
 */
export type { DeveloperManagedSigner } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Storage allocations response
 *
 * Response containing storage allocation data.
 *
 * **Properties:**
 * - `allocations: Array<StorageAllocation>` - Array of storage allocations
 * - `total_active_units: number` - Total active storage units
 */
export type { StorageAllocationsResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Storage usage response
 *
 * Response containing storage usage data.
 *
 * **Properties:**
 * - `object: 'storage_usage'` - Object type identifier
 * - `fid: number` - Farcaster ID
 * - `units: number` - Storage units used
 * - `timestamp: string` - ISO timestamp
 */
export type { StorageUsageResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Subscription Types
// ============================================================================

/**
 * Subscribed to response
 *
 * Response containing users subscribed to.
 *
 * **Properties:**
 * - `subscribed_to: Array<User>` - Users subscribed to
 * - `next:` {@link NextCursor} - Cursor for pagination
 */
export type { SubscribedToResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Subscribers response
 *
 * Response containing subscriber list.
 *
 * **Properties:**
 * - `subscribers: Array<User>` - Array of subscribers
 * - `next:` {@link NextCursor} - Cursor for pagination
 */
export type { SubscribersResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Subscription check response
 *
 * Response checking if user is subscribed.
 *
 * **Properties:**
 * - `subscribed: boolean` - Whether user is subscribed
 */
export type { SubscriptionCheckResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Subscriptions response
 *
 * Response containing subscription data.
 *
 * **Properties:**
 * - `subscriptions: Array<Subscription>` - Array of subscriptions
 */
export type { SubscriptionsResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Subscribed to
 *
 * Represents a subscription relationship with full details including creator info.
 *
 * **Properties:**
 * - `object: 'subscription'` - Object type identifier (always 'subscription')
 * - `provider_name?: string` - Name of the subscription provider
 * - `contract_address: string` - Smart contract address for the subscription
 * - `chain: number` - Blockchain chain ID
 * - `metadata:` {@link SubscriptionMetadata} - Subscription metadata (name, description, etc.)
 * - `owner_address: string` - Address of the subscription contract owner
 * - `price:` {@link SubscriptionPrice} - Pricing information for the subscription
 * - `tiers?: Array<SubscriptionTier>` - Available subscription tiers
 * - `protocol_version: number` - Version of the subscription protocol
 * - `token:` {@link SubscriptionToken} - Token information for payment
 * - `expires_at: string` - ISO timestamp when the subscription expires
 * - `subscribed_at: string` - ISO timestamp when the subscription started
 * - `tier:` {@link SubscriptionTier} - Current subscription tier
 * - `creator:` {@link User} - User who created the subscription
 *
 * **Usage Context:**
 * - Returned by subscription queries showing who the user is subscribed to
 * - Includes full creator user data
 */
export type { SubscribedTo } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Subscriber
 *
 * Represents a subscriber to a subscription with user information.
 *
 * **Properties:**
 * - `object: 'subscriber'` - Object type identifier (always 'subscriber')
 * - `user:` {@link User} - User who is subscribing
 * - `subscribed_to:` {@link SubscribedToObject} - Details of what they're subscribed to
 *
 * **Usage Context:**
 * - Returned by subscriber list queries
 * - Shows who is subscribed to a particular subscription
 */
export type { Subscriber } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Subscription
 *
 * Represents a subscription contract with pricing and metadata.
 *
 * **Properties:**
 * - `object: 'subscription'` - Object type identifier (always 'subscription')
 * - `provider_name?: string` - Name of the subscription provider
 * - `contract_address: string` - Smart contract address for the subscription
 * - `chain: number` - Blockchain chain ID
 * - `metadata:` {@link SubscriptionMetadata} - Subscription metadata (name, description, etc.)
 * - `owner_address: string` - Address of the subscription contract owner
 * - `price:` {@link SubscriptionPrice} - Pricing information for the subscription
 * - `tiers?: Array<SubscriptionTier>` - Available subscription tiers
 * - `protocol_version: number` - Version of the subscription protocol
 * - `token:` {@link SubscriptionToken} - Token information for payment
 *
 * **Usage Context:**
 * - Represents the subscription contract itself
 * - Does not include subscriber-specific data like expiration dates
 */
export type { Subscription } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction frame response
 *
 * Response containing transaction frame data.
 *
 * **Properties:**
 * - `transaction_frame:` {@link TransactionFrame} - The transaction frame object
 */
export type { TransactionFrameResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Transaction frame
 *
 * Frame for executing blockchain transactions.
 *
 * **Properties:**
 * - `type:` {@link TransactionFrameType} - Type of transaction
 * - `status:` {@link TransactionFrameStatus} - Transaction status
 * - `config:` {@link TransactionFrameConfig} - Transaction configuration
 */
export type { TransactionFrame } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Transaction send fungibles response
 *
 * Response after sending fungible tokens.
 *
 * **Properties:**
 * - `success: boolean` - Whether transaction succeeded
 * - `transaction_hash?: string` - Transaction hash
 */
export type { TransactionSendFungiblesResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame pay transaction request body
 *
 * Request body for creating a payment transaction within a frame.
 *
 * **Properties:**
 * - `transaction:` {@link FramePayTransactionReqBodyTransaction} - Transaction details (amount, recipient, etc.)
 * - `config:` {@link TransactionFrameConfig} - Transaction frame configuration (chain, contract details)
 * - `idem?: string` - Idempotency key for preventing duplicate requests (recommended: 16-character unique string)
 *
 * **Usage Context:**
 * - Used when creating payment transactions in frames
 * - Idempotency key ensures retry safety
 */
export type { FramePayTransactionReqBody } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Webhook
 *
 * Webhook configuration for receiving event notifications.
 *
 * **Core Properties:**
 * - `webhook_id: string` - Unique webhook identifier
 * - `target_url: string` - URL to send webhook events
 * - `subscription:` {@link WebhookSubscription} - Event subscription configuration
 * - `active: boolean` - Whether webhook is active
 *
 * **Optional Properties:**
 * - `created_at?: string` - ISO timestamp when webhook was created
 * - `secret?:` {@link WebhookSecret} - Secret for verifying webhook signatures
 */
export type { Webhook } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Webhook response
 *
 * Response containing a single webhook object.
 *
 * **Properties:**
 * - `webhook:` {@link Webhook} - The webhook object
 */
export type { WebhookResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Webhook list response
 *
 * Response containing list of webhooks.
 *
 * **Properties:**
 * - `webhooks: Array<Webhook>` - Array of webhook objects
 */
export type { WebhookListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Webhook subscription
 *
 * Event subscription configuration for a webhook.
 *
 * **Properties:**
 * - `event_type: string` - Type of events to subscribe to
 * - `filters?:` {@link WebhookSubscriptionFilters} - Filters for events
 */
export type { WebhookSubscription } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Webhook subscription filters
 *
 * Filters for webhook event subscriptions.
 *
 * **Properties:**
 * - `cast?:` {@link WebhookSubscriptionFiltersCast} - Cast filters
 * - `follow?:` {@link WebhookSubscriptionFiltersFollow} - Follow filters
 * - `reaction?:` {@link WebhookSubscriptionFiltersReaction} - Reaction filters
 * - `user_updated?:` {@link WebhookSubscriptionFiltersUserUpdated} - User update filters
 */
export type { WebhookSubscriptionFilters } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Webhook secret
 *
 * Secret for verifying webhook signatures.
 *
 * **Properties:**
 * - `value: string` - The secret value
 */
export type { WebhookSecret } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Webhook post request body
 *
 * Request body for creating a new webhook.
 *
 * **Properties:**
 * - `name: string` - Name of the webhook
 * - `url: string` - Target URL to send webhook events
 * - `subscription?:` {@link WebhookSubscriptionFilters} - Event subscription filters (optional)
 *
 * **Usage Context:**
 * - Used when creating a new webhook
 * - Subscription filters determine which events trigger the webhook
 */
export type { WebhookPostReqBody } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Webhook put request body
 *
 * Request body for updating an existing webhook.
 *
 * **Properties:**
 * - `webhook_id: string` - ID of the webhook to update
 * - `name: string` - Updated name of the webhook
 * - `url: string` - Updated target URL to send webhook events
 * - `subscription?:` {@link WebhookSubscriptionFilters} - Updated event subscription filters (optional)
 *
 * **Usage Context:**
 * - Used when updating a webhook's configuration
 * - All fields except subscription are required
 */
export type { WebhookPutReqBody } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Webhook delete request body
 *
 * Request body for deleting a webhook.
 *
 * **Properties:**
 * - `webhook_id: string` - ID of the webhook to delete
 *
 * **Usage Context:**
 * - Used when permanently removing a webhook
 */
export type { WebhookDeleteReqBody } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Webhook patch request body
 *
 * Request body for updating a webhook's active status.
 *
 * **Properties:**
 * - `webhook_id: string` - ID of the webhook to update
 * - `active: 'true' | 'false'` - Whether the webhook should be active
 *
 * **Usage Context:**
 * - Used to enable or disable a webhook without deleting it
 * - Allows temporary suspension of webhook events
 */
export type { WebhookPatchReqBody } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Onchain Types
// ============================================================================

/**
 * Deploy fungible response
 *
 * Response after deploying a fungible token contract.
 *
 * **Properties:**
 * - `success: boolean` - Whether deployment succeeded
 * - `contract:` {@link DeployFungibleResponseContract} - Deployed contract details
 */
export type { DeployFungibleResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Relevant fungible owners response
 *
 * Response containing users who own a fungible token.
 *
 * **Properties:**
 * - `users: Array<User>` - Users who own the token
 * - `next:` {@link NextCursor} - Cursor for pagination
 */
export type { RelevantFungibleOwnersResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Mint NFT response
 *
 * Response after minting an NFT.
 *
 * **Properties:**
 * - `success: boolean` - Whether minting succeeded
 * - `transaction_hash?: string` - Transaction hash
 */
export type { MintNft200Response } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Simulate NFT mint response
 *
 * Response from simulating an NFT mint.
 *
 * **Properties:**
 * - `success: boolean` - Whether simulation succeeded
 * - `gas_estimate?: string` - Estimated gas cost
 */
export type { SimulateNftMintResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Balance response
 *
 * Response containing token balance data.
 *
 * **Properties:**
 * - `balances: Array<BalanceResponseUserBalance>` - Array of balance objects
 */
export type { BalanceResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Embed Types
// ============================================================================

/**
 * Embed
 *
 * Content embedded in a cast (image, video, URL, or another cast).
 *
 * **Union Type - one of:**
 * - {@link EmbedUrl} - URL embed
 * - {@link EmbedCast} - Cast embed
 * - String (image/video URL)
 */
export type { Embed } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Embed URL
 *
 * URL embedded in a cast with metadata.
 *
 * **Properties:**
 * - `url: string` - The embedded URL
 * - `metadata?:` {@link EmbedUrlMetadata} - Metadata extracted from URL
 */
export type { EmbedUrl } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Embed URL metadata
 *
 * Metadata extracted from an embedded URL.
 *
 * **Properties:**
 * - `content_type?: string` - MIME type
 * - `content_length?: number` - Size in bytes
 * - `html?:` {@link HtmlMetadata} - HTML metadata (title, description, etc.)
 * - `image?:` {@link EmbedUrlMetadataImage} - Image metadata
 * - `video?:` {@link EmbedUrlMetadataVideo} - Video metadata
 */
export type { EmbedUrlMetadata } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Embed cast
 *
 * Cast embedded within another cast.
 *
 * **Properties:**
 * - `cast_id:` {@link CastId} - ID of embedded cast
 */
export type { EmbedCast } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Conversation Types
// ============================================================================

/**
 * Conversation
 *
 * A threaded conversation of casts.
 *
 * **Properties:**
 * - `cast:` {@link Cast} - Root cast of conversation
 * - `direct_replies: Array<ConversationConversation>` - Direct replies to the cast
 */
export type { Conversation } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Conversation summary
 *
 * AI-generated summary of a conversation.
 *
 * **Properties:**
 * - `cast:` {@link Cast} - The cast being summarized
 * - `summary:` {@link ConversationSummarySummary} - Summary data
 */
export type { ConversationSummary } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Follow Types
// ============================================================================

/**
 * Follower
 *
 * A user following relationship.
 *
 * **Properties:**
 * - `object: "follower"` - Type identifier
 * - `user:` {@link User} - The follower user
 * - `app?:` {@link UserDehydrated} - Optional app context
 */
export type { Follower } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Followers response
 *
 * Paginated list of followers.
 *
 * **Properties:**
 * - `users: Array<Follower>` - Array of follower objects
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { FollowersResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Follow response
 *
 * Response after following or unfollowing a user.
 *
 * **Properties:**
 * - `success: boolean` - Whether the operation succeeded
 */
export type { FollowResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Bulk follow response
 *
 * Response after bulk follow operation.
 *
 * **Properties:**
 * - `success: boolean` - Whether the operation succeeded
 * - `followed_count: number` - Number of users successfully followed
 */
export type { BulkFollowResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Relevant followers response
 *
 * Response containing relevant followers.
 *
 * **Properties:**
 * - `all_relevant_followers_dehydrated: Array<UserDehydrated>` - Relevant followers (minimal data)
 */
export type { RelevantFollowersResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Best friends response
 *
 * Response containing best friends (mutual follows).
 *
 * **Properties:**
 * - `users: Array<User>` - Array of best friend users
 */
export type { BestFriendsResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Mute Types
// ============================================================================

/**
 * Mute record
 *
 * Represents a mute relationship between two Farcaster users.
 *
 * **Properties:**
 * - `object: 'mute'` - Object type identifier (always 'mute')
 * - `muted:` {@link User} - User who is muted
 * - `muted_at: string` - ISO timestamp when the mute was created
 */
export type { MuteRecord } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Mute request body
 *
 * Request body for muting a user.
 *
 * **Properties:**
 * - `fid: number` - The unique identifier of the user creating the mute (unsigned integer)
 * - `muted_fid: number` - The unique identifier of the user being muted (unsigned integer)
 */
export type { MuteReqBody } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Mute list response
 *
 * Paginated list of muted users.
 *
 * **Properties:**
 * - `muted_users: Array<User>` - Array of muted users
 * - `next:` {@link NextCursor} - Cursor for pagination to fetch next page
 */
export type { MuteListResponse } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Mute response
 *
 * Response after muting or unmuting a user.
 *
 * **Properties:**
 * - `success: boolean` - Whether the operation succeeded
 */
export type { MuteResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Next cursor
 *
 * Pagination cursor for fetching next page of results.
 *
 * **Properties:**
 * - `cursor: string | null` - Cursor value (null if no more pages)
 */
export type { NextCursor } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Text range
 *
 * Position range within text (for mentions, etc.).
 *
 * **Properties:**
 * - `start: number` - Start position (inclusive)
 * - `end: number` - End position (exclusive)
 */
export type { TextRange } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Error response
 *
 * Standard error response from the Neynar API.
 *
 * **Properties:**
 * - `code?: string` - Error code
 * - `message: string` - Error message describing what went wrong
 * - `property?: string` - Property that caused the error
 * - `status?: number` - HTTP status code
 */
export type { ErrorRes } from "@neynar/nodejs-sdk/build/api/models";

/**
 * User FID response
 *
 * Response containing a user's Farcaster ID.
 *
 * **Properties:**
 * - `fid: number` - The unique Farcaster identifier (unsigned integer)
 */
export type { UserFIDResponse } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Enum Types - Notification Parameters
// ============================================================================

/**
 * Notification type enum
 *
 * Types of notifications that can occur on Farcaster.
 *
 * **Values:**
 * - `'follows'` - Follow notifications
 * - `'recasts'` - Recast notifications
 * - `'likes'` - Like notifications
 * - `'mentions'` - Mention notifications
 * - `'replies'` - Reply notifications
 * - `'quotes'` - Quote cast notifications
 */
export type { NotificationType } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Reaction type enum
 *
 * Types of reactions users can perform on casts.
 *
 * **Values:**
 * - `'like'` - Like reaction
 * - `'recast'` - Recast (share) reaction
 */
export type { ReactionType } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Enum Types - Additional Core Enums
// ============================================================================

/**
 * Verification chain ID enum
 *
 * Blockchain chain ID for verification operations.
 */
export type { VerificationChainId } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Verification type enum
 *
 * Type of verification (custody address or verified address).
 */
export type { VerificationType } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Request Body Types
// ============================================================================

/**
 * Post cast request body embeds
 *
 * Embeds to include in a new cast.
 * Can be URLs, cast IDs, or other embedded content.
 */
export type { PostCastReqBodyEmbeds } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Update user request body location
 *
 * Location data for updating user profile.
 *
 * **Properties:**
 * - `latitude?: number` - Latitude coordinate
 * - `longitude?: number` - Longitude coordinate
 * - `address?:` {@link LocationAddress} - Structured address
 */
export type { UpdateUserReqBodyLocation } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Update user request body verified accounts
 *
 * Verified social accounts for updating user profile.
 *
 * **Properties:**
 * - `platform?: 'x' | 'github'` - Social platform
 * - `username?: string` - Username on the platform
 */
export type { UpdateUserReqBodyVerifiedAccounts } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Register user request body metadata
 *
 * Metadata for user registration.
 *
 * **Properties:**
 * - `bio?: string` - User bio
 * - `display_name?: string` - Display name
 * - `pfp_url?: string` - Profile picture URL
 */
export type { RegisterUserReqBodyMetadata } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Register user on-chain request body pre-registration calls
 *
 * Pre-registration contract calls to execute before user registration.
 */
export type { RegisterUserOnChainReqBodyPreRegistrationCallsInner } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Register user on-chain request body registration
 *
 * Registration configuration for on-chain user registration.
 */
export type { RegisterUserOnChainReqBodyRegistration } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Register user on-chain request body signers
 *
 * Signer configuration for on-chain user registration.
 */
export type { RegisterUserOnChainReqBodySignersInner } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Signed key request sponsor
 *
 * Sponsorship configuration for signed key requests.
 *
 * **Properties:**
 * - `fid?: number` - FID of the sponsor
 * - `signature?: string` - Signature from sponsor
 * - `sponsored_by_neynar?: boolean` - Whether Neynar sponsors the signer (if true, fid/signature ignored)
 *
 * **Usage Context:**
 * - Used when creating signers for users
 * - If `sponsored_by_neynar` is true, Neynar will sponsor on behalf of the user (developer charged in compute units)
 */
export type { SignedKeyRequestSponsor } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Send frame notifications request body filters
 *
 * Filters for targeting frame notification recipients.
 */
export type { SendFrameNotificationsReqBodyFilters } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Send frame notifications request body notification
 *
 * Notification content and configuration for frame notifications.
 */
export type { SendFrameNotificationsReqBodyNotification } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Mint NFT request
 *
 * Request body for minting an NFT.
 *
 * **Properties:**
 * - Contains NFT contract address, token ID, and minting parameters
 */
export type { MintNftRequest } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Frame pay transaction request body transaction
 *
 * Transaction configuration for frame payment transactions.
 */
export type { FramePayTransactionReqBodyTransaction } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Transaction send fungibles recipient
 *
 * Recipient configuration for sending fungible tokens.
 *
 * **Properties:**
 * - `address: string` - Recipient address
 * - `amount: string` - Amount to send
 */
export type { TransactionSendFungiblesRecipient } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Additional Response Types
// ============================================================================

/**
 * Fetch cast quotes response
 *
 * Response containing casts that quote another cast.
 */
export type { FetchCastQuotes200Response } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Fetch frame meta tags from URL response
 *
 * Response containing extracted frame metadata from a URL.
 */
export type { FetchFrameMetaTagsFromUrl200Response } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Fetch relevant frames response
 *
 * Response containing frames relevant to a user or context.
 */
export type { FetchRelevantFrames200Response } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Fetch user interactions response
 *
 * Response containing user interaction data.
 */
export type { FetchUserInteractions200Response } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Fetch user reciprocal followers response
 *
 * Response containing users who mutually follow each other.
 */
export type { FetchUserReciprocalFollowers200Response } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Get notification campaign stats response
 *
 * Response containing statistics for a notification campaign.
 *
 * **Properties:**
 * - Statistics about delivery, opens, clicks, etc.
 */
export type { GetNotificationCampaignStats200Response } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Register signed key for developer managed auth address response
 *
 * Response after registering a signed key for developer-managed authentication.
 */
export type { RegisterSignedKeyForDeveloperManagedAuthAddress200Response } from "@neynar/nodejs-sdk/build/api/models";

// ============================================================================
// Frame & Mini App Types
// ============================================================================

/**
 * Neynar frame
 *
 * A Neynar-hosted mini app (frame) with multiple pages.
 *
 * **Properties:**
 * - `uuid: string` - Unique identifier for the mini app
 * - `name: string` - Name of the mini app
 * - `link: string` - Generated link for the mini app's first page
 * - `pages: Array<NeynarFramePage>` - Pages in the mini app
 * - `valid?: boolean` - Indicates if the mini app is valid
 *
 * **Usage Context:**
 * - Returned when creating or fetching Neynar-hosted frames
 * - Used for managing multi-page interactive mini apps
 */
export type { NeynarFrame } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Neynar frame page
 *
 * A single page within a Neynar-hosted mini app.
 *
 * **Properties:**
 * - Page configuration including image, buttons, and actions
 * - Links to other pages in the mini app
 *
 * **Usage Context:**
 * - Used within {@link NeynarFrame} to define multi-page flows
 */
export type { NeynarFramePage } from "@neynar/nodejs-sdk/build/api/models";

/**
 * Transaction frame config
 *
 * Configuration for transaction frames.
 *
 * **Properties:**
 * - Chain configuration
 * - Contract details
 * - Transaction parameters
 *
 * **Usage Context:**
 * - Used in {@link TransactionFrame} for blockchain transaction frames
 */
export type { TransactionFrameConfig } from "@neynar/nodejs-sdk/build/api/models";
