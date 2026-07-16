import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KNOT | Verified settlement for autonomous agents",
  description:
    "KNOT binds agent intent, service evidence, and USDC settlement on Arc.",
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
