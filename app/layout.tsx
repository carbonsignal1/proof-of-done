import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { RoleProvider } from "@/components/state";

export const metadata: Metadata = {
  title: "Proof-of-Done",
  description: "Pay for small jobs only when they're done. PayPal holds the money, AI checks the photo proof.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RoleProvider>
          <Nav />
          {children}
        </RoleProvider>
      </body>
    </html>
  );
}
