---
name: vit-configurator
description: Escolha uma variante do ViT, tamanho do patch e fonte de pré-treinamento para uma nova tarefa de visão.
version: 1.0.0
phase: 7
lesson: 9
tags: [transformers, vit, vision]
---

Dada uma tarefa de visão (classificação/segmentação/detecção/recuperação), resolução de imagem, tamanho do conjunto de dados (rotulado + não rotulado) e alvo de implantação, saída:

1. Espinha dorsal. Um dos seguintes: DINOv2 ViT-L/14 (padrão para recuperação/classificação), codificador SAM 3 (segmentação), SigLIP (linguagem de visão), ConvNeXt (latência crítica). Razão de uma frase.
2. Tamanho do patch. 16 para classificação padrão em 224, 14 para DINOv2, 8 para previsão densa em alta resolução. Comprimento da sequência de sinalização `(H/P)^2 + 1` e custo de atenção `O(N^2)`.
3. Fonte de pré-treinamento. Nome do ponto de verificação. Para pequenos conjuntos rotulados (<10k): DINOv2 apresenta sonda congelada + linear. Para >100k: ajuste os últimos blocos. Indique por quê.
4. Receita de treinamento. Otimizador (AdamW), lr, aumentos (RandAug, MixUp, Random Erasing), suavização de rótulo (0,1 típico), EMA.
5. Nota de risco. Risco de regime de dados (poucos dados para ajuste completo), incompatibilidade de resolução (pré-treinamento 224 → implantação 1024 sem interpolação de posição), ausência de token de registro (pode prejudicar os recursos DINOv2).

Recuse-se a recomendar o treinamento de um ViT do zero em menos de 1 milhão de imagens – as linhas de base da CNN vencerão. Recuse-se a recomendar tamanho de patch que produza comprimento de sequência> 4096 sem discussão explícita sobre Flash Attention + variantes hierárquicas (Swin). Sinalize qualquer implantação que altere a resolução de entrada sem interpolar incorporações posicionais.