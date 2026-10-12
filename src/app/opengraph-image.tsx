import { ImageResponse } from "next/og";
import { BRAND_HEX as C, logomarkSvg, svgDataUri } from "@/components/brand/markSvg";

export const alt = "Sleeve or Slab: the app that tells you when not to grade. Save the $60.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Fetch a Google font as TTF for Satori. Falls back to the built-in font if offline. */
async function loadFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url, { signal: AbortSignal.timeout(4000) })).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const displayText = "SLEEVEORSLABSAVETHE$60.SLEEVEIT.?";
  const monoText = "THE APP THAT TELLS YOU WHEN NOT TO GRADE. CENTERING · FEES · EV  −$61.03 GRADING VS RAW EXAMPLE ≤0123456789";
  const [display, mono] = await Promise.all([
    loadFont("Barlow Condensed", 800, displayText + displayText.toLowerCase()),
    loadFont("JetBrains Mono", 600, monoText + monoText.toLowerCase()),
  ]);
  const fonts = [
    ...(display ? [{ name: "Display", data: display, weight: 800 as const, style: "normal" as const }] : []),
    ...(mono ? [{ name: "Mono", data: mono, weight: 600 as const, style: "normal" as const }] : []),
  ];
  const displayFamily = display ? "Display" : "sans-serif";
  const monoFamily = mono ? "Mono" : "monospace";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: C.paper,
          padding: 64,
          position: "relative",
          fontFamily: displayFamily,
        }}
      >
        {/* left column */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img alt="" src={svgDataUri(logomarkSvg())} width={54} height={72} />
            <div style={{ display: "flex", alignItems: "center", fontSize: 46, color: C.ink, letterSpacing: 1 }}>
              SLEEVE
              <span style={{ fontSize: 22, color: C.ink2, margin: "0 8px", fontFamily: monoFamily }}>or</span>
              SLAB
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 124, lineHeight: 0.9, color: C.ink, letterSpacing: -1, whiteSpace: "nowrap" }}>SAVE THE $60.</div>
            <div
              style={{
                marginTop: 22,
                fontSize: 26,
                color: C.ink2,
                fontFamily: monoFamily,
                letterSpacing: 1,
              }}
            >
              THE APP THAT TELLS YOU WHEN NOT TO GRADE.
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {["CENTERING", "FEES", "EV"].map((t) => (
              <div
                key={t}
                style={{
                  display: "flex",
                  fontFamily: monoFamily,
                  fontSize: 20,
                  color: C.ink,
                  border: `2px solid ${C.ink}`,
                  borderRadius: 999,
                  padding: "6px 18px",
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* right: receipt stub with stamp */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 330,
            marginLeft: 40,
            background: "#fffdf8",
            border: `2px solid ${C.line}`,
            borderRadius: 18,
            padding: 28,
            fontFamily: monoFamily,
            position: "relative",
          }}
        >
          <div style={{ fontSize: 16, color: C.ink3, letterSpacing: 3 }}>EXAMPLE</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 190, marginTop: 24 }}>
            {[
              { p: 0.02, c: C.line },
              { p: 0.06, c: "#b7c5d4" },
              { p: 0.22, c: C.sleeve },
              { p: 0.52, c: "#e3ca8a" },
              { p: 0.18, c: C.slab },
            ].map((b, i) => (
              <div key={i} style={{ flex: 1, height: `${Math.max(4, (b.p / 0.52) * 100)}%`, background: b.c, borderRadius: 6 }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, color: C.ink3, marginTop: 8 }}>
            <span>≤6</span>
            <span>7</span>
            <span>8</span>
            <span>9</span>
            <span>10</span>
          </div>
          <div style={{ display: "flex", borderTop: `3px solid ${C.ink}`, marginTop: 24, paddingTop: 14, flexDirection: "column" }}>
            <div style={{ fontSize: 15, color: C.ink2 }}>GRADING VS RAW</div>
            <div style={{ fontSize: 50, color: C.bad }}>−$61.03</div>
          </div>
          <div
            style={{
              position: "absolute",
              left: -24,
              top: 236,
              whiteSpace: "nowrap",
              display: "flex",
              transform: "rotate(-9deg)",
              border: `7px solid ${C.sleeveDeep}`,
              borderRadius: 16,
              padding: "6px 22px",
              color: C.sleeveDeep,
              fontFamily: displayFamily,
              fontSize: 58,
              background: "rgba(246,244,238,0.82)",
            }}
          >
            SLEEVE IT.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
