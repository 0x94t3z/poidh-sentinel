import { MiniappHeader } from "./miniapp-header";
import { ReactNode } from "react";
import { publicConfig } from "@/config/public-config";

type StandardMiniLayoutProps = {
  children: ReactNode;
};

/**
 * StandardMiniLayout - Layout for standard (non-game) mini apps
 *
 * Features:
 * - Fixed floating header with backdrop blur
 * - Scrollable content area
 * - Full width
 * - Padding included
 *
 * Usage:
 * ```tsx
 * <StandardMiniLayout>
 *   <YourAppContent />
 * </StandardMiniLayout>
 * ```
 */
export function StandardMiniLayout({ children }: StandardMiniLayoutProps) {
  return (
    <>
      <MiniappHeader title={publicConfig.shortName} variant="fixed" />
      <main className="pt-16 min-h-screen">{children}</main>
    </>
  );
}
