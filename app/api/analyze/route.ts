import { NextRequest, NextResponse } from "next/server";
import { parsePrUrl, fetchPrData } from "@/lib/github";
import { analyzePr } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json(
        { error: "Forneça uma URL de PR do GitHub no campo `url`." },
        { status: 400 },
      );
    }

    const url = body.url.trim();

    // 1. Valida URL antes de qualquer fetch — fail fast em input ruim.
    const parsed = parsePrUrl(url);

    // 2. Cache lookup (1h TTL, SHA-256 da URL).
    const cached = getCached(url);
    if (cached) {
      return NextResponse.json({
        markdown: cached.markdown,
        prInfo: cached.prInfo,
        fromCache: true,
      });
    }

    // 3. Busca dados do PR (metadata + diff + arquivos).
    const pr = await fetchPrData(parsed);

    // 4. Manda pro Gemini com o system instruction configurado no modelo.
    const markdown = await analyzePr({
      title: pr.title,
      body: pr.body,
      diff: pr.diff,
      files: pr.files,
      truncated: pr.truncated,
    });

    const prInfo = {
      title: pr.title,
      url: pr.html_url,
      author: pr.user.login,
      state: pr.state,
    };

    // 5. Salva no cache (1h).
    setCached(url, { markdown, prInfo });

    return NextResponse.json({
      markdown,
      prInfo,
      fromCache: false,
      truncated: pr.truncated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    const status = message.includes("URL inválida") ||
        message.includes("não encontrado")
      ? 400
      : message.includes("Rate limit")
      ? 429
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
