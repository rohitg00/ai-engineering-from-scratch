---
name: claude-agent-scaffold
description: Crie um aplicativo Claude Agent SDK com subagentes, ganchos de ciclo de vida, armazenamento de sessão, anexo de servidor MCP e propagação de rastreamento W3C.
version: 1.0.0
phase: 14
lesson: 17
tags: [claude-agent-sdk, subagents, hooks, session-store, mcp]
---

Dado um domínio de produto e uma lista de servidores MCP, crie um aplicativo Claude Agent SDK.

Produzir:

1. Uma definição de agente principal com instruções, acesso a ferramentas integradas (read_file, write_file, shell, grep, glob, web fetch) e ferramentas de funções personalizadas.
2. Gerador de subagente para paralelização e isolamento de contexto. Use quando o orquestrador iria estourar seu orçamento de contexto.
3. Ganchos de ciclo de vida registrados: PreToolUse + PostToolUse para auditoria, SessionStart para configuração, SessionEnd para desmontagem, UserPromptSubmit para aplicação de regras (consulte padrões de fluxo de trabalho pró).
4. Armazenamento de sessão (padrão SQLite) com `list_subkeys` conectado para renderizar uma árvore de subagentes.
5. Anexação do servidor MCP para superfícies externas de ferramentas/recursos.
6. Propagação do contexto de rastreamento do W3C para que os trechos do OTel do chamador continuem através da CLI.

Rejeições difíceis:

- Gerar um subagente para uma tarefa de ferramenta única. Os subagentes são para paralelização ou isolamento de contexto; não para "uma chamada read_file".
- Ganchos com trabalho caro e síncrono. Os ganchos devem ser de microssegundos a milissegundos. O trabalho longo pertence a um subagente.
- Armazenamentos de sessões sem uma política de exclusão em cascata. Sessões de subagentes órfãos sobrecarregam o armazenamento.

Regras de recusa:

- Se o produto precisar de trabalho assíncrono de longa duração (horas a dias), recuse o SDK auto-hospedado e encaminhe para Claude Managed Agents.
- Se o usuário solicitar `--session-mirror` para um local compartilhado, recuse. As transcrições das sessões contêm PII; espelhar para armazenamento criptografado por usuário.
- Se o agente depender de streaming LLM bruto para UX sem uso de ferramenta, recuse o Agent SDK e recomende o Client SDK diretamente.

Saída: `agent.py`, `tools.py`, `hooks.py`, `session.py`, `README.md` explicando a política de subagente, registro de gancho, backend de sessão, anexos MCP e fiação OTel. Termine com "o que ler a seguir" apontando para a Lição 22 para transferências de voz, Lição 23 para atribuição de extensão OTel ou Lição 18 se o produto precisar de formato de tempo de execução de produção.