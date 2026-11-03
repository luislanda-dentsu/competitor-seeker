import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app/shell/AppShell";
import { ThemeScript } from "@/components/app/shell/ThemeScript";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Competitor-Seeker",
    template: "%s · Competitor-Seeker",
  },
  description: "Inteligencia competitiva por marca: panel local de corridas, señales y evidencia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${geist.variable} ${geistMono.variable} h-full`}
      lang="es"
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
