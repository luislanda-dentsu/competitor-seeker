import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { AppShell } from "@/components/app/shell/AppShell";
import { ThemeScript } from "@/components/app/shell/ThemeScript";
import "./globals.css";

// Poppins: 400 texto, 500 énfasis, 600 semibold, 700 bold; 300 puntual.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
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
      className={`${poppins.variable} ${geistMono.variable} h-full`}
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
