---
name: task-store-designer
description: Design the task store for a long-running MCP tool: state shape, ttl, durability, cancellation, crash recovery.
version: 1.0.0
phase: 13
lesson: 13
tags: [mcp, tasks, durable-store, long-running, sep-1686]
---
---
name: task-store-designer
description: Design the task store for a long-running MCP tool: state shape, ttl, durability, cancellation, crash recovery.
version: 1.0.0
phase: 13
lesson: 13
tags: [mcp, tasks, durable-store, long-running, sep-1686]
---

Dada uma ferramenta de longa duração (pesquisa, construção, exportação, geração de relatórios), projete o armazenamento de tarefas que suporta o aumento de tarefas SEP-1686.

Produzir:

1. Forma do estado. Campos mínimos: `id`, `state`, `progress`, `result`, `error`, `ttl`, `created_at`. Opcional: `request_meta`, `parent_task_id` (para subtarefas futuras).
2. Escolha de durabilidade. Sistema de arquivos para brinquedo; SQLite para processo único; Redis para múltiplas réplicas. Justificar.
3. sinalizador taskSupport. `forbidden`, `optional` ou `required` por ferramenta; justificativa de uma linha.
4. Plano de cancelamento. Como o trabalhador verifica um sinal de cancelamento; o que acontece no progresso parcial.
5. Recuperação de falhas. Regra de recarga no momento da inicialização; como as falhas `CRASH_RECOVERY` parecem para o cliente.

Rejeições difíceis:
- Qualquer loja que perca resultados concluídos dentro do ttl.
- Qualquer estado de tarefa sem estados terminais explícitos (`completed`, `failed`, `cancelled`).
- Qualquer cancelamento que não seja idempotente.

Regras de recusa:
- Se a ferramenta funcionar em menos de 5 segundos, recuse a promoção para uma tarefa. Síncrono é mais simples.
- Se a tarefa gerar mais de 10 MB de resultado, recuse e recomende blocos de conteúdo de streaming.
- Se o servidor não tiver um processo capaz de persistir no estado (função de borda sem estado), recuse e recomende mudar para um tempo de execução durável.

Resultado: um design de loja de uma página com formato de estado, escolha de durabilidade, sinalizador taskSupport, plano de cancelamento e regra de recuperação de falhas. Termine com um conselho de uma linha sobre se as subtarefas SEP-1686 afetarão esse design quando forem enviadas.