# Tasks Assíncronas (SEP-1686) — Chamar Agora, Buscar Depois pra Trabalho de Longa Duração

> Trabalho real de agente leva minutos a horas: CI runs, síntese de pesquisa profunda, exports em lote. Chamadas de ferramenta síncronas caem conexões, estouram timeout ou bloqueiam a UI. SEP-1686, incorporado em 2025-11-25, adiciona a primitiva Tasks: qualquer request pode ser aumentada pra virar uma task, e o resultado pode ser buscado depois ou transmitido via notificações de estado. Nota de risco de deriva: Tasks são experimentais até H1 2026; superfície de SDK ainda está sendo projetada ao redor da eespecificaçãoificação.

**Tipo:** Construir
**Linguagens:** Python (stdlib, máquina de estados de task assíncrona)
**Pré-requisitos:** Fase 13 · 07 (servidor MCP), Fase 13 · 09 (transportes)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Identificar quando promover uma ferramenta de síncrona pra task aumentada (>30 segundos de trabalho no servidor).
- Caminhar pelo ciclo de vida da task: `working` → `input_required` → `completed` / `failed` / `cancelled`.
- Persistir estado da task pra que crashes não percam trabalho em andamento.
- Fazer polling de `tasks/status` e buscar `tasks/result` corretamente.

## O Problema

Uma ferramenta `generate_report` roda um pipeline de extração que leva vários minutos. Opções sob o modelo síncrono:

1. Manter a conexão aberta por três minutos. Transportes remotos caem; clientes estouram timeout; UIs congelam.
2. Retornar imediatamente com um placeholder; exigir que o cliente faça polling num endpoint custom. Quebra a uniformidade do MCP.
3. Disparar e esquecer; sem resultado.

Nenhuma é boa. SEP-1686 adiciona uma quarta: aumento de task. Qualquer request (tipicamente `tools/call`) pode ser marcado como task. O servidor retorna um id de task imediatamente. O cliente faz polling em `tasks/status` e busca `tasks/result` quando pronto. Estado do lado do servidor sobrevive a reinícios.

## O Conceito

### Aumento de task

