/**
 * Neynar Signers API hooks
 *
 * Comprehensive set of hooks for managing Farcaster signers, signed keys, and developer-managed signers.
 * These hooks handle user authentication, key management, and signer registration workflows.
 *
 * @module SignersHooks
 * @author Neynar
 * @since 1.0.0
 */

import {
  useApiQuery,
  useApiMutation,
  useApiQueryClient,
  STALE_TIME,
  type ExtendedMutationOptions,
  type ExtendedQueryOptions,
  type QueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type { Signer } from "../sdk-response-types";

/**
 * Parameters for {@link useSigners}
 */
type UseSignersParams = {
  /**
   * A Sign-In with Ethereum (SIWE) message that the user's Ethereum wallet signs.
   *
   * This message includes details such as the domain, address, statement, URI, nonce,
   * and other relevant information following the EIP-4361 standard. It should be
   * structured and URL-encoded.
   */
  message: string;

  /**
   * The digital signature produced by signing the provided SIWE message with the
   * user's Ethereum private key.
   *
   * This signature is used to verify the authenticity of the message and the identity
   * of the signer.
   */
  signature: string;
};

/**
 * Fetches a list of signers for a custody address
 *
 * **Special Behaviors:**
 * - Requires SIWE authentication (both message and signature are mandatory)
 * - Not paginated (returns all signers in single response)
 * - SIWE message must follow EIP-4361 standard
 *
 * @param params - SIWE authentication parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with signer array
 *
 * @example Fetch signers with SIWE authentication
 * ```tsx
 * function SignersList({ siweMessage, signature }: {
 *   siweMessage: string;
 *   signature: string;
 * }) {
 *   const { data: signers, isLoading } = useSigners({
 *     message: siweMessage,
 *     signature
 *   });
 *
 *   if (isLoading) return <div>Loading signers...</div>;
 *
 *   return (
 *     <div>
 *       <h2>Your Signers</h2>
 *       {signers?.map(signer => (
 *         <div key={signer.signer_uuid}>
 *           <span>{signer.public_key.slice(0, 10)}...</span>
 *           <span>Status: {signer.status}</span>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useSignerLookup} for fetching a single signer by UUID
 * @see {@link useDeveloperManagedSignerLookup} for fetching developer-managed signer by public key
 */
export function useSigners(
  params: UseSignersParams,
  options?: ExtendedQueryOptions<{ signers: Signer[] }, Signer[]>,
): QueryHookResult<Signer[]> {
  const queryParams = buildNeynarQuery(params);

  return useApiQuery<{ signers: Signer[] }, Signer[]>(
    neynarQueryKeys.signers.list(params),
    `/api/neynar/signers?${queryParams}`,
    {
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (response) => response.signers || [],
    },
  );
}

/**
 * Parameters for {@link useSignerLookup}
 */
type UseSignerLookupParams = {
  /**
   * UUID of the signer (paired with API key)
   */
  signer_uuid: string;
};

/**
 * Gets information status of a signer by passing in a signer_uuid
 *
 * Fetches detailed status information for a specific signer by its UUID. The signer UUID
 * is paired with your API key and cannot be used with a different API key.
 *
 * **Special Behaviors:**
 * - Query automatically enabled only when signer_uuid is provided
 * - signer_uuid is paired with API key, can't use a uuid made with a different API key
 *
 * @param params - Lookup parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with signer data
 *
 * @example
 * ```tsx
 * function SignerStatus({ signerUuid }: { signerUuid: string }) {
 *   const { data: signer, isLoading } = useSignerLookup({
 *     signer_uuid: signerUuid
 *   });
 *
 *   if (isLoading) return <div>Loading signer...</div>;
 *   if (!signer) return <div>Signer not found</div>;
 *
 *   return (
 *     <div>
 *       <h3>Signer Status</h3>
 *       <p>UUID: {signer.signer_uuid}</p>
 *       <p>Status: {signer.status}</p>
 *       <p>FID: {signer.fid}</p>
 *       {signer.status === 'pending_approval' && signer.signer_approval_url && (
 *         <a href={signer.signer_approval_url}>Approve Signer</a>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useSigners} for fetching all signers for a custody address
 * @see {@link useDeveloperManagedSignerLookup} for developer-managed signer lookup by public key
 */
export function useSignerLookup(
  params: UseSignerLookupParams,
  options?: ExtendedQueryOptions<Signer>,
) {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<Signer>(
    neynarQueryKeys.signers.lookup(params),
    `/api/neynar/signers/lookup?${queryParams}`,
    {
      enabled: Boolean(params?.signer_uuid),
      staleTime: STALE_TIME.NORMAL,
      ...options,
    },
  );
}

/**
 * Parameters for {@link useDeveloperManagedSignerLookup}
 */
type UseDeveloperManagedSignerLookupParams = {
  /**
   * Ed25519 public key
   */
  public_key: string;
};

/**
 * Fetches the status of a developer managed signer by public key
 *
 * Retrieves status information for a developer-managed signer using its Ed25519 public key.
 * Developer-managed signers give you more control over key management compared to standard signers.
 *
 * **Special Behaviors:**
 * - Query automatically enabled only when public_key is provided
 *
 * @param params - Lookup parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with developer-managed signer data
 *
 * @example
 * ```tsx
 * function DeveloperSignerStatus({ publicKey }: { publicKey: string }) {
 *   const { data: signer, isLoading } = useDeveloperManagedSignerLookup({
 *     public_key: publicKey
 *   });
 *
 *   if (isLoading) return <div>Loading developer signer...</div>;
 *   if (!signer) return <div>Signer not found</div>;
 *
 *   return (
 *     <div>
 *       <h3>Developer-Managed Signer</h3>
 *       <p>UUID: {signer.signer_uuid}</p>
 *       <p>Public Key: {signer.public_key}</p>
 *       <p>Status: {signer.status}</p>
 *       <p>FID: {signer.fid}</p>
 *       {signer.status === 'pending_approval' && (
 *         <span>Awaiting approval...</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useSignerLookup} for looking up standard signers by UUID
 * @see {@link useRegisterDeveloperManagedSignedKey} for registering a developer-managed signer
 */
export function useDeveloperManagedSignerLookup(
  params: UseDeveloperManagedSignerLookupParams,
  options?: ExtendedQueryOptions<Signer>,
) {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<Signer>(
    neynarQueryKeys.signers.developerManagedLookup(params),
    `/api/neynar/signers/developer-managed/lookup?${queryParams}`,
    {
      enabled: Boolean(params?.public_key),
      staleTime: STALE_TIME.NORMAL,
      ...options,
    },
  );
}

/**
 * Parameters for {@link useRegisterSignedKey}
 */
type UseRegisterSignedKeyParams = {
  /**
   * UUID of the signer to register
   */
  signer_uuid: string;

  /**
   * Signature for authentication
   */
  signature: string;

  /**
   * App Farcaster ID
   */
  app_fid: number;

  /**
   * Unix timestamp deadline for signature validity
   */
  deadline: number;

  /**
   * Optional redirect URL after approval
   */
  redirect_url?: string;

  /**
   * Optional sponsor FID
   */
  sponsor?: {
    /**
     * Sponsor Farcaster ID
     */
    fid: number;
  };
};

/**
 * Registers an app FID, deadline and a signature
 *
 * Registers a signed key with an app FID and deadline. Returns the signer status with an
 * approval URL that users can visit to approve the signer. This is a critical step in the
 * signer authentication flow.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params) => void` - Trigger key registration
 *   - `isPending: boolean` - True while registration is in progress
 *   - `isError: boolean` - True if registration failed
 *   - `error: ApiError | null` - Error if failed
 *
 * @example
 * ```tsx
 * function RegisterKey({ signerUuid, signature, appFid, deadline }: {
 *   signerUuid: string;
 *   signature: string;
 *   appFid: number;
 *   deadline: number;
 * }) {
 *   const registerKey = useRegisterSignedKey({
 *     onSuccess: (data) => {
 *       console.log('Key registered:', data.signer_uuid);
 *       if (data.signer_approval_url) {
 *         window.location.href = data.signer_approval_url;
 *       }
 *     }
 *   });
 *
 *   const handleRegister = () => {
 *     registerKey.mutate({
 *       signer_uuid: signerUuid,
 *       signature,
 *       app_fid: appFid,
 *       deadline
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleRegister} disabled={registerKey.isPending}>
 *       {registerKey.isPending ? 'Registering...' : 'Register Key'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useSignerLookup} for checking signer status after registration
 * @see {@link useCreateAndRegisterSignedKey} for creating and registering in one step
 */
export function useRegisterSignedKey(
  options?: ExtendedMutationOptions<Signer, UseRegisterSignedKeyParams>,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<Signer, UseRegisterSignedKeyParams>(
    "/api/neynar/signers/register",
    "POST",
    {
      onSuccess: () => {
        // Invalidate signers and lookup queries using hierarchical keys
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.signers.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.signers.lookup(),
        });
      },
      ...options,
    },
  );
}

