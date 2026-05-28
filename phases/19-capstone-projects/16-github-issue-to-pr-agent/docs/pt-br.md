# Capstone 16 — Agent Autônomo de Issue para PR no GitHub

> Remote SWE Agents da AWS, Background Agents do Cursor, Codex cloud da OpenAI e Jules da Google todos lançam a mesma forma de produto de 2026: rotule uma issue, ganhe um PR. Rode um agente num sandbox em nuvem, verifique se os testes passam e publique um PR pronto para revisão com justificativa. As partes difíceis são reproduzir o ambiente de build do repo automaticamente, impedir vazamento de credenciais, aplicar orçamentos por repo e garantir que o agente não consegue force-push. Este capstone constrói a versão auto-hospedada e compara custo e taxa de pass com as alternativas hospedadas.

**Tipo:** Capstone
**Linguagens:** Python (agent), TypeScript (GitHub App), YAML (Actions)
**Pré-requisitos:** Fase 11 (engenharia de LLM), Fase 13 (ferramentas), Fase 14 (agents), Fase 15 (autônomo), Fase 17 (infraestrutura)
**Fases exercitadas:** P11 · P13 · P14 · P15 · P17
**Tempo:** 30 horas

## Problema

O agente de programação assíncrono em nuvem é uma categoria de produto separada dos agentes de programação interativos (capstone 01). A UX é um label no GitHub. Você rotula uma issue `@agent fix this`, um worker sobe num sandbox em nuvem, clona o repo, roda testes, edita arquivos, verifica e abre um PR com a justificativa do agente no corpo. Sem loop interativo, sem terminal. Remote SWE Agents da AWS, Background Agents do Cursor, Codex cloud da OpenAI, Jules da Google e Factory Droids convergem nisso.

Os desafios de engenharia são concretos: reprodução de ambiente (o agente tem que buildar o repo do zero sem imagem de dev em cache), testes flaky (devem ser re-rodados ou isolados), escopo de credenciais (um GitHub App com permissões refinadas mínimas), aplicação de orçamento por repo por dia e política de não-force-push. O capstone mede taxa de pass, custo e segurança vs as alternativas hospedadas.

## Conceito

O gatilho é um webhook do GitHub (label de issue ou comentário em PR). Um despachante enfileira trabalho em ECS Fargate ou Lambda. O worker puxa o repo para um sandbox Daytona ou E2B com um Dockerfile genérico inferido do repo (linguagem, framework). O agente roda um loop mini-swe-agent ou SWE-agent v2 contra Claude Opus 4.7 ou GPT-5.4-Codex. Ele itera: ler código, propor correção, aplicar patch, rodar testes.

Verificação é o passo de controle. CI completo deve passar no sandbox antes do PR abrir. Delta de cobertura é computado; se negativo além de um limiar, o PR abre mas recebe a label `needs-review`. O agente publica a justificativa como descrição do PR mais uma thread `@agent` que o revisor pode mencionar para follow-ups.

Segurança é escopada através de duas superfícies diferentes do GitHub: o App fornece um token de instalação de curta duração com `workflows: read` e escopos estreitos de conteúdo/PR do repo; proteção de branch (não permissões de app) aplica "sem escritas diretas em `main`" e "sem force-push" — o app nunca é adicionado à lista de bypass. Acesso somente-leitura escopado por caminho a `.github/workflows` não é uma primitiva real de GitHub App, então a lista de permissões do agente em edições de arquivo tem que aplicar isso no worker. Limites de orçamento por repo por dia são aplicados no despachante (ex.: máximo 5 PRs por repo por dia, $20 por PR).

## Arquitetura

```
issue do GitHub rotulada `@agent fix` ou comentário em PR
            |
            v
    webhook do GitHub App -> despachante AWS Lambda
            |
            v
    tarefa ECS Fargate (ou runner auto-hospedado GitHub Actions)
       - puxar repo
       - inferir Dockerfile (linguagem, gerenciador de pacotes)
       - sandbox Daytona / E2B com runtime alvo
       - clone -> git worktree -> branch do agent
            |
            v
    loop mini-swe-agent / SWE-agent v2
       Claude Opus 4.7 ou GPT-5.4-Codex
       ferramentas: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verificar CI passa no-sandbox + verificação de delta de cobertura
            |
            v (verificado)
    git push + abrir PR via GitHub App
       corpo do PR = justificativa + resumo do diff + URL de trace
       label: needs-review
            |
            v
    operador revisa; pode @-mencionar o agente para follow-ups
```

## Stack

- Gatilho: GitHub App com token refinado; receptor de webhook via Lambda ou Fly.io
- Worker: tarefa ECS Fargate (ou runner auto-hospedado GitHub Actions)
- Sandbox: devcontainer Daytona ou sandbox E2B por tarefa
- Loop do agent: baseline mini-swe-agent ou SWE-agent v2 sobre Claude Opus 4.7 / GPT-5.4-Codex
- Recuperação: repo-map tree-sitter + ripgrep
- Verificação: CI completo no-sandbox + gate de delta de cobertura
- Observabilidade: Langfuse com arquivo de trace por PR vinculado do corpo do PR
- Orçamento: teto diário em dólares por repo; máximo de PRs por repo por dia

## Construa

