import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rift - Secure Buyer Protection for Marketplace Deals",
  description: "Send money safely, receive goods, and release funds only when everything checks out.",
  // Icons are handled via file-based convention (app/icon.svg, app/icon.png, etc.)
  // See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
  openGraph: {
    title: "Rift - Secure Buyer Protection for Marketplace Deals",
    description: "Send money safely, receive goods, and release funds only when everything checks out.",
    images: [
      {
        url: '/rift-logo.png',
        width: 1200,
        height: 630,
        alt: 'Rift Logo',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Rift - Secure Buyer Protection for Marketplace Deals",
    description: "Send money safely, receive goods, and release funds only when everything checks out.",
    images: ['/rift-logo.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen flex flex-col`}
      >
        <Providers>
          <ScrollToTop />
          <Navbar />
          <main className="flex-1 pt-4 sm:pt-8">{children}</main>
          <Footer />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
