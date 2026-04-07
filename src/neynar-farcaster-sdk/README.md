# Neynar Farcaster SDK

A comprehensive TypeScript SDK for building Farcaster applications using the Neynar ecosystem.

## Overview

This SDK provides everything you need to build Farcaster applications, from client-side mini app components to server-side API utilities. It's designed to work seamlessly with the Neynar API and provides a developer-friendly interface for common Farcaster operations.

## Quick Start

### Installation

```bash
# Copy the neynar-farcaster-sdk folder to your project
cp -r neynar-farcaster-sdk /path/to/your/project/src/
```

### Environment Setup

```env
# The NEYNAR_API_KEY is automatically provided as an environment variable
# when your mini-app is deployed through Neynar's platform
NEYNAR_API_KEY=automatically_provided_by_platform
```

### Basic Setup

```tsx
// features/app/providers-and-initialization.tsx
"use client";

import { ReactNode, useState } from "react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useInitializeFarcasterApp } from "@/neynar-farcaster-sdk/mini";

export function ProvidersAndInitialization({
  children,
}: {
  children: ReactNode;
}) {
  useInitializeFarcasterApp();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </JotaiProvider>
  );
}
```

```tsx
// app/layout.tsx
import { ProvidersAndInitialization } from "@/features/app/providers-and-initialization";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ProvidersAndInitialization>{children}</ProvidersAndInitialization>
      </body>
    </html>
  );
}
```

```tsx
// app/page.tsx
import { MiniappHeader } from "@/neynar-farcaster-sdk/mini";

export default function App() {
  return (
    <>
      <MiniappHeader title="My Farcaster App" />
      {/* Your app content */}
    </>
  );
}
```

### API Proxy Setup

```tsx
// app/api/neynar/[...route]/route.ts
import { createNeynarApiHandler } from "@/neynar-web-sdk/api-handlers";
import { createNeynarClient } from "@neynar/nodejs-sdk";

const client = createNeynarClient({ apiKey: process.env.NEYNAR_API_KEY! });

const { GET, POST, PUT, DELETE } = createNeynarApiHandler(client, {
  pathPrefix: "/api/neynar",
});

export { GET, POST, PUT, DELETE };
```

## Architecture

### 📱 Mini App Components (`/mini`)

Client-side React components for building Farcaster mini applications with user authentication and social features.

**Key Features:**

- Farcaster authentication and user state
- UI components with @neynar/ui compatibility
- Audio and game features
- Social sharing functionality
- TypeScript support

**Documentation:**

- [📖 SDK Overview](./llms.txt) - Start here for navigation
- [🎮 Game Development](./src/mini/features/game/llms.txt) - Comprehensive game primitives
- [🔊 Audio System](./src/mini/features/audio/llms.txt) - Sound effects and music
- [👤 Farcaster Integration](./src/mini/.llm/farcaster-integration.llm.md) - User context and authentication

### 🔧 Server Utilities

Server-side API handlers and direct SDK clients are provided by the Neynar Web SDK for backend integration.

**Note:** Server utilities have been moved to the `neynar-web-sdk/src/api-handlers` tier for better organization and shared functionality.

## Examples

### Complete Mini App with Social Features

```tsx
// app/page.tsx
"use client";

import {
  useFarcasterUser,
  MiniappHeader,
  ShareButton,
} from "@/neynar-farcaster-sdk/mini";

export default function SocialApp() {
  const { data: user, isLoading } = useFarcasterUser();

  return (
    <>
      <MiniappHeader title="Social Demo" />
      <div className="p-4">
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <>
            <p>Welcome, {user?.displayName}!</p>
            <ShareButton text="Check out my mini app!" />
          </>
        )}
      </div>
    </>
  );
}
```

### API Integration

```tsx
// Backend API route
import { createNeynarClient } from "@neynar/nodejs-sdk";

export default async function handler(req, res) {
  const client = createNeynarClient({ apiKey: process.env.NEYNAR_API_KEY! });
  const user = await client.user.getUserByUsername(req.query.username);
  res.json(user);
}

// Frontend usage
const user = await fetch("/api/neynar/user/alice").then((r) => r.json());
```

## Development

### Project Structure

```
neynar-farcaster-sdk/
├── README.md                          # This file
├── llms.txt                          # AI-focused documentation
├── llm-tsdoc-generator.config.json   # Documentation generation config
└── src/                              # Source code
    └── mini/                         # Client-side mini app SDK
        ├── llms.txt                  # Mini app component documentation
        ├── index.tsx                 # Main exports
        ├── app/                      # App-level components
        ├── components/               # UI components
        └── helpers/                  # Helper utilities
```

### Dependencies

The SDK requires these peer dependencies:

**Required:**

- `jotai` - State management (used by SDK internally)
- `@farcaster/miniapp-sdk` - Farcaster client SDK
- `@neynar/ui` - UI components
- `tone` - Audio synthesis library (only if using audio features)

**Application Setup:**

Your app needs to provide these providers (see setup example above):

- `JotaiProvider` from jotai
- `QueryClientProvider` from @tanstack/react-query (for your app's data fetching)

### Best Practices

1. **Set up providers correctly** - Wrap your app with `JotaiProvider` and `QueryClientProvider`, and call `useInitializeFarcasterApp()` inside that wrapper
2. **Secure API keys** using environment variables
3. **Handle errors gracefully** in both client and server code
4. **Use atoms for state** when you need global state access
5. **Follow TypeScript patterns** throughout your code

## Support

For issues and questions:

1. Check the main `llms.txt` file for navigation to feature-specific documentation
2. Review feature-specific guides (game, audio, Farcaster integration)
3. Examine the example implementations
4. Refer to the Neynar API documentation

## License

This SDK is provided as part of the Neynar ecosystem.
