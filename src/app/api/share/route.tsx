// Share card PNG (owned by flows). 1080x1350 portrait by default; ?format=og → 1200x630.
// GET /api/share?saved=720&cards=12&verdict=SLEEVE&name=Charizard%20ex
// Satori constraints: flex layouts only, every multi-child div is display:flex, no external fonts.
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const C = {
  paper: "#f7f6f2",
  paper2: "#efede6",
  card: "#ffffff",
  ink: "#15171c",
  ink2: "#4a4f5c",
  ink3: "#8a8f9c",
  line: "#dedbd2",
  sleeve: "#5b7a99",
  sleeveSoft: "#e3eaf1",
  sleeveInk: "#2c4560",
  slab: "#c9971c",
  slabSoft: "#f8edd0",
  slabInk: "#6b4d05",
  borderline: "#d9741e",
  borderlineSoft: "#fbe6d3",
};

type V = "SLAB" | "SLEEVE" | "BORDERLINE";

function num(v: string | null, max: number): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : undefined;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function clean(s: string | null, max: number): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
  return t || undefined;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const og = sp.get("format") === "og";
  const saved = num(sp.get("saved"), 10_000_000);
  const cards = num(sp.get("cards"), 100_000);
  const vRaw = (sp.get("verdict") ?? "").toUpperCase();
  const verdict: V | undefined = vRaw === "SLAB" || vRaw === "SLEEVE" || vRaw === "BORDERLINE" ? vRaw : undefined;
  const name = clean(sp.get("name"), 48);

  const W = og ? 1200 : 1080;
  const H = og ? 630 : 1350;
  const s = og ? 0.62 : 1; // type scale

  const n = cards !== undefined ? Math.round(cards) : undefined;
  const lines: { big: string; small: string }[] = [];
  if (verdict === "SLAB") {
    lines.push({ big: name ?? "1 card", small: "worth slabbing" });
    if (saved) lines.push({ big: `+${money(saved)}`, small: "expected vs selling raw" });
  } else if (verdict === "BORDERLINE") {
    lines.push({ big: name ?? "1 card", small: "coin flip. think twice." });
  } else {
    lines.push({
      big: n !== undefined ? `${n} card${n === 1 ? "" : "s"}` : (name ?? "This card"),
      small: "sleeved",
    });
    if (saved !== undefined) lines.push({ big: money(saved), small: "not wasted on grading" });
  }

  const stamp = verdict ?? "SLEEVE";
  const stampColors =
    stamp === "SLAB"
      ? { bg: C.slabSoft, fg: C.slabInk, bd: C.slab }
      : stamp === "BORDERLINE"
        ? { bg: C.borderlineSoft, fg: C.ink, bd: C.borderline }
        : { bg: C.sleeveSoft, fg: C.sleeveInk, bd: C.sleeve };

  const date = new Date().toISOString().slice(0, 10);
  const dashed = { display: "flex", width: "100%", borderTop: `${Math.max(2, 3 * s)}px dashed ${C.line}`, margin: `${28 * s}px 0` } as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.paper2,
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: og ? 1040 : 860,
            background: C.card,
            padding: og ? "40px 56px" : "72px 72px 64px",
            minHeight: og ? undefined : 1180,
            justifyContent: "space-between",
            boxShadow: "0 18px 50px rgba(21,23,28,0.18)",
            color: C.ink,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 44 * s, fontWeight: 800, letterSpacing: 2 }}>SLEEVE OR SLAB</div>
              <div style={{ display: "flex", fontSize: 24 * s, color: C.ink3, marginTop: 6 }}>{`RECEIPT · ${date}`}</div>
            </div>
            <div
              style={{
                display: "flex",
                padding: `${14 * s}px ${26 * s}px`,
                border: `${Math.max(3, 6 * s)}px solid ${stampColors.bd}`,
                borderRadius: 18 * s,
                background: stampColors.bg,
                color: stampColors.fg,
                fontSize: 40 * s,
                fontWeight: 800,
                letterSpacing: 6 * s,
                transform: "rotate(-6deg)",
              }}
            >
              {stamp}
            </div>
          </div>

          <div style={dashed} />

          <div style={{ display: "flex", flexDirection: og ? "row" : "column", gap: og ? 48 : 36 }}>
            {lines.map((l) => (
              <div key={l.small} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: (og ? 96 : 120) * Math.max(0.38, Math.min(1, (og ? 11 : 13) / l.big.length)), fontWeight: 800, lineHeight: 1.05 }}>
                  {l.big}
                </div>
                <div style={{ display: "flex", fontSize: 40 * s, color: C.ink2, marginTop: 8 }}>{l.small}</div>
              </div>
            ))}
          </div>

          {name && verdict !== "SLAB" && verdict !== "BORDERLINE" ? (
            <div style={{ display: "flex", fontSize: 30 * s, color: C.ink3, marginTop: 28 * s }}>{name}</div>
          ) : null}

          <div style={dashed} />

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 * s, color: C.ink2 }}>
            <div style={{ display: "flex" }}>the app that tells you when not to grade</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", fontSize: 34 * s, fontWeight: 800, marginTop: 28 * s, letterSpacing: 3 }}>
            *** SLEEVEORSLAB.COM ***
          </div>
          {!og ? (
            <div style={{ display: "flex", justifyContent: "center", fontSize: 20, color: C.ink3, marginTop: 24, textAlign: "center" }}>
              Estimates, not financial advice. Not affiliated with PSA, CGC, or The Pokémon Company.
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
