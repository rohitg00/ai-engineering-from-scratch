# Skills e SDKs de Agent — Agent Skills da Anthropic, AGENTS.md, OpenAI Apps SDK

> MCP diz "quais ferramentas existem." Skills dizem "como executar uma tarefa." A stack de 2026 empilha os dois. Agent Skills da Anthropic (padrão aberto, dezembro 2025) saem como SKILL.md com disclosure progressivo. Apps SDK da OpenAI é MCP mais metadata de widget. AGENTS.md (agora em 60.000+ repos) fica na raiz do repo como contexto de agente a nível de projeto. Essa lição lista o que cada um cobre e constrói um bundle mínimo SKILL.md + AGENTS.md que viaja entre agentes.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, parser e loader de SKILL.md)
**Pré-requisitos:** Fase 13 · 07 (Servidor MCP)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Distinguir as três camadas: AGENTS.md (contexto do projeto), SKILL.md (know-how reutilizável), MCP (ferramentas).
- Escreva um SKILL.md com frontmatter YAML e disclosure progressivo.
- Carregue skills estilo filesystem num runtime de agente.
- Componha uma skill com um servidor MCP e um AGENTS.md pra que um único pacote funcione no Claude Code, Cursor e Codex.

## O Problema

Um engenheiro destila um workflow de escrita de release notes num prompt multi-step: "Read the latest merged PRs. Group by area. Summarize each. Write a changelog entry following the team's style. Post to Slack draft." Coloca num doc do Notion pro time.

Agora quer usar esse workflow do Claude Code, Cursor e Codex CLI. Cada agente tem uma forma diferente de carregar instruções: slash-commands do Claude Code, rules do Cursor, `.codex.md` do Codex. O engenheiro copia o workflow três vezes e mantém três cópias.

AGENTS.md e SKILL.md juntos corrigem isso:

- **AGENTS.md** fica na raiz do repo. Cada agente compatível lê na inicialização da sessão. "Como este projeto funciona? Quais são as convenções? Quais comandos rodam testes?"
- **SKILL.md** é um bundle portátil: frontmatter YAML (nome, descrição) + corpo markdown + recursos opcionais. Agentes que suportam skills carregam por nome sob demanda.
- **MCP** (Fase 13 · 06-14) lida com as ferramentas que a skill precisa invocar.

Três camadas, um artefato portátil.

## O Conceito

### AGENTS.md (agents.md)

Lançado no fim de 2025, adotado por 60.000+ repos até abril de 2026. Um arquivo na raiz do repo. Formato:

```markdown
# Project: my-service

## Conventions
- TypeScript with strict mode.
- Use Pydantic for models on the Python side.
- Tests run with `pnpm test`.

## Build and run
- `pnpm dev` for local dev server.
- `pnpm build` for production bundle.
```

Agentes leem isso na inicialização da sessão e usam pra calibrar seu comportamento pra aquele projeto. Todo agente de código em 2026 suporta AGENTS.md: Claude Code, Cursor, Codex, Copilot Workspace, opencode, Windsurf, Zed.

### Formato SKILL.md

Agent Skills da Anthropic (lançados como padrão aberto em dezembro 2025):

