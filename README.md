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
  <img src="https://img.shields.io/badge/Google-Gemini_2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white"/>
  <img src="https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white"/>
  <a href="https://pr-reviewer-lemon.vercel.app"><img src="https://img.shields.io/github/deployments/guuszz/pr-reviewer/production?label=vercel&logo=vercel&style=flat-square" alt="Vercel deploy"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/guuszz/pr-reviewer?style=flat-square" alt="MIT License"/></a>
</p>

---

## 💡 Sobre · About

Cola a URL de um Pull Request público do GitHub. Recebe uma análise estruturada em português em 5 seções: resumo, complexidade & risco, possíveis bugs, sugestões de melhoria e pontos positivos.

> _Paste a public GitHub PR URL. Get a structured review in 5 sections: summary, complexity & risk, possible bugs, improvement suggestions, and positive notes._

## 🛠️ Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Google Generative AI SDK** (`gemini-2.5-flash`) com system instruction
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
  → analyzePr()          monta prompt, chama Gemini com system instruction
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
# edite .env.local com sua GOOGLE_API_KEY

npm run dev
```

Acessa http://localhost:3000.

## 📋 Variáveis de ambiente

| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `GOOGLE_API_KEY` | ✅ | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — grátis, login com conta Google. |
| `GITHUB_TOKEN` | ❌ | Sobe rate limit de 60/h pra 5000/h. Só precisa de scope `public_repo`. |

## 💰 Custo estimado

Gratuito dentro do free tier do Google AI Studio com `gemini-2.5-flash` (15 RPM, 1M tokens/dia, 1500 req/dia em maio/2026). PRs grandes (diff truncado em 50KB) ficam dentro de ~12k tokens de input + 2k de output, bem abaixo do limite de 1M tokens/minuto do modelo.

## 🗺️ Roadmap

- [ ] Streaming da resposta (Server-Sent Events)
- [ ] Cache persistente (Upstash KV)
- [ ] Suporte a repos privados via GitHub App
- [ ] Análise de PRs em outras linguagens além de PT-BR
- [ ] Comparação de múltiplos PRs lado-a-lado

## 📝 Licença

MIT © [Gustavo Oliveira](https://github.com/guuszz)
