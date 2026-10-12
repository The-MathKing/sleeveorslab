"use client";

// Replaces the root layout when it fails, so it must be self-contained: its own <html>/<body>,
// no app fonts, components, or globals.css. Inline styles only.
import { useEffect } from "react";

const css = `
:root{color-scheme:light dark;--paper:#f6f4ee;--ink:#16181d;--ink-2:#4a4f5a;--line:#d9d4c7;--btn:#16181d;--on-btn:#f6f4ee}
@media (prefers-color-scheme:dark){:root{--paper:#101216;--ink:#f2efe6;--ink-2:#b4b8c2;--line:#2c3038;--btn:#f2efe6;--on-btn:#101216}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:28rem;width:100%;text-align:center;border:2px dashed var(--line);border-radius:16px;padding:40px 24px}
h1{margin:0 0 12px;font-size:1.75rem;line-height:1.1;text-transform:uppercase;letter-spacing:.02em}
p{margin:0 0 24px;color:var(--ink-2);line-height:1.5}
.row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
button,a{font:inherit;font-weight:600;border-radius:999px;padding:10px 18px;cursor:pointer;text-decoration:none}
button{background:var(--btn);color:var(--on-btn);border:0}
a{color:var(--ink);border:1px solid var(--line)}
small{display:block;margin-top:16px;color:var(--ink-2);font-family:ui-monospace,monospace}
`;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong · Sleeve or Slab</title>
        <meta name="robots" content="noindex" />
        <style>{css}</style>
      </head>
      <body>
        <main>
          <h1>That one slipped out of the sleeve.</h1>
          <p>Sleeve or Slab hit an unexpected error. Your scans stay on your device. Try again, or head home.</p>
          <div className="row">
            <button type="button" onClick={() => reset()}>
              Try again
            </button>
            {/* Plain <a> on purpose: a full reload is the safest recovery when the root layout failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Back to home</a>
          </div>
          {error.digest ? <small>Ref: {error.digest}</small> : null}
        </main>
      </body>
    </html>
  );
}
