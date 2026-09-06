import { createHash } from "node:crypto";
import { fetchPrData, parsePrUrl, MODEL_DIFF_MAX_CHARS, type PrData } from "./github";
import { getCached, setCached, type CachedAnalysis } from "./cache";
import { scanSecurityDiff, summarizeSecurity } from "./security";
import type { PrAnalysisInput } from "./gemini";

export interface ReviewDependencies {
  fetchPr: typeof fetchPrData;
  analyze: (input: PrAnalysisInput) => Promise<string>;
  stream: (input: PrAnalysisInput) => AsyncIterable<string>;
  share: (snapshotId: string, review: CachedAnalysis) => Promise<string | null>;
  engineVersion: string;
}

export function snapshotId(pr: PrData, engineVersion: string): string {
  // Preserve diff case/whitespace: these are semantically significant.
  return createHash("sha256").update(JSON.stringify([engineVersion, pr])).digest("hex");
}

/** Both HTTP transports use this implementation; tests inject offline adapters. */
export function createReviewHandlers(deps: ReviewDependencies) {
  async function prepare(req: Request) {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.url !== "string") throw new Error("URL inválida: informe o campo url.");
    // Fetch before lookup: the same PR URL can represent different content.
    const pr = await deps.fetchPr(parsePrUrl(body.url));
    const id = snapshotId(pr, deps.engineVersion);
    const cached = getCached(id);
    const securityFindings = cached?.securityFindings ?? scanSecurityDiff(pr.diff);
    const metadata = {
      prInfo: { title: pr.title, url: pr.html_url, author: pr.user.login, state: pr.state },
      truncated: pr.truncated,
      securityFindings,
      securitySummary: cached?.securitySummary ?? summarizeSecurity(securityFindings),
    };
    const input = { ...pr, diff: pr.diff.slice(0, MODEL_DIFF_MAX_CHARS), securityFindings };
    return { id, cached, metadata, input };
  }
  async function save(id: string, review: CachedAnalysis) {
    if (!review.markdown.trim()) throw new Error("Modelo retornou resposta vazia.");
    setCached(id, review);
    try { return await deps.share(id, review); }
    catch { return null; } // Sharing is best effort; never advertise an unsaved link.
  }
  function errorResponse(err: unknown) {
    const error = err instanceof Error ? err.message : "Erro na análise";
    const status = error.includes("URL inválida") ? 400 : error.includes("Rate limit") ? 429 : 502;
    return Response.json({ error }, { status });
  }
  return {
    async json(req: Request): Promise<Response> {
      try {
        const { id, cached, metadata, input } = await prepare(req);
        const markdown = cached?.markdown ?? await deps.analyze(input);
        const review = { ...metadata, markdown };
        const shareId = await save(id, review);
        return Response.json({ ...review, snapshotId: id, fromCache: !!cached, shareId });
      } catch (err) { return errorResponse(err); }
    },
    async ndjson(req: Request): Promise<Response> {
      // Input/GitHub failures retain HTTP error status, rather than a misleading 200.
      let prepared;
      try { prepared = await prepare(req); }
      catch (err) { return errorResponse(err); }
      const { id, cached, metadata, input } = prepared;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (value: object) => controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
          try {
            emit({ type: "meta", ...metadata, snapshotId: id, fromCache: !!cached, shareId: null });
            let markdown = "";
            if (cached) {
              markdown = cached.markdown;
              emit({ type: "chunk", text: markdown });
            } else {
              for await (const chunk of deps.stream(input)) {
                markdown += chunk;
                emit({ type: "chunk", text: chunk });
              }
            }
            const shareId = await save(id, { ...metadata, markdown });
            emit({ type: "done", shareId });
          } catch (err) {
            emit({ type: "error", message: err instanceof Error ? err.message : "Erro na análise" });
          } finally { controller.close(); }
        },
      });
      return new Response(stream, { headers: {
        "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
      } });
    },
  };
}