1. **GitHub App.** Token de instalação refinado: issues read+write, pull_requests write, contents read+write, workflows read. Proteção de branch (a única superfície que pode fazer isso) aplica "sem push direto em `main`" e "sem force-push"; o app não está na lista de bypass. O worker aplica "sem escritas em `.github/workflows`" como verificação de lista de permissão no diff proposto, já que permissões de GitHub App não são escopadas por caminho.

2. **Receptor de webhook.** Função Lambda aceita webhooks de label de issue / comentário em PR. Filtra pela label `@agent fix this`. Enfileira no SQS.

3. **Despachante.** Desempacota tarefas do SQS. Aplica orçamento por repo por dia. Sobe uma tarefa ECS Fargate com a URL do repo, o corpo da issue e um novo sandbox Daytona.

4. **Inferência de ambiente.** Detecta linguagem (Python, Node, Go, Rust) e gerenciador de pacotes (uv, pnpm, go mod, cargo). Gera um Dockerfile on-the-fly se não existir.

5. **Loop do agent.** mini-swe-agent ou SWE-agent v2 com Claude Opus 4.7. Ferramentas: ripgrep, repo-map tree-sitter, read_file, edit_file, run_tests, git. Limites rígidos: $20 de custo, 30 min de relógio, 30 turnos do agent.

6. **Verificação.** Após o loop concluir, rode a suíte completa de testes no-sandbox. Compute delta de cobertura via jacoco / coverage.py. Se CI vermelho: pausar, não abrir PR. Se cobertura cair mais de 2%: abrir PR com label `needs-review`.

7. **Publicação de PR.** Faça push da branch do agent. Abra PR via API do GitHub com: título, justificativa, resumo do diff, URL de trace, custo, turnos.

8. **Higiene de credenciais.** Worker roda com um token de instalação de GitHub App de curta duração. Logs são limpos de segredos antes do arquivo.

9. **Avaliação.** 30 issues internas com sementes de dificuldade variada. Meça taxa de pass, qualidade do PR (tamanho do diff, estilo, cobertura), custo, latência. Compare com Background Agents do Cursor e Remote SWE Agents da AWS nas mesmas issues.

## Use

```
# no github.com
  - usuário rotula issue #842 com `@agent fix this`
  - PR #1903 aparece 14 minutos depois
  - corpo:
    > Corrigido NPE em widget.dedupe() causado por entrada de comparador nula.
    > Adicionado teste de regressão widget_test.go::TestDedupeNullComparator.
    > Delta de cobertura: +0.12%
    > Turnos: 7  Custo: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## Entregue

`outputs/skill-issue-to-pr.md` é a entrega. Um GitHub App + worker assíncrono em nuvem que transforma issues rotuladas em PRs prontos para revisão com custo limitado e credenciais escopadas.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Taxa de pass em 30 issues | Sucesso ponta a ponta (CI verde + cobertura OK) |
| 20 | Qualidade do PR | Tamanho do diff, delta de cobertura, conformidade de estilo |
| 20 | Custo e latência por issue resolvida | $ e tempo de parede por PR |
| 20 | Segurança | Token escopado, orçamento por repo, sem force-push, higiene de credenciais |
| 15 | UX do operador | Comentários de justificativa, possibilidade de retry, follow-up por @-menção |
| **100** | | |

## Exercícios

1. Adicione um modo "corrigir teste flaky": a label `@agent stabilize-flake TestX` roda o teste 50 vezes no-sandbox e propõe uma mudança mínima que o estabiliza.

2. Compare custo vs Background Agents do Cursor em três issues compartilhadas. Relate quais ferramentas ganham onde.

3. Implemente um painel de orçamento: custo por repo por dia, custo por usuário. Alerta em anomalia.

4. Construa um modo "dry-run" que abre um PR draft sem rodar CI, para que revisores examinem o plano barato.

5. Adicione uma política de retenção: branches de PR com mais de 7 dias sem merge são deletadas automaticamente.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| GitHub App | "Identidade de bot escopada" | App com permissões refinadas + token de instalação de curta duração |
| Agent assíncrono em nuvem | "Agent em background" | Worker não-interativo que roda num sandbox em nuvem, não num terminal |
| Inferência de ambiente | "Síntese de Dockerfile" | Detectar linguagem + gerenciador de pacotes, gerar Dockerfile se ausente |
| Verificação | "CI-no-sandbox" | Rodar a suíte completa de testes dentro do worker antes de abrir um PR |
| Delta de cobertura | "Preservação de cobertura" | Mudança na % de cobertura de testes do base para a branch do agente |
| Orçamento por repo | "Teto diário" | Limite em dólares e contagem de PRs aplicado no despachante |
| Justificativa | "Explicação do corpo do PR" | Resumo do agente do que mudou e por quê; obrigatório no corpo do PR |

## Leitura Complementar

- [Remote SWE Agents da AWS](https://github.com/aws-samples/remote-swe-agents) — referência de agente assíncrono em nuvem canônica
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — referência CLI
- [Background Agents do Cursor](https://docs.cursor.com/background-agent) — alternativa comercial
- [OpenAI Codex (cloud)](https://openai.com/codex) — concorrente hospedado
- [Google Jules](https://jules.google) — versão hospedada do Google
- [Factory Droids](https://www.factory.ai) — referência comercial alternativa
- [Documentação GitHub App](https://docs.github.com/en/apps) — identidade de bot escopada
- [Sandboxes em nuvem Daytona](https://daytona.io) — sandbox de referência
