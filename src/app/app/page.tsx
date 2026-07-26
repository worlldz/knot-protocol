import type { Metadata } from "next";
import { KnotConsole } from "@/components/knot-console";

export const metadata: Metadata = {
  title: "Clearing App",
  description: "Define an agent obligation, route providers, verify evidence, and settle accepted machine work on KNOT.",
  alternates: {
    canonical: "/app",
  },
};

export default function AppPage() {
  return <KnotConsole />;
}
