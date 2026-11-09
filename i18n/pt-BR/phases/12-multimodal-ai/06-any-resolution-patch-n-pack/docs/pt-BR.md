# Visão de qualquer resolução: Patch-n'-Pack e NaFlex

> Imagens reais não são 224x224 quadrados. Um recibo é 1: 3, um gráfico é 16: 9, uma varredura médica pode ser 4096x4096, uma captura de tela móvel é 9:19.5. A resposta VLM pré-2024  redimensionar tudo para um quadrado fixo  jogou fora o sinal que faz OCR, compreensão de documentos e análise de cena de alta resolução trabalhar. NaViT (Google, 2023) mostrou que você pode embalar patches de resolução variável em um único lote de transformador com mascaramento de diagonal de bloco. O M-RoPE (2024) do Qwen2-VL desistiu completamente das tabelas de posições absolutas. AnyRes do LLaVA-NeXT enrolaram imagens de alta resolução em uma base + sub-imagens. A variante NaFlex (2025) do SigLIP 2 é agora o codificador padrão para VLMs abertos que querem um único ponto de verificação para atender a cada relação de aspecto. Esta lição implementa patch-n'-pack de ponta a ponta.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, patch packer + block-diagonal mask)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 12 · 05 (LLaVA)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Envolva os patches de um lote de imagens de resolução variável numa sequência e construa a máscara de atenção de bloco-diagonal.
- Escolha entre o OneRes tiling (LLaVA-NeXT), o NaFlex (SigLIP 2) e o M-RoPE (Qwen2-VL) para uma determinada tarefa.
- Compute orçamentos de tokens para OCR, gráficos e fotografia sem redimensionar.
- Cite os três modos de falha de quadrado: texto esmagado, conteúdo cortado, tokens desperdiçados no enchimento.

## O problema

Os transformadores esperam uma sequência. Um lote é uma pilha de sequências do mesmo comprimento. Se as suas imagens são 224x224, você recebe 196 tokens de parche toda vez, não é necessário enchimento, o trabalho feito. Trein no 224, infer no 224, nunca mais pense sobre resolução.

Os documentos são retratos (8,5x11 polegadas, 2:3-ish). As imagens de gráficos são paisagem (16:9). Os recibos são altos e finos (1:3). Os navios de imagem médica em 2048x2048 ou maior.

Três opções pré-2024 e por que cada uma falha:

1. Reduzir para um quadrado fixo (224x224 ou 336x336). O squish distorce texto e faces. A escala baixa destrói os rótulos de gráficos e o conteúdo de OCR. Prática padrão até LLaVA-1.5.
2. A colheita em uma relação de aspecto fixa, você joga fora a maior parte da imagem, e escolher o local da colheita é seu próprio problema de visão.
3. Pad para o lado mais longo. Corre distorção, mas desperdiça 50%+ de tokens em padding para imagens de retrato.

A resposta 2024-2025: deixe o transformador comer manchas na resolução nativa da imagem, e descobrir como empacotar um lote heterogêneo em uma sequência sem desperdiçar computação.

## O conceito

### NaViT e patch-n'-pack

NaViT (Dehghani et al., 2023) foi o artigo que mostrou que isso funciona em escala.

1. Para cada imagem no lote, calcule a sua grade de parche nativa em um tamanho de parche escolhido (digamos 14).
2. Aplanar os patches de cada imagem em sua própria sequência de comprimento variável.
3. Concatenar todos os parches de imagens em uma longa sequência para o lote.
4. Construir uma máscara de atenção de diagonal de bloco para que os parches da imagem A só atendam dentro da imagem A.
5. Carregar informações de posição por parche (2 RoPE ou inserções de posição fracionária).

Um lote de três imagens em 336x336 (576 tokens), 224x224 (256 tokens) e 448x336 (768 tokens) se torna uma sequência de 1600 tokens com uma máscara de bloco-diagonal 1600x1600.