Um request vira uma task definindo `params._meta.task.required: true` (ou `optional: true`, servidor decide). O servidor responde imediatamente com:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "_meta": {
      "task": {
        "id": "tsk_9f7b...",
        "state": "working",
        "ttl": 900000
      }
    }
  }
}
```

`ttl` é a promessa do servidor de manter o estado; após ttl o resultado da task é descartado.

### Opt-in por ferramenta

Anotações de ferramenta podem declarar suporte a task:

- `taskSupport: "forbidden"` — esta ferramenta sempre roda síncrona. Seguro pra ferramentas rápidas.
- `taskSupport: "optional"` — cliente pode solicitar aumento de task.
- `taskSupport: "required"` — cliente DEVE usar aumento de task.

Uma ferramenta `generate_report` seria `required`. Uma `notes_search` seria `forbidden`.

### Estados

```
working  -> input_required -> working  (loop via elicitation)
working  -> completed
working  -> failed
working  -> cancelled
```

Máquina de estados é append-only: uma vez `completed`, `failed` ou `cancelled`, a task é terminal.

### Métodos

- `tasks/status {taskId}` — retorna estado atual e dica de progresso.
- `tasks/result {taskId}` — bloqueia ou retorna 404 se ainda não pronto.
- `tasks/cancel {taskId}` — idempotente; estados terminais ignoram.
- `tasks/list` — opcional; enumera tasks ativas e recentemente completadas.

### Streaming de mudanças de estado

Quando o servidor suporta, o cliente pode se inscrever em notificações de estado:

```
server -> notifications/tasks/updated {taskId, state, progress?}
```

Clientes que fazem streaming em vez de polling ganham melhor UX. Polling sempre é suportado como superfície mínima.

### Estado durável

A eespecificaçãoificação requer que servidores que declaram suporte a task persistam estado. Um crash não deve perder resultados completados dentro do ttl. Stores vão de SQLite a Redis ao sistema de arquivos. O harness da Aula 13 usa o sistema de arquivos.

### Semântica de cancelamento

`tasks/cancel` é idempotente. Se a task está em execução, o servidor tenta parar (verifique cancelamento cooperativo do executor). Se já terminal, a request é um no-op.

### Recuperação de crash

Quando o processo do servidor reinicia:

1. Carrega todos os estados de task persistidos.
2. Marca qualquer task `working` cujo processo morreu como `failed` com erro `CRASH_RECOVERY`.
3. Preserva `completed` / `failed` / `cancelled` por seu ttl.

### Tasks assíncronas mais sampling

Uma task pode em si chamar `sampling/createMessage`. É assim que funcionam tasks de pesquisa de longa duração: a thread de task do servidor faz sample do modelo do cliente conforme necessário, enquanto a UI do cliente mostra a task como `working` com atualizações periódicas de progresso.

### Por que isso é experimental

SEP-1686 saiu na 2025-11-25 mas o roadmap mais amplo aponta três questões abertas: primitivas de assinatura duráveis, subtarefas (relações pai-filho de task) e padronização de TTL de resultado. Espere a eespecificaçãoificação evoluir ao longo de 2026. Código de produção deve tratar Tasks como estável só pro caso comum e se prevenir contra mudanças futuras de SDK pra subtarefas.

## Use

`code/main.py` implementa um store de tasks durável (backed por sistema de arquivos) e uma ferramenta `generate_report` que roda numa thread de background. Clientes chamam a ferramenta, recebem um id de task imediatamente, fazem polling em `tasks/status` enquanto o worker atualiza progresso, e buscam `tasks/result` quando pronto. Cancelamento funciona; recuperação de crash é simulada matando a thread do worker e recarregando estado.

O que conferir:

- JSON de estado da task persistido em `/tmp/lesson-13-tasks/<id>.json`.
- Thread de worker atualiza o campo `progress`; polling mostra avanço.
- Cancelamento do lado do cliente seta um evento; worker verifica e sai antes.
- Recarga de estado em "crash" marca a task em andamento como `failed` com `CRASH_RECOVERY`.

## Entregue

Esta aula produz `outputs/skill-task-store-designer.md`. Dada uma ferramenta de longa duração (pesquisa, build, export), a skill projeta o store de tasks (forma do estado, ttl, durabilidade), escolhe a flag `taskSupport` correta e esboça notificações de progresso.

## Exercícios

1. Rode `code/main.py`. Dispare uma task `generate_report`, faça polling no status, depois busque o resultado.

2. Adicione uma chamada `tasks/cancel` no meio da execução. Verifique que o worker honra e o estado vira `cancelled`.

3. Simule recuperação de crash: mate a thread do worker, reinicie o loader e observe o modo de falha `CRASH_RECOVERY`.

4. Estenda o store pra SQLite. Ganhos de durabilidade são os mesmos; opções de consulta abrem (listar todas tasks da sessão X).

5. Leia o post do roadmap do MCP pra 2026. Identifique a questão aberta mais provável de afetar o design de APIs de SDK no próximo ano relacionada a Tasks.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Task | "Chamada de ferramenta de longa duração" | Request aumentado com `_meta.task` pra execução assíncrona |
| SEP-1686 | "Eespecificaçãoificação de Tasks" | Proposta de Evolução da Eespecificaçãoificação que adicionou Tasks na 2025-11-25 |
| `_meta.task` | "Envelope da task" | Metadados por request contendo id, estado, ttl |
| taskSupport | "Flag de ferramenta" | `forbidden` / `optional` / `required` por ferramenta |
| `tasks/status` | "Método de polling" | Buscar estado atual e dica de progresso opcional |
| `tasks/result` | "Buscar resultado" | Retorna payload completado ou 404 se ainda não pronto |
| `tasks/cancel` | "Parar" | Request de cancelamento idempotente |
| ttl | "Orçamento de retenção" | Milissegundos que o servidor promete manter o estado da task |
| `notifications/tasks/updated` | "Push de estado" | Evento de mudança de estado iniciado pelo servidor |
| Store durável | "Estado seguro contra crash" | Camada de persistência em sistema de arquivos / SQLite / Redis |

## Leituras Complementares

- [MCP — GitHub SEP-1686 issue](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686) — a proposta original e discussão completa
- [WorkOS — MCP async tasks for AI agente workflows](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows) — walkthrough de design com justificativa
- [DeepWiki — MCP task system and async operations](https://deepwiki.com/modelcontextprotocol/modelcontextprotocol/2.7-task-system-and-async-operations) — mecânicas e máquina de estados
- [FastMCP — Tasks](https://gofastmcp.com/servers/tasks) — padrões de implementação de tasks no nível de SDK
- [MCP blog — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — questões abertas e prioridades de 2026 incluindo subtarefas
