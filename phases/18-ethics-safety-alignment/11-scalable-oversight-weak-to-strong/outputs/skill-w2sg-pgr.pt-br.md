---
name: w2sg-pgr
description: Audit a scalable-oversight or W2SG claim via the performance-gap-recovered metric.
version: 1.0.0
phase: 18
lesson: 11
tags: [scalable-oversight, weak-to-strong, pgr, debate, recursive-reward-modeling]
---
---
name: w2sg-pgr
description: Audit a scalable-oversight or W2SG claim via the performance-gap-recovered metric.
version: 1.0.0
phase: 18
lesson: 11
tags: [scalable-oversight, weak-to-strong, pgr, debate, recursive-reward-modeling]
---

Dado um descuido escalável ou um documento/relatório do W2SG, audite se a configuração suporta sua afirmação.

Produzir:

1. Identificação fraca/forte. Nomeie explicitamente o supervisor fraco e o modelo forte. A lacuna de capacidade é medida em parâmetros, tokens de treinamento, pontuação de benchmark ou avaliação específica de tarefa?
2. Definição de teto. Qual é o limite máximo supervisionado do modelo forte para a tarefa? Sem teto, o PGR não pode ser computado.
3. Cálculo do PGR. PGR = (ajustado - fraco) / (teto - fraco). Verifique sinal, magnitude e denominador. Pequenos denominadores inflacionam artificialmente o PGR.
4. Verificação prévia de vazamento. Os dados de pré-treinamento do modelo forte incluem a verdade básica da tarefa? Se sim, a “recuperação” pode ser uma recuperação prévia em vez de uma generalização.
5. Divisão alinhamento versus capacidade. A lacuna entre fraco e forte é uma lacuna de capacidade ou uma lacuna de alinhamento? Queimaduras et al. 2023 deixa explícito que a sua lacuna é moldada pelas capacidades; lacunas em forma de alinhamento podem se comportar de maneira diferente.

Para auditorias de mecanismos de supervisão escalonáveis:
- Debate: identificar o conhecimento do juiz, a estrutura do debatedor e se a tarefa recompensa a verdade. Cite Khan et al. 2024 (arXiv:2402.06782) sobre onde o debate ajuda e falha.
- RRM: identifique a profundidade da recursão e o que acontece se U+1 já não for confiável.
- Decomposição de tarefas: identifique o procedimento de decomposição e se as subtarefas são verificáveis ​​de forma independente.

Rejeições difíceis:
- Qualquer reclamação de PGR sem limite máximo de rótulos dourados.
- Qualquer afirmação do W2SG que pretenda resolver o alinhamento – o W2SG mede a recuperação de capacidade, não o alinhamento.
- Qualquer afirmação de mecanismo de debate que ignore a literatura empírica de 2024 sobre quando o debate ajuda ou prejudica.

Regras de recusa:
- Se o usuário perguntar "o W2SG resolve o superalinhamento", recuse a resposta binária e explique que o PGR é mensurável, não uma solução.
- Se o usuário perguntar qual mecanismo de supervisão escalonável é melhor, recuse — a resposta depende da tarefa.

Resultado: uma auditoria de uma página que preenche as cinco secções acima, reporta ou solicita PGR e sinaliza se a lacuna fraco-forte é moldada pela capacidade ou pelo alinhamento. Cite Burns et al. 2023 e Lang et al. (arXiv:2501.13124) uma vez cada.