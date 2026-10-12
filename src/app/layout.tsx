import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { ToastProvider } from "@/components/ui/Toast";
import { ServiceWorkerRegister } from "@/components/brand/ServiceWorkerRegister";
import { Analytics } from "@/lib/analytics/Analytics";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-display-face",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-face",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono-face",
  display: "swap",
});

const siteUrl = SITE_URL;
const description =
  "Should you grade that Pokémon card? Check centering on your phone, see the fees, and get an honest expected-value verdict. Most cards should stay sleeved.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sleeve or Slab · The app that tells you when not to grade",
    template: "%s · Sleeve or Slab",
  },
  description,
  applicationName: "Sleeve or Slab",
  keywords: ["Pokémon card grading", "PSA", "CGC", "should I grade", "centering", "grading calculator", "gem rate"],
  appleWebApp: { capable: true, title: "SleeveSlab", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Sleeve or Slab",
    title: "Sleeve or Slab · Save the $60.",
    description,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sleeve or Slab · Save the $60.",
    description: "Do the math before you slab. Centering, fees, and an honest verdict for your Pokémon cards.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#101216" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <ToastProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ToastProvider>
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
