# Visão Qualquer Resolução: Patch-n'-Pack e NaFlex

> Imagens reais não são quadrados de 224x224. Um cupom fiscal é 9:16, um gráfico é 16:9, um exame médico pode ser 4096x4096, um screenshot de celular é 9:19.5. A resposta dos VLMs pré-2024 — redimensionar tudo pra um quadrado fixo — jogava fora o sinal que faz OCR, entendimento de documentos e parsing de cenas de alta resolução funcionarem. NaViT (Google, 2023) mostrou que você podia empacotar patches de resolução variável num batch único de transformer com máscara em bloco diagonal. M-RoPE do Qwen2-VL (2024) eliminou tabelas posicionais absolutas completamente. AnyRes do LLaVA-NeXT dividiu imagens de alta resolução em base + sub-imagens. NaFlex do SigLIP 2 (2025) é agora o encoder padrão pra VLMs abertos que querem um único checkpoint servindo todas as proporções de aespecificaçãoto. Essa lição implementa patch-n'-pack de ponta a ponta.

**Tipo:** Construção
**Linguagens:** Python (stdlib, empacotador de patches + máscara em bloco diagonal)
**Pré-requisitos:** Fase 12 · 01 (patches ViT), Fase 12 · 05 (LLaVA)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Empacotar patches de um batch de imagens de resolução variável numa única sequência e construir a máscara de attention em bloco diagonal.
- Escolher entre mosaico AnyRes (LLaVA-NeXT), NaFlex (SigLIP 2) e M-RoPE (Qwen2-VL) pra uma tarefa dada.
- Calcular orçamentos de tokens pra OCR, gráficos e fotografia sem redimensionar.
- Nomear os três modos de falha do redimensionamento quadrado: texto comprimido, conteúdo cortado, tokens desperdiçados com padding.

## O Problema

Transformers esperam uma sequência. Um batch é uma pilha de sequências do mesmo tamanho. Se suas imagens são 224x224, você ganha 196 patch tokens toda vez, padding não necessário, trabalho feito. Treina em 224, infere em 224, nunca mais pensa na resolução.

O mundo não coopera. Documentos são retrato (8.5x11 polegadas, ~2:3). Screenshots de gráficos são paisagem (16:9). Cupons fiscais são altos e finos (1:3). Imagens médicas vêm em 2048x2048 ou maiores. Screenshots de dispositivos móveis são 1170x2532 (0.46:1).

Três opções pré-2024 e por que cada uma falha:

1. Redimensionar pra um quadrado fixo (224x224 ou 336x336). A compressão distorce texto e rostos. A redução destrói legendas de gráficos e conteúdo OCR. Prática padrão até LLaVA-1.5.
2. Cortar pra uma proporção fixa. Você joga fora a maioria da imagem, e escolher a posição do corte é seu próprio problema de visão.
3. Preencher até o lado mais longo. Corrige distorção mas desperdiça 50%+ dos tokens em padding pra imagens em retrato. Custo de attention quadrático em todos aqueles tokens de padding.

A resposta de 2024-2025: deixar o transformer comer patches na resolução nativa da imagem e descobrir como empacotar um batch heterogêneo numa sequência sem desperdício de computação.

## O Conceito

### NaViT e patch-n'-pack

NaViT (Dehghani et al., 2023) foi o artigo que mostrou que isso funciona em escala. A ideia é mecânica:

1. Pra cada imagem no batch, calcular sua grade nativa de patches num tamanho de patch escolhido (digamos 14).
2. Achatar os patches de cada imagem em sua própria sequência de comprimento variável.
3. Concatenar os patches de todas as imagens numa sequência longa pro batch.
4. Construir uma máscara de attention em bloco diagonal pra que os patches da imagem A atentem só dentro da imagem A.
5. Carregar informação posicional por patch (RoPE 2D ou embeddings posicionais fracionários).

Um batch de três imagens em 336x336 (576 tokens), 224x224 (256 tokens) e 448x336 (768 tokens) vira uma sequência de 1600 tokens com máscara 1600x1600 em bloco diagonal. Sem padding. Sem desperdício de computação. O transformer lida com proporções arbitrárias.

NaViT também introduziu dropagem fracionária de patches durante treino — dropar 50% dos patches aleatoriamente no batch — o que regulariza e acelera o treino. SigLIP 2 herdou isso.