NaViT também introduziu a queda de parches fracionários durante o treinamento  queda de 50% de parches aleatórias em todo o lote  que regulariza e acelera o treinamento.

### AnyRes (LLaVA-NeXT)

O AnyRes da LLaVA-NeXT é a alternativa pragmática. Dada uma imagem de alta resolução e um codificador fixo (CLIP ou SigLIP em 336), o quadro é feito de azulejo:

1. Escolha um layout de grade de um conjunto predefinido  (1x1), (1x2), (2x1), (1x3), (3x1), (2x2), etc.  que melhor se adapte à relação de aspecto da imagem.
2. Tire a imagem completa na grade; cada telha se torna uma colheita de 336x336.
3. Também produzir uma miniatura: toda a imagem de tamanho 336x336 como um token de contexto global.
4. Encode cada telha através do encodeador congelado 336.

Para uma imagem 672x672 em 2x2 grade mais miniatura: 4 * 576 + 576 = 2880 tokens visuais.

AnyRes é a rota de escolha quando o seu codificador está congelado e suporta apenas uma resolução. Ele explode a contagem de tokens para imagens grandes (uma imagem de 1344x1344 em 4x4 grade é 9216 + 576 ≈ 9800 tokens, que supera um contexto de LLM de 8k antes de qualquer texto chegar).

### M-RoPE (Qwen2-VL)

Qwen2-VL introduziu a Embedding Multimodal Rotary Positioning. Em vez das posições fracionárias do NaViT ou da telha e miniatura do AnyRes, cada parche carrega uma posição 3D (temporal, altura, largura). As rotações de consulta / chave gerenciam H, W e comprimento temporal arbitrários.

M-RoPE envia resolução dinâmica nativa sem reformulação. Na inferência de você alimentar qualquer imagem HxW, o inseridor de patch produz tokens H/14 x W/14, cada token obtém sua posição (t=0, r=row, c=col), RoPE gira a atenção com as frequências certas, feito. Qwen2.5-VL e Qwen3-VL continuam assim. V2PE do InternVL3 é a mesma ideia com codificação variável por modalidade.

Ao contrário do AnyRes, o M- RoPE é $O(H \times W / P^2)$O software de partilha de dados é um sistema de partilha de dados que permite a transferência de dados para outros dispositivos.

### NaFlex (SigLIP 2)

NaFlex é o modo nativo do checkpoint SigLIP 2. Um único modelo serve vários comprimentos de sequência (256, 729, 1024 tokens) na inferência. Internamente, ele usa patch-n'-pack no estilo NaViT durante o treinamento e posições fraccionais absolutas por patch.

Para uma tarefa semântica (classificação, recuperação), 256 tokens. Para OCR ou compreensão de gráficos, 1024 tokens. Sem reformulação.

### A máscara de embalagem

A máscara de diagonal de bloco é onde a maioria das implementações tropeça.`N_total`Representações de imagens `i=0..B-1`com comprimentos `n_i`, a máscara .`M`de forma`(N_total, N_total)`é 1 se ambos os índices caem no mesmo bloco da imagem, ou 0. Você pode construí-lo a partir de uma lista de comprimento cumulativo:

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

Esta é uma linha em PyTorch com `torch.block_diag`O caminho de comprimento variável da FlashAttention (`cu_seqlens`) salta a máscara inteiramente e atende em sequências usando o tensor de comprimento acumulativo diretamente  ~ 10 vezes mais rápido do que uma máscara densa para lotes típicos.

### Orçamentos de tokens

Escolha a sua estratégia por tarefa:

- OCR / documentos: 1024-4096 tokens. SigLIP 2 NaFlex em 1024, ou AnyRes 3x3 + miniatura.
- Gráficos e UI: 729-1024 tokens em 384-448 nativo. Qwen2.5VL resolução dinâmica com limite máximo de pixels.
- Fotos naturais: 256-576 tokens está bem. O LLM em baixo vê o suficiente. Pague para tokens onde a densidade de conteúdo é alta.
- Vídeo: 64-128 tokens por quadro após a agregação espacial, 2-8 FPS.

