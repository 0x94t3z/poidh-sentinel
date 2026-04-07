"use client";

import { MiniappHeader } from "../../../layout/miniapp-header";
import { ReactNode } from "react";
import { publicConfig } from "@/config/public-config";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@neynar/ui";

type GameTab = {
  label: string;
  content: ReactNode;
};

type GameMiniLayoutProps = {
  tabs: GameTab[];
  defaultTab?: string;
};

/**
 * GameMiniLayout - Layout for game-based mini apps
 *
 * Features:
 * - Static header (not floating, part of layout flow)
 * - Full-height layout (no scrolling)
 * - Built-in Tabs from @neynar/ui
 * - Three sections: Header, Tabs, Tab Content
 * - Tab values are auto-generated from labels (lowercase)
 *
 * Note: Use GameBoard component inside tabs for game + controls layout
 *
 * Usage:
 * ```tsx
 * import { GameBoard } from '@/neynar-farcaster-sdk/mini';
 *
 * <GameMiniLayout
 *   tabs={[
 *     {
 *       label: 'Play',
 *       content: (
 *         <GameBoard controls={<YourControls />}>
 *           <YourGameCanvas />
 *         </GameBoard>
 *       )
 *     },
 *     { label: 'Stats', content: <YourStats /> },
 *     { label: 'Settings', content: <YourSettings /> }
 *   ]}
 *   defaultTab="play"
 * />
 * ```
 */
export function GameMiniLayout({ tabs, defaultTab }: GameMiniLayoutProps) {
  const firstTabValue = tabs[0]?.label.toLowerCase();
  const defaultValue = defaultTab || firstTabValue;

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Section 1: Header - Static, part of layout flow */}
      <MiniappHeader title={publicConfig.shortName} variant="static" />

      {/* Section 2 & 3: Tabs + Content - Takes remaining height */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Tabs
          defaultValue={defaultValue}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {/* Section 2: Tabs - Navigation between game views */}
          <TabsList className="w-full">
            {tabs.map((tab) => {
              const value = tab.label.toLowerCase();
              return (
                <TabsTrigger key={value} value={value}>
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Section 3: Tab Content - Main content area, fills remaining space */}
          {tabs.map((tab) => {
            const value = tab.label.toLowerCase();
            return (
              <TabsContent
                key={value}
                value={value}
                className="flex-1 overflow-scroll"
              >
                {tab.content}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
