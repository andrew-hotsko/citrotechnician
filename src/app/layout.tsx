import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "CitroTech Jobs",
  description: "Internal job management for CitroTech field technicians",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "CitroTech",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "CitroTech Jobs",
    description: "Internal job management for CitroTech field technicians",
    siteName: "CitroTech Jobs",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "CitroTech" }],
  },
  twitter: {
    card: "summary",
    title: "CitroTech Jobs",
    description: "Internal job management for CitroTech field technicians",
    images: ["/icon-512.png"],
  },
  robots: { index: false, follow: false },
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
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[var(--color-surface)] text-neutral-900 font-sans">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
