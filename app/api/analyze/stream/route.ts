import { NextRequest } from "next/server";
import { parsePrUrl, fetchPrData } from "@/lib/github";
import { analyzePrStream } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/cache";
import { isRedisConfigured, saveSharedReview, shortIdFromUrl } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streaming variant de /api/analyze.
 *
 * Protocolo: NDJSON (newline-delimited JSON). Cada linha é um evento:
 *   { "type": "meta", "prInfo": {...}, "truncated": bool, "fromCache": bool }
 *   { "type": "chunk", "text": "..." }       (vários, conforme Gemini gera)
 *   { "type": "done" }
 *   { "type": "error", "message": "..." }
 *
 * Em cache hit, manda o "meta" com fromCache:true + 1 único chunk com tudo +
 * done — same protocol, instant response.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.url !== "string" || !body.url.trim()) {
    return new Response(
      JSON.stringify({ error: "Forneça uma URL de PR do GitHub no campo `url`." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = body.url.trim();

  // Valida URL antes de fail fast
  let parsed;
  try {
    parsed = parsePrUrl(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "URL inválida";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Helper pra serializar eventos NDJSON
  const encoder = new TextEncoder();
  const event = (data: Record<string, unknown>) =>
    encoder.encode(JSON.stringify(data) + "\n");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. Cache lookup — responde instantaneamente se hit
        const cached = getCached(url);
        if (cached) {
          controller.enqueue(
            event({
              type: "meta",
              prInfo: cached.prInfo,
              fromCache: true,
              truncated: false,
              shareId: isRedisConfigured() ? shortIdFromUrl(url) : null,
            }),
          );
          controller.enqueue(event({ type: "chunk", text: cached.markdown }));
          controller.enqueue(event({ type: "done" }));
          controller.close();
          return;
        }

        // 2. Busca dados do PR
        const pr = await fetchPrData(parsed);

        const prInfo = {
          title: pr.title,
          url: pr.html_url,
          author: pr.user.login,
          state: pr.state,
        };

        // Manda meta antes do conteúdo — frontend pode renderizar header.
        // shareId é o ID estável (hash da URL) — frontend já pode mostrar
        // o link de share antes mesmo do conteúdo terminar de streaming
        const shareId = isRedisConfigured() ? shortIdFromUrl(url) : null;

        controller.enqueue(
          event({
            type: "meta",
            prInfo,
            fromCache: false,
            truncated: pr.truncated,
            shareId,
          }),
        );

        // 3. Stream do Gemini
        const generator = analyzePrStream({
          title: pr.title,
          body: pr.body,
          diff: pr.diff,
          files: pr.files,
          truncated: pr.truncated,
        });

        let fullText = "";
        for await (const chunk of generator) {
          fullText += chunk;
          controller.enqueue(event({ type: "chunk", text: chunk }));
        }

        // 4. Salva no cache in-memory pra próximas requests deste deploy
        if (fullText.trim()) {
          setCached(url, { markdown: fullText.trim(), prInfo });

          // 5. Persistente em Redis pra share URLs (best-effort — não bloqueia)
          if (isRedisConfigured()) {
            try {
              await saveSharedReview(url, {
                markdown: fullText.trim(),
                prInfo,
                truncated: pr.truncated,
              });
            } catch (e) {
              console.error("[share] erro ao salvar no Redis:", e);
              // Não propaga — share é nice-to-have
            }
          }
        }

        controller.enqueue(event({ type: "done" }));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido durante análise";
        controller.enqueue(event({ type: "error", message }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", // hint pra proxies não bufferizarem
    },
  });
}
