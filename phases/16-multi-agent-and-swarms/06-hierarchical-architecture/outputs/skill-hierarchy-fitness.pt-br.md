---
name: hierarchy-fitness
description: Decida se uma tarefa multiagente se enquadra em hierarquia, supervisor plano ou sequencial. Revele os modos de falha que importam.
version: 1.0.0
phase: 16
lesson: 06
tags: [multi-agent, hierarchy, crewai, langgraph, decomposition-drift]
---

Dada uma descrição da tarefa e uma estrutura organizacional opcional, recomende o padrão de coordenação (supervisor plano, hierárquico, sequencial) e liste os modos de falha específicos contra os quais se proteger.

Produzir:

1. **Análise do formato da tarefa.** A tarefa é um fluxo linear, distribuída com ramificações independentes ou equipes aninhadas com suas próprias subequipes? Justificar.
2. **Veredicto do padrão.** Sequencial, supervisor plano ou hierárquico. Se for hierárquico, especifique a profundidade (2 níveis fortemente preferidos; 3 apenas com forte necessidade de auditoria).
3. **Plano de decomposição.** A divisão exata que o principal gestor deve fazer. Para cada ramificação, nomeie o subgerente e o escopo limitado.
4. **Orçamento de reconciliação.** Número de rodadas permitidas antes que o gerente principal se comprometa. Padrão 2.
5. **Guarda-corpos.** Três guarda-corpos mínimos: trabalhador canário por nível, cadeia de procedência em cada síntese, alerta sobre desvio de decomposição.
6. **Lista de verificação do modo de falha.** Qual dos seguintes {erro de atribuição de tarefa, interpretação incorreta de saída, ciclo de consenso} é mais provável de acordo com o formato da tarefa? Descreva um sintoma concreto e uma mitigação por modo.

Rejeições difíceis:

- Qualquer recomendação que proponha profundidade > 2 sem nomear uma auditoria concreta ou requisito organizacional que o exija.
- Hierárquico para tarefas de fluxo linear único. Esses devem ser pipelines sequenciais.
- Projetos sem orçamento de reconciliação explícito.

Regras de recusa:

- Se a tarefa for simples o suficiente para acomodar um agente (menos de 10 chamadas de ferramenta), recuse a hierarquia e recomende um único agente.
- Se a tarefa não tiver limites naturais de equipe (cada subetapa depende uma da outra), recuse e recomende um padrão de bate-papo em grupo.
- Se o usuário quiser hierárquico para "realismo" (porque a organização humana é profunda), sinalize que a hierarquia humana não é mapeada para a hierarquia LLM e recomende mais plana.

Resultado: resumo de uma página. Abra com o veredicto do padrão, feche com os três maiores riscos e suas proteções.