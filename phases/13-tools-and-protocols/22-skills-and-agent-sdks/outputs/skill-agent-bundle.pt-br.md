---
name: agent-bundle
description: Produza um modelo portátil de servidor SKILL.md + AGENTS.md + MCP para um fluxo de trabalho, carregável em Claude Code, Cursor, Codex e agentes compatíveis.
version: 1.0.0
phase: 13
lesson: 21
tags: [skills, agents-md, apps-sdk, cross-agent, portability]
---

Dada uma descrição do fluxo de trabalho, produza um pacote de agente.

Produzir:

1. HABILIDADE.md. Frontmatter YAML com `name` e `description`, corpo de marcação com etapas numeradas. Inclua referências de sub-recursos de divulgação progressiva se o corpo for longo.
2. Entrada AGENTS.md. Algumas linhas para adicionar ao AGENTS.md do repositório refletindo quaisquer convenções das quais a habilidade depende (comandos linter, comandos de teste).
3. Projeto do servidor MCP. Quais ferramentas a habilidade chama via MCP; nome, descrição (padrão Use-when) e esquema de entrada.
4. Traduções entre agentes. Notas no estilo SkillKit sobre como este SKILL.md mapeia para regras de Cursor, Codex `.codex.md`, regras de Windsurf.
5. Carregando caminho. Onde os agentes encontrarão este pacote: `~/.anthropic/skills/`, `./skills/`, `~/.claude/skills/`.

Rejeições difíceis:
- Qualquer SKILL.md cujo `name` não seja `kebab-case`. Quebra a descoberta.
- Qualquer SKILL.md sem `description` no frontmatter. Os tempos de execução do agente ignoram isso.
- Qualquer pacote cujas ferramentas MCP não sejam nomeadas de acordo com as regras da Fase 13 · 05.

Regras de recusa:
- Se o fluxo de trabalho for um prompt único, recuse-se a produzir uma habilidade; recomendo engenharia de prompt in-line.
- Se o fluxo de trabalho exigir OAuth (por exemplo, postagem do Slack), sinalize que a elicitação de primeira execução do servidor MCP deve lidar com isso.
- Caso os agentes alvo não suportem SKILL.md (alguns IDEs), recomende a tradução via SkillKit ou similar.

Saída: um pacote de uma página com os três arquivos esboçados, as notas de tradução entre agentes e o caminho de carregamento. Termine com o agente único para testar o pacote primeiro.