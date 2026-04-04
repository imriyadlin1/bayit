import { ImageResponse } from "next/og";

export const alt = "בית — ניהול משק בית";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 45%, #0f766e 100%)",
        }}
      >
        <div style={{ fontSize: 140, lineHeight: 1, marginBottom: 24 }}>🏠</div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "white",
            letterSpacing: "-0.02em",
          }}
        >
          בית
        </div>
        <div
          style={{
            fontSize: 32,
            color: "rgba(255,255,255,0.92)",
            marginTop: 16,
          }}
        >
          ניהול משק בית חכם
        </div>
      </div>
    ),
    { ...size }
  );
}
