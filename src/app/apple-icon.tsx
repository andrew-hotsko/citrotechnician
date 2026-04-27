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
          background: "#ea580c",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 13 8 H 51 Q 54 8 54 11 V 34 C 54 44 47 53 32 58 C 17 53 10 44 10 34 V 11 Q 10 8 13 8 Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    size,
  );
}
