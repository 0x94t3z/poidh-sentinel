import { useReadContract, useWriteContract } from "wagmi";
import type { Address, Hex } from "viem";
import { CONTRACT_ABI } from "./abi";

const CONTRACT_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

const contractConfig = {
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
} as const;

// Read Functions (view/pure)

export function useUsdcCANCEL_AUTHORIZATION_TYPEHASH(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "CANCEL_AUTHORIZATION_TYPEHASH",
    query: options,
  });
}

export function useUsdcDOMAIN_SEPARATOR(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "DOMAIN_SEPARATOR",
    query: options,
  });
}

export function useUsdcPERMIT_TYPEHASH(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "PERMIT_TYPEHASH",
    query: options,
  });
}

export function useUsdcRECEIVE_WITH_AUTHORIZATION_TYPEHASH(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "RECEIVE_WITH_AUTHORIZATION_TYPEHASH",
    query: options,
  });
}

export function useUsdcTRANSFER_WITH_AUTHORIZATION_TYPEHASH(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "TRANSFER_WITH_AUTHORIZATION_TYPEHASH",
    query: options,
  });
}

export function useUsdcAllowance(
  owner: Address,
  spender: Address,
  options?: {
    enabled?: boolean;
    watch?: boolean;
  },
) {
  return useReadContract({
    ...contractConfig,
    functionName: "allowance",
    args: [owner, spender],
    query: options,
  });
}

export function useUsdcAuthorizationState(
  authorizer: Address,
  nonce: Hex,
  options?: {
    enabled?: boolean;
    watch?: boolean;
  },
) {
  return useReadContract({
    ...contractConfig,
    functionName: "authorizationState",
    args: [authorizer, nonce],
    query: options,
  });
}

export function useUsdcBalanceOf(
  account: Address,
  options?: {
    enabled?: boolean;
    watch?: boolean;
  },
) {
  return useReadContract({
    ...contractConfig,
    functionName: "balanceOf",
    args: [account],
    query: options,
  });
}

export function useUsdcBlacklister(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "blacklister",
    query: options,
  });
}

export function useUsdcCurrency(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "currency",
    query: options,
  });
}

export function useUsdcDecimals(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "decimals",
    query: options,
  });
}

export function useUsdcIsBlacklisted(
  _account: Address,
  options?: {
    enabled?: boolean;
    watch?: boolean;
  },
) {
  return useReadContract({
    ...contractConfig,
    functionName: "isBlacklisted",
    args: [_account],
    query: options,
  });
}

export function useUsdcIsMinter(
  account: Address,
  options?: {
    enabled?: boolean;
    watch?: boolean;
  },
) {
  return useReadContract({
    ...contractConfig,
    functionName: "isMinter",
    args: [account],
    query: options,
  });
}

export function useUsdcMasterMinter(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "masterMinter",
    query: options,
  });
}

export function useUsdcMinterAllowance(
  minter: Address,
  options?: {
    enabled?: boolean;
    watch?: boolean;
  },
) {
  return useReadContract({
    ...contractConfig,
    functionName: "minterAllowance",
    args: [minter],
    query: options,
  });
}

export function useUsdcName(options?: { enabled?: boolean; watch?: boolean }) {
  return useReadContract({
    ...contractConfig,
    functionName: "name",
    query: options,
  });
}

export function useUsdcNonces(
  owner: Address,
  options?: {
    enabled?: boolean;
    watch?: boolean;
  },
) {
  return useReadContract({
    ...contractConfig,
    functionName: "nonces",
    args: [owner],
    query: options,
  });
}

export function useUsdcOwner(options?: { enabled?: boolean; watch?: boolean }) {
  return useReadContract({
    ...contractConfig,
    functionName: "owner",
    query: options,
  });
}

export function useUsdcPaused(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "paused",
    query: options,
  });
}

export function useUsdcPauser(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "pauser",
    query: options,
  });
}

export function useUsdcRescuer(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "rescuer",
    query: options,
  });
}

export function useUsdcSymbol(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "symbol",
    query: options,
  });
}

export function useUsdcTotalSupply(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "totalSupply",
    query: options,
  });
}