A regra de produção de 2026: escolher um limite máximo de pixels por tarefa, codificar em relação de aspecto nativa até esse limite, embalar o lote e saltar empilhadeira.`min_pixels`E ...`max_pixels`Para este botão.

```figure
mm-patch-n-pack
```

## Usá-lo

`code/main.py`Implementa o patch-n'-pack para um lote heterogêneo de imagens com coordenadas de pixel inteiros.

- Toma uma lista de tamanhos de imagem (H, W).
- Calcula o comprimento da sequência de parches de cada imagem no tamanho de parche 14.
- Enchém-os numa sequência de comprimento total .`sum(n_i)`- Não .
- Construi a máscara de atenção de bloco-diagonal (densa, para clareza).
- Compara o custo de embalagem com o tamanho quadrado e o revestimento de AnyRes.
- Imprime uma tabela de orçamento simbólico para um lote misturado (receito, gráfico, captura de tela, foto).

Os números que caem são a razão de cada VLM aberto em 2026 usarem patch-n'-pack.

## Envia-o

Esta lição produz`outputs/skill-resolution-budget-planner.md`. Dada uma carga de trabalho de relação de aspecto mista (OCR, gráficos, fotos, quadros de vídeo) e um orçamento total de tokens, ele escolhe a estratégia certa (NaFlex, AnyRes, M-RoPE ou quadrado fixo) e emite uma configuração por pedido.

## Exercícios

1. Um recibo é 600x1500 (1:2.5). No tamanho do patch 14, quantos tokens de resolução nativa? Quantos depois de quadrado para 336? Que perde mais precisão OCR na prática?

2. Construa a máscara de diagonal de bloco para um lote de quatro imagens com comprimentos 256, 576, 729, 1024. Verifique a matriz de atenção é 2585x2585 e tem exatamente `256^2 + 576^2 + 729^2 + 1024^2`Notas não-zero.

3. Para uma imagem 1792x896 no patch 14, compare: (a) quadrado-dimensional para 336 e então codificar, (b) AnyRes 2x1 + miniatura, (c) M-RoPE em nativo. Qual usa menos tokens?

4. Implementar a queda de parche fracionário: dada uma sequência embalada, solte 50% dos tokens uniformemente ao acaso e atualize a máscara de diagonal de bloco em conformidade. Meter a mudança de esparcia da máscara.

5. Leia a secção 3.2 do documento Qwen2-VL (arXiv:2409.12191).`min_pixels`E ...`max_pixels`O controlo e por que ambas as fronteiras importam.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Patch-n'-pack | "NaViT-style packing" | Concatenate variable-length patch sequences from different images into one batch dimension |
| Block-diagonal mask | "Packing mask" | Attention mask that confines each image's patches to attend only to themselves, not neighbors in the pack |
| AnyRes | "LLaVA-NeXT tiling" | Split a high-res image into a grid of fixed-size tiles plus a global thumbnail; encode every tile with a fixed encoder |
| NaFlex | "SigLIP 2 native-flex" | Single SigLIP 2 checkpoint that serves 256/729/1024-token budgets at inference without retraining |
| M-RoPE | "Multimodal RoPE" | 3D rotary position encoding (time, row, column) that handles arbitrary H, W, T without position tables |
| cu_seqlens | "FlashAttention packing" | Cumulative-length tensor the FlashAttention varlen path uses instead of a dense block-diagonal mask |
| min_pixels / max_pixels | "Resolution bounds" | Qwen2.5-VL per-request knobs capping token count on very small or very large inputs |
| Visual token budget | "How many tokens per image" | Rough count of patch tokens emitted per image; sets the LLM's prompt budget and attention cost |

## Mais leitura

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
