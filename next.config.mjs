/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      {
        protocol: "https",
        hostname: "neynar-public.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "cdn.neynar.com",
      },
    ],
  },
};

export default nextConfig;
