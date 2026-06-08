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
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
