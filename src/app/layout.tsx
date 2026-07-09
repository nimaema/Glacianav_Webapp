import type { Metadata } from "next";
import { Schibsted_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GlaciaNav Workspace",
  description: "Customer-conversation intelligence for GlaciaNav",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${schibsted.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
