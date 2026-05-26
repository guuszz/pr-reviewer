import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const SITE_URL = "https://pr-reviewer-guuszz.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "PR Reviewer — análise de Pull Requests com IA",
  description:
    "Cola a URL de um Pull Request público do GitHub e receba uma análise estruturada com resumo, possíveis bugs e sugestões. Powered by Claude.",
  keywords: ["pull request", "code review", "claude", "anthropic", "github", "ai"],
  openGraph: {
    title: "PR Reviewer — análise de PRs com IA",
    description: "Resumo + possíveis bugs + sugestões pra qualquer PR público do GitHub.",
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
