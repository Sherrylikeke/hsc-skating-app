import type { Metadata } from "next";
import "./globals.css";
import "./club.css";
import "./i18n.css";
import "./club-mobile.css";
import "./mobile-header.css";

export const metadata: Metadata = {
  title: "HSC · Club Portal",
  description: "Hamilton Skating Club · Skater records, competition schedules and coach instructions",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-CA">
      <body className="antialiased">{children}</body>
    </html>
  );
}