/**
 * Parameters for {@link useCreateAndRegisterSignedKey}
 */
type UseCreateAndRegisterSignedKeyParams = {
  /**
   * Developer mnemonic for key derivation
   */
  farcasterDeveloperMnemonic: string;

  /**
   * Optional deadline (Unix timestamp)
   */
  deadline?: number;
};

/**
 * Creates a signer and returns the signer status
 *
 * Convenience mutation that creates a new signer and registers it in a single operation.
 * This combines signer creation with key registration, returning the signer status and
 * approval URL.
 *
 * **Special Behaviors:**
 * - While testing please reuse the signer, it costs money to approve a signer
 * - Combines create + register operations into one API call
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params) => void` - Trigger signer creation and registration
 *   - `isPending: boolean` - True while creation is in progress
 *   - `isError: boolean` - True if creation failed
 *   - `error: ApiError | null` - Error if failed
 *
 * @example
 * ```tsx
 * function CreateSigner({ mnemonic }: { mnemonic: string }) {
 *   const createSigner = useCreateAndRegisterSignedKey({
 *     onSuccess: (signer) => {
 *       console.log('Signer created:', signer.signer_uuid);
 *       console.log('Status:', signer.status);
 *       if (signer.signer_approval_url) {
 *         window.location.href = signer.signer_approval_url;
 *       }
 *     }
 *   });
 *
 *   const handleCreate = () => {
 *     createSigner.mutate({
 *       farcasterDeveloperMnemonic: mnemonic,
 *       deadline: Math.floor(Date.now() / 1000) + 86400
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleCreate} disabled={createSigner.isPending}>
 *         {createSigner.isPending ? 'Creating Signer...' : 'Create & Register Signer'}
 *       </button>
 *       {createSigner.data && (
 *         <div>
 *           <p>Signer UUID: {createSigner.data.signer_uuid}</p>
 *           <p>Status: {createSigner.data.status}</p>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useRegisterSignedKey} for registering an existing signer separately
 * @see {@link useSignerLookup} for checking signer status after creation
 */
