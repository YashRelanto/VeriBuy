import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "VeriBuy — AI Product Research Platform",
  description:
    "Intelligent product research and recommendation platform powered by multi-agent AI. Compare products, analyze reviews, and make smarter purchasing decisions.",
  keywords: [
    "AI",
    "product research",
    "recommendation",
    "price comparison",
    "review analysis",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Background effects */}
        <div className="fixed inset-0 bg-grid pointer-events-none z-0" />
        <div
          className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none z-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 70%)",
          }}
        />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
