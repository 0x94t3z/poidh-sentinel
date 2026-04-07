# Neynar Web SDK

TypeScript SDK for Neynar web applications with complete client, server, and shared utilities.

## Overview

The Neynar Web SDK provides everything needed to build web applications with Neynar integration:

- **Client Components** - React components, providers, and hooks for web applications
- **API Handlers** - Next.js route handlers for backend integration
- **API Hooks** - TanStack Query hooks for data fetching
- **Shared Utilities** - Common utilities and types used across the application

## Architecture

```
src/
├── server/          # Next.js API route handlers
│   ├── neynar/      # Neynar API proxy handlers
│   └── coingecko/   # CoinGecko API proxy handlers
├── neynar/          # Neynar SDK
│   └── hooks/       # Neynar API hooks (110+ hooks)
├── coingecko/       # CoinGecko SDK
│   └── hooks/       # CoinGecko API hooks (40+ hooks)
└── shared/          # Common utilities and types
    ├── components/  # UI components (ExperimentalCastCard, etc.)
    ├── types/       # TypeScript type definitions
    └── utilities/   # Utility functions (truncateText, truncateEmail, etc.)
```

## Installation

This SDK is designed to be used as part of the Neynar mini-app template. The dependencies are managed at the template level.

## Quick Start

### 1. Use Neynar Hooks

```tsx
import { useUser, useCast } from "@/neynar-web-sdk/neynar/hooks";

function UserProfile({ fid }: { fid: number }) {
  const { data: user, isLoading } = useUser({ fid });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>{user?.displayName}</h1>
      <p>{user?.profile?.bio?.text}</p>
    </div>
  );
}
```

### 2. Set up API Routes

```tsx
// src/app/api/neynar/[...route]/route.ts
import { createNeynarApiHandler } from "@/neynar-web-sdk/neynar/handlers";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

const config = new Configuration({ apiKey: process.env.NEYNAR_API_KEY });
const client = new NeynarAPIClient(config);

export const { GET, POST, PUT, DELETE } = createNeynarApiHandler(client, {
  cors: { origin: true },
});
```

### 3. Use Shared Utilities

```tsx
import { truncateText, truncateEmail } from "@/neynar-web-sdk";

const shortText = truncateText("Long text here...", 50);
const shortEmail = truncateEmail("verylongemail@example.com", 20);
```

## Import Patterns

```tsx
// Neynar hooks (TanStack Query hooks)
import {
  useUser,
  useCast,
  useFollowingFeed,
} from "@/neynar-web-sdk/neynar/hooks";

// CoinGecko hooks
import { useCoin, useSimplePrice } from "@/neynar-web-sdk/coingecko/hooks";

// API handlers (Next.js route handlers)
import { createNeynarApiHandler } from "@/neynar-web-sdk/neynar/handlers";
import { createCoinGeckoApiHandler } from "@/neynar-web-sdk/coingecko/handlers";

// Shared utilities and components (available everywhere)
import {
  ExperimentalCastCard,
  truncateText,
  truncateEmail,
} from "@/neynar-web-sdk";
```

## Environment Variables

```env
# The NEYNAR_API_KEY is automatically provided as an environment variable
# when your mini-app is deployed through Neynar's platform
NEYNAR_API_KEY=automatically_provided_by_platform

COINGECKO_API_KEY=your_coingecko_api_key_here  # Optional for public endpoints
```

## Documentation

### Full Documentation by Tier

- **Neynar Hooks**: See `src/neynar/hooks/llms.txt` for overview (110+ hooks)
- **CoinGecko Hooks**: See `src/coingecko/hooks/llms.txt` for overview (40+ hooks)
- **Shared Components**: See `src/shared/llms.txt` for components and utilities
- **API Handlers**: See `src/server/` for Next.js route handlers

Each tier provides detailed documentation with usage examples, types, and patterns.

## Features

### Neynar Hooks (110+ Hooks)

- **Users** (11 hooks): `useUser`, `useBulkUsers`, `useUserSearch`, `useFollowUser`, etc.
- **Casts** (16 hooks): `useCast`, `useCastsByUser`, `usePublishCast`, `useLikeCast`, etc.
- **Feeds** (10 hooks): `useFollowingFeed`, `useForYouFeed`, `useChannelFeed`, etc.
- **Channels** (9 hooks): `useChannel`, `useChannelSearch`, `useFollowChannel`, etc.
- **Frames** (9 hooks): `usePostFrameAction`, `useFrameCatalog`, `usePublishNeynarFrame`, etc.
- **And more**: Notifications, Auth/Signers, Social features, Storage, Webhooks, Subscriptions

### CoinGecko Hooks (40+ Hooks)

- **Coins**: `useCoin`, `useCoinsMarkets`, `useCoinMarketChart`, etc.
- **Categories**: `useCoinsCategories`, `useAssetPlatforms`
- **Exchanges**: `useExchanges`, `useExchangeVolumeChart`
- **NFTs**: `useNFT`, `useNFTsMarkets`
- **Simple**: `useSimplePrice`, `useTokenPrice`

### API Handler Features

- **createNeynarApiHandler** - Factory for creating Neynar API route handlers
- **createCoinGeckoApiHandler** - Factory for creating CoinGecko API route handlers

### Shared Components & Utilities

- **Components**: `ExperimentalCastCard` - Full-featured Farcaster cast display
- **Text utilities**: `truncateText`, `truncateEmail`
- **Types**: `NeynarUser` and other shared types

## Contributing

This SDK is part of the Neynar mini-app template system. For contributions and issues, please refer to the main template repository.
