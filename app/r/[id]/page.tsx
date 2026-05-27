import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ExternalLink, GitPullRequest, Sparkles } from "lucide-react";
import { getSharedReview, isRedisConfigured } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!isRedisConfigured()) return { title: "PR Reviewer · Compartilhado" };

  try {
    const review = await getSharedReview(id);
    if (!review) return { title: "Revisão não encontrada · PR Reviewer" };
    return {
      title: `${review.prInfo.title} · Revisão · PR Reviewer`,
      description: `Análise estruturada por IA do PR "${review.prInfo.title}" por @${review.prInfo.author}.`,
      openGraph: {
        title: review.prInfo.title,
        description: "Revisão estruturada com IA · PR Reviewer",
        type: "article",
      },
    };
  } catch {
    return { title: "PR Reviewer · Compartilhado" };
  }
}

export default async function SharedReviewPage({ params }: PageProps) {
  const { id } = await params;

  if (!isRedisConfigured()) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-6 text-sm text-yellow-300">
          <p className="font-medium">Compartilhamento ainda não configurado.</p>
          <p className="mt-1 text-yellow-300/80">
            O Upstash Redis não está provisionado neste deploy. Configure em
            <code className="mx-1 rounded bg-bg/40 px-1 font-mono text-xs">
              vercel.com/[team]/pr-reviewer/stores
            </code>
            pra habilitar links compartilháveis.
          </p>
        </div>
      </main>
    );
  }

  const review = await getSharedReview(id).catch(() => null);

  if (!review) {
    notFound();
  }

  const createdRel = relativeTime(review.createdAt);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      {/* Back link */}
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Analisar outro PR</span>
      </Link>

      {/* Header */}
      <header className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 font-mono text-xs text-muted">
          <Sparkles className="h-3 w-3 text-accent" aria-hidden="true" />
          revisão compartilhada · gerada {createdRel}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Revisão de PR</h1>
      </header>

      {/* PR Info card */}
      <article className="space-y-6">
        <div className="rounded-xl border border-border bg-surface/40 p-5">
          <a
            href={review.prInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-start gap-2 text-fg transition-opacity hover:opacity-80"
          >
            <GitPullRequest className="mt-1 h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
            <span className="font-medium">{review.prInfo.title}</span>
            <ExternalLink className="mt-1 h-3 w-3 flex-shrink-0 text-muted" aria-hidden="true" />
          </a>
          <div className="mt-2 ml-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
            <span>by @{review.prInfo.author}</span>
            <span>·</span>
            <span
              className={
                review.prInfo.state === "open"
                  ? "text-green-400"
                  : review.prInfo.state === "merged"
                  ? "text-purple-400"
                  : "text-muted"
              }
            >
              {review.prInfo.state}
            </span>
          </div>
        </div>

        {/* Markdown */}
        <div className="markdown-body rounded-xl border border-border bg-surface/40 p-6 sm:p-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{review.markdown}</ReactMarkdown>
        </div>
      </article>

      {/* CTA pra analisar próprio PR */}
      <div className="mt-12 rounded-lg border border-accent/30 bg-accent/5 p-6 text-center">
        <p className="text-sm font-medium text-fg">Curtiu a análise?</p>
        <p className="mt-1 text-xs text-muted">
          Cole qualquer URL de PR público pra gerar a sua revisão grátis.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>Analisar meu PR</span>
        </Link>
      </div>
    </main>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────
function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  return new Date(timestamp).toLocaleDateString("pt-BR");
}
