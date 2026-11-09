# Capstone 16  GitHub Issue-to-PR Agente Autônomo

> Marque um problema, obtenha um PR  a forma do produto 2026 para agentes de codificação autônoma: execute um agente em uma caixa de areia em nuvem, verifique o teste passar, e publique um PR pronto para revisão com raciocínio. Agentes AWS Remote SWE, Agentes de Background Cursor, OpenAI Codex nuvem, e Google Jules todos enviam. As partes difíceis são reproduzir o ambiente de construção do repo automaticamente, evitando vazamento de credenciais, aplicando orçamentos por repo e garantindo que o agente não possa forçar. Esta pedra final constrói a versão auto-hospedada e compara-a em custo e taxa de passagem com as alternativas hospedadas.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App, agent scaffold), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Problemas

O agente de codificação em nuvem asynchrono é uma categoria de produto separada dos agentes de codificação interativa (capstone 01). O UX é um rótulo GitHub.`@agent fix this`O computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador de computador

Os desafios de engenharia são concretos: reprodução do ambiente (o agente tem que construir o repo a partir do zero sem uma imagem de desenvolvimento em cache), testes escassos (devem ser re-executados ou isolados), escopo de credenciais (um aplicativo GitHub com permissões mínimas de grãos finos), execução do orçamento por repo por dia e política de não empurro de força.

## Conceptos

O gatilho é um webhook GitHub (etiqueta de questão ou comentário de relações públicas). Um dispatcher encoura o trabalho para o ECS Fargate ou Lambda. O trabalhador puxa o repo para uma caixa de areia Daytona ou E2B com um Dockerfile genérico inferido do repo (linguagem, framework). O agente executa um mini-swe-agent ou SWE-agent v2 loop contra Claude Opus 4.7 ou GPT-5.4-Codex.

A verificação é a etapa de abertura. A CI completa deve passar na caixa de areia antes da abertura do PR. O delta de cobertura é calculado; se negativo além de um limiar, o PR abre-se mas é rotulado `needs-review`O agente publica a justificativa como a descrição de relações públicas mais um`@agent`O revisor pode pedir seguimento.

A segurança é avaliada através de duas superfícies diferentes do GitHub: a aplicação fornece um token de instalação de curta duração com `workflows: read`e conteúdos de repo / escopo de relações públicas estreitos; proteção de ramo (não permissões de aplicativo) impõe "não escreve diretamente para `main`" e "sem empurrar forçadamente"  o aplicativo nunca é adicionado à lista de desvio.`.github/workflows`O aplicativo não é um aplicativo primitivo do GitHub, por isso a lista de permisos do agente em edições de arquivos tem que impor isso ao trabalhador.

## Arquitetura

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## Estaca

- Trigger: Aplicação GitHub com token de grãos finos; receptor webhook através de Lambda ou Fly.io
- Trabalhador: tarefa ECS Fargate (ou GitHub Actions auto-hosted runner)
- Sandbox: Container de desenvolvimento Daytona ou sandbox E2B por tarefa
- Localização do agente: linha de base do agente mini-swe ou do agente SWE v2 sobre o código Claude Opus 4.7 / GPT-5.4-Codex
- Retorno: mapa de repo de árvore + ripgrep
- Verificação: IC completa na caixa de areia + porta delta de cobertura
- Observabilidade: Langfuse com arquivo de rastreamento por PR ligado a partir do organismo de PR
- Orçamento: limite máximo diário de dólar por repo; máximo de relações públicas por repo por dia

```figure
cf-issue-to-pr
```

## Construí-lo

1. **GitHub App.**Tokens de instalação de graus finos: problemas de leitura+escritura, pull_requests write, conteúdos de leitura+escritura, fluxos de trabalho de leitura.`main`"e "sem empurrão forçado"; o aplicativo não está na lista de desvio. O trabalhador impõe "não escreve sob`.github/workflows`" como uma lista de permitimentos de verificação da diferença proposta, já que as permissões do GitHub App não são percorrer.

