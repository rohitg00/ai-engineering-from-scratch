---
name: workflow-picker
description: Escolha o padrão certo (cadeia de prompts, roteador, paralelo, orquestrador-trabalhadores, avaliador-otimizador ou agente completo) para uma determinada tarefa e produza a implementação mínima.
version: 1.0.0
phase: 14
lesson: 12
tags: [anthropic, workflows, agents, patterns, minimal]
---

Dada uma descrição da tarefa, escolha o padrão mínimo adequado e produza a menor implementação correta.

Árvore de decisão:

1. Você pode enumerar as etapas? -> **cadeia de prompts** ou **roteamento**.
2. A produção precisa de agregação em execuções independentes? -> **paralelização** (seccionamento ou votação).
3. Você precisa de um grupo de especialistas cuja adesão varie de acordo com a tarefa? -> **trabalhadores-orquestradores**.
4. Você precisa de refinamento iterativo até que um juiz seja aprovado? -> **avaliador-otimizador** (forma de auto-refinamento).
5. Nenhuma das opções acima ou a contagem de passos depende de resultados intermediários? -> **loop de agente** (Lição 01).

Produzir:

- Para fluxos de trabalho: funções puras que compõem LLM + chamadas de ferramentas. Sem estrutura.
- Para agentes: o loop ReAct da Lição 01 mais qualquer registro de ferramenta que a tarefa exija.
- Um `README.md` com a justificativa da decisão, contagem de etapas, custo esperado do token e critério de sucesso observável.

Rejeições difíceis:

- Alcançar uma estrutura (LangGraph, AutoGen, CrewAI) quando a tarefa for uma cadeia de prompts de 3 etapas. O excesso de engenharia esconde o problema real.
- Descrever um orquestrador-trabalhador de 3 trabalhadores como "multiagente". Os trabalhadores não são agentes; são chamadas LLM. Use "trabalhadores-orquestradores" para maior clareza.
- Avaliador-otimizador sem condição de parada. Sem `max_iter` e um substituto de "passagem de falha", o loop pode girar indefinidamente.

Regras de recusa:

- Se o usuário solicitar "multiagente" quando a tarefa for na verdade um roteador, recuse e renomeie. O rótulo multiagente acarreta custos operacionais (coordenação, depuração, avaliações) que o roteamento não necessita.
- Se o usuário desejar fluxos de trabalho para uma tarefa de pesquisa aberta, recuse e sugira um agente com orçamento de turno. Os fluxos de trabalho são para trajetórias previsíveis.
- Se o usuário desejar um agente para uma tarefa de 2 etapas, recuse e sugira o encadeamento imediato. Os agentes adicionam modos de latência e falha; use-os apenas quando precisar deles.

Saída: escolha de padrão + código mínimo + README. Termine com "o que ler a seguir" apontando para a Lição 13 (LangGraph) se o estado durável for importante, a Lição 16 (OpenAI Agents SDK) para transferências e proteções ou a Lição 01 se você estiver escolhendo um agente, afinal.