export function useUsdcVersion(options?: {
  enabled?: boolean;
  watch?: boolean;
}) {
  return useReadContract({
    ...contractConfig,
    functionName: "version",
    query: options,
  });
}

// Write Functions (state-changing)

export function useUsdcApprove() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ spender, value }: { spender: Address; value: bigint }) => {
    return writeContract({
      ...contractConfig,
      functionName: "approve",
      args: [spender, value],
    });
  };

  const writeAsync = ({
    spender,
    value,
  }: {
    spender: Address;
    value: bigint;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "approve",
      args: [spender, value],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcBlacklist() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ _account }: { _account: Address }) => {
    return writeContract({
      ...contractConfig,
      functionName: "blacklist",
      args: [_account],
    });
  };

  const writeAsync = ({ _account }: { _account: Address }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "blacklist",
      args: [_account],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcBurn() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ _amount }: { _amount: bigint }) => {
    return writeContract({
      ...contractConfig,
      functionName: "burn",
      args: [_amount],
    });
  };

  const writeAsync = ({ _amount }: { _amount: bigint }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "burn",
      args: [_amount],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcCancelAuthorizationS() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    authorizer,
    nonce,
    v,
    r,
    s,
  }: {
    authorizer: Address;
    nonce: Hex;
    v: number;
    r: Hex;
    s: Hex;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "cancelAuthorization",
      args: [authorizer, nonce, v, r, s],
    });
  };

  const writeAsync = ({
    authorizer,
    nonce,
    v,
    r,
    s,
  }: {
    authorizer: Address;
    nonce: Hex;
    v: number;
    r: Hex;
    s: Hex;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "cancelAuthorization",
      args: [authorizer, nonce, v, r, s],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcCancelAuthorizationSignature() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    authorizer,
    nonce,
    signature,
  }: {
    authorizer: Address;
    nonce: Hex;
    signature: Hex;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "cancelAuthorization",
      args: [authorizer, nonce, signature],
    });
  };

  const writeAsync = ({
    authorizer,
    nonce,
    signature,
  }: {
    authorizer: Address;
    nonce: Hex;
    signature: Hex;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "cancelAuthorization",
      args: [authorizer, nonce, signature],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcConfigureMinter() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    minter,
    minterAllowedAmount,
  }: {
    minter: Address;
    minterAllowedAmount: bigint;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "configureMinter",
      args: [minter, minterAllowedAmount],
    });
  };

  const writeAsync = ({
    minter,
    minterAllowedAmount,
  }: {
    minter: Address;
    minterAllowedAmount: bigint;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "configureMinter",
      args: [minter, minterAllowedAmount],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcDecreaseAllowance() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    spender,
    decrement,
  }: {
    spender: Address;
    decrement: bigint;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "decreaseAllowance",
      args: [spender, decrement],
    });
  };

  const writeAsync = ({
    spender,
    decrement,
  }: {
    spender: Address;
    decrement: bigint;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "decreaseAllowance",
      args: [spender, decrement],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcIncreaseAllowance() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    spender,
    increment,
  }: {
    spender: Address;
    increment: bigint;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "increaseAllowance",
      args: [spender, increment],
    });
  };

  const writeAsync = ({
    spender,
    increment,
  }: {
    spender: Address;
    increment: bigint;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "increaseAllowance",
      args: [spender, increment],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcInitialize() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    tokenName,
    tokenSymbol,
    tokenCurrency,
    tokenDecimals,
    newMasterMinter,
    newPauser,
    newBlacklister,
    newOwner,
  }: {
    tokenName: string;
    tokenSymbol: string;
    tokenCurrency: string;
    tokenDecimals: number;
    newMasterMinter: Address;
    newPauser: Address;
    newBlacklister: Address;
    newOwner: Address;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "initialize",
      args: [
        tokenName,
        tokenSymbol,
        tokenCurrency,
        tokenDecimals,
        newMasterMinter,
        newPauser,
        newBlacklister,
        newOwner,
      ],
    });
  };

  const writeAsync = ({
    tokenName,
    tokenSymbol,
    tokenCurrency,
    tokenDecimals,
    newMasterMinter,
    newPauser,
    newBlacklister,
    newOwner,
  }: {
    tokenName: string;
    tokenSymbol: string;
    tokenCurrency: string;
    tokenDecimals: number;
    newMasterMinter: Address;
    newPauser: Address;
    newBlacklister: Address;
    newOwner: Address;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "initialize",
      args: [
        tokenName,
        tokenSymbol,
        tokenCurrency,
        tokenDecimals,
        newMasterMinter,
        newPauser,
        newBlacklister,
        newOwner,
      ],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcInitializeV2() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ newName }: { newName: string }) => {
    return writeContract({
      ...contractConfig,
      functionName: "initializeV2",
      args: [newName],
    });
  };

  const writeAsync = ({ newName }: { newName: string }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "initializeV2",
      args: [newName],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcInitializeV2_1() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ lostAndFound }: { lostAndFound: Address }) => {
    return writeContract({
      ...contractConfig,
      functionName: "initializeV2_1",
      args: [lostAndFound],
    });
  };

  const writeAsync = ({ lostAndFound }: { lostAndFound: Address }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "initializeV2_1",
      args: [lostAndFound],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcInitializeV2_2() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    accountsToBlacklist,
    newSymbol,
  }: {
    accountsToBlacklist: readonly Address[];
    newSymbol: string;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "initializeV2_2",
      args: [accountsToBlacklist, newSymbol],
    });
  };

  const writeAsync = ({
    accountsToBlacklist,
    newSymbol,
  }: {
    accountsToBlacklist: readonly Address[];
    newSymbol: string;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "initializeV2_2",
      args: [accountsToBlacklist, newSymbol],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcMint() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ _to, _amount }: { _to: Address; _amount: bigint }) => {
    return writeContract({
      ...contractConfig,
      functionName: "mint",
      args: [_to, _amount],
    });
  };

  const writeAsync = ({ _to, _amount }: { _to: Address; _amount: bigint }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "mint",
      args: [_to, _amount],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcPause() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = () => {
    return writeContract({
      ...contractConfig,
      functionName: "pause",
    });
  };

  const writeAsync = () => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "pause",
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcPermitSignature() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    owner,
    spender,
    value,
    deadline,
    signature,
  }: {
    owner: Address;
    spender: Address;
    value: bigint;
    deadline: bigint;
    signature: Hex;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "permit",
      args: [owner, spender, value, deadline, signature],
    });
  };

  const writeAsync = ({
    owner,
    spender,
    value,
    deadline,
    signature,
  }: {
    owner: Address;
    spender: Address;
    value: bigint;
    deadline: bigint;
    signature: Hex;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "permit",
      args: [owner, spender, value, deadline, signature],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcPermitS() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    owner,
    spender,
    value,
    deadline,
    v,
    r,
    s,
  }: {
    owner: Address;
    spender: Address;
    value: bigint;
    deadline: bigint;
    v: number;
    r: Hex;
    s: Hex;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "permit",
      args: [owner, spender, value, deadline, v, r, s],
    });
  };

  const writeAsync = ({
    owner,
    spender,
    value,
    deadline,
    v,
    r,
    s,
  }: {
    owner: Address;
    spender: Address;
    value: bigint;
    deadline: bigint;
    v: number;
    r: Hex;
    s: Hex;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "permit",
      args: [owner, spender, value, deadline, v, r, s],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcReceiveWithAuthorizationSignature() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    signature,
  }: {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    signature: Hex;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "receiveWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, signature],
    });
  };

  const writeAsync = ({
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    signature,
  }: {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    signature: Hex;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "receiveWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, signature],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcReceiveWithAuthorizationS() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    v,
    r,
    s,
  }: {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    v: number;
    r: Hex;
    s: Hex;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "receiveWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
    });
  };

  const writeAsync = ({
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    v,
    r,
    s,
  }: {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    v: number;
    r: Hex;
    s: Hex;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "receiveWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcRemoveMinter() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ minter }: { minter: Address }) => {
    return writeContract({
      ...contractConfig,
      functionName: "removeMinter",
      args: [minter],
    });
  };

  const writeAsync = ({ minter }: { minter: Address }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "removeMinter",
      args: [minter],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcRescueERC20() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    tokenContract,
    to,
    amount,
  }: {
    tokenContract: Address;
    to: Address;
    amount: bigint;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "rescueERC20",
      args: [tokenContract, to, amount],
    });
  };

  const writeAsync = ({
    tokenContract,
    to,
    amount,
  }: {
    tokenContract: Address;
    to: Address;
    amount: bigint;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "rescueERC20",
      args: [tokenContract, to, amount],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcTransfer() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ to, value }: { to: Address; value: bigint }) => {
    return writeContract({
      ...contractConfig,
      functionName: "transfer",
      args: [to, value],
    });
  };

  const writeAsync = ({ to, value }: { to: Address; value: bigint }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "transfer",
      args: [to, value],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcTransferFrom() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    from,
    to,
    value,
  }: {
    from: Address;
    to: Address;
    value: bigint;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "transferFrom",
      args: [from, to, value],
    });
  };

  const writeAsync = ({
    from,
    to,
    value,
  }: {
    from: Address;
    to: Address;
    value: bigint;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "transferFrom",
      args: [from, to, value],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcTransferOwnership() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ newOwner }: { newOwner: Address }) => {
    return writeContract({
      ...contractConfig,
      functionName: "transferOwnership",
      args: [newOwner],
    });
  };

  const writeAsync = ({ newOwner }: { newOwner: Address }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "transferOwnership",
      args: [newOwner],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcTransferWithAuthorizationSignature() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    signature,
  }: {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    signature: Hex;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "transferWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, signature],
    });
  };

  const writeAsync = ({
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    signature,
  }: {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    signature: Hex;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "transferWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, signature],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcTransferWithAuthorizationS() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    v,
    r,
    s,
  }: {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    v: number;
    r: Hex;
    s: Hex;
  }) => {
    return writeContract({
      ...contractConfig,
      functionName: "transferWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
    });
  };

  const writeAsync = ({
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    v,
    r,
    s,
  }: {
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    v: number;
    r: Hex;
    s: Hex;
  }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "transferWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcUnBlacklist() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ _account }: { _account: Address }) => {
    return writeContract({
      ...contractConfig,
      functionName: "unBlacklist",
      args: [_account],
    });
  };

  const writeAsync = ({ _account }: { _account: Address }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "unBlacklist",
      args: [_account],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcUnpause() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = () => {
    return writeContract({
      ...contractConfig,
      functionName: "unpause",
    });
  };

  const writeAsync = () => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "unpause",
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcUpdateBlacklister() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ _newBlacklister }: { _newBlacklister: Address }) => {
    return writeContract({
      ...contractConfig,
      functionName: "updateBlacklister",
      args: [_newBlacklister],
    });
  };

  const writeAsync = ({ _newBlacklister }: { _newBlacklister: Address }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "updateBlacklister",
      args: [_newBlacklister],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcUpdateMasterMinter() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ _newMasterMinter }: { _newMasterMinter: Address }) => {
    return writeContract({
      ...contractConfig,
      functionName: "updateMasterMinter",
      args: [_newMasterMinter],
    });
  };

  const writeAsync = ({ _newMasterMinter }: { _newMasterMinter: Address }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "updateMasterMinter",
      args: [_newMasterMinter],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcUpdatePauser() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ _newPauser }: { _newPauser: Address }) => {
    return writeContract({
      ...contractConfig,
      functionName: "updatePauser",
      args: [_newPauser],
    });
  };

  const writeAsync = ({ _newPauser }: { _newPauser: Address }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "updatePauser",
      args: [_newPauser],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}

export function useUsdcUpdateRescuer() {
  const { writeContract, writeContractAsync, ...rest } = useWriteContract();

  const write = ({ newRescuer }: { newRescuer: Address }) => {
    return writeContract({
      ...contractConfig,
      functionName: "updateRescuer",
      args: [newRescuer],
    });
  };

  const writeAsync = ({ newRescuer }: { newRescuer: Address }) => {
    return writeContractAsync({
      ...contractConfig,
      functionName: "updateRescuer",
      args: [newRescuer],
    });
  };

  return {
    ...rest,
    write,
    writeAsync,
  };
}