### AnyRes (LLaVA-NeXT)

AnyRes do LLaVA-NeXT é a alternativa pragmática. Dada uma imagem de alta resolução e um encoder fixo (CLIP ou SigLIP em 336), faz mosaico da imagem:

1. Escolhe um layout de grade de um conjunto predefinido — (1x1), (1x2), (2x1), (1x3), (3x1), (2x2), etc. — que melhor se encaixa na proporção da imagem.
2. Divide a imagem completa na grade; cada tile vira um crop de 336x336.
3. Também produz um thumbnail: a imagem inteira redimensionada pra 336x336 como token de contexto global.
4. Cada tile passa pelo encoder 336 congelado. Concatena os tokens de tile + tokens de thumbnail.

Pra uma imagem 672x672 em grade 2x2 mais thumbnail: 4 * 576 + 576 = 2880 tokens visuais. Caro mas eficiente — o LLM vê tanto detalhe local quanto contexto global.

AnyRes é o caminho escolhido quando seu encoder está congelado e só suporta uma resolução. Explode a contagem de tokens pra imagens grandes (uma imagem 1344x1344 em grade 4x4 é 9216 + 576 ≈ 9800 tokens, que preenche a maior parte de um contexto de LLM de 8k).

### M-RoPE (Qwen2-VL)

Qwen2-VL introduziu Embedding Posicional Rotacional Multimodal. Em vez das posições fracionárias do NaViT ou do mosaico-e-thumbnail do AnyRes, cada patch carrega uma posição 3D (temporal, altura, largura). As rotações de consulta/key lidam com H, W e comprimento temporal arbitrários.

M-RoPE entrega resolução dinâmica nativa sem retreino. Na inferência, você alimenta qualquer imagem HxW, o patch embedder produz tokens H/14 x W/14, cada token recebe sua posição (t=0, r=row, c=col), RoPE rotaciona a attention com as frequências certas, pronto. Qwen2.5-VL e Qwen3-VL continuam isso. V2PE do InternVL3 é a mesma ideia com encoding variável por modalidade.

Diferente do AnyRes, M-RoPE é O(H x W / P^2) tokens em resolução nativa — sem custo multiplicativo de tile. Diferente do NaViT, ainda espera uma única imagem por forward. Batching entre resoluções ainda precisa de patch-n'-pack por cima.

### NaFlex (SigLIP 2)

NaFlex é o modo flex-nativo do checkpoint SigLIP 2. Um único modelo serve múltiplos comprimentos de sequência (256, 729, 1024 tokens) na inferência. Internamente usa patch-n'-pack estilo NaViT durante treino e posições fracionárias absolutas por patch. O diferencial: um checkpoint, escolha seu orçamento de tokens na inferência baseado na tarefa.

Pra uma tarefa semântica (classificação, recuperação), 256 tokens. Pra OCR ou entendimento de gráficos, 1024 tokens. Sem retreino.

### A máscara de empacotamento

