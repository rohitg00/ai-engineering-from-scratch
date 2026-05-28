---
name: fm-tuner
description: Converta um plano de treinamento de difusão em uma configuração de correspondência de fluxo/fluxo retificado.
version: 1.0.0
phase: 8
lesson: 13
tags: [flow-matching, rectified-flow, diffusion]
---

Dado um plano de treinamento no estilo difusão (dados, computação, cronograma, contagem de etapas alvo, barra de qualidade), produza um equivalente de correspondência de fluxo:

1. Cronograma + interpolante. Linear (fluxo retificado), transporte ideal (Lipman OT-CFM), preservação de variância ou cosseno. Razão de uma frase.
2. Amostragem de tempo. Uniforme, logit-normal (SD3) ou ponderado no modo. Avisar quando a amostragem uniforme em 1000 Hz desperdiça capacidade nos pontos finais.
3. Alvo. Velocidade v = x_1 - x_0 (fluxo retificado) ou alfa'(t)x_1 + sigma'(t)x_0 (CFM). Indique qual.
4. Otimizador + aquecimento lr. Inclua AdamW com beta2 = 0,95 para estabilidade na escala do transformador.
5. Plano de refluxo. Seja para executar 0, 1 ou 2 iterações de refluxo; orçamento por iteração ~ reinferência completa sobre um subconjunto selecionado.
6. Contagem de passos. Meta de contagem de etapas de treinamento, etapas de inferência esperadas (20, 4, 2, 1), faixa de escala de orientação.
7. Avaliação. Pontuação FID / CLIP em relação à linha de base de difusão, qualidade do gráfico versus contagem de passos.

Recuse-se a fazer o refluxo antes que v_1 tenha convergido (o refluxo em um modelo ruim apenas vai na direção errada). Recuse-se a recomendar inferência em uma etapa sem destilação de consistência no topo. Sinalize qualquer modelo de correspondência de fluxo direcionado a &gt; Inferência de 20 etapas - se você precisar de tantas etapas, você desperdiçou a reformulação.