export function useCreateAndRegisterSignedKey(
  options?: ExtendedMutationOptions<
    Signer,
    UseCreateAndRegisterSignedKeyParams
  >,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<Signer, UseCreateAndRegisterSignedKeyParams>(
    "/api/neynar/signers/create-and-register",
    "POST",
    {
      onSuccess: () => {
        // Invalidate signers and lookup queries using hierarchical keys
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.signers.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.signers.lookup(),
        });
      },
      ...options,
    },
  );
}

/**
 * Parameters for {@link useRegisterDeveloperManagedSignedKey}
 */
type UseRegisterDeveloperManagedSignedKeyParams = {
  /**
   * Ed25519 public key for the signer
   */
  public_key: string;

  /**
   * Signature for authentication
   */
  signature: string;

  /**
   * App Farcaster ID
   */
  app_fid: number;

  /**
   * Unix timestamp deadline for signature validity
   */
  deadline: number;

  /**
   * Optional redirect URL after approval
   */
  redirect_url?: string;

  /**
   * Optional sponsor FID
   */
  sponsor?: {
    /**
     * Sponsor Farcaster ID
     */
    fid: number;
  };
};

/**
 * Registers a signed key and returns the developer managed signer status with an approval url
 *
 * Registers a developer-managed signer by providing a public key, signature, app FID, and deadline.
 * Developer-managed signers give you full control over key management and cryptographic operations.
 * Returns the signer status with an approval URL.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params) => void` - Trigger developer key registration
 *   - `isPending: boolean` - True while registration is in progress
 *   - `isError: boolean` - True if registration failed
 *   - `error: ApiError | null` - Error if failed
 *
 * @example
 * ```tsx
 * function RegisterDevKey({ publicKey, signature, appFid, deadline }: {
 *   publicKey: string;
 *   signature: string;
 *   appFid: number;
 *   deadline: number;
 * }) {
 *   const registerDevKey = useRegisterDeveloperManagedSignedKey({
 *     onSuccess: (data) => {
 *       console.log('Developer key registered:', data.signer_uuid);
 *       console.log('Public key:', data.public_key);
 *       console.log('Status:', data.status);
 *     }
 *   });
 *
 *   const handleRegister = () => {
 *     registerDevKey.mutate({
 *       public_key: publicKey,
 *       signature,
 *       app_fid: appFid,
 *       deadline
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleRegister} disabled={registerDevKey.isPending}>
 *       {registerDevKey.isPending ? 'Registering...' : 'Register Developer Key'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useDeveloperManagedSignerLookup} for checking developer-managed signer status after registration
 * @see {@link useRegisterSignedKey} for registering standard (non-developer-managed) signers
 */
export function useRegisterDeveloperManagedSignedKey(
  options?: ExtendedMutationOptions<
    Signer,
    UseRegisterDeveloperManagedSignedKeyParams
  >,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<Signer, UseRegisterDeveloperManagedSignedKeyParams>(
    "/api/neynar/signers/developer-managed/register",
    "POST",
    {
      onSuccess: () => {
        // Invalidate signers and developer managed lookup queries using hierarchical keys
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.signers.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.signers.developerManagedLookup(),
        });
      },
      ...options,
    },
  );
}
