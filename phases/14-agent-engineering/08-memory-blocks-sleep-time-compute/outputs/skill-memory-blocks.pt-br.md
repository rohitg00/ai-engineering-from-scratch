---
name: memory-blocks
description: Generate a Letta-shaped three-tier memory system (core blocks, recall, archival) with a sleep-time consolidation agent off the critical path.
version: 1.0.0
phase: 14
lesson: 08
tags: [memory, letta, blocks, sleep-time, consolidation]
---
---
name: memory-blocks
description: Generate a Letta-shaped three-tier memory system (core blocks, recall, archival) with a sleep-time consolidation agent off the critical path.
version: 1.0.0
phase: 14
lesson: 08
tags: [memory, letta, blocks, sleep-time, consolidation]
---

Dado um tempo de execução alvo, um modelo primário e um modelo de tempo de espera (possivelmente mais forte), produza um sistema de memória de três camadas com tipos de blocos explícitos e consolidação assíncrona.

Produzir:

1. Tipo `Block` com `label`, `value`, `limit`, `description`, `version`, `history`. Cada gravação altera a versão e registra o valor antigo. Exponha `near_limit(threshold=0.8)`.
2. Um `BlockStore` com no mínimo três blocos padrão: `human` (fatos sobre o usuário), `persona` (autoconceito do agente) e `task` (escopo atual). Permitir blocos definidos pelo usuário.
3. Uma loja `Recall` — registro de turnos paginado por sessão. Gravação automática a cada turno. A cauda é despejada no limite, mas permanece recuperável.
4. Uma loja `Archival` — pelo menos dois backends (vetor, KV). Inserir retorna o ID do registro. Invalidar em vez de excluir por contradição.
5. Um `PrimaryAgent` que lida com turnos e apenas emite gravações brutas. Sem resumo do caminho crítico.
6. Um `SleepTimeAgent` que funciona entre turnos: resume blocos acima do limite, invalida registros de arquivo contraditos, escreve `learned_context` em blocos compartilhados.

Rejeições difíceis:

- Qualquer operação de memória executada de forma síncrona durante um turno voltado para o usuário, exceto uma pesquisa direta. A sumarização, a consolidação, a invalidação pertencem ao passe do sono.
- Exclusão de registros de arquivo por contradição. Invalide para que o histórico permaneça auditável.
- Escrever para o bloco Persona ou Segurança sem etapa de revisão. Esses bloqueios moldam o comportamento globalmente; silencioso escreve bugs de máscara.

Regras de recusa:

- Se o tempo de execução não puder persistir bloqueios entre sessões, recuse o envio de um produto descrito como "memória". Faça o downgrade da reivindicação.
- Se o agente de tempo de suspensão não tiver saída de rastreamento, recuse. A consolidação silenciosa é uma zona morta de depuração.
- Se o usuário solicitar "sem invalidação, sempre confie na última gravação", recuse qualquer domínio onde as reivindicações históricas sejam importantes (conformidade, médica, jurídica).

Saída: um arquivo por componente mais um `README.md` que nomeia os blocos padrão, a cadência do tempo de sono e a política de resolução de contradições. Termine com "o que ler a seguir" apontando para a Lição 09 se o agente precisar de raciocínio gráfico sobre memória, ou para a Lição 23 se o produto precisar de spans OTel em operações de memória.