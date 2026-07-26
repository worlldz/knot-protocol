import type { Metadata } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import "./landing.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://knot-omega.vercel.app";
const description = "Programmable payment policy for autonomous agents. KNOT releases USDC only when purchased machine work satisfies verifiable conditions.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "KNOT",
  title: {
    default: "KNOT | Pay only after proof",
    template: "%s | KNOT",
  },
  description,
  keywords: [
    "KNOT",
    "Arc Testnet",
    "x402",
    "USDC",
    "agent payments",
    "autonomous commerce",
    "verified settlement",
    "ERC-8183",
  ],
  authors: [{ name: "KNOT Protocol" }],
  creator: "KNOT Protocol",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "KNOT",
    title: "KNOT | Pay only after proof",
    description,
    images: [{
      url: "/og.png",
      width: 1744,
      height: 909,
      alt: "KNOT programmable payment policy: pay only after proof",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "KNOT | Pay only after proof",
    description,
    images: ["/og.png"],
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `
    (() => {
      try {
        const stored = localStorage.getItem("knot-theme");
        const theme = stored === "light" || stored === "dark" ? stored : "dark";
        document.documentElement.dataset.theme = theme;
      } catch {
        document.documentElement.dataset.theme = "dark";
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
