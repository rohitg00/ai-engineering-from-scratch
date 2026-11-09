# O Arnes como uma biblioteca  Subbagents e loja de sessões

> Um arnes que você pode importar: ferramentas incorporadas, subagentes para isolamento de contexto, ganchos, propagação de vestígios W3C, persistência de sessão. O Claude Agent SDK é o exemplo de referência  a forma de biblioteca do arnes Claude Code  e Claude Managed Agents é a alternativa hospedada para trabalho de sincronia de longa duração.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique a diferença entre o SDK do cliente antropico (API bruto) e o SDK do agente Claude (forma de arnes).
- Descrever os sub-gêneros  paralelação e isolamento de contexto  e quando alcançá-los.
- Nomear a superfície de armazenamento de sessão do Python SDK (`append`- Não .`load`- Não .`list_sessions`- Não .`delete`- Não .`list_subkeys`) e o papel de `--session-mirror`- Não .
- Implementar um arnes de stdlib com ferramentas incorporadas, desovação subagente com contexto isolado, ganchos do ciclo de vida e uma loja de sessões.

## O problema

Uma API LLM cru obtém uma viagem de ida e volta. Um agente de produção precisa de execução de ferramentas, servidores MCP, ganchos do ciclo de vida, reprodução subagente, persistência de sessão, propagação de vestígios. Claude Agent SDK envia esta forma como uma biblioteca  o mesmo arnes Claude Code usa, exposto para agentes personalizados.

## O conceito

### SDK do cliente vs SDK do agente

- **Client SDK (`anthropic`).**A API de mensagens brutas é tua, possues o circuito, as ferramentas, o estado.
- **Agent SDK (`claude-agent-sdk`).**Execução de ferramentas integradas, conexões MCP, ganchos, reprodução de subagentes, loja de sessões, o ciclo de código Claude como biblioteca.

### Ferramentas incorporadas

O SDK envia mais de 10 ferramentas fora da caixa: ler/escrever arquivos, shell, grep, glob, web fetch, etc. Ferramentas personalizadas registram-se através da interface padrão de esquema de ferramentas.

### Sub-gêneros

Dois propósitos documentados pela Anthropic:

1. **Parallelization.**Execute simultaneamente trabalhos independentes. "Encontre o arquivo de teste para cada um destes 20 módulos" é 20 tarefas paralelas.
2. **Context isolation.**Os subagentes usam sua própria janela de contexto; apenas os resultados retornam ao orquestrador.

Python SDK adições recentes: `list_subagents()`- Não .`get_subagent_messages()`para a leitura de transcrições de subagens.

### Loja de sessões

Paridade de protocolo com o TypeScript:

- `append(session_id, message)` adicionar um giro.
- `load(session_id)`- Restaurar a conversa.
- `list_sessions()` enumerar.
- `delete(session_id)` com sessões em cascata para subagentes.
- `list_subkeys(session_id)` lista de chaves subagentes.

`--session-mirror`(Bandera CLI) reflete a transcrição para um arquivo externo enquanto ele fluir, para depurar.

### Anéis

Anéis de ciclo de vida que podem ser registados:

- `PreToolUse`- Não .`PostToolUse` chamadas de porta ou de ferramenta de auditoria.
- `SessionStart`- Não .`SessionEnd`- Configurar e derrubar.
- `UserPromptSubmit` agir sobre a entrada do utilizador antes que o modelo a veja.
- `PreCompact` executar antes da compactação do contexto.
- `Stop`- Limpeza na saída do agente.
- `Notification` Alertas de canais laterais.

Os ganchos são como o pro-fluxo de trabalho (referência ao currículo da Fase 14) e sistemas semelhantes adicionam comportamento transversal.

### Contexto de rastreamento W3C

Os intervalos OTel ativos no chamador se propagam para o subprocesso CLI através de cabeçalhos de contexto de rastreamento W3C. Todo o rastreamento de múltiplos processos aparece como um rastreamento no seu backend.

### Claude gerenciava agentes

A alternativa hospedada (beta header `managed-agents-2026-04-01`O controlo comercial para infraestruturas gerenciadas.

### Onde este padrão vai mal

- **Subagent over-spawn.**Desembaraçar 100 subagentes para 100 tarefas pequenas.
- **Hook creep.**Cada equipa adiciona ganchos, balões de tempo de arranque, revisa os ganchos trimestralmente.
- **Session bloat.**As sessões acumulam-se, o tamanho aumenta.`list_sessions`+ Política de expiração.

```figure
ae-subagent-isolation
```

## Construí-lo

`code/main.py`Implementa a forma do SDK no stdlib:

- `Tool`- Não .`ToolRegistry`com incorporado`read_file`- Não .`write_file`- Não .`list_dir`- Não .
- `Subagent` contexto privado, execução isolada, resultados devolvidos.
- `SessionStore` apenda, carrega, lista, exclui, list_subkey.
- `Hooks`- Não .`pre_tool_use`- Não .`post_tool_use`- Não .`session_start`- Não .`session_end`- Não .
- Uma demonstração: o agente principal gera 3 sub-agentes em paralelo (cada um isolado), agrega resultados, persiste sessão.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra isolamento de contexto subagente (o tamanho do contexto do orquestrador permanece limitado), execução de gancho e persistência da sessão.

## Usá-lo

- **Claude Agent SDK**para produtos Claude-first que querem a forma do arnés Claude Code.
- **Claude Managed Agents**para trabalhos de sincronização de longa duração hospedados.
- **OpenAI Agents SDK**(Lessão 16) para as contrapartes OpenAI-primeiras.
- **LangGraph + custom tools**Se quiserem a máquina de estado em forma de gráfico em vez disso.

## Envia-o

`outputs/skill-claude-agent-scaffold.md`Estafa de um Claude Agent SDK app com subagens, ganchos, loja de sessões, MCP servidor anexo, e W3C rastreamento propagação.

## Exercícios

1. Adicione um deslizador de subbagentes que distribui 20 tarefas em grupos de 5 subbagentes paralelos.
2. Implementar um `PreToolUse`- O que é isso ?`write_file`As chamadas (5 por minuto por sessão).
3. - O fio .`list_subkeys`Como é o ninho profundo?
4. Leva o brinquedo para o real .`claude-agent-sdk`Pacote Python. Que mudanças no registro de ferramentas?
5. Quando é que passaria de auto-host para gerenciado?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | "Claude Code as a library" | Harness shape: tools, MCP, hooks, subagents, session store |
| Subagent | "Child agent" | Separate context, own budget; results bubble up |
| Session store | "Conversation DB" | Persist, load, list, delete turns with subagent cascade |
| Hook | "Lifecycle callback" | Pre/post tool, session, prompt submit, compact, stop |
| W3C trace context | "Cross-process trace" | Parent span propagates into CLI subprocess |
| Managed Agents | "Hosted harness" | Anthropic-hosted long-running async work |
| `--session-mirror` | "Transcript mirror" | Writes session turns to an external file as they stream |
| MCP server | "Tool surface" | External tool/resource source attached to the agent |

## Mais leitura

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) a forma de biblioteca do Código Claude
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) Padrões de produção
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) alternativa hospedada
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) contraparte
