import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CitroTech Jobs",
  description: "Internal job management for CitroTech",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CitroTech",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-neutral-50 text-neutral-900 font-sans [font-feature-settings:'cv11','ss01'] tabular-nums">
        {children}
      </body>
    </html>
  );
}
