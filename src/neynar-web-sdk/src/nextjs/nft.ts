/**
 * NFT Minting - Route Handler Factories + Standalone Utilities
 *
 * Layer 1 (handler factories): createNftMintHandler, createNftPreviewHandler, createNftPriceHandler
 * Layer 2 (standalone utilities): generateNftImage, mintNft, uploadNftMetadata, estimateNftMintCost
 *
 * All NFT operations are server-side via the Neynar API.
 */

import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import {
  createPublicClient,
  http,
  formatEther,
  parseEther,
} from "viem";

type PublicClient = ReturnType<typeof createPublicClient>;
import { base, optimism, baseSepolia } from "viem/chains";

// ============================================================================
// Types
// ============================================================================

export type NftHandlerConfig = {
  apiKey: string;
  walletId: string;
  network: "base" | "optimism" | "base-sepolia";
  contractAddress: string;
};

export type NftCallbackContext = {
  fid: number;
  collectionSlug: string;
};

export type NftTokenMetadata = {
  name: string;
  description?: string;
  image: string;
  external_url?: string;
  animation_url?: string;
  /** Hex color without '#' prefix, e.g. "FF0000" */
  background_color?: string;
  youtube_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
    display_type?: "number" | "boost_number" | "boost_percentage" | "date";
    max_value?: number;
  }>;
};

/** Static config or a resolver function for multi-collection apps */
type ConfigOrResolver<T> = T | ((ctx: NftCallbackContext) => T);

export type RpcUrlMap = Partial<Record<NftHandlerConfig["network"], string>>;

export type CreateNftMintHandlerOptions = {
  config: ConfigOrResolver<NftHandlerConfig>;

  /** AI prompt for image generation. Can be async (e.g., to fetch user data). tokenId is available for mystery mint (generated after minting). */
  imagePrompt: (
    ctx: NftCallbackContext & { tokenId?: string },
  ) => string | Promise<string>;

  /** Build token metadata from the minted tokenId and image URL */
  metadata: (
    tokenId: string,
    imageUrl: string,
    ctx: NftCallbackContext,
  ) => NftTokenMetadata;

  /** If provided, enables preview-first pattern: looks up pre-generated image instead of generating one */
  previewStorage?: {
    get: (ctx: NftCallbackContext) => Promise<string | null>;
    delete: (ctx: NftCallbackContext) => Promise<void>;
  };

  /** If provided, enables server-side payment verification for paid/fee-only collections */
  paymentVerification?: {
    rpcUrl: RpcUrlMap;
    serverWalletAddress: string;
    /** Return the expected cost in ETH, or null for free collections (skip verification). */
    expectedCost: (
      ctx: NftCallbackContext,
      quantity: number,
    ) => number | null | Promise<number | null>;
    /** Replay protection store */
    txHashStore: {
      isUsed: (txHash: string) => Promise<boolean>;
      markUsed: (txHash: string, ctx: NftCallbackContext) => Promise<void>;
    };
  };
};

export type CreateNftPreviewHandlerOptions = {
  config: ConfigOrResolver<Pick<NftHandlerConfig, "apiKey" | "walletId">>;

  /** AI prompt for image generation. Can be async (e.g., to fetch user data). */
  imagePrompt: (ctx: NftCallbackContext) => string | Promise<string>;

  /** Storage for preview images */
  previewStorage: {
    get: (ctx: NftCallbackContext) => Promise<string | null>;
    save: (ctx: NftCallbackContext, imageUrl: string) => Promise<void>;
  };
};

// ============================================================================
// Internal: Shared fetch wrapper
// ============================================================================

function resolveConfig<T>(
  configOrResolver: ConfigOrResolver<T>,
  ctx: NftCallbackContext,
): T {
  return typeof configOrResolver === "function"
    ? (configOrResolver as (ctx: NftCallbackContext) => T)(ctx)
    : configOrResolver;
}

function resolveRpcUrl(
  rpcUrls: RpcUrlMap,
  network: NftHandlerConfig["network"],
): string {
  const url = rpcUrls[network];
  if (!url) throw new Error(`No RPC URL configured for network "${network}"`);
  return url;
}

const NEYNAR_API_BASE = "https://api.neynar.com";

async function neynarNftPost<T>(
  path: string,
  body: Record<string, unknown>,
  config: Pick<NftHandlerConfig, "apiKey"> & Partial<NftHandlerConfig>,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
  };
  if (config.walletId) {
    headers["x-wallet-id"] = config.walletId;
  }

  const response = await fetch(`${NEYNAR_API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(
      `Neynar API error (${response.status}): ${errorBody}`,
    );
    (error as Error & { status: number }).status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

async function withRetries<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Don't retry client errors (4xx) — only retry server/network errors
      const status = (error as { status?: number }).status;
      if (typeof status === "number" && status >= 400 && status < 500) {
        break;
      }
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * 2 ** attempt),
        );
      }
    }
  }
  throw lastError;
}

// ============================================================================
// Layer 2: Standalone Utilities
// ============================================================================

type GenerateNftImageResult = {
  image_url: string;
};

export type GenerateNftImageOptions = {
  /** URLs of source images to edit or use as reference (max 5) */
  source_image_urls?: string[];
  /** Output width in pixels (1-4096, default: 1024) */
  width?: number;
  /** Output height in pixels (1-4096, default: 1024) */
  height?: number;
  /** Output format (default: "png") */
  format?: "png" | "jpeg" | "webp";
  /** Use high-fidelity model — slower but more detailed. Only use when the image contains text. */
  high_fidelity?: boolean;
  maxRetries?: number;
};

/**
 * Generate an NFT image using AI via the Neynar API.
 *
 * @param prompt - AI prompt for image generation
 * @param config - API config (needs apiKey + walletId)
 * @param options - Optional image generation and retry config
 * @returns Object with image_url
 */
export async function generateNftImage(
  prompt: string,
  config: Pick<NftHandlerConfig, "apiKey" | "walletId">,
  options?: GenerateNftImageOptions,
): Promise<GenerateNftImageResult> {
  const body: Record<string, unknown> = { prompt };
  if (options?.source_image_urls)
    body.source_image_urls = options.source_image_urls;
  if (options?.width != null) body.width = options.width;
  if (options?.height != null) body.height = options.height;
  if (options?.format) body.format = options.format;
  if (options?.high_fidelity != null)
    body.high_fidelity = options.high_fidelity;

  return withRetries(
    () =>
      neynarNftPost<GenerateNftImageResult>(
        "/v2/farcaster/nft/image",
        body,
        config,
      ),
    options?.maxRetries ?? 3,
  );
}

type MintNftParams = {
  fid: number;
  quantity?: number;
  network: "base" | "optimism" | "base-sepolia";
  contractAddress: string;
};

type MintNftResult = {
  transaction_hash: string;
  token_ids: string[];
};

type MintNftRawResponse = {
  transactions: Array<
    | {
        recipient: {
          address: string;
          quantity: number;
          fid?: number;
          tokens?: Array<{ token_id: string }>;
        };
        transaction_hash: string;
      }
    | { error: string }
  >;
};

/**
 * Mint an NFT via the Neynar API (synchronous mode).
 *
 * @param params - Minting parameters (fid, network, contractAddress, quantity)
 * @param config - API config (needs apiKey + walletId)
 */
export async function mintNft(
  params: MintNftParams,
  config: Pick<NftHandlerConfig, "apiKey" | "walletId">,
): Promise<MintNftResult> {
  const raw = await neynarNftPost<MintNftRawResponse>(
    "/v2/farcaster/nft/mint",
    {
      network: params.network,
      contract_address: params.contractAddress,
      recipients: [{ fid: params.fid, quantity: params.quantity ?? 1 }],
      async: false,
    },
    config,
  );

  const tx = raw.transactions[0];
  if (!tx || "error" in tx) {
    throw new Error((tx as { error: string })?.error ?? "Mint failed");
  }

  const tokenIds = tx.recipient.tokens?.map((t) => t.token_id) ?? [];
  if (tokenIds.length === 0) {
    throw new Error("No token IDs returned from mint");
  }

  return {
    transaction_hash: tx.transaction_hash,
    token_ids: tokenIds,
  };
}

type UploadNftMetadataParams = {
  tokenId: string;
  network: "base" | "optimism" | "base-sepolia";
  contractAddress: string;
  metadata: NftTokenMetadata;
};

type UploadNftMetadataResult = {
  metadata_uri: string;
};

type UploadNftMetadataRawResponse = {
  tokens: Array<
    { token_id: string; uri: string } | { token_id: string; error: string }
  >;
};

/**
 * Upload NFT token metadata via the Neynar API.
 *
 * @param params - Metadata parameters (tokenId, network, contractAddress, metadata)
 * @param config - API config (needs apiKey + walletId)
 * @param options - Optional retry config
 */
export async function uploadNftMetadata(
  params: UploadNftMetadataParams,
  config: Pick<NftHandlerConfig, "apiKey" | "walletId">,
  options?: { maxRetries?: number },
): Promise<UploadNftMetadataResult> {
  const raw = await withRetries(
    () =>
      neynarNftPost<UploadNftMetadataRawResponse>(
        "/v2/farcaster/nft/metadata/token",
        {
          network: params.network,
          contract_address: params.contractAddress,
          tokens: [
            {
              token_id: params.tokenId,
              metadata: params.metadata,
            },
          ],
        },
        config,
      ),
    options?.maxRetries ?? 3,
  );

  const token = raw.tokens[0];
  if (!token || "error" in token) {
    throw new Error(
      (token as { error: string })?.error ?? "Metadata upload failed",
    );
  }

  return { metadata_uri: token.uri };
}

// ============================================================================
// Layer 2: Estimate NFT Mint Cost
// ============================================================================

type SimulateMintResponse = {
  to: string;
  data: string;
  value: string;
  estimated_total_cost_wei: string;
};

const CHAIN_MAP = { base, optimism, "base-sepolia": baseSepolia } as const;

/**
 * Estimate the total cost of minting an NFT including gas.
 *
 * Calls the Neynar simulate endpoint which returns `estimated_total_cost_wei`
 * (value + gas with buffer). Falls back to `value` if the field is missing.
 *
 * @returns Total cost in ETH as a number
 */
export async function estimateNftMintCost(
  config: Pick<NftHandlerConfig, "apiKey" | "network" | "contractAddress">,
  params: { fid: number; quantity?: number },
): Promise<number> {
  const quantity = params.quantity ?? 1;

  const simulateParams = new URLSearchParams({
    network: config.network,
    nft_contract_address: config.contractAddress,
    recipients: JSON.stringify([{ fid: params.fid, quantity }]),
  });

  const simulateResponse = await fetch(
    `${NEYNAR_API_BASE}/v2/farcaster/nft/mint?${simulateParams}`,
    {
      method: "GET",
      headers: { "x-api-key": config.apiKey },
    },
  );

  if (!simulateResponse.ok) {
    const errorBody = await simulateResponse.text();
    throw new Error(
      `Neynar simulate error (${simulateResponse.status}): ${errorBody}`,
    );
  }

  const simulateArray =
    (await simulateResponse.json()) as SimulateMintResponse[];
  const simulateData = simulateArray[0];
  if (!simulateData) throw new Error("Simulate returned empty results");

  const costWei = BigInt(simulateData.estimated_total_cost_wei);
  return Number(formatEther(costWei));
}

// ============================================================================
// Internal: Payment verification helpers
// ============================================================================

async function getUserVerifiedAddresses(
  fid: number,
  apiKey: string,
): Promise<string[]> {
  const client = new NeynarAPIClient(new Configuration({ apiKey }));
  const { users } = await client.fetchBulkUsers({ fids: [fid] });

  const user = users[0];
  if (!user) throw new Error(`User not found for fid ${fid}`);

  const addresses: string[] = [];
  if (user.custody_address) {
    addresses.push(user.custody_address.toLowerCase());
  }
  for (const addr of user.verified_addresses.eth_addresses) {
    addresses.push(addr.toLowerCase());
  }
  return addresses;
}

// ============================================================================
// Layer 1: Route Handler Factories
// ============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Run async tasks with a concurrency limit */
async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]!) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

const IMAGE_GEN_CONCURRENCY = 3;

/**
 * Creates a POST handler for the NFT mint route.
 *
 * The client sends `{ fid, collectionSlug, quantity? }` in the request body.
 * Auth is the app's responsibility at a higher level.
 *
 * When `previewStorage` is configured (preview-first pattern), quantity must be 1.
 *
 * Place at: `app/api/nft/mint/route.ts`
 */
export function createNftMintHandler(options: CreateNftMintHandlerOptions): {
  POST: (request: Request) => Promise<Response>;
} {
  const {
    config: configOrResolver,
    imagePrompt,
    metadata,
    previewStorage,
    paymentVerification,
  } = options;

  const viemClients = new Map<string, PublicClient>();
  function getViemClient(network: NftHandlerConfig["network"]): PublicClient {
    let client = viemClients.get(network);
    if (!client && paymentVerification) {
      client = createPublicClient({
        chain: CHAIN_MAP[network],
        transport: http(resolveRpcUrl(paymentVerification.rpcUrl, network)),
      }) as unknown as PublicClient;
      viemClients.set(network, client);
    }
    return client!;
  }

  async function POST(request: Request): Promise<Response> {
    try {
      // 1. Parse request body
      const body = await request.json();
      const fid = body.fid as number | undefined;
      if (!fid) {
        return jsonResponse({ error: "fid is required" }, 400);
      }
      const collectionSlug = body.collectionSlug as string | undefined;
      if (!collectionSlug) {
        return jsonResponse({ error: "collectionSlug is required" }, 400);
      }
      const quantity = (body.quantity as number | undefined) ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1) {
        return jsonResponse(
          { error: "quantity must be a positive integer" },
          400,
        );
      }
      if (previewStorage && quantity > 1) {
        return jsonResponse(
          {
            error:
              "Preview-first pattern only supports quantity of 1. Eject to the standalone utilities for multi-token preview flows.",
          },
          400,
        );
      }

      const ctx: NftCallbackContext = { fid, collectionSlug };
      const config = resolveConfig(configOrResolver, ctx);
      const paymentTxHash = body.paymentTxHash as string | undefined;

      // 1b. Payment verification (if configured)
      if (paymentVerification) {
        const expectedCost = await paymentVerification.expectedCost(
          ctx,
          quantity,
        );

        if (expectedCost !== null && expectedCost > 0) {
          if (!paymentTxHash) {
            return jsonResponse(
              { error: "paymentTxHash is required for paid collections" },
              400,
            );
          }

          // Validate tx hash format
          if (!/^0x[0-9a-fA-F]{64}$/.test(paymentTxHash)) {
            return jsonResponse({ error: "Invalid paymentTxHash format" }, 400);
          }

          // Replay check
          const alreadyUsed =
            await paymentVerification.txHashStore.isUsed(paymentTxHash);
          if (alreadyUsed) {
            return jsonResponse(
              { error: "Payment transaction has already been used" },
              400,
            );
          }

          // Fetch tx + receipt from chain in parallel
          const client = getViemClient(config.network);

          const txHash = paymentTxHash as `0x${string}`;
          const [tx, receipt] = await Promise.all([
            client.getTransaction({ hash: txHash }),
            client.getTransactionReceipt({ hash: txHash }),
          ]);

          // Verify receipt status (tx confirmed and not reverted)
          if (receipt.status !== "success") {
            return jsonResponse(
              { error: "Payment transaction failed or is not yet confirmed" },
              400,
            );
          }

          // Verify recipient matches server wallet
          const expectedRecipient =
            paymentVerification.serverWalletAddress.toLowerCase();
          if (tx.to?.toLowerCase() !== expectedRecipient) {
            return jsonResponse(
              { error: "Payment was not sent to the correct server wallet" },
              400,
            );
          }

          // Verify amount is sufficient
          const expectedWei = parseEther(expectedCost.toFixed(18));
          if (tx.value < expectedWei) {
            return jsonResponse(
              {
                error: `Insufficient payment: expected at least ${expectedCost} ETH, got ${formatEther(tx.value)} ETH`,
              },
              400,
            );
          }

          // Verify sender belongs to requesting FID
          const userAddresses = await getUserVerifiedAddresses(
            fid,
            config.apiKey,
          );
          const txSender = tx.from.toLowerCase();
          if (!userAddresses.includes(txSender)) {
            return jsonResponse(
              {
                error:
                  "Payment sender address does not belong to the requesting user",
              },
              400,
            );
          }

          // Mark tx as used (replay protection)
          await paymentVerification.txHashStore.markUsed(paymentTxHash, ctx);
        }
      }

      // 2. Check for pre-generated preview image (only used for first/only token)
      let previewImageUrl: string | null = null;
      if (previewStorage) {
        previewImageUrl = await previewStorage.get(ctx);
      }

      // 3. Mint the NFT(s) (sync mode)
      const mintResult = await mintNft(
        {
          fid,
          quantity,
          network: config.network,
          contractAddress: config.contractAddress,
        },
        config,
      );
      const { transaction_hash, token_ids } = mintResult;

      // 4. Generate image + upload metadata for each token
      type TokenResult = {
        token_id: string;
        image_url: string | null;
        metadata_uri: string | null;
        error?: string;
      };

      const tokenResults = await mapWithConcurrency(
        token_ids,
        async (tokenId): Promise<TokenResult> => {
          let imageUrl: string | null = null;
          let metadataUri: string | null = null;
          let error: string | undefined;

          try {
            // Use preview image if available (single-token preview-first)
            if (previewImageUrl) {
              imageUrl = previewImageUrl;
            } else {
              const prompt = await imagePrompt({ ...ctx, tokenId });
              const imageResult = await generateNftImage(prompt, config);
              imageUrl = imageResult.image_url;
            }

            const tokenMetadata = metadata(tokenId, imageUrl, ctx);
            const metadataResult = await uploadNftMetadata(
              {
                tokenId,
                network: config.network,
                contractAddress: config.contractAddress,
                metadata: tokenMetadata,
              },
              config,
            );
            metadataUri = metadataResult.metadata_uri;
          } catch (err) {
            error =
              err instanceof Error
                ? err.message
                : "Image/metadata upload failed";
          }

          return {
            token_id: tokenId,
            image_url: imageUrl,
            metadata_uri: metadataUri,
            ...(error ? { error } : {}),
          };
        },
        IMAGE_GEN_CONCURRENCY,
      );

      const tokens: TokenResult[] = tokenResults.map((result, i) => {
        if (result.status === "fulfilled") return result.value;
        const reason = result.reason;
        return {
          token_id: token_ids[i]!,
          image_url: null,
          metadata_uri: null,
          error:
            reason instanceof Error
              ? reason.message
              : "Image/metadata upload failed",
        };
      });

      // 5. Clean up preview storage
      if (previewStorage) {
        try {
          await previewStorage.delete(ctx);
        } catch (e) {
          console.warn("[nft] Failed to clean up preview storage", e);
        }
      }

      return jsonResponse({ transaction_hash, tokens });
    } catch (err) {
      const message = err instanceof Error ? err.message : "NFT mint failed";
      return jsonResponse({ error: message }, 500);
    }
  }

  return { POST };
}

/**
 * Creates a POST handler for the NFT preview route (preview-first pattern).
 *
 * The client sends `{ fid, collectionSlug }` in the request body.
 *
 * Place at: `app/api/nft/preview/route.ts`
 */
export function createNftPreviewHandler(
  options: CreateNftPreviewHandlerOptions,
): {
  POST: (request: Request) => Promise<Response>;
} {
  const { config: configOrResolver, imagePrompt, previewStorage } = options;

  async function POST(request: Request): Promise<Response> {
    try {
      // 1. Parse request body
      const body = await request.json();
      const fid = body.fid as number | undefined;
      if (!fid) {
        return jsonResponse({ error: "fid is required" }, 400);
      }
      const collectionSlug = body.collectionSlug as string | undefined;
      if (!collectionSlug) {
        return jsonResponse({ error: "collectionSlug is required" }, 400);
      }
      const ctx: NftCallbackContext = { fid, collectionSlug };
      const config = resolveConfig(configOrResolver, ctx);

      // 2. Check for existing preview
      const existingPreview = await previewStorage.get(ctx);
      if (existingPreview) {
        return jsonResponse({ image_url: existingPreview });
      }

      // 3. Generate new preview image
      const prompt = await imagePrompt(ctx);
      const imageResult = await generateNftImage(prompt, config);
      const imageUrl = imageResult.image_url;

      // 4. Save preview
      await previewStorage.save(ctx, imageUrl);

      return jsonResponse({ image_url: imageUrl });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "NFT preview generation failed";
      return jsonResponse({ error: message }, 500);
    }
  }

  return { POST };
}

// ============================================================================
// NFT Price Handler Factory
// ============================================================================

export type CreateNftPriceHandlerOptions = {
  config: ConfigOrResolver<
    Pick<NftHandlerConfig, "apiKey" | "network" | "contractAddress">
  >;
  /** Return the pricing tier for a collection. Null or 'free' → cost_eth: 0. */
  pricingTier?: (
    ctx: NftCallbackContext,
  ) => "free" | "fee-only" | "paid" | null;
};

/**
 * Creates a GET handler for the NFT price route.
 *
 * Returns `{ cost_eth: number }` for the given collection + quantity.
 * Free collections return `{ cost_eth: 0 }`.
 *
 * Place at: `app/api/nft/price/route.ts`
 */
export function createNftPriceHandler(options: CreateNftPriceHandlerOptions): {
  GET: (request: Request) => Promise<Response>;
} {
  const { config: configOrResolver, pricingTier } = options;

  async function GET(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const collectionSlug = url.searchParams.get("collectionSlug");
      if (!collectionSlug) {
        return jsonResponse({ error: "collectionSlug is required" }, 400);
      }
      const fid = Number(url.searchParams.get("fid"));
      if (!fid || !Number.isInteger(fid)) {
        return jsonResponse(
          { error: "fid is required and must be an integer" },
          400,
        );
      }
      const quantity = Number(url.searchParams.get("quantity") ?? "1");
      if (!Number.isInteger(quantity) || quantity < 1) {
        return jsonResponse(
          { error: "quantity must be a positive integer" },
          400,
        );
      }

      const ctx: NftCallbackContext = { fid, collectionSlug };

      // Check pricing tier
      const tier = pricingTier?.(ctx) ?? "paid";
      if (tier === "free" || tier === null) {
        return jsonResponse({ cost_eth: 0 });
      }

      const config = resolveConfig(configOrResolver, ctx);
      const costEth = await estimateNftMintCost(config, {
        fid,
        quantity,
      });

      return jsonResponse({ cost_eth: costEth });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to estimate NFT price";
      return jsonResponse({ error: message }, 500);
    }
  }

  return { GET };
}
