import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "KNOT",
  title: {
    default: "KNOT | Pay for verified outcomes",
    template: "%s | KNOT",
  },
  description: "Verification-native USDC settlement for autonomous agents on Arc.",
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
    title: "KNOT | Pay for verified outcomes",
    description: "Verification-native USDC settlement for autonomous agents on Arc.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KNOT | Pay for verified outcomes",
    description: "Verification-native USDC settlement for autonomous agents on Arc.",
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
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
