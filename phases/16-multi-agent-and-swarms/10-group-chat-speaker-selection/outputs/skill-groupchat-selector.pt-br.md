---
name: groupchat-selector
description: Configure an AutoGen/AG2-style GroupChat selector for a task, naming the selector variant, termination, and anti-hot-speaker rules.
version: 1.0.0
phase: 16
lesson: 10
tags: [multi-agent, groupchat, autogen, ag2, speaker-selection]
---
---
name: groupchat-selector
description: Configure an AutoGen/AG2-style GroupChat selector for a task, naming the selector variant, termination, and anti-hot-speaker rules.
version: 1.0.0
phase: 16
lesson: 10
tags: [multi-agent, groupchat, autogen, ag2, speaker-selection]
---

Dada uma tarefa e uma lista de agentes, produza uma configuração do GroupChat: escolha do seletor, entradas do seletor, regras de rescisão e proteções.

Produzir:

1. **Variante do seletor.** Round-robin (barato, justo, cego ao contexto), selecionado por LLM (sensível ao contexto, caro) ou personalizado (LLM + substituto baseado em regras).
2. **Entradas do seletor.** Se o LLM for selecionado: N mensagens recentes, especialidades do agente, contagens de turnos. Se personalizado: regras explícitas.
3. **Regras de rescisão.** Rodadas máximas, token TERMINATE, verificador de meta alcançada ou combinação.
4. **Mitigação de alto-falante ativo.** Limite de giro por agente, pontuação de equilíbrio do alto-falante na entrada do seletor, rotação forçada após K giros consecutivos.
5. **Mitigação do inchaço do contexto.** Plano de projeção (visualizações com escopo por função), pontos de verificação de resumo, limite de contexto por agente.
6. **Observabilidade.** Entrada do seletor de log, escolha do seletor, latência do agente por turno.

Rejeições difíceis:

- Qualquer configuração selecionada pelo LLM sem registro de entrada/saída do seletor. A depuração torna-se impossível.
- Configurações sem limite de max_rounds.
- Bate-papos simétricos (sem especialização) em tarefas de raciocínio — use o debate (Lição 07).

Regras de recusa:

- Se a tarefa tiver uma estrutura DAG conhecida, recuse o GroupChat e recomende o gráfico estático LangGraph para determinismo.
- Se a tarefa exigir trilhas de auditoria rigorosas, recuse o GroupChat; recomendo LangGraph com checkpointer.
- Se o número de agentes for superior a 5-6, recuse o GroupChat simples e recomende grupos aninhados ou padrão hierárquico.

Saída: um resumo de configuração do GroupChat de uma página. Fechar com a estimativa de custo (selecionado pelo LLM incorre em uma chamada de seletor por turno).