import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const SITE_URL = "https://pr-reviewer-guuszz.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Security PR Reviewer ? an?lise de seguran?a em Pull Requests",
  description:
    "Analise Pull Requests com regras determin?sticas, classifica??o CWE/OWASP e revis?o contextual assistida por IA.",
  keywords: ["pull request", "application security", "code review", "owasp", "cwe", "github", "ai"],
  openGraph: {
    title: "Security PR Reviewer ? AppSec para Pull Requests",
    description: "Security findings determin?sticos e revis?o contextual para Pull Requests p?blicos.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
