---
name: patch-geometry-reader
description: Read a ViT config and produce a patch-token, parameter, and VRAM analysis for downstream VLM planning.
version: 1.0.0
phase: 12
lesson: 01
tags: [vit, patch-tokens, dinov2, siglip, vlm-backbone]
---
---
name: patch-geometry-reader
description: Read a ViT config and produce a patch-token, parameter, and VRAM analysis for downstream VLM planning.
version: 1.0.0
phase: 12
lesson: 01
tags: [vit, patch-tokens, dinov2, siglip, vlm-backbone]
---

Dada uma configuração de backbone de visão (tamanho do patch, resolução, dim oculto, profundidade, cabeçotes, registros opcionais), produza uma análise geométrica que informe ao chamador quantos tokens esse codificador emitirá, quanto VRAM custa para ser executado e se é a escolha certa para um VLM downstream ou uma tarefa de previsão densa.

Produzir:

1. Grade de patch e comprimento de sequência. Forma de grade (H/P, W/P). Comprimento da sequência incluindo CLS, registros e qualquer token de pooling. Destaque o suporte multi-resolução (NaFlex, AnyRes) quando declarado.
2. Detalhamento dos parâmetros. Incorporação de patch, incorporação de posição, blocos transformadores (atenção + MLP), LN final, totais em contagens exatas e legíveis por humanos (por exemplo, 86,4M).
3. FLOPs por encaminhamento. Atenção (4 N D^2 + 2 N^2 D por bloco) e MLP (16 N D^2 por bloco), somados em profundidade. Sinalize custos quadráticos em N que afetarão em alta resolução.
4. Estimativa de VRAM. Memória de ativação na inferência para um único encaminhamento em uma imagem, mais cache equivalente a KV se o codificador alimentar um LLM downstream.
5. Recomendação de agrupamento. CLS, significa patch, baseado em registro ou skip-pooling-for-VLM, com base na tarefa downstream declarada.

Rejeições difíceis:
- Qualquer análise que trate tokens de patch como pixels idênticos à entrada. A projeção é um mapa linear aprendido; patches são vetores abstratos, não pixels.
- Reivindicar o CLS é sempre o pool certo. Os caminhos modernos de recursos densos e VLM ignoram totalmente o CLS.
- Tratar 2D-RoPE e embeddings posicionais aprendidos como intercambiáveis, sem notar a flexibilidade de resolução nativa do estilo NaFlex.

Regras de recusa:
- Se a configuração fornecida declarar um tamanho de patch que não divide uniformemente o tamanho da imagem, recuse — esta não é uma configuração compatível com NaFlex sem um esquema de preenchimento declarado.
- Se o chamador solicitar contagens exatas de peso pré-treinado para modelos proprietários (Gemini, Claude, GPT-5), recuse – elas não serão publicadas.
- Se a VRAM de implantação alvo for inferior a 4 GB para um modelo de classe ViT-g/14, recuse e recomende um backbone SigLIP SO400m/14 ou menor.

Resultado: uma análise geométrica de uma página com contagem de tokens, detalhamento de parâmetros, estimativa de FLOPs, orçamento de VRAM e uma estratégia de pooling recomendada. Termine com um parágrafo "o que ler a seguir" apontando para o artigo SigLIP 2 (arXiv:2502.14786) para detalhes do NaFlex, o artigo DINOv2 para recursos densos ou a Lição 12.06 para implementação de patch-n'-pack.