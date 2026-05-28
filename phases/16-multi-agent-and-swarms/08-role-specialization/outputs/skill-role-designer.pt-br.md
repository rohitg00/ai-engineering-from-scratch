---
name: role-designer
description: Produza uma lista de funções para um sistema multiagente, nomeando o planejador/executor/crítico/verificador para uma determinada tarefa com esquemas de E/S explícitos.
version: 1.0.0
phase: 16
lesson: 08
tags: [multi-agent, role-specialization, metagpt, chatdev, verification]
---

Dada uma tarefa, produza uma lista de funções especializadas com esquemas de E/S e um verificador determinístico. Pronto para mapear em CrewAI, LangGraph, AutoGen ou loops personalizados.

Produzir:

1. **Lista de funções.** 3-5 funções. Nomeie cada um. No mínimo: planejador, executor, verificador. Crítico opcional.
2. **Esquema de E/S por função.** Para cada função: o que ela consome (da função upstream) e o que produz (esquema, não prosa). Use notação estilo dataclass.
3. **Especificação do verificador.** Nomeie a verificação determinística: conjunto de testes, verificador de tipo, validador de esquema, linter. Descreva os critérios de aprovação/reprovação.
4. **Especificação crítica (opcional).** Se incluída, nomeie a qualidade subjetiva que ela julga. Lista de verificação concreta, não "bom código".
5. **Regras de desalucinação comunicativa.** Cite as perguntas que cada função downstream pode enviar ao upstream quando falta um detalhe, para que não inventem.
6. **Revisão do orçamento do ciclo.** Máximo de rodadas antes do escalonamento para humano. Padrão 2.
7. **Mapeamento de estrutura.** Uma linha cada: como expressar esta lista em CrewAI, LangGraph, AutoGen.

Rejeições difíceis:

- Qualquer escalação sem verificador determinístico. Todas as escalações LLM falham na verificação MAST.
- Fuzzy I/O ("o executor retorna a saída"). Sempre indique o esquema.
- Crítico e verificador confundidos. Eles pegam bugs diferentes; ambos devem existir se ambos forem garantidos.

Regras de recusa:

- Se a tarefa não tiver verificação determinística de correção (trabalho generativo puro, escrita criativa), recuse e recomende um ciclo de revisor humano ou um debate multiagente (Lição 07).
- Se a tarefa for muito pequena para mais de 3 funções (menos de 10 minutos de trabalho humano), recuse e recomende o agente único.

Resultado: um resumo de design de função de uma página. Encerre com a verificação de falha de falha do MAST: confirme se existe pelo menos um verificador determinístico.