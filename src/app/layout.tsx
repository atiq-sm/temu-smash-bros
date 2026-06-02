import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Temu Smash Bros - Platform Fighter",
  description:
    "Temu Smash Bros is a browser-based platform fighter inspired by the greats. Choose your fighter, master your moves, and knock your opponents off the stage!",
  keywords: ["platform fighter", "fighting game", "browser game", "multiplayer"],
  authors: [{ name: "Temu Smash Bros Team" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className="h-full overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]"
        style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
