---
name: supervisor-designer
description: Projete um sistema supervisor/orquestrador-trabalhador para uma determinada consulta de estilo de pesquisa, especificando prompt de lead, funções de trabalhador, regras de decomposição e modelo de síntese.
version: 1.0.0
phase: 16
lesson: 05
tags: [multi-agent, supervisor, orchestrator, anthropic-research, langgraph]
---

Dada uma consulta do usuário que se beneficia da pesquisa paralela de subagentes, produza um design de padrão de supervisor pronto para ser conectado a qualquer estrutura (LangGraph, OpenAI Agents SDK, CrewAI Hierarchical).

Produzir:

1. **Estimativa de complexidade.** Esta consulta é simples (1 agente, 3 a 10 chamadas de ferramenta), média (2 a 4 trabalhadores) ou complexa (5 ou mais trabalhadores)? Justifique em uma frase usando a heurística de esforço em escala da Anthropic.
2. **Prompt do sistema do lead.** Deve incluir: (a) instruções de decomposição, (b) instruções de síntese, (c) regra explícita de que o lead nunca lê o conteúdo da fonte bruta, apenas resumos do trabalhador.
3. **Avisos do sistema de trabalho.** Um por função, cada um nomeando seu escopo restrito e o formato de saída que o líder espera.
4. **Regras de decomposição de subquestões.** Como o lead divide a consulta? Decomposição ampla primeiro e depois estreita ou decomposição direta? O que desqualifica uma subquestão (sobreposição com outra, muito ampla)?
5. **Modelo de síntese.** Regra explícita para lidar com conflitos: se dois trabalhadores retornarem fatos contraditórios, a síntese deverá trazer à tona a discordância, em vez de escolher silenciosamente uma delas.
6. **Emparelhamento de modelos.** Qual modelo para o lead (nível de raciocínio), qual para os trabalhadores (nível mais rápido/mais barato). Explique a compensação.
7. **Requisitos de observabilidade.** Pontos de rastreamento mínimos: plano, início/fim de cada trabalhador, entrada de síntese, saída de síntese.

Rejeições difíceis:

- Qualquer projeto em que o próprio líder faça uso da ferramenta. Lidere apenas planos e sínteses.
- Solicitações de trabalho que permitem desvios de escopo (por exemplo, "pesquise qualquer coisa relacionada a X" sem limites).
- Modelos de síntese que ocultam conflitos.

Regras de recusa:

- Se a consulta for simples (estimada em menos de 10 chamadas de ferramenta no total), recuse o design e recomende um agente único. Cite a descoberta do custo do token Antrópico 15×.
- Se a consulta for sequencial (a etapa 2 precisa da saída da etapa 1), recuse e recomende um padrão de pipeline/cadeia.
- Se o usuário estiver otimizando para determinismo e auditoria, recuse o supervisor e recomende um gráfico estático LangGraph.

Resultado: resumo do design de uma página. Comece com a estimativa de complexidade e um veredicto de ajuste de padrão (“ajustes de supervisor”). Encerre com um lembrete de implantação do arco-íris se o sistema funcionar continuamente.