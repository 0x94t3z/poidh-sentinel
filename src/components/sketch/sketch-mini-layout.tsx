"use client";

import { ReactNode, useState } from "react";
import { SketchHeading } from "./sketch-heading";
import { SketchFilters } from "./sketch-filters";

type SketchTab = {
  label: string;
  content: ReactNode;
};

type SketchMiniLayoutProps = {
  /**
   * App title shown in header
   */
  title?: string;
  /**
   * Layout mode:
   * - "scroll" (default): Fixed header, scrollable content
   * - "fixed": Full viewport, no scroll (for games/dashboards)
   * - "tabs": Full viewport with tab navigation
   */
  mode?: "scroll" | "fixed" | "tabs";
  /**
   * For tabs mode: array of tab objects
   */
  tabs?: SketchTab[];
  /**
   * Default selected tab (lowercase label)
   */
  defaultTab?: string;
  /**
   * Footer content (optional, fixed at bottom)
   */
  footer?: ReactNode;
  /**
   * Main content (for scroll/fixed modes)
   */
  children?: ReactNode;
};

/**
 * SketchMiniLayout - Wireframe layout for Farcaster mini apps
 *
 * Use this to define your app's layout structure in Phase 1.
 * In Phase 2, replace with StandardMiniLayout or GameMiniLayout.
 *
 * @example Scrolling content app
 * ```tsx
 * <SketchMiniLayout title="My App" mode="scroll">
 *   <SketchCard>Content here...</SketchCard>
 * </SketchMiniLayout>
 * ```
 *
 * @example Viewport-filling app (games, dashboards)
 * ```tsx
 * <SketchMiniLayout title="My Game" mode="fixed" footer={<SketchButton>Play</SketchButton>}>
 *   <GameBoard />
 * </SketchMiniLayout>
 * ```
 *
 * @example Tabbed app
 * ```tsx
 * <SketchMiniLayout
 *   title="My App"
 *   mode="tabs"
 *   tabs={[
 *     { label: "Home", content: <HomeScreen /> },
 *     { label: "Stats", content: <StatsScreen /> },
 *     { label: "Settings", content: <SettingsScreen /> },
 *   ]}
 * />
 * ```
 */
export function SketchMiniLayout({
  title = "App Name",
  mode = "scroll",
  tabs,
  defaultTab,
  footer,
  children,
}: SketchMiniLayoutProps) {
  const [activeTab, setActiveTab] = useState(
    defaultTab || tabs?.[0]?.label.toLowerCase() || "",
  );

  // Tabs mode
  if (mode === "tabs" && tabs) {
    return (
      <>
        <SketchFilters />
        <div className="h-dvh flex flex-col overflow-hidden sketch-paper p-1">
          {/* Sketchy outer border */}
          <div
            className="flex-1 flex flex-col min-h-0 sketch-border"
            style={{ filter: "url(#sketchy)" }}
          >
            {/* Header */}
            <header className="shrink-0 px-3 py-2 sketch-border-b">
              <SketchHeading level={4}>{title}</SketchHeading>
            </header>

            {/* Tab Navigation */}
            <nav className="shrink-0 flex sketch-border-b">
              {tabs.map((tab) => {
                const tabValue = tab.label.toLowerCase();
                const isActive = activeTab === tabValue;
                return (
                  <button
                    key={tabValue}
                    onClick={() => setActiveTab(tabValue)}
                    className={`
                      flex-1 px-3 py-2 sketch-text text-sm font-medium
                      border-r-2 border-foreground/30 last:border-r-0
                      transition-colors
                      ${isActive ? "bg-foreground/10" : "hover:bg-foreground/5"}
                    `}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Tab Content */}
            <main className="flex-1 overflow-y-auto p-3">
              {tabs.find((t) => t.label.toLowerCase() === activeTab)?.content}
            </main>

            {/* Optional Footer */}
            {footer && (
              <footer className="shrink-0 p-3 sketch-border-t">{footer}</footer>
            )}
          </div>
        </div>
      </>
    );
  }

  // Fixed mode (viewport-filling, no scroll)
  if (mode === "fixed") {
    return (
      <>
        <SketchFilters />
        <div className="h-dvh flex flex-col overflow-hidden sketch-paper p-1">
          {/* Sketchy outer border */}
          <div
            className="flex-1 flex flex-col min-h-0 sketch-border"
            style={{ filter: "url(#sketchy)" }}
          >
            {/* Header */}
            <header className="shrink-0 px-3 py-2 sketch-border-b">
              <SketchHeading level={4}>{title}</SketchHeading>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden p-3">
              {children}
            </main>

            {/* Optional Footer */}
            {footer && (
              <footer className="shrink-0 p-3 sketch-border-t">{footer}</footer>
            )}
          </div>
        </div>
      </>
    );
  }

  // Scroll mode (default)
  return (
    <>
      <SketchFilters />
      <div className="min-h-dvh flex flex-col sketch-paper p-1">
        {/* Sketchy outer border */}
        <div
          className="flex-1 flex flex-col sketch-border"
          style={{ filter: "url(#sketchy)" }}
        >
          {/* Fixed Header */}
          <header className="sticky top-1 z-10 px-3 py-2 sketch-border-b bg-[#fafafa]/95 backdrop-blur-sm">
            <SketchHeading level={4}>{title}</SketchHeading>
          </header>

          {/* Scrollable Content */}
          <main className="flex-1 p-3">{children}</main>

          {/* Optional Fixed Footer */}
          {footer && (
            <footer className="sticky bottom-1 p-3 sketch-border-t bg-[#fafafa]/95 backdrop-blur-sm">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </>
  );
}
