<h1 align="center">🔍 PR Reviewer</h1>

<p align="center">
  <b>Análise de Pull Requests do GitHub com IA — resumo, possíveis bugs e sugestões.</b><br/>
  <sub>AI-powered GitHub Pull Request review — summary, possible bugs, improvement suggestions.</sub>
</p>

<p align="center">
  <a href="https://pr-reviewer-guuszz.vercel.app"><b>🌐 Demo ao vivo</b></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Anthropic-Claude_Sonnet_4.6-D97757?style=flat-square&logo=anthropic&logoColor=white"/>
  <img src="https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white"/>
</p>

---

## 💡 Sobre · About

Cola a URL de um Pull Request público do GitHub. Recebe uma análise estruturada em português em 5 seções: resumo, complexidade & risco, possíveis bugs, sugestões de melhoria e pontos positivos.

> _Paste a public GitHub PR URL. Get a structured review in 5 sections: summary, complexity & risk, possible bugs, improvement suggestions, and positive notes._

## 🛠️ Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Anthropic SDK** (`claude-sonnet-4-6`) com prompt caching no system prompt
- **GitHub REST API** pra metadata + diff + lista de arquivos
- **In-memory cache** (1h TTL, SHA-256 da URL) pra evitar re-análise
- **react-markdown** + **remark-gfm** pra renderizar a saída
- Deploy: **Vercel**

## 🏗️ Arquitetura

```
POST /api/analyze {url}
  → parsePrUrl()         valida formato github.com/owner/repo/pull/N
  → getCached()          retorna se houver hit (1h TTL)
  → fetchPrData()        metadata + diff + arquivos em paralelo (GitHub REST)
  → analyzePr()          monta prompt, chama Claude com cache_control no system
  → setCached()          persiste resultado
  → response             markdown + prInfo + fromCache flag
```

## 🚀 Como rodar local

```bash
git clone https://github.com/guuszz/pr-reviewer.git
cd pr-reviewer
npm install

# copie e preencha
cp .env.example .env.local
# edite .env.local com sua ANTHROPIC_API_KEY

npm run dev
```

Acessa http://localhost:3000.

## 📋 Variáveis de ambiente

| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `ANTHROPIC_API_KEY` | ✅ | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `GITHUB_TOKEN` | ❌ | Sobe rate limit de 60/h pra 5000/h. Só precisa de scope `public_repo`. |

## 💰 Custo estimado

Por análise: ~$0.01-$0.03 com `claude-sonnet-4-6` ($3/$15 por 1M tokens). PRs grandes (diff truncado em 50KB) ficam dentro de ~12k tokens de input + 2k de output. Prompt caching no system prompt reduz ~80% do custo em chamadas subsequentes dentro de 5min.

## 🗺️ Roadmap

- [ ] Streaming da resposta (Server-Sent Events)
- [ ] Cache persistente (Upstash KV)
- [ ] Suporte a repos privados via GitHub App
- [ ] Análise de PRs em outras linguagens além de PT-BR
- [ ] Comparação de múltiplos PRs lado-a-lado

## 📝 Licença

MIT © [Gustavo Oliveira](https://github.com/guuszz)
