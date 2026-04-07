"use client";

export type FlashOverlayProps = {
  isFlashing: boolean;
  opacity: number;
  color: string;
};

export function FlashOverlay({
  isFlashing,
  opacity,
  color,
}: FlashOverlayProps) {
  if (!isFlashing && opacity === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        backgroundColor: color,
        opacity: opacity,
      }}
    />
  );
}
