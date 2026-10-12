"use client";
// On a computer, offer a QR code that opens the scanner on your phone. The scan then runs
// entirely on the phone; nothing is relayed between devices, so photos never leave it.
import { Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function isDesktop(): boolean {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches && navigator.maxTouchPoints === 0;
  } catch {
    return false;
  }
}

export function PhoneHandoff({ path = "/scan" }: { path?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!isDesktop()) return;
    // localhost isn't reachable from a phone, so prefer the public site URL there.
    const local = /^(localhost|127\.|\[::1\])/.test(window.location.hostname);
    const origin = local && SITE_URL ? SITE_URL : window.location.origin;
    const target = `${origin.replace(/\/$/, "")}${path}?from=qr`;
    setUrl(target);
    QRCode.toString(target, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#15171c", light: "#ffffff" } })
      .then((s) => {
        setSvg(s);
        track("qr_shown");
      })
      .catch(() => setSvg(null));
  }, [path]);

  if (!svg) return null;

  return (
    <aside className="mt-4 flex items-center gap-4 rounded-[var(--radius)] border border-line bg-card p-4">
      <div
        className="size-28 shrink-0 overflow-hidden rounded-lg bg-white p-1.5"
        role="img"
        aria-label={`QR code linking to ${url}`}
        // Locally generated SVG from the qrcode library; no user input reaches it.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <Smartphone className="size-5 text-sleeve" aria-hidden /> Easier on your phone
        </p>
        <p className="text-sm text-ink-2">
          Point your phone&apos;s camera at this code to open the scanner there. It snaps the card automatically when it&apos;s
          lined up, and the photo never leaves your phone.
        </p>
        <p className="break-all font-mono text-xs text-ink-3">{url.replace(/^https?:\/\//, "")}</p>
      </div>
    </aside>
  );
}
