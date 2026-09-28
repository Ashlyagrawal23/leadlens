import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * App icon for Android and browser tabs. The mark stays inside the middle
 * 80% so Android's round and squircle masks never clip it.
 */
export default function Icon() {
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
        fontSize: 300,
        fontWeight: 700,
        fontFamily: "Georgia, serif",
      }}
    >
      L
    </div>,
    size,
  );
}
