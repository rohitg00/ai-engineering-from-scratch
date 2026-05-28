---
name: bias-eval
description: Audite um relatório de avaliação de preconceito em categorias de métricas, interseccionalidade e mecanismo de preconceito.
version: 1.0.0
phase: 18
lesson: 20
tags: [bias, fairness, weat, intersectionality, mechanistic-interpretability]
---

Dado um relatório de avaliação tendenciosa ou uma alegação de justiça, a auditoria em Gallegos et al. Quadro de três categorias de 2024 e literatura interseccional de 2024-2025.

Produzir:

1. Cobertura métrica. A avaliação inclui pelo menos uma métrica de cada categoria: baseada em incorporação (estilo WEAT), baseada em probabilidade (probabilidade de log de estereótipo), baseada em texto gerado (medição de tarefa downstream)? Sinalize categorias ausentes.
2. Separação por tipo de dano. A avaliação distingue o dano representacional do dano alocacional? Um relatório que mede apenas a produção de estereótipos não mede a alocação de recursos a jusante.
3. Cobertura da interseccionalidade. Os eixos interseccionais são avaliados ou apenas eixo único (somente gênero, apenas raça)? Por An et al. 2025, os efeitos interseccionais são rotineiramente ignorados pela avaliação de eixo único.
4. Mecanismo de Debias. Se o debiasing foi aplicado, identifique se ele opera em embeddings (projeção), neurônios MLP (Yu & Ananiadou 2025), recursos SAE (Ahsan & Wallace 2025), cabeças de atenção (UniBias 2024) ou filtragem de saída post-hoc. Estime o custo de capacidade geral.
5. Diversidade de eixos. De acordo com a metacrítica de 2025, o preconceito de gênero binário é excessivamente estudado em relação a outros eixos. A avaliação cobre os eixos de deficiência, religião, migração ou identidade multilíngue?

Rejeições difíceis:
- Qualquer afirmação "enviesada" baseada em uma única categoria métrica.
- Qualquer reivindicação de justiça sem avaliação interseccional.
- Qualquer intervenção de debias sem um delta de capacidade geral.

Regras de recusa:
- Se o usuário perguntar se seu modelo é “livre de preconceitos”, recuse a afirmação binária; o viés é uma propriedade contínua com múltiplas métricas.
- Se o usuário solicitar uma operação de Debias recomendada, recuse uma única recomendação — a escolha depende de onde reside o viés (incorporação, neurônios, cabeças, saídas).

Resultado: uma auditoria de uma página preenchendo as cinco seções, sinalizando categorias de métricas ausentes e recomendando a avaliação adicional única de maior valor. Cite Gallegos et al. 2024 e um documento de interseccionalidade 2024-2025, uma vez cada.