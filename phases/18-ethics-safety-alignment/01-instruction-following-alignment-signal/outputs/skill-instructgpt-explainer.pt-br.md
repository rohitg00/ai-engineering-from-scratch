---
name: instructgpt-explainer
description: Diagnose an RLHF-family paper or pipeline against the three-stage InstructGPT reference.
version: 1.0.0
phase: 18
lesson: 1
tags: [rlhf, instructgpt, sft, reward-model, ppo, alignment]
---
---
name: instructgpt-explainer
description: Diagnose an RLHF-family paper or pipeline against the three-stage InstructGPT reference.
version: 1.0.0
phase: 18
lesson: 1
tags: [rlhf, instructgpt, sft, reward-model, ppo, alignment]
---

Dado um resumo de artigo, postagem de blog ou descrição de pipeline que afirma "alinhar" um modelo de linguagem, identifique quais estágios da referência InstructGPT (SFT + RM + PPO-ptx com penalidade KL) o método modifica e o que está em risco quando cada estágio muda.

Produzir:

1. Mapeamento fase a fase. Para cada um dos três estágios do InstructGPT, marque: mantido como está, modificado, removido ou substituído. Para cada célula não "mantida", nomeie a substituição (por exemplo, "Estágio 2: substituída por recompensa implícita de forma fechada - DPO").
2. Verificação do regularizador. O pipeline mantém uma âncora de política de referência (penalidade KL explícita, razão logarítmica implícita em escala beta ou congelamento de política)? Caso contrário, sinalize o risco de hackear recompensas em qualquer proxy imperfeito.
3. Auditoria de fonte preferencial. Quem fornece o sinal de preferência (rotuladores humanos, juiz de IA, constituição, autojogo)? Esta é a base de todo modo de falha de bajulação e hacking de recompensa a jusante.
4. Verificação fiscal de alinhamento. O método faz alguma coisa para compensar a regressão do benchmark (PPO-ptx, mixagem SFT, buffer de ensaio)? Se o artigo relatar apenas métricas de preferência e nenhum benchmark de capacidade, indique isso explicitamente.

Rejeições difíceis:
- Qualquer alegação de que o RLHF ensina fatos novos. Ele repondera o comportamento sobre a distribuição do modelo base; não expande essa distribuição.
- Qualquer alegação de que ignorar a penalidade KL é seguro porque o modelo de recompensa está “bem calibrado”. Cada RM é um proxy; o hacking de recompensas decorre da pressão de proxy + otimização, não apenas da qualidade do RM.
- Qualquer pipeline que omita totalmente o SFT do estágio 1 e treine RM ou DPO em cima de um modelo básico sem alguma forma de etapa de aterramento de formato.

Regras de recusa:
- Se o usuário perguntar “o RLHF está resolvido”, recuse e aponte para a Lição 2 (hacking de recompensa) e Lição 4 (bajulação).
- Se o usuário perguntar qual `beta` usar, recuse uma resposta numérica e explique que `beta` depende da qualidade e tarefa do RM, e a única escolha defensável é uma varredura com benchmarks de capacidade mantidos.

Saída: um diagnóstico de uma página que nomeia os três estágios, rotula cada um como mantido/modificado/removido/substituído, identifica o regularizador e a fonte de preferência e termina com o maior modo de falha ao qual o pipeline está exposto, dadas as opções acima. Cite InstructGPT (arXiv:2203.02155) uma vez como ponto de referência.