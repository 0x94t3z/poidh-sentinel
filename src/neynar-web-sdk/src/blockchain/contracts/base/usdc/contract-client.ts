import type { PublicClient, WalletClient, Address, Hex } from "viem";
import { base } from "viem/chains";
import { CONTRACT_ABI } from "./abi";

const CONTRACT_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

const contractConfig = {
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
} as const;

export class UsdcContract {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;

  constructor(publicClient: PublicClient, walletClient?: WalletClient) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  getAddress(): Address {
    return CONTRACT_ADDRESS;
  }

  setWalletClient(walletClient: WalletClient): void {
    this.walletClient = walletClient;
  }

  // Read Methods (view/pure)

  async cancelAuthorizationTypehash(): Promise<Hex> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "CANCEL_AUTHORIZATION_TYPEHASH",
    });
    return result as Hex;
  }

  async domainSeparator(): Promise<Hex> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "DOMAIN_SEPARATOR",
    });
    return result as Hex;
  }

  async permitTypehash(): Promise<Hex> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "PERMIT_TYPEHASH",
    });
    return result as Hex;
  }

  async receiveWithAuthorizationTypehash(): Promise<Hex> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "RECEIVE_WITH_AUTHORIZATION_TYPEHASH",
    });
    return result as Hex;
  }

  async transferWithAuthorizationTypehash(): Promise<Hex> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "TRANSFER_WITH_AUTHORIZATION_TYPEHASH",
    });
    return result as Hex;
  }

  async allowance(owner: Address, spender: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "allowance",
      args: [owner, spender],
    });
    return result as bigint;
  }

  async authorizationstate(authorizer: Address, nonce: Hex): Promise<boolean> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "authorizationState",
      args: [authorizer, nonce],
    });
    return result as boolean;
  }

  async balanceof(account: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "balanceOf",
      args: [account],
    });
    return result as bigint;
  }

  async blacklister(): Promise<Address> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "blacklister",
    });
    return result as Address;
  }

  async currency(): Promise<string> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "currency",
    });
    return result as string;
  }

  async decimals(): Promise<number> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "decimals",
    });
    return result as number;
  }

  async isblacklisted(_account: Address): Promise<boolean> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "isBlacklisted",
      args: [_account],
    });
    return result as boolean;
  }

  async isminter(account: Address): Promise<boolean> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "isMinter",
      args: [account],
    });
    return result as boolean;
  }

  async masterminter(): Promise<Address> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "masterMinter",
    });
    return result as Address;
  }

  async minterallowance(minter: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "minterAllowance",
      args: [minter],
    });
    return result as bigint;
  }

  async name(): Promise<string> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "name",
    });
    return result as string;
  }

  async nonces(owner: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "nonces",
      args: [owner],
    });
    return result as bigint;
  }

  async owner(): Promise<Address> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "owner",
    });
    return result as Address;
  }

  async paused(): Promise<boolean> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "paused",
    });
    return result as boolean;
  }

  async pauser(): Promise<Address> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "pauser",
    });
    return result as Address;
  }

  async rescuer(): Promise<Address> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "rescuer",
    });
    return result as Address;
  }

  async symbol(): Promise<string> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "symbol",
    });
    return result as string;
  }

  async totalsupply(): Promise<bigint> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "totalSupply",
    });
    return result as bigint;
  }

  async version(): Promise<string> {
    const result = await this.publicClient.readContract({
      ...contractConfig,
      functionName: "version",
    });
    return result as string;
  }

  // Write Methods (state-changing)

  async approve(spender: Address, value: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "approve",
      args: [spender, value],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async approveWithoutSimulation(
    spender: Address,
    value: bigint,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "approve",
      args: [spender, value],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async blacklist(_account: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "blacklist",
      args: [_account],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async blacklistWithoutSimulation(_account: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "blacklist",
      args: [_account],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async burn(_amount: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "burn",
      args: [_amount],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async burnWithoutSimulation(_amount: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "burn",
      args: [_amount],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async cancelauthorizations(
    authorizer: Address,
    nonce: Hex,
    v: number,
    r: Hex,
    s: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "cancelAuthorization",
      args: [authorizer, nonce, v, r, s],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async cancelauthorizationsWithoutSimulation(
    authorizer: Address,
    nonce: Hex,
    v: number,
    r: Hex,
    s: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "cancelAuthorization",
      args: [authorizer, nonce, v, r, s],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async cancelauthorizationsignature(
    authorizer: Address,
    nonce: Hex,
    signature: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "cancelAuthorization",
      args: [authorizer, nonce, signature],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async cancelauthorizationsignatureWithoutSimulation(
    authorizer: Address,
    nonce: Hex,
    signature: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "cancelAuthorization",
      args: [authorizer, nonce, signature],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async configureminter(
    minter: Address,
    minterAllowedAmount: bigint,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "configureMinter",
      args: [minter, minterAllowedAmount],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async configureminterWithoutSimulation(
    minter: Address,
    minterAllowedAmount: bigint,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "configureMinter",
      args: [minter, minterAllowedAmount],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async decreaseallowance(spender: Address, decrement: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "decreaseAllowance",
      args: [spender, decrement],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async decreaseallowanceWithoutSimulation(
    spender: Address,
    decrement: bigint,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "decreaseAllowance",
      args: [spender, decrement],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async increaseallowance(spender: Address, increment: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "increaseAllowance",
      args: [spender, increment],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async increaseallowanceWithoutSimulation(
    spender: Address,
    increment: bigint,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "increaseAllowance",
      args: [spender, increment],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async initialize(
    tokenName: string,
    tokenSymbol: string,
    tokenCurrency: string,
    tokenDecimals: number,
    newMasterMinter: Address,
    newPauser: Address,
    newBlacklister: Address,
    newOwner: Address,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
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
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async initializeWithoutSimulation(
    tokenName: string,
    tokenSymbol: string,
    tokenCurrency: string,
    tokenDecimals: number,
    newMasterMinter: Address,
    newPauser: Address,
    newBlacklister: Address,
    newOwner: Address,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
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
      account: this.walletClient.account,
      chain: base,
    });
  }

  async initializev2(newName: string): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "initializeV2",
      args: [newName],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async initializev2WithoutSimulation(newName: string): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "initializeV2",
      args: [newName],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async initializev21(lostAndFound: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "initializeV2_1",
      args: [lostAndFound],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async initializev21WithoutSimulation(lostAndFound: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "initializeV2_1",
      args: [lostAndFound],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async initializev22(
    accountsToBlacklist: readonly Address[],
    newSymbol: string,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "initializeV2_2",
      args: [accountsToBlacklist, newSymbol],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async initializev22WithoutSimulation(
    accountsToBlacklist: readonly Address[],
    newSymbol: string,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "initializeV2_2",
      args: [accountsToBlacklist, newSymbol],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async mint(_to: Address, _amount: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "mint",
      args: [_to, _amount],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async mintWithoutSimulation(_to: Address, _amount: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "mint",
      args: [_to, _amount],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async pause(): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "pause",
      args: undefined,
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async pauseWithoutSimulation(): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "pause",
      args: undefined,
      account: this.walletClient.account,
      chain: base,
    });
  }

  async permitsignature(
    owner: Address,
    spender: Address,
    value: bigint,
    deadline: bigint,
    signature: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "permit",
      args: [owner, spender, value, deadline, signature],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async permitsignatureWithoutSimulation(
    owner: Address,
    spender: Address,
    value: bigint,
    deadline: bigint,
    signature: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "permit",
      args: [owner, spender, value, deadline, signature],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async permits(
    owner: Address,
    spender: Address,
    value: bigint,
    deadline: bigint,
    v: number,
    r: Hex,
    s: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "permit",
      args: [owner, spender, value, deadline, v, r, s],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async permitsWithoutSimulation(
    owner: Address,
    spender: Address,
    value: bigint,
    deadline: bigint,
    v: number,
    r: Hex,
    s: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "permit",
      args: [owner, spender, value, deadline, v, r, s],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async receivewithauthorizationsignature(
    from: Address,
    to: Address,
    value: bigint,
    validAfter: bigint,
    validBefore: bigint,
    nonce: Hex,
    signature: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "receiveWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, signature],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async receivewithauthorizationsignatureWithoutSimulation(
    from: Address,
    to: Address,
    value: bigint,
    validAfter: bigint,
    validBefore: bigint,
    nonce: Hex,
    signature: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "receiveWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, signature],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async receivewithauthorizations(
    from: Address,
    to: Address,
    value: bigint,
    validAfter: bigint,
    validBefore: bigint,
    nonce: Hex,
    v: number,
    r: Hex,
    s: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "receiveWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async receivewithauthorizationsWithoutSimulation(
    from: Address,
    to: Address,
    value: bigint,
    validAfter: bigint,
    validBefore: bigint,
    nonce: Hex,
    v: number,
    r: Hex,
    s: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "receiveWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async removeminter(minter: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "removeMinter",
      args: [minter],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async removeminterWithoutSimulation(minter: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "removeMinter",
      args: [minter],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async rescueerc20(
    tokenContract: Address,
    to: Address,
    amount: bigint,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "rescueERC20",
      args: [tokenContract, to, amount],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async rescueerc20WithoutSimulation(
    tokenContract: Address,
    to: Address,
    amount: bigint,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "rescueERC20",
      args: [tokenContract, to, amount],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async transfer(to: Address, value: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "transfer",
      args: [to, value],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async transferWithoutSimulation(to: Address, value: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "transfer",
      args: [to, value],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async transferfrom(from: Address, to: Address, value: bigint): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "transferFrom",
      args: [from, to, value],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async transferfromWithoutSimulation(
    from: Address,
    to: Address,
    value: bigint,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "transferFrom",
      args: [from, to, value],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async transferownership(newOwner: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "transferOwnership",
      args: [newOwner],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async transferownershipWithoutSimulation(newOwner: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "transferOwnership",
      args: [newOwner],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async transferwithauthorizationsignature(
    from: Address,
    to: Address,
    value: bigint,
    validAfter: bigint,
    validBefore: bigint,
    nonce: Hex,
    signature: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "transferWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, signature],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async transferwithauthorizationsignatureWithoutSimulation(
    from: Address,
    to: Address,
    value: bigint,
    validAfter: bigint,
    validBefore: bigint,
    nonce: Hex,
    signature: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "transferWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, signature],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async transferwithauthorizations(
    from: Address,
    to: Address,
    value: bigint,
    validAfter: bigint,
    validBefore: bigint,
    nonce: Hex,
    v: number,
    r: Hex,
    s: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "transferWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async transferwithauthorizationsWithoutSimulation(
    from: Address,
    to: Address,
    value: bigint,
    validAfter: bigint,
    validBefore: bigint,
    nonce: Hex,
    v: number,
    r: Hex,
    s: Hex,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "transferWithAuthorization",
      args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async unblacklist(_account: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "unBlacklist",
      args: [_account],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async unblacklistWithoutSimulation(_account: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "unBlacklist",
      args: [_account],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async unpause(): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "unpause",
      args: undefined,
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async unpauseWithoutSimulation(): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "unpause",
      args: undefined,
      account: this.walletClient.account,
      chain: base,
    });
  }

  async updateblacklister(_newBlacklister: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "updateBlacklister",
      args: [_newBlacklister],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async updateblacklisterWithoutSimulation(
    _newBlacklister: Address,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "updateBlacklister",
      args: [_newBlacklister],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async updatemasterminter(_newMasterMinter: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "updateMasterMinter",
      args: [_newMasterMinter],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async updatemasterminterWithoutSimulation(
    _newMasterMinter: Address,
  ): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "updateMasterMinter",
      args: [_newMasterMinter],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async updatepauser(_newPauser: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "updatePauser",
      args: [_newPauser],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async updatepauserWithoutSimulation(_newPauser: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "updatePauser",
      args: [_newPauser],
      account: this.walletClient.account,
      chain: base,
    });
  }

  async updaterescuer(newRescuer: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    const { request } = await this.publicClient.simulateContract({
      ...contractConfig,
      functionName: "updateRescuer",
      args: [newRescuer],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async updaterescuerWithoutSimulation(newRescuer: Address): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.walletClient.account) {
      throw new Error("Wallet client account required for write operations");
    }

    return await this.walletClient.writeContract({
      ...contractConfig,
      functionName: "updateRescuer",
      args: [newRescuer],
      account: this.walletClient.account,
      chain: base,
    });
  }
}
