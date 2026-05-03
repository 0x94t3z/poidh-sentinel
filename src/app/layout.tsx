import "@/app/globals.css";
import { ThemeClient } from "@/components/theme-client";
import { ProvidersAndInitialization } from "@/features/app/providers-and-initialization";
import { Caveat, Inter, Patrick_Hand, Roboto_Mono } from "next/font/google";
import { ReactNode } from "react";

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const patrickHand = Patrick_Hand({
  variable: "--font-patrick-hand",
  subsets: ["latin"],
  weight: "400",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="talentapp:project_verification"
          content="0fb1715ce2b3b4f4a4cf0aa2eb0f7102ee6fe9823fa3693797a1168fa94ab414e3fbc029052b36dd2436d28ed13be1b07af7f9c00d263f87d9c43bd43b502b96"
        />
        <ThemeClient />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} ${patrickHand.variable} antialiased`}
      >
        <ProvidersAndInitialization>{children}</ProvidersAndInitialization>
      </body>
    </html>
  );
}
