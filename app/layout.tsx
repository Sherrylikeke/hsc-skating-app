import type { Metadata } from "next";
import "./globals.css";
import "./club.css";

export const metadata: Metadata = {
  title: "HSC · Club Portal",
  description: "Hamilton Skating Club 选手档案、比赛记录与教练赛程",
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
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
