import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StreamOMS — Institutional Trading Dashboard",
  description:
    "Real-time market data streaming dashboard. Sub-100ms latency, 10K+ ticks/sec. Analytics: SMA, EMA, VWAP, RSI, MACD, Bollinger Bands.",
  keywords: ["trading dashboard", "market data", "order book", "real-time", "institutional"],
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0d0f12" />
      </head>
      <body className="font-sans antialiased bg-[#0d0f12] text-[#e2e8f0] overflow-hidden">
        {children}
      </body>
    </html>
  );
}
