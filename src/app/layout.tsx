import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "@/providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import Analytics from "@/components/Analytics";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Compound Blue",
  description: "DeFi lending and borrowing interface for Compound-managed deployments on the Morpho protocol.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL!),
  openGraph: {
    url: process.env.NEXT_PUBLIC_URL!,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <div className="flex min-h-[100dvh] w-full flex-col items-center">
            <Header />
            <main className="flex w-full max-w-screen-xl flex-grow flex-col gap-8 p-4 pb-20">{children}</main>
            <Footer />
          </div>
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
