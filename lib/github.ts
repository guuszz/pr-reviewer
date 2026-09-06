export interface ParsedPrUrl {
  owner: string;
  repo: string;
  number: number;
}

export interface PrData {
  title: string;
  body: string;
  diff: string;
  files: Array<{ filename: string; additions: number; deletions: number }>;
  truncated: boolean;
  html_url: string;
  state: string;
  user: { login: string };
}

// Limite no diff enviado pro Gemini pra controlar custo de tokens.
// Limite em unidades UTF-16, não em bytes ou tokens. O scanner recebe o diff completo aceito.
export const MODEL_DIFF_MAX_CHARS = 50_000;
export const RESPONSE_MAX_BYTES = 2_000_000;

const URL_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/i;

export function parsePrUrl(url: string): ParsedPrUrl {
  const m = url.trim().match(URL_RE);
  if (!m) {
    throw new Error(
      "URL inválida. Use o formato https://github.com/owner/repo/pull/123",
    );
  }
  return {
    owner: m[1],
    repo: m[2].replace(/\.git$/, ""),
    number: Number(m[3]),
  };
}

export async function fetchPrData(parsed: ParsedPrUrl): Promise<PrData> {
  const { owner, repo, number } = parsed;
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "pr-reviewer-app",
  };


  // Anonymous requests deliberately exclude tokens with private-repository access.
  const options = { headers, cache: "no-store" as const, redirect: "error" as const, signal: AbortSignal.timeout(15_000) };
  const prResp = await fetch(baseUrl, options);

  if (prResp.status === 404) {
    throw new Error(
      "PR não encontrado. Verifique se a URL está correta e se o repositório é público.",
    );
  }
  if (prResp.status === 403) {
    throw new Error("Rate limit ou acesso negado pela API pública do GitHub.");
  }
  if (!prResp.ok) {
    throw new Error(`GitHub respondeu ${prResp.status} ao buscar metadata do PR.`);
  }
  const meta = JSON.parse(await readBoundedText(prResp));
  if (meta.base?.repo?.private !== false) {
    throw new Error("A análise aceita somente repositórios explicitamente públicos.");
  }
  const [diffResp, filesResp] = await Promise.all([
    fetch(baseUrl, { ...options, headers: { ...headers, Accept: "application/vnd.github.diff" } }),
    fetch(`${baseUrl}/files?per_page=100`, options),
  ]);
  if (!diffResp.ok) {
    throw new Error(`GitHub respondeu ${diffResp.status} ao buscar o diff.`);
  }
  if (!filesResp.ok) {
    throw new Error(
      `GitHub respondeu ${filesResp.status} ao listar arquivos do PR.`,
    );
  }

  const rawDiff = await readBoundedText(diffResp);
  const filesJson: Array<{
    filename: string;
    additions: number;
    deletions: number;
  }> = JSON.parse(await readBoundedText(filesResp));

  const truncated = rawDiff.length > MODEL_DIFF_MAX_CHARS;


  return {
    title: meta.title,
    body: meta.body ?? "",
    diff: rawDiff,
    files: filesJson.map((f) => ({
      filename: f.filename,
      additions: f.additions,
      deletions: f.deletions,
    })),
    truncated,
    html_url: meta.html_url,
    state: meta.state,
    user: { login: meta.user.login },
  };
}

/** Bound decoded HTTP response bytes before buffering the full response. */
export async function readBoundedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > RESPONSE_MAX_BYTES) throw new Error("Resposta do GitHub excede o limite de 2 MB.");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
