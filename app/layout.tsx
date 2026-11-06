import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { RoleProvider } from "@/components/state";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Proof-of-Done",
  description: "Pay for small jobs only when they're done. PayPal holds the money, AI checks the photo proof.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Some browser extensions add classes (e.g. "hydrated") to <html> before React loads.
    // This only silences attribute mismatches on this one element, not its children.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <RoleProvider>
          <Nav />
          {children}
        </RoleProvider>
      </body>
    </html>
  );
}
