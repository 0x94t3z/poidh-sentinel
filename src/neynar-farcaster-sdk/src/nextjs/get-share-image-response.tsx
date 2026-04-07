import { ImageResponse } from "next/og";
import { CSSProperties, ReactNode } from "react";

export async function getShareImageResponse(
  {
    type,
    style,
    heroImageUrl,
    imageUrl,
    showDevWarning,
    personalize = true,
  }: {
    type: string;
    style?: CSSProperties;
    heroImageUrl: string;
    imageUrl: string;
    showDevWarning?: boolean;
    personalize?: boolean;
  },
  children: ReactNode | null = null,
) {
  const backgroundImageUrl = type === "og" ? heroImageUrl : imageUrl;
  const height = type === "og" ? 630 : 800;

  // If not personalizing, return the static image directly
  if (!personalize) {
    const response = await fetch(backgroundImageUrl);
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={backgroundImageUrl}
        alt=""
        width={1200}
        height={height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      {children}
      {showDevWarning && <DevWarning />}
    </div>,
    {
      width: 1200,
      height: height,
    },
  );
}

function DevWarning() {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        backgroundColor: "rgba(185, 28, 28, 0.8)",
        zIndex: 10,
      }}
    >
      <span
        style={{
          color: "white",
          fontSize: "36px",
          fontWeight: "700",
        }}
      >
        ⚠️ Preview only - Publish before sharing link ⚠️
      </span>
    </div>
  );
}
