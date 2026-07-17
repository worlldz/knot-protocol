import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KNOT | Pay for verified outcomes",
  description: "Verification-native USDC settlement for autonomous agents on Arc.",
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
