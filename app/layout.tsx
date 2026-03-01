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

// Helper function to safely get metadata base URL
function getMetadataBase(): URL {
  try {
    // Try multiple environment variables in order of preference
    const url = process.env.NEXT_PUBLIC_APP_URL || 
                process.env.APP_URL || 
                process.env.NEXTAUTH_URL || 
                (process.env.NODE_ENV === 'production' ? '[REDACTED]' : 'http://localhost:3000')
    
    // Validate URL format
    if (!url || url.trim() === '') {
      const fallback = process.env.NODE_ENV === 'production' ? '[REDACTED]' : 'http://localhost:3000'
      return new URL(fallback)
    }
    return new URL(url)
  } catch (error) {
    console.error('Invalid URL in environment variables, using fallback:', error)
    const fallback = process.env.NODE_ENV === 'production' ? '[REDACTED]' : 'http://localhost:3000'
    return new URL(fallback)
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
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
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-[#1d1d1f] min-h-screen flex flex-col`}
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
