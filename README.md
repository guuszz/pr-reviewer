<h1 align="center">Security PR Reviewer</h1>

<p align="center">
  <strong>AppSec review for GitHub Pull Requests with deterministic rules, CWE/OWASP mapping and contextual AI analysis.</strong>
</p>

<p align="center">
  <a href="https://github.com/guuszz/pr-reviewer/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/guuszz/pr-reviewer/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="OWASP" src="https://img.shields.io/badge/OWASP-mapped-000000?logo=owasp">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/guuszz/pr-reviewer"></a>
</p>

## Visão geral

Cole a URL de um Pull Request público. O projeto busca o diff, examina **somente as linhas adicionadas**, apresenta achados reproduzíveis com `arquivo:linha` e envia esse contexto para uma segunda revisão com Gemini.

O resultado reúne:

- severidade e evidência do achado;
- regra acionada e localização exata;
- classificação **CWE** e **OWASP**;
- orientação de remediação;
- revisão contextual em streaming NDJSON;
- link compartilhável, quando Upstash Redis está configurado.

## Regras determinísticas

| Regra | Exemplo de risco | Referência |
|---|---|---|
| `SPR-001` | Credencial hardcoded | CWE-798 |
| `SPR-002` | AWS Access Key no diff | CWE-798 |
| `SPR-003` | Execução dinâmica com `eval` | CWE-95 |
| `SPR-004` | Interpolação em comando de shell | CWE-78 |
| `SPR-005` | Interpolação em consulta SQL | CWE-89 |
| `SPR-006` | Validação TLS desativada | CWE-295 |
| `SPR-007` | CORS com origem curinga | CWE-942 |
| `SPR-008` | Hash criptográfico fraco | CWE-328 |
| `SPR-009` | Token gerado com `Math.random` | CWE-330 |
| `SPR-010` | Dado sensível enviado ao log | CWE-532 |

O scanner ignora linhas removidas, metadados do patch e valores comuns de placeholder ou variáveis de ambiente para reduzir ruído.

## Arquitetura

```mermaid
flowchart LR
    A[URL do Pull Request] --> B[GitHub API]
    B --> C[Unified diff]
    C --> D[Deterministic security engine]
    D --> E[CWE / OWASP findings]
    C --> F[Gemini contextual review]
    E --> F
    E --> G[Next.js UI]
    F -->|NDJSON stream| G
    G --> H[(Upstash Redis)]
```

## Execução local

Requisitos: Node.js 22+ e uma chave do Google AI Studio.

```bash
git clone https://github.com/guuszz/pr-reviewer.git
cd pr-reviewer
npm ci
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000` e informe uma URL no formato:

```text
https://github.com/OWNER/REPOSITORY/pull/NUMBER
```

### Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---:|---|
| `GOOGLE_API_KEY` | sim | Revisão contextual com Gemini |
| `GITHUB_TOKEN` | não utilizado | Ignorado: acesso anônimo somente |
| `UPSTASH_REDIS_REST_URL` | não | Persistência de análises compartilhadas |
| `UPSTASH_REDIS_REST_TOKEN` | não | Autenticação do Redis |

## Qualidade e verificação

```bash
npm audit --audit-level=high
npm test
npm run typecheck
npm run build
```

A pipeline executa os mesmos quatro gates em cada Pull Request. Os testes unitários cobrem parsing de diff, linha original do achado, detecções principais, redução de falso positivo e resumo por severidade.

## Decisões técnicas

- **Determinístico antes da IA:** achados essenciais continuam verificáveis e testáveis.
- **Somente adições:** o reviewer não atribui ao PR uma vulnerabilidade que já foi removida.
- **NDJSON sobre POST:** permite enviar a URL no corpo e consumir a análise incrementalmente com `fetch`.
- **Cache por conteúdo:** SHA-256 do snapshot recebido e da versão de análise, não da URL. Cada requisição reconsulta o GitHub antes do cache.
- **Sem rate limiter da aplicação:** o cache não é um controle de abuso. Proteja deployments públicos com autenticação, quotas e limites no gateway antes de expor chamadas ao modelo.

## Limites e contrato

- O scanner determinístico recebe todo o diff aceito; respostas HTTP acima de **2.000.000 bytes decodificados** são interrompidas e rejeitadas, nunca aprovadas como análise parcial.
- Somente o contexto do modelo é cortado em **50.000 unidades UTF-16**. `truncated` descreve esse corte e é preservado no cache. Isso não é uma medida de tokens.
- A lista contextual de arquivos contém no máximo os primeiros 100 arquivos. Não há análise de arquivos binários nem do repositório inteiro.
- Metadata e diff vêm de requisições separadas: o hash identifica os dados recebidos, não uma leitura atomicamente vinculada a um commit Git. Mudanças durante a coleta podem produzir um snapshot transitório.
- Repositórios privados são excluídos: nenhum token GitHub é enviado e a metadata deve declarar `private: false`.
- JSON e NDJSON compartilham `prInfo`, `truncated`, `securityFindings`, `securitySummary`, `snapshotId` e `fromCache`. NDJSON envia o `shareId` no evento `done`, somente depois de persistir. Falha no Redis retorna `null`.
- Novos links usam a identidade do snapshot (64 hex); links antigos de 10 hex continuam legíveis. Redis usa primeira gravação por snapshot, com expiração de 30 dias; não é arquivo permanente. Uma nova geração do modelo pode diferir da primeira versão compartilhada.
- Conteúdo público não implica ausência de segredos: título, descrição, diff reduzido e achados seguem para o provedor do modelo. Redis armazena relatórios compartilhados quando configurado. Revise essa exposição antes do uso.

Testes de integração usam adaptadores locais para GitHub, modelo e compartilhamento: não fazem chamadas pagas. Veja [engineering notes](docs/review-engineering-notes.md).

## Roadmap

- [ ] saída SARIF para GitHub Code Scanning;
- [ ] GitHub App com comentários inline;
- [ ] integração opcional com Semgrep;
- [ ] quality gate configurável por severidade;
- [ ] exportação de achados para o RedReport.

## Uso responsável

Analise apenas Pull Requests que possam ser processados pelo serviço. Não inclua segredos em URLs, diffs, issues ou relatórios. Achados automatizados são um primeiro passe e devem receber validação humana antes de uma decisão de merge.

## Licença

[MIT](LICENSE)
