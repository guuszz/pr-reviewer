"use client";

import { useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  GitPullRequest,
  Loader2,
  Sparkles,
  AlertTriangle,
  Clock,
  ExternalLink,
  ScanSearch,
} from "lucide-react";

interface PrInfo {
  title: string;
  url: string;
  author: string;
  state: string;
}

interface AnalyzeResponse {
  markdown: string;
  prInfo: PrInfo;
  fromCache: boolean;
  truncated?: boolean;
}

const EXAMPLES = [
  "https://github.com/anthropics/anthropic-sdk-typescript/pull/100",
  "https://github.com/vercel/next.js/pull/50000",
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      {/* Header */}
      <header className="mb-12">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 font-mono text-xs text-muted">
          <Sparkles className="h-3 w-3 text-accent" aria-hidden="true" />
          powered by Gemini 2.0 Flash
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          PR Reviewer
        </h1>
        <p className="mt-4 max-w-prose text-lg text-muted">
          Cole a URL de um Pull Request público do GitHub e receba uma análise
          estruturada: resumo, complexidade, possíveis bugs, sugestões de melhoria
          e pontos positivos.
        </p>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <label htmlFor="pr-url" className="sr-only">
          URL do Pull Request
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <GitPullRequest
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="pr-url"
              type="url"
              required
              placeholder="https://github.com/owner/repo/pull/123"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-border bg-surface/40 py-3 pl-10 pr-4 font-mono text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Analisando...</span>
              </>
            ) : (
              <>
                <ScanSearch className="h-4 w-4" aria-hidden="true" />
                <span>Analisar PR</span>
              </>
            )}
          </button>
        </div>

        {!loading && !result && !error && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Experimente:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setUrl(ex)}
                className="font-mono text-accent transition-opacity hover:opacity-70"
              >
                {ex.replace("https://github.com/", "")}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Loading state */}
      {loading && (
        <div className="rounded-lg border border-border bg-surface/30 p-6 text-sm text-muted">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
            <span>
              Buscando o PR no GitHub e mandando pro Gemini analisar. Pode levar
              10-30 segundos.
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Erro ao analisar o PR</p>
              <p className="mt-1 text-red-300/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <article className="space-y-6">
          {/* PR Info card */}
          <div className="rounded-xl border border-border bg-surface/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <a
                  href={result.prInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 text-fg transition-opacity hover:opacity-80"
                >
                  <GitPullRequest className="h-4 w-4 text-accent" aria-hidden="true" />
                  <span className="font-medium">{result.prInfo.title}</span>
                  <ExternalLink className="h-3 w-3 text-muted" aria-hidden="true" />
                </a>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
                  <span>by @{result.prInfo.author}</span>
                  <span>·</span>
                  <span
                    className={
                      result.prInfo.state === "open"
                        ? "text-green-400"
                        : result.prInfo.state === "merged"
                        ? "text-purple-400"
                        : "text-muted"
                    }
                  >
                    {result.prInfo.state}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {result.fromCache && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg/60 px-2 py-1 font-mono text-[10px] text-muted">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    cached
                  </span>
                )}
                {result.truncated && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 font-mono text-[10px] text-yellow-300">
                    diff truncado
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Markdown */}
          <div className="markdown-body rounded-xl border border-border bg-surface/40 p-6 sm:p-8">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result.markdown}
            </ReactMarkdown>
          </div>
        </article>
      )}

      <footer className="mt-20 border-t border-border pt-6 font-mono text-xs text-muted/80">
        <p>
          Construído com Next.js, Google Gemini e Tailwind ·{" "}
          <a
            href="https://github.com/guuszz/pr-reviewer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 transition-colors hover:text-fg hover:underline"
          >
            view source
          </a>
        </p>
      </footer>
    </main>
  );
}
