"use client";

import dynamic from "next/dynamic";
import { LiveDemoFallback, LiveDemoSlot } from "./LiveDemoSlot";

// Client wrapper so the landing page (a Server Component) can lazy-load the canvas tool.
const CenteringTool = dynamic(() => import("@/components/scan/CenteringTool"), {
  ssr: false,
  loading: () => <LiveDemoFallback loading />,
});

export function LiveCenteringDemo() {
  return <LiveDemoSlot tool={<CenteringTool compact />} />;
}
