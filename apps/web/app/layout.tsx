import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { AppShell } from "@/components/app/shell/AppShell";
import { ThemeScript } from "@/components/app/shell/ThemeScript";
import "./globals.css";

// Gotham (AMGC): Book para el texto, Medium como «semibold», Bold puntual.
const gotham = localFont({
  variable: "--font-gotham",
  display: "swap",
  src: [
    { path: "./fonts/Gotham-Book.otf", weight: "400", style: "normal" },
    { path: "./fonts/Gotham-BookItalic.otf", weight: "400", style: "italic" },
    { path: "./fonts/Gotham-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/Gotham-Medium.otf", weight: "600", style: "normal" },
    { path: "./fonts/Gotham-Bold.otf", weight: "700", style: "normal" },
  ],
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
      className={`${gotham.variable} ${geistMono.variable} h-full`}
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
