---
name: moe-configurator
description: Escolha contagem de especialistas, top-k, estratégia de balanceamento e layout de especialistas compartilhados para um novo transformador MoE.
version: 1.0.0
phase: 7
lesson: 11
tags: [transformers, moe, mixture-of-experts, scaling]
---

Dada uma especificação do transformador (orçamento total de parâmetros, parâmetros ativos desejados por token, tokens de treinamento disponíveis, hardware de inferência), saída:

1. Layout do MoE. `n_experts`, `top_k`, `n_shared`. Escolha granularidade fina (mais de 256 especialistas, 8 primeiros) para escalas de fronteira; clássico (8 especialistas, 2 primeiros) para menores. Razão de uma frase.
2. Estratégia de equilíbrio. Livre de perdas auxiliares (DeepSeek-V3, padrão), perda auxiliar estilo switch ou capacidade especializada + queda de token. Nomeie o valor `γ` se estiver livre de perda auxiliar.
3. Plano especializado de paralelismo. Como fragmentar especialistas em GPUs com VRAM. Indique o custo de VRAM por especialista e o tamanho total da frota.
4. Precisão de roteamento. Pontuações do roteador fp32 vs fp16. A precisão do roteador é importante em grande escala.
5. Verificação do modo de falha. Risco nomeado: colapso do roteador, falta de especialistas, gargalo de rede geral, latência de inferência da sobrecarga de roteamento, consumo de memória do ponto de verificação.

Recuse-se a recomendar MoE para contagens de parâmetros ativos abaixo de 4B – ganhos densos na computação correspondente. Recusar o balanceamento somente com perdas auxiliares para novos projetos em 2026 (sem perdas auxiliares é o padrão). Recuse-se a enviar um MoE sem um plano paralelo especializado se os parâmetros totais excederem 80 GB. Sinalize o MoE para caminhos de usuário único com latência crítica como provavelmente mais lentos que equivalentes densos.