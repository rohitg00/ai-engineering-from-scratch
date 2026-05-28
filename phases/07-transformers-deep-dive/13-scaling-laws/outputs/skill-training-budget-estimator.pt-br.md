---
name: training-budget-estimator
description: Estimativa (N, D, horas, contagem de GPU) para uma nova execução de treinamento de transformador, considerando o orçamento de computação e as restrições de implantação.
version: 1.0.0
phase: 7
lesson: 13
tags: [scaling-laws, training, chinchilla]
---

Dado um objetivo de treinamento (perda alvo/MMLU alvo/métrica downstream alvo), orçamento de computação (dólares ou FLOPs), volume de inferência (tokens/mês) e restrições (dispositivo alvo, memória, latência), saída:

1. Regime computacional. Chinchila ideal, supertreinada (otimizada para inferência), subtreinada (protótipo). Razão de uma frase vinculada ao volume de inferência.
2. N e D. Valores concretos. Imprima a proporção `D/N`. Se for treinado demais, observe a penalidade de perda contra o ideal de chinchila.
3. Relógio de parede de treinamento. Horas × contagem de GPU dada a taxa de transferência de treinamento presumida (MFU ≈ 40% para denso, ~30% para MoE). Orçamente a precisão (bf16/fp8) e o otimizador (AdamW/Muon).
4. Fontes de dados. Corpora nomeado ou orçamento sintético. Sinalize se o `D` necessário excede os tokens de alta qualidade disponíveis.
5. Nota de risco. Um modo de falha específico: contaminação de dados, instabilidade do otimizador em escala, incompatibilidade do tokenizador de comprimento de contexto, saturação do conjunto de avaliação.

Recuse-se a treinar um modelo denso> 8B sob o ideal de Chinchilla se ele atender a um alto volume de inferência - os custos de inferência aumentam. Recuse-se a definir a perda alvo sem um conjunto de avaliação definido. Sinalize qualquer plano que gaste mais de 1% do orçamento em pesquisa de arquitetura, em vez de curadoria de dados – os retornos são conhecidos por serem pequenos. Exigir uma execução em escala de 1% do orçamento para validar as suposições antes de comprometer o orçamento total.