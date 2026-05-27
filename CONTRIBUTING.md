# Contribuindo

Obrigado pelo interesse! Aceito contribuições — issues, PRs ou ideias.

## 🐛 Reportando bugs

1. Abre uma [issue](../../issues) descrevendo:
   - O que você esperava que acontecesse
   - O que aconteceu de verdade
   - Passos pra reproduzir
   - Screenshot ou print do console se aplicável
2. Inclua versão do navegador / sistema se relevante

## 💡 Sugerindo features

Abre uma issue com label `enhancement`. Descreve:
- Qual problema essa feature resolve
- Esboço da solução proposta
- Alternativas que você considerou

## 🛠️ Submetendo Pull Requests

### Setup local

```bash
git clone https://github.com/guuszz/pr-reviewer.git
cd pr-reviewer
npm install
cp .env.example .env.local  # se existir
npm run dev
```

### Workflow

1. Fork o repo + cria branch a partir de `main`: `git checkout -b feat/minha-feature`
2. Faz suas mudanças com commits atômicos
3. Roda `npm run build` localmente — garante que não quebrou nada
4. Push pra sua fork: `git push origin feat/minha-feature`
5. Abre PR contra `main`, descrevendo:
   - O que mudou e por quê
   - Como testar
   - Screenshots se mudanças visuais

### Padrões de commit

Sigo [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` nova feature
- `fix:` correção de bug
- `chore:` mudança que não afeta código (deps, configs)
- `refactor:` refatoração sem mudança de comportamento
- `docs:` mudança de documentação
- `perf:` melhoria de performance
- `test:` adição/correção de testes

### Code style

- TypeScript strict mode habilitado — sem `any` se possível
- Prefer função/hook reutilizável em vez de duplicação
- Componentes pequenos e focados
- Mantenha o build verde

## 📝 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a MIT License do projeto.

---

Made with ❤️ in Vitória da Conquista, BA · [Gustavo Oliveira](https://github.com/guuszz)
