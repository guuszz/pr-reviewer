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

// Limite no diff enviado pro Claude pra controlar custo de tokens.
// ~50KB ≈ ~12k tokens de input, deixa folga pro system prompt + max_tokens.
const DIFF_MAX_BYTES = 50_000;

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
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const [prResp, diffResp, filesResp] = await Promise.all([
    fetch(baseUrl, { headers }),
    fetch(baseUrl, {
      headers: { ...headers, Accept: "application/vnd.github.diff" },
    }),
    fetch(`${baseUrl}/files?per_page=100`, { headers }),
  ]);

  if (prResp.status === 404) {
    throw new Error(
      "PR não encontrado. Verifique se a URL está correta e se o repositório é público.",
    );
  }
  if (prResp.status === 403) {
    const remaining = prResp.headers.get("x-ratelimit-remaining");
    const hint = remaining === "0"
      ? " Configure GITHUB_TOKEN no Vercel pra aumentar o limite de 60/h pra 5000/h."
      : "";
    throw new Error(`Rate limit do GitHub atingido.${hint}`);
  }
  if (!prResp.ok) {
    throw new Error(`GitHub respondeu ${prResp.status} ao buscar metadata do PR.`);
  }
  if (!diffResp.ok) {
    throw new Error(`GitHub respondeu ${diffResp.status} ao buscar o diff.`);
  }
  if (!filesResp.ok) {
    throw new Error(
      `GitHub respondeu ${filesResp.status} ao listar arquivos do PR.`,
    );
  }

  const meta = await prResp.json();
  const rawDiff = await diffResp.text();
  const filesJson: Array<{
    filename: string;
    additions: number;
    deletions: number;
  }> = await filesResp.json();

  const truncated = rawDiff.length > DIFF_MAX_BYTES;
  const diff = truncated ? rawDiff.slice(0, DIFF_MAX_BYTES) : rawDiff;

  return {
    title: meta.title,
    body: meta.body ?? "",
    diff,
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
