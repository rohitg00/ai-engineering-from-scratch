# Claude Agent SDK: Subagents e Session Store

> O Claude Agent SDK é a forma em biblioteca do harness do Claude Code. Tools built-in, subagents para isolamento de contexto, hooks, propagação de trace W3C, paridade de session store. Claude Managed Agents é a alternativa hospedada para trabalho assíncrono de longa duração.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 10 (Skill Libraries)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar a diferença entre o Client SDK da Anthropic (API cru) e o Claude Agent SDK (formato harness).
- Descrever subagents — paralelização e isolamento de contexto — e quando usá-los.
- Nomear a superfície do session store do Python SDK (`append`, `load`, `list_sessions`, `delete`, `list_subkeys`) e o papel do `--session-mirror`.
- Implementar um harness em stdlib com ferramentas built-in, spawning de subagent com contexto isolado, lifecycle hooks e session store.

## O Problema

Uma API cru de LLM te dá um round-trip. Um agente de precisa de execução de tools, servidores MCP, lifecycle hooks, spawning de subagent, persistência de sessão, propagação de trace. O Claude Agent SDK entrega esse formato como biblioteca — o mesmo harness que o Claude Code usa, exposto para agentes customizados.

## O Conceito

### Client SDK vs Agent SDK

- **Client SDK (`anthropic`).** Messages API cru. Você controla o loop, as tools, o estado.
- **Agent SDK (`claude-agent-sdk`).** Execução de ferramentas built-in, conexões MCP, hooks, spawning de subagent, session store. O loop do Claude Code como biblioteca.

### Tools built-in

O SDK traz 10+ ferramentas de fábrica: leitura/escrita de arquivo, shell, grep, glob, web fetch, e mais. Tools customizadas são registradas via a interface padrão de tool-schema.

### Subagents

Dois propósitos documentados pela Anthropic:

1. **Paralelização.** Rodar trabalho independente de forma concorrente. "Ache o arquivo de teste pra cada um desses 20 módulos" são 20 subagentes paralelos.
2. **Isolamento de contexto.** Subagents usam sua própria janela de contexto; só os resultados voltam pro orquestrador. O orçamento do orquestrador é preservado.

Adições recentes no Python SDK: `list_subagents()`, `get_subagent_messages()` pra ler transcrições de subagent.

### Session store

Paridade de protocolo com TypeScript:

- `append(session_id, message)` — adicionar um turn.
- `load(session_id)` — restaurar conversa.
- `list_sessions()` — enumerar.
- `delete(session_id)` — com cascade pra sessões de subagent.
- `list_subkeys(session_id)` — listar chaves de subagent.

`--session-mirror` (flag CLI) espelha a transcrição pra um arquivo externo durante o streaming, pra debug.

### Hooks

Lifecycle hooks que você pode registrar:

- `PreToolUse`, `PostToolUse` — filtrar ou auditar chamadas de tool.
- `SessionStart`, `SessionEnd` — setup e teardown.
- `UserPromptSubmit` — agir no input do usuário antes do modelo ver.
- `PreCompact` — rodar antes da compactação de contexto.
- `Stop` — cleanup na saída do agente.
- `Notification` — alertas por canal lateral.

Hooks são como sistemas como pro-workflow (referência do currículo Fase 14) e similares adicionam comportamentos transversais.

### W3C trace context

Spans OTel ativos no caller se propagam pro subprocesso CLI via headers W3C trace context. O trace multiprocesso inteiro aparece como um único trace no seu backend.

### Claude Managed Agents

A alternativa hospedada (header beta `managed-agents-2026-04-01`). Trabalho assíncrono de longa duração, prompt caching built-in, compactação built-in. Troque controle por infraestrutura gerenciada.

### Onde esse pattern dá errado

- **Subagent over-spawn.** Criar 100 subagentes pra 100 tarefas pequenas. Overhead domina. Faça batching.
- **Hook creep.** Cada time adiciona hooks; tempo de startup infla. Revise hooks trimestralmente.
- **Session bloat.** Sessões acumulam; tamanho cresça. Use `list_sessions` + política de expiração.

## Construa

`code/main.py` implementa o formato do SDK em stdlib:

- `Tool`, `ToolRegistry` com `read_file`, `write_file`, `list_dir` built-in.
- `Subagent` — contexto privado, execução isolada, resultados retornados.
- `SessionStore` — append, load, list, delete, list_subkeys.
- `Hooks` — `pre_tool_use`, `post_tool_use`, `session_start`, `session_end`.
- Uma demo: agente principal cria 3 subagentes em paralelo (cada um isolado), agrega resultados, persiste sessão.

Execute:

```
python3 code/main.py
```

O trace mostra isolamento de contexto dos subagentes (tamanho do contexto do orquestrador fica limitado), execução de hooks e persistência de sessão.

## Use

- **Claude Agent SDK** para produtos Claude-first que querem o formato harness do Claude Code.
- **Claude Managed Agents** pra trabalho assíncrono de longa duração hospedado.
- **OpenAI Agents SDK** (Aula 16) pra contrapartes OpenAI-first.
- **LangGraph + ferramentas customizadas** se você quer a máquina de estados em formato graf ao invés disso.

## Entregue

`outputs/skill-claude-agent-scaffold.md` monta um scaffold de app Claude Agent SDK com subagents, hooks, session store, anexo de MCP server e propagação de trace W3C.

## Exercícios

1. Adicione um spawner de subagent que agrupa 20 tarefas em grupos de 5 subagentes paralelos. Meça o tamanho do contexto do orquestrador vs um por tarefa.
2. Implemente um hook `PreToolUse` que faz rate-limit nas chamadas de `write_file` (5 por minuto por sessão). Trace o comportamento.
3. Conecte `list_subkeys` pra renderizar uma árvore de subagent. Como fica um nesting profundo?
4. Porte o toy pro pacote Python real `claude-agent-sdk`. O que muda no registro de tools?
5. Leia a documentação do Claude Managed Agents. Quando você migraria de self-hosted pra managed?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Agent SDK | "Claude Code como biblioteca" | Formato harness: tools, MCP, hooks, subagents, session store |
| Subagent | "Agente filho" | Contexto separado, orçamento próprio; resultados sobem |
| Session store | "DB de conversa" | Persistir, carregar, listar, deletar turns com cascade de subagent |
| Hook | "Callback de lifecycle" | Pre/post tool, session, prompt submit, compact, stop |
| W3C trace context | "Trace cross-process" | Span pai se propaga pro subprocesso CLI |
| Managed Agents | "Harness hospedado" | Trabalho assíncrono de longa duração hospedado pela Anthropic |
| `--session-mirror` | "Espelho de transcrição" | Escreve turns da sessão num arquivo externo durante o streaming |
| MCP server | "Superfície de tools" | Fonte externa de tool/recurso anexada ao agente |

## Leitura Complementar

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — a forma em biblioteca do Claude Code
- [Anthropic, Building agentes with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) — padrões de produção
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — alternativa hospedada
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — contraparte