2. **Webhook receiver.**Função Lambda aceita etiqueta de questão / comentários de relações públicas webhooks.`@agent fix this`- Enquestas para o SQS.

3. **Dispatcher.**Pops tarefas de SQS. Força por rep- por-dia orçamento. Spins uma tarefa de ECS Fargate com o repo URL, corpo de emissão, e uma caixa de areia Daytona fresca.

4. **Environment inference.**Detectar linguagem (Python, Node, Go, Rust) e gerenciador de pacotes (uv, pnpm, go mod, cargo). Gerar um arquivo docker em movimento se não existir.

5. **Agent loop.**Mini-swe-agent ou SWE-agent v2 com Claude Opus 4.7. Ferramentas: ripgrep, tree-sitter repo-map, read_file, edit_file, run_tests, git. Limites rígidos: $20 custo, 30 min de relógio de parede, 30 agentes giras.

6. **Verification.**Após a conclusão do ciclo, execute a suíte de teste completa na caixa de areia.`needs-review`- É o que é?

7. **PR posting.**Abra as relações públicas através da API GitHub com: título, raciocínio, resumo diferente, URL de rastreamento, custo, voltas.

8. **Credential hygiene.**O Worker funciona com um token de instalação de aplicativo GitHub de curta duração. Os registos são limpos para segredos antes de ser arquivados.

9. **Eval.**30 questões internas de dificuldade variada. Messa a taxa de aprovação, a qualidade de relações públicas (dimensão diferente, estilo, cobertura), custo, latência. Comparar com agentes de fundo cursor e agentes de AWS Remote SWE sobre os mesmos problemas.

## Usá-lo

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## Envia-o

`outputs/skill-issue-to-pr.md`Um funcionário em nuvem asynchronizada GitHub App + que transforma questões rotuladas em relações públicas prontas para revisão com custos limitados e credenciais de alcance.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $ and wall-clock per PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |
| **100** | | |

## Exercícios

1. Adicionar um modo de "ação de ensaio de fixação de escamas": o rótulo `@agent stabilize-flake TestX`Ele corre o teste 50 vezes na caixa de areia e propõe uma mudança mínima que o estabilize.

2. Comparar custos com agentes de fundo de cursor em três questões compartilhadas.

3. Implementar um painel de orçamento: custo por reposição por dia, custo por usuário.

4. Construir um modo "dry-run" que abra um projeto de relações públicas sem executar CI, para que os revisores possam examinar o plano barato.

5. Adicionar uma política de retenção: Os serviços de relações públicas com mais de 7 dias sem fusão são excluídos automaticamente.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | App with fine-grained permissions + short-lived installation token |
| Async cloud agent | "Background agent" | Non-interactive worker that runs in a cloud sandbox, not a terminal |
| Environment inference | "Dockerfile synthesis" | Detect language + package manager, generate a Dockerfile if absent |
| Verification | "CI-in-sandbox" | Run the full test suite inside the worker before opening a PR |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to agent branch |
| Per-repo budget | "Daily ceiling" | Dollar and PR-count cap enforced at the dispatcher |
| Rationale | "PR body explanation" | Agent's summary of what changed and why; required in the PR body |

## Mais leitura

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) a referência de agente de nuvem asíncrona canônica
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) Referência CLI
- [Cursor Background Agents](https://docs.cursor.com/background-agent) alternativa comercial
- [OpenAI Codex (cloud)](https://openai.com/codex) concorrente hospedado
- [Google Jules](https://jules.google) A versão hospedada do Google
- [Factory Droids](https://www.factory.ai) Referência comercial alternativa
- [GitHub App documentation](https://docs.github.com/en/apps) Identidade de bot de alcance
- [Daytona cloud sandboxes](https://daytona.io) caixa de areia de referência