```markdown
---
name: release-notes-writer
description: Write a changelog entry for the latest merged PRs following this project's style.
---

# Release notes writer

When invoked, run these steps:

1. List PRs merged since the last tag. Use `gh pr list --base main --state merged`.
2. Group by label: feature, fix, chore, docs.
3. For each PR in each group, write one line: `- <title> (#<num>)`.
4. Draft the release notes and stage them in CHANGELOG.md.

If the user says "ship", run `git tag vX.Y.Z` and `gh release create`.

## Notes

- Never include commits without a PR.
- Skip "chore" entries from the public changelog.
```

Frontmatter declara a identidade da skill. O corpo é o prompt mostrado ao modelo quando a skill é carregada.

### Disclosure progressivo

Skills podem referenciar sub-recursos que o agente busca só quando necessário. Exemplo:

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.md diz "see style-guide.md for the style rules." O agente puxa style-guide.md só quando a skill está ativamente rodando. Isso evita inflar o prompt com detalhes que o modelo pode não precisar.

### Descoberta por filesystem

Runtimes de agente escaneiam diretórios conhecidos buscando arquivos SKILL.md:

- `~/.anthropic/skills/*/SKILL.md`
- Projeto `./skills/*/SKILL.md`
- `~/.claude/skills/*/SKILL.md`

Carregamento é por nome de pasta e `name` do frontmatter. Claude Code, Anthropic Claude Agent SDK e SkillKit (cross-agent) todos seguem esse padrão.

### Claude Agent SDK da Anthropic

`@anthropic-ai/claude-agent-sdk` (TypeScript) e `claude-agent-sdk` (Python) carregam skills na inicialização da sessão, as expõem como "agentes" chamáveis dentro do runtime. O agente loop despacha pra uma skill quando o usuário a invoca.

### OpenAI Apps SDK

Lançado em outubro de 2025; construído diretamente sobre MCP. Unifica Connectors e Custom GPT Actions anteriores da OpenAI numa única superfície de desenvolvedor. Uma app do Apps SDK é:

- Um servidor MCP (ferramentas, recursos, prompts).
- Mais metadata de widget pra UI do ChatGPT.
- Mais um recurso MCP Apps `ui://` opcional pra superfícies interativas.

Mesmo protocolo, UX mais rico.

### Portabilidade cross-agent via SkillKit

Ferramentas como SkillKit e camadas de distribuição cross-agent similares traduzem um único SKILL.md pro formato nativo de 32+ agentes de IA (Claude Code, Cursor, Codex, Gemini CLI, OpenCode, etc.). Uma fonte de verdade; muitos consumidores.

### A stack de três camadas

| Camada | Arquivo | Carregado quando | Propósito |
|-------|------|-------------|---------|
| AGENTS.md | raiz do repo | inicialização da sessão | convenções do projeto |
| SKILL.md | diretório de skills | skill invocada | workflow reutilizável |
| Servidor MCP | processo externo | ferramentas necessárias | ações chamáveis |

Os três compõem: o agente lê AGENTS.md na inicialização da sessão, o usuário invoca uma skill, as instruções da skill incluem chamadas de ferramenta MCP, o agente despacha via um cliente MCP.

## Usar

`code/main.py` disponibiliza um parser e loader de SKILL.md com stdlib. Ele descobre skills sob `./skills/`, parseia o frontmatter YAML mais corpo markdown e produz um dict indexado por nome da skill. Depois simula um agente loop que invoca `release-notes-writer` por nome.

O que observar:

- Frontmatter YAML parseado com um parser stdlib mínimo (sem dependência de `pyyaml`).
- Corpo da skill armazenado verbatim; agente antepõe ao system prompt na invocação.
- Disclosure progressivo demonstrado via função `read_subresource` que puxa arquivos referenciados sob demanda.

## Entregar

Essa lição produz `outputs/skill-agent-bundle.md`. Dado um workflow, a skill produz o bundle combinado SKILL.md + AGENTS.md + blueprint de servidor MCP, portátil entre agentes.

## Exercícios

1. Rode `code/main.py`. Adicione uma segunda skill sob `skills/` e confirme que o loader a pega.

2. Escreva um AGENTS.md pra este repo do curso. Inclua comandos de teste, convenções de estilo e o modelo mental da Fase 13.

3. Porte um workflow multi-step da documentação interna do seu time pra um SKILL.md. Verifique que carrega no Claude Code.

4. Traduza a skill pros formatos de rules nativos do Cursor e Codex à mão. Conte a diferença entre formatos — essa é a superfície de tradução que o SkillKit automatiza.

5. Leia o blog post de Agent Skills da Anthropic. Identifique uma funcionalidade no Claude Agent SDK que o loader desta lição não cobre. (Dica: sub-invocação de agent.)

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|----------------|------------------------|
| SKILL.md | "O arquivo de skill" | Frontmatter YAML mais corpo markdown, carregado pelo runtime do agente |
| AGENTS.md | "Contexto de agente na raiz do repo" | Arquivo de convenções a nível de projeto lido na inicialização da sessão |
| Disclosure progressivo | "Lazy-load de sub-recursos" | Corpo da skill referencia arquivos puxados só quando necessários |
| Frontmatter | "Bloco YAML no topo" | Metadados (nome, descrição) em delimitadores `---` |
| Claude Agent SDK | "Runtime de skill da Anthropic" | `@anthropic-ai/claude-agent-sdk`, carrega skills e roteia |
| OpenAI Apps SDK | "MCP + metadata de widget" | Superfície de dev da OpenAI construída sobre MCP mais hooks da UI do ChatGPT |
| Descoberta de skill | "Scan de filesystem" | Percorre diretórios conhecidos buscando SKILL.md, indexa por nome |
| Portabilidade cross-agent | "Uma skill muitos agentes" | Traduz um SKILL.md pra 32+ agentes via ferramentas estilo SkillKit |
| Agent Skill | "Know-how portátil" | Template de tarefa reutilizável fora do conceito de ferramenta do MCP |
| Apps SDK | "MCP mais UI do ChatGPT" | Connectors e Custom GPTs unificados no MCP |

## Leitura Complementar

- [Anthropic — Agent Skills announcement](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — lançamento de dezembro 2025
- [Anthropic — Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — referência do formato SKILL.md
- [OpenAI — Apps SDK](https://developers.openai.com/apps-sdk) — plataforma de desenvolvedor baseada em MCP pra ChatGPT
- [agents.md](https://agents.md/) — formato AGENTS.md e lista de adoção
- [Anthropic — anthropics/skills GitHub](https://github.com/anthropics/skills) — exemplos oficiais de skills
