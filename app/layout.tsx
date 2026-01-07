import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import Providers from "@/components/Providers";
import ScrollToTop from "@/components/ScrollToTop";
import Chatbot from "@/components/Chatbot";
import LayoutWrapper from "@/components/layouts/LayoutWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Rift - Secure Buyer Protection for Marketplace Deals",
  description: "Send money safely, receive goods, and release funds only when everything checks out.",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen flex flex-col`}
      >
        <Providers>
          <ScrollToTop />
          <LayoutWrapper>{children}</LayoutWrapper>
          <Chatbot />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
