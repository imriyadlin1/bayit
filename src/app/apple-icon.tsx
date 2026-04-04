import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)",
          fontSize: 100,
          borderRadius: 36,
        }}
      >
        🏠
      </div>
    ),
    { ...size }
  );
}
