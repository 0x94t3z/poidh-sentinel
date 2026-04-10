// Complete Neynar API proxy using our new architecture
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import { createNeynarApiHandler } from "@/neynar-web-sdk/nextjs";
import { privateConfig } from "@/config/private-config";

// Create SDK client with proper Configuration object (SDK requires this format to pass API key)
const config = new Configuration({
  apiKey: privateConfig.neynarApiKey,
});

const client = new NeynarAPIClient(config);

// Export Next.js API route handlers
export const { GET, POST, PUT, DELETE, OPTIONS } =
  createNeynarApiHandler(client);