A máscara em bloco diagonal é onde a maioria das implementações tropeça. Pra uma sequência empacotada de comprimento `N_total` cobrindo imagens `i=0..B-1` com comprimentos `n_i`, a máscara `M` de forma `(N_total, N_total)` é 1 se ambos os índices caem no bloco da mesma imagem, senão 0. Você pode construir ela a partir de uma lista de comprimentos cumulativos:

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff existe b onde offsets[b] <= i < offsets[b+1] e offsets[b] <= j < offsets[b+1]
```

Isso é uma linha em PyTorch com `torch.block_diag` ou um gather explícito. O caminho de comprimento variável do FlashAttention (`cu_seqlens`) pula a máscara completamente e atenta dentro de sequências usando o tensor de comprimento cumulativo diretamente — ~10x mais rápido que uma máscara densa pra batches típicos.

### Orçamentos de tokens

Escolha sua estratégia por tarefa:

- OCR / documentos: 1024-4096 tokens. SigLIP 2 NaFlex a 1024, ou AnyRes 3x3 + thumbnail.
- Gráficos e UI: 729-1024 tokens em 384-448 nativo. Qwen2.5-VL com resolução dinâmica e teto de pixels máximo.
- Fotos naturais: 256-576 tokens basta. O LLM downstream vê o suficiente. Pague tokens onde a densidade de conteúdo é alta.
- Vídeo: 64-128 tokens por frame após pooling espacial, 2-8 FPS. Lição 12.17 cobre isso.

A regra de produção de 2026: escolha um teto de pixels máximo por tarefa, codifique na proporção nativa até esse teto, empacote o batch e pule o padding. Qwen2.5-VL expõe `min_pixels` e `max_pixels` exatamente pra esse ajuste.

## Use

`code/main.py` implementa patch-n'-pack pra um batch heterogêneo de imagens com coordenadas de pixel inteiras. Ele:

- Recebe uma lista de tamanhos de imagem (H, W).
- Calcula o comprimento da sequência de patches de cada imagem em tamanho de patch 14.
- Empacota tudo numa sequência de comprimento total `sum(n_i)`.
- Constrói a máscara de attention em bloco diagonal (densa, pra clareza).
- Compara o custo empacotado vs redimensionamento quadrado e mosaico AnyRes.
- Imprime uma tabela de orçamento de tokens pra um batch misto (cupom, gráfico, screenshot, foto).

Rode. Os números que saem são a razão pela qual todo VLM aberto de 2026 usa patch-n'-pack.

## Entregue

Essa lição produz `outputs/skill-resolution-budget-planner.md`. Dada uma carga de trabalho com proporções mistas (OCR, gráficos, fotos, frames de vídeo) e um orçamento total de tokens, escolhe a estratégia certa (NaFlex, AnyRes, M-RoPE ou quadrado fixo) e emite uma configuração por requisição. Use essa skill quando estiver dimensionando um VLM pra um produto — ela evita a explosão silenciosa de 10x tokens que mata orçamentos de latência.

## Exercícios

1. Um cupom fiscal é 600x1500 (1:2.5). Em tamanho de patch 14, quantos tokens nativos? Quantos após redimensionamento quadrado pra 336? Qual perde mais acurácia de OCR na prática?

2. Construa a máscara em bloco diagonal pra um batch de quatro imagens com comprimentos 256, 576, 729, 1024. Verifique que a matriz de attention é 2585x2585 e tem exatamente `256^2 + 576^2 + 729^2 + 1024^2` entradas não-zero.

3. Pra uma imagem 1792x896 em patch 14, compare: (a) redimensionamento quadrado pra 336 depois codificar, (b) AnyRes 2x1 + thumbnail, (c) M-RoPE nativo. Qual usa menos tokens? Qual preserva mais detalhe?

4. Implemente dropagem fracionária de patches: dada uma sequência empacotada, dropar 50% dos tokens uniformemente ao acaso e atualizar a máscara em bloco diagonal de acordo. Meça a mudança de esparsidade da máscara.

5. Leia Seção 3.2 do artigo Qwen2-VL (arXiv:2409.12191). Descreva em duas frases o que `min_pixels` e `max_pixels` controlam e por que ambos os limites importam.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|-------------------------|
| Patch-n'-pack | "Empacotamento estilo NaViT" | Concatena sequências de patches de comprimento variável de diferentes imagens numa dimensão de batch |
| Máscara em bloco diagonal | "Máscara de empacotamento" | Máscara de attention que confina os patches de cada imagem a atentarem só a si mesmos, não aos vizinhos no pacote |
| AnyRes | "Mosaico LLaVA-NeXT" | Divide imagem de alta resolução numa grade de tiles de tamanho fixo mais um thumbnail global; cada tile é codificado com um encoder fixo |
| NaFlex | "Flex-nativo SigLIP 2" | Único checkpoint SigLIP 2 que serve orçamentos de 256/729/1024 tokens na inferência sem retreino |
| M-RoPE | "RoPE multimodal" | Encoding posicional rotacional 3D (tempo, linha, coluna) que lida com H, W, T arbitrários sem tabelas de posição |
| cu_seqlens | "Empacotamento FlashAttention" | Tensor de comprimento cumulativo que o caminho varlen do FlashAttention usa em vez de máscara densa em bloco diagonal |
| min_pixels / max_pixels | "Limites de resolução" | Controles por requisição do Qwen2.5-VL que limitam contagem de tokens em entradas muito pequenas ou muito grandes |
| Orçamento de tokens visuais | "Quantos tokens por imagem" | Contagem aproximada de patch tokens emitidos por imagem; define o orçamento de prompt e custo de attention do LLM |

## Leitura Complementar

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)