/**
 * Neynar Onchain API Hooks
 *
 * React Query hooks for Neynar onchain operations including fungibles deployment,
 * transfer, and NFT minting. Uses TanStack Query v5 with proper error handling and type safety.
 */
import type {
  RelevantFungibleOwnersResponse,
  User,
} from "../sdk-response-types";
import {
  useApiQuery,
  useApiMutation,
  useApiQueryClient,
  STALE_TIME,
  type BaseMutationOptions,
  type QueryHookOptions,
  type QueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";

// ============================================================================
// Onchain Types
// ============================================================================

/**
 * Deploy fungible token request parameters
 */
export type DeployFungibleRequest = {
  /** The signer UUID for authentication */
  signer_uuid: string;
  /** Name of the fungible token */
  name: string;
  /** Symbol/ticker of the token */
  symbol: string;
  /** Total supply of tokens */
  total_supply: string;
  /** Number of decimal places */
  decimals?: number;
  /** Additional metadata for the token */
  metadata?: Record<string, unknown>;
};

/**
 * Deploy fungible token response
 */
export type DeployFungibleResponse = {
  /** Deployment transaction hash */
  transaction_hash: string;
  /** Deployed contract address */
  contract_address: string;
  /** Deployment status */
  status: "pending" | "confirmed" | "failed";
  /** Additional deployment details */
  details?: Record<string, unknown>;
};

/**
 * Send fungibles request parameters
 */
export type SendFungiblesRequest = {
  /** The signer UUID for authentication */
  signer_uuid: string;
  /** Contract address of the fungible token */
  contract_address: string;
  /** Array of recipients and amounts */
  recipients: Array<{
    /** Recipient's FID or address */
    fid?: number;
    address?: string;
    /** Amount to send */
    amount: string;
  }>;
  /** Optional memo/note */
  memo?: string;
};

/**
 * Send fungibles response
 */
export type SendFungiblesResponse = {
  /** Transaction hash */
  transaction_hash: string;
  /** Transaction status */
  status: "pending" | "confirmed" | "failed";
  /** Number of successful transfers */
  successful_transfers: number;
  /** Failed transfers with reasons */
  failed_transfers?: Array<{
    recipient: string;
    reason: string;
  }>;
};

/**
 * Mint NFT request parameters
 */
export type MintNftRequest = {
  /** The signer UUID for authentication */
  signer_uuid: string;
  /** NFT contract address */
  contract_address: string;
  /** Recipient's FID or address */
  recipient_fid?: number;
  recipient_address?: string;
  /** Token metadata */
  metadata: {
    /** NFT name */
    name: string;
    /** NFT description */
    description?: string;
    /** Image URL */
    image: string;
    /** Additional attributes */
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  /** Mint quantity */
  quantity?: number;
};

/**
 * Mint NFT response
 */
export type MintNftResponse = {
  /** Transaction hash */
  transaction_hash: string;
  /** Minted token IDs */
  token_ids: string[];
  /** Mint status */
  status: "pending" | "confirmed" | "failed";
  /** Total gas cost */
  gas_cost?: string;
};

/**
 * Simulate NFT mint request parameters
 */
export type SimulateNftMintRequest = {
  /** NFT contract address */
  contract_address: string;
  /** Recipient address */
  recipient_address: string;
  /** Token metadata for simulation */
  metadata: MintNftRequest["metadata"];
  /** Quantity to simulate */
  quantity?: number;
};

/**
 * Simulate NFT mint response
 */
export type SimulateNftMintResponse = {
  /** Estimated gas cost */
  estimated_gas: string;
  /** Gas price estimate */
  gas_price: string;
  /** Total estimated cost */
  total_cost: string;
  /** Simulation success */
  success: boolean;
  /** Any simulation errors */
  errors?: string[];
};

// ============================================================================
// Onchain Query Hooks
// ============================================================================

type UseRelevantFungibleOwnersParams = {
  /** Contract address of the fungible token */
  contract_address: string;

  /** Network of the fungible asset (ethereum, optimism, base, arbitrum, solana) */
  network: "ethereum" | "optimism" | "base" | "arbitrum" | "solana";

  /** When provided, returns token holders from user's network; when omitted, returns top token holders across network */
  viewer_fid?: number;
};

/**
 * Fetch a list of relevant owners for an on chain asset
 *
 * Shows token holders as "X, Y, Z and N others you know own this asset" when viewer_fid provided,
 * or top token holders across the network when viewer_fid is omitted.
 *
 * @param params - Query parameters (see type definition for available options)
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with relevant owners data
 *
 * @example
 * ```tsx
 * function TokenHolders({ contractAddress, viewerFid }: {
 *   contractAddress: string;
 *   viewerFid: number
 * }) {
 *   const { data: owners = [] } = useRelevantFungibleOwners({
 *     contract_address: contractAddress,
 *     network: "base",
 *     viewer_fid: viewerFid,
 *   });
 *
 *   return (
 *     <div>
 *       <h2>Token Holders ({owners.length})</h2>
 *       {owners.map(owner => (
 *         <div key={owner.fid}>
 *           <img src={owner.pfp_url} alt={owner.display_name} />
 *           <span>{owner.display_name} (@{owner.username})</span>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useSendFungibles} for sending tokens to these owners
 */
export function useRelevantFungibleOwners(
  params: UseRelevantFungibleOwnersParams,
  options?: QueryHookOptions<RelevantFungibleOwnersResponse, User[]>,
): QueryHookResult<User[]> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<RelevantFungibleOwnersResponse, User[]>(
    neynarQueryKeys.onchain.relevantFungibleOwners(params),
    `/api/neynar/onchain/relevant-fungible-owners?${queryParams}`,
    {
      enabled: Boolean(params.contract_address && params.network),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (response: RelevantFungibleOwnersResponse) => {
        return response?.top_relevant_fungible_owners_hydrated || [];
      },
    },
  );
}

// ============================================================================
// Onchain Mutation Hooks
// ============================================================================

/**
 * Deploy fungible token mutation hook
 *
 * Provides a mutation function to deploy a new fungible token contract on-chain.
 * Returns a TanStack Query mutation with loading states and error handling.
 * Automatically invalidates relevant token queries upon success.
 *
 * @param options - Additional mutation options for error handling and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *   - `mutate: (params: DeployFungibleRequest) => void`
 *
 * @example Basic token deployment
 * ```tsx
 * function CreateTokenForm({ signerUuid }: { signerUuid: string }) {
 *   const [tokenData, setTokenData] = useState({
 *     name: '',
 *     symbol: '',
 *     total_supply: '1000000'
 *   });
 *
 *   const deployMutation = useDeployFungible({
 *     onSuccess: (data) => {
 *       console.log('Token deployed!', data.contract_address);
 *     },
 *     onError: (error) => {
 *       console.error('Deployment failed:', error);
 *     }
 *   });
 *
 *   const handleDeploy = () => {
 *     deployMutation.mutate({
 *       signer_uuid: signerUuid,
 *       name: tokenData.name,
 *       symbol: tokenData.symbol,
 *       total_supply: tokenData.total_supply,
 *       decimals: 18
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={(e) => { e.preventDefault(); handleDeploy(); }}>
 *       <input
 *         value={tokenData.name}
 *         onChange={(e) => setTokenData({...tokenData, name: e.target.value})}
 *         placeholder="Token Name"
 *       />
 *       <input
 *         value={tokenData.symbol}
 *         onChange={(e) => setTokenData({...tokenData, symbol: e.target.value})}
 *         placeholder="Token Symbol"
 *       />
 *       <button
 *         type="submit"
 *         disabled={deployMutation.isPending}
 *       >
 *         {deployMutation.isPending ? 'Deploying...' : 'Deploy Token'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @see {@link useSendFungibles} for transferring deployed tokens
 * @see {@link useRelevantFungibleOwners} for finding token holders
 */
export function useDeployFungible(options?: BaseMutationOptions) {
  const queryClient = useApiQueryClient();

  return useApiMutation<DeployFungibleResponse, DeployFungibleRequest>(
    "/api/neynar/onchain/deploy-fungible",
    "POST",
    {
      onSuccess: () => {
        // Invalidate relevant fungible queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.onchain.all(),
        });
      },
      ...options,
    },
  );
}

/**
 * Send fungibles to users mutation hook
 *
 * Provides a mutation function to transfer fungible tokens to multiple recipients.
 * Supports sending to users by FID or wallet address. Returns a TanStack Query
 * mutation with loading states and detailed transfer results.
 *
 * @param options - Additional mutation options for error handling and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *   - `mutate: (params: SendFungiblesRequest) => void`
 *
 * @example Batch token transfer
 * ```tsx
 * function SendTokensForm({
 *   signerUuid,
 *   contractAddress
 * }: {
 *   signerUuid: string;
 *   contractAddress: string
 * }) {
 *   const [recipients, setRecipients] = useState([
 *     { fid: 0, amount: '' }
 *   ]);
 *
 *   const sendMutation = useSendFungibles({
 *     onSuccess: (data) => {
 *       console.log(`Sent to ${data.successful_transfers} recipients`);
 *       if (data.failed_transfers?.length) {
 *         console.log('Some transfers failed:', data.failed_transfers);
 *       }
 *     },
 *     onError: (error) => {
 *       console.error('Transfer failed:', error);
 *     }
 *   });
 *
 *   const handleSend = () => {
 *     sendMutation.mutate({
 *       signer_uuid: signerUuid,
 *       contract_address: contractAddress,
 *       recipients: recipients.filter(r => r.fid > 0 && r.amount)
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       {recipients.map((recipient, index) => (
 *         <div key={index}>
 *           <input
 *             type="number"
 *             value={recipient.fid}
 *             onChange={(e) => {
 *               const newRecipients = [...recipients];
 *               newRecipients[index].fid = parseInt(e.target.value);
 *               setRecipients(newRecipients);
 *             }}
 *             placeholder="Recipient FID"
 *           />
 *           <input
 *             value={recipient.amount}
 *             onChange={(e) => {
 *               const newRecipients = [...recipients];
 *               newRecipients[index].amount = e.target.value;
 *               setRecipients(newRecipients);
 *             }}
 *             placeholder="Amount"
 *           />
 *         </div>
 *       ))}
 *       <button onClick={handleSend} disabled={sendMutation.isPending}>
 *         {sendMutation.isPending ? 'Sending...' : 'Send Tokens'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useRelevantFungibleOwners} for finding relevant recipients
 * @see {@link useDeployFungible} for deploying new tokens
 */
export function useSendFungibles(options?: BaseMutationOptions) {
  const queryClient = useApiQueryClient();

  return useApiMutation<SendFungiblesResponse, SendFungiblesRequest>(
    "/api/neynar/onchain/send-fungibles",
    "POST",
    {
      onSuccess: () => {
        // Invalidate relevant fungible queries and user balance
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.onchain.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.all(),
        });
      },
      ...options,
    },
  );
}

/**
 * @deprecated Use {@link useNftMint} instead, which works with `createNftMintHandler` and handles
 * image generation, metadata upload, and payment verification automatically.
 *
 * Mint NFT mutation hook
 *
 * Provides a mutation function to mint NFTs to a specified recipient.
 * Supports minting to users by FID or wallet address with custom metadata.
 * Returns a TanStack Query mutation with loading states and minting results.
 *
 * @param options - Additional mutation options for error handling and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *   - `mutate: (params: MintNftRequest) => void`
 *
 * @example NFT minting with attributes
 * ```tsx
 * function MintNFTForm({
 *   signerUuid,
 *   contractAddress
 * }: {
 *   signerUuid: string;
 *   contractAddress: string
 * }) {
 *   const [nftData, setNftData] = useState({
 *     recipient_fid: 0,
 *     name: '',
 *     description: '',
 *     image: '',
 *     quantity: 1
 *   });
 *
 *   const mintMutation = useMintNft({
 *     onSuccess: (data) => {
 *       console.log('NFT minted!', data.token_ids);
 *       console.log('Transaction:', data.transaction_hash);
 *     },
 *     onError: (error) => {
 *       console.error('Minting failed:', error);
 *     }
 *   });
 *
 *   const handleMint = () => {
 *     mintMutation.mutate({
 *       signer_uuid: signerUuid,
 *       contract_address: contractAddress,
 *       recipient_fid: nftData.recipient_fid,
 *       metadata: {
 *         name: nftData.name,
 *         description: nftData.description,
 *         image: nftData.image,
 *         attributes: [
 *           { trait_type: "Rarity", value: "Common" },
 *           { trait_type: "Power", value: 100 }
 *         ]
 *       },
 *       quantity: nftData.quantity
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={(e) => { e.preventDefault(); handleMint(); }}>
 *       <input
 *         type="number"
 *         value={nftData.recipient_fid}
 *         onChange={(e) => setNftData({...nftData, recipient_fid: parseInt(e.target.value)})}
 *         placeholder="Recipient FID"
 *       />
 *       <input
 *         value={nftData.name}
 *         onChange={(e) => setNftData({...nftData, name: e.target.value})}
 *         placeholder="NFT Name"
 *       />
 *       <input
 *         value={nftData.image}
 *         onChange={(e) => setNftData({...nftData, image: e.target.value})}
 *         placeholder="Image URL"
 *       />
 *       <button type="submit" disabled={mintMutation.isPending}>
 *         {mintMutation.isPending ? 'Minting...' : 'Mint NFT'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @see {@link useSimulateNftMint} for simulating mints before execution to estimate costs
 */
export function useMintNft(options?: BaseMutationOptions) {
  const queryClient = useApiQueryClient();

  return useApiMutation<MintNftResponse, MintNftRequest>(
    "/api/neynar/onchain/mint-nft",
    "POST",
    {
      onSuccess: () => {
        // Invalidate user balance queries and onchain data
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.onchain.all(),
        });
      },
      ...options,
    },
  );
}

/**
 * @deprecated Use {@link useNftPrice} instead, which works with `createNftPriceHandler` and
 * provides accurate cost estimation including Neynar fees and gas.
 *
 * Simulate NFT mint mutation hook
 *
 * Provides a mutation function to simulate NFT minting without actually executing
 * the transaction. This is useful for estimating gas costs, validating parameters,
 * and ensuring the mint will succeed before committing to the transaction.
 *
 * @param options - Additional mutation options for error handling and callbacks
 * @returns TanStack Query mutation result with mutate function and simulation results
 *   - `mutate: (params: SimulateNftMintRequest) => void`
 *
 * @example Mint simulation with cost preview
 * ```tsx
 * function NFTMintSimulator({ contractAddress }: { contractAddress: string }) {
 *   const [simulationData, setSimulationData] = useState({
 *     recipient_address: '',
 *     name: '',
 *     image: '',
 *     quantity: 1
 *   });
 *
 *   const simulateMutation = useSimulateNftMint({
 *     onSuccess: (data) => {
 *       console.log('Simulation successful!');
 *       console.log('Estimated gas:', data.estimated_gas);
 *       console.log('Total cost:', data.total_cost);
 *     },
 *     onError: (error) => {
 *       console.error('Simulation failed:', error);
 *     }
 *   });
 *
 *   const handleSimulate = () => {
 *     simulateMutation.mutate({
 *       contract_address: contractAddress,
 *       recipient_address: simulationData.recipient_address,
 *       metadata: {
 *         name: simulationData.name,
 *         image: simulationData.image
 *       },
 *       quantity: simulationData.quantity
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <h3>Simulate NFT Mint</h3>
 *       <input
 *         value={simulationData.recipient_address}
 *         onChange={(e) => setSimulationData({...simulationData, recipient_address: e.target.value})}
 *         placeholder="Recipient Address"
 *       />
 *       <button onClick={handleSimulate} disabled={simulateMutation.isPending}>
 *         {simulateMutation.isPending ? 'Simulating...' : 'Simulate Mint'}
 *       </button>
 *
 *       {simulateMutation.data && (
 *         <div>
 *           <h4>Simulation Results</h4>
 *           <p>Estimated Gas: {simulateMutation.data.estimated_gas}</p>
 *           <p>Gas Price: {simulateMutation.data.gas_price}</p>
 *           <p>Total Cost: {simulateMutation.data.total_cost}</p>
 *           {simulateMutation.data.errors?.map((error, index) => (
 *             <p key={index} style={{color: 'red'}}>Error: {error}</p>
 *           ))}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useMintNft} for executing the actual mint after simulation
 */
export function useSimulateNftMint(options?: BaseMutationOptions) {
  return useApiMutation<SimulateNftMintResponse, SimulateNftMintRequest>(
    "/api/neynar/onchain/simulate-mint-nft",
    "POST",
    options,
  );
}

// ============================================================================
// NFT Handler Hook Types (for use with createNftMintHandler / createNftPreviewHandler)
// ============================================================================

/**
 * Request body for the NFT mint route handler.
 * The client sends fid in the body; auth is handled at a higher level
 * (middleware, quickAuth.fetch, etc.).
 */
export type NftMintRequest = {
  fid: number;
  collectionSlug: string;
  /** Number of tokens to mint (default: 1). Preview-first pattern only supports 1. */
  quantity?: number;
  /** Transaction hash of the ETH payment to the server wallet (required for paid collections). */
  paymentTxHash?: string;
};

/** Per-token result within an NFT mint response. */
export type NftMintTokenResult = {
  token_id: string;
  image_url: string | null;
  metadata_uri: string | null;
  /** Present when image generation or metadata upload failed for this token */
  error?: string;
};

/**
 * Response from the NFT mint route handler.
 */
export type NftMintResponse = {
  transaction_hash: string;
  tokens: NftMintTokenResult[];
};

/**
 * Request body for the NFT preview route handler.
 */
export type NftPreviewRequest = {
  fid: number;
  collectionSlug: string;
};

/**
 * Response from the NFT preview route handler.
 */
export type NftPreviewResponse = {
  image_url: string;
};

// ============================================================================
// NFT Handler Hooks (for use with createNftMintHandler / createNftPreviewHandler)
// ============================================================================

/**
 * Calls the NFT mint route handler (`POST /api/nft/mint`).
 *
 * Designed to work with `createNftMintHandler` from `@/neynar-web-sdk/nextjs`.
 * Invalidates onchain and user queries on success.
 *
 * @example
 * ```tsx
 * function MintButton({ fid }: { fid: number }) {
 *   const mint = useNftMint({
 *     onSuccess: (data) => console.log("Minted!", data.tokens.map((t) => t.token_id)),
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => mint.mutate({ fid, collectionSlug: "my-collection" })}
 *       disabled={mint.isPending}
 *     >
 *       {mint.isPending ? "Minting..." : "Mint NFT"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useNftMint(options?: BaseMutationOptions) {
  const queryClient = useApiQueryClient();

  return useApiMutation<NftMintResponse, NftMintRequest>(
    "/api/nft/mint",
    "POST",
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.onchain.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.all(),
        });
      },
      ...options,
    },
  );
}

/**
 * Calls the NFT preview route handler (`POST /api/nft/preview`).
 *
 * Designed to work with `createNftPreviewHandler` from `@/neynar-web-sdk/nextjs`.
 *
 * @example
 * ```tsx
 * function PreviewButton({ fid }: { fid: number }) {
 *   const preview = useNftPreview({
 *     onSuccess: (data) => console.log("Preview:", data.image_url),
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => preview.mutate({ fid, collectionSlug: "my-collection" })}
 *       disabled={preview.isPending}
 *     >
 *       {preview.isPending ? "Generating..." : "Generate Preview"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useNftPreview(options?: BaseMutationOptions) {
  return useApiMutation<NftPreviewResponse, NftPreviewRequest>(
    "/api/nft/preview",
    "POST",
    options,
  );
}

// ============================================================================
// NFT Price Hook (for use with createNftPriceHandler)
// ============================================================================

/**
 * Request parameters for the NFT price endpoint.
 */
export type NftPriceRequest = {
  collectionSlug: string;
  quantity?: number;
  fid: number;
};

/**
 * Response from the NFT price endpoint.
 */
export type NftPriceResponse = {
  cost_eth: number;
};

/**
 * Fetches the mint price for a collection via `GET /api/nft/price`.
 *
 * Designed to work with `createNftPriceHandler` from `@/neynar-web-sdk/nextjs`.
 * Returns the total cost in ETH including Neynar fees and estimated gas.
 * Free collections return `{ cost_eth: 0 }`.
 *
 * @example
 * ```tsx
 * function MintCost({ fid, collectionSlug }: { fid: number; collectionSlug: string }) {
 *   const { data: price } = useNftPrice({ fid, collectionSlug, quantity: 1 });
 *
 *   if (!price) return null;
 *   return <p>Cost: {price.cost_eth.toFixed(4)} ETH</p>;
 * }
 * ```
 */
export function useNftPrice(
  params: NftPriceRequest,
  options?: QueryHookOptions<NftPriceResponse>,
): QueryHookResult<NftPriceResponse> {
  const queryParams = buildNeynarQuery({
    collectionSlug: params.collectionSlug,
    quantity: params.quantity ?? 1,
    fid: params.fid,
  });

  return useApiQuery<NftPriceResponse>(
    neynarQueryKeys.onchain.nftPrice({
      collectionSlug: params.collectionSlug,
      quantity: params.quantity ?? 1,
      fid: params.fid,
    }),
    `/api/nft/price?${queryParams}`,
    {
      enabled: Boolean(params.fid && params.collectionSlug),
      staleTime: STALE_TIME.REALTIME,
      ...options,
    },
  );
}
