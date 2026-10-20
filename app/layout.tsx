import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HSC · 选手与教练",
  description: "Hamilton Skating Club 教练信息编辑表",
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
