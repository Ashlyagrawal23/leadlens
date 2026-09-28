import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iPhone and iPad. iOS rounds the corners itself, so the square is full bleed. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f5c56",
        color: "#fffdf8",
        fontSize: 108,
        fontWeight: 700,
        fontFamily: "Georgia, serif",
      }}
    >
      L
    </div>,
    size,
  );
}
