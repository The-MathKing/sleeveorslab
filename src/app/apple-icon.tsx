import { ImageResponse } from "next/og";
import { BRAND_HEX, logomarkSvg, svgDataUri } from "@/components/brand/markSvg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon: paper tile (iOS rounds the corners itself) with the full logomark. */
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
          background: BRAND_HEX.paper,
        }}
      >
        <img alt="" src={svgDataUri(logomarkSvg())} width={105} height={140} />
      </div>
    ),
    size,
  );
}
