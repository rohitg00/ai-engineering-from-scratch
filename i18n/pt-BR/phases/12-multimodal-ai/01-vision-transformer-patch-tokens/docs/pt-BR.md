# Transformadores de visão e o primitivo com patch-token

> Antes de qualquer coisa multimodal, uma imagem tem de se tornar uma sequência de tokens que um transformador pode comer. O documento ViT de 2020 respondeu a isso com parches de 16x16 pixels, uma projeção linear e uma inserção de posição. Cinco anos depois, cada modelo de fronteira de 2026 (Claude Opus 4.7 em 2576px nativo, Gemini 3.1 Pro, Qwen3.5-Omni) ainda começa desta forma  o codificador mudou de ViT para DINOv2 para SigLIP 2, foram adicionados tokens de registro, o esquema posicional tornou-se 2D-RoPE, mas o primitivo manteve. Esta lição lê o pipeline de patch-tokens de ponta a ponta e constrói-o em stdlib Python para que o resto da Fase 12 tenha um modelo mental concreto para "tokens visuais".

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Converte uma imagem HxWx3 em uma sequência de tokens de correção com codificação posicional correta.
- Calcule o comprimento da sequência, a contagem de parâmetros e os FLOPs para um ViT de um dado ( tamanho do parche, resolução, escuridão oculta, profundidade).
- Cite as três atualizações que levaram a ViT da pesquisa de 2020 para a produção de 2026: pré-treinamento auto-supervisionado (DINO / MAE), tokens de registro e embalagem de resolução nativa.
- Escolha entre o CLS pooling, o pooling médio e o registro de tokens para uma tarefa a jusante.

## O problema

Os transformadores operam em sequências de vetores. O texto já é uma sequência (bytes ou tokens). Uma imagem é uma grade 2D de pixels com três canais de cores  não uma sequência. Se você achar cada pixel, uma imagem RGB 224x224 se torna 150.528 tokens, e a auto-atenção naquele comprimento é um não-starter (quadrático no comprimento da sequência).

As abordagens pré-2020 viraram um extractor de recursos da CNN para a frente: a ResNet produz um mapa de recursos 7x7 de vetores de 2048 dimensões, alimenta esses 49 tokens para um transformador.

Dosovitskiy et al. (2020) fez a pergunta contundente: e se saltarmos a CNN? Divida a imagem em parches de tamanho fixo (digamos 16x16 pixels), projetar linearmente cada parche em um vetor, adicionar um inserimento posicional e alimentar a sequência para um transformador de vainilha. Na época, esta era uma visão herésica sem convulsões. Com dados suficientes (JFT-300M, então LAION) ele venceu a ResNet na ImageNet e continuou a melhorar.

Em 2026, o ViT primitivo é o fundamento incontestável. Cada torre de visão de VLM de peso aberto é algum descendente (DINOv2, SigLIP 2, CLIP, EVA, InternViT). A questão não é mais "deveríamos usar patches?" mas "que tamanho de patch, qual cronograma de resolução, qual objetivo de pré-treino, qual codificação posicional".

## O conceito

### Patches como tokens

Dado uma imagem `x`de forma`(H, W, 3)`e um tamanho de parche `P`, você esculpir a imagem em uma grade de`(H/P) x (W/P)`- não se sobrepõem.`P x P x 3`Cubo de pixels. Aplanar cada cubo para um `3 P^2`Aplicar uma projeção linear compartilhada `W_E`de forma`(3 P^2, D)`para mapear cada parche na dimensão oculta do modelo `D`- Não .

Para a configuração canónica ViT-B/16:
- Resolução 224, tamanho do parche 16 → rede 14x14 → 196 tokens do parche.
- Cada parche é`16 x 16 x 3 = 768`Valores de pixels, projetados para `D = 768`- Não .
- Adicionar um aprendizagem `[CLS]`token → sequência de longo 197.

A projeção de correio é matematicamente idêntica a uma convolução 2D com tamanho do núcleo `P`, passo `P`, e `D`É assim que o código de produção realmente o implementa.`nn.Conv2d(3, D, kernel_size=P, stride=P)`O enquadramento da "projeção linear" é conceitual; o enquadramento do núcleo é eficiente.

### Embedings de posição

Os parches não têm ordem inerente  o transformador os vê como um saco. Os primeiros ViTs adicionaram um inserimento posicional 1D aprendizagem (um vetor de 768-dim por posição, 197 deles). Funciona, mas liga o modelo à resolução de treinamento: na inferência você tem que interpolar a tabela de posição se você mudar a grade.

Os espinhos de visão modernos usam 2D-RoPE (M-RoPE do Qwen2-VL, padrão do SigLIP 2) ou posições 2D factorizadas. 2D-RoPE gira a consulta e vetores-chave com base no índice do parche (fila, coluna), de modo que o modelo infere a posição 2D relativa do ângulo de rotação.

### Tokens CLS, saída conjunta e tokens de registro

O que é a representação no nível da imagem?

1. `[CLS]`token. Prepare um vetor apropriado para a sequência de correção. Depois de todos os blocos transformadores, o estado oculto do token CLS é a representação da imagem. Herda do BERT. usado pelo ViT original, CLIP.
2. Uma média de estados ocultos dos tokens dos patches, usada pela SigLIP, DINOv2, a maioria dos VLMs modernos.
3. Os dados de registro são de acordo com o estudo de Darcet e outros (2023) que os vídeos treinados sem um token de lavagem explícito desenvolvem patches de "artifatos" de alta norma que sequestram a auto-atenção.

A escolha importa para tarefas a jusante. CLS é bom para classificação. Para VLMs que alimentam tokens de patch em um LLM, você evita a agregação inteira  cada patch se torna um token de entrada do LLM. Os registros são descartados antes da entrega (eles são andares, não conteúdo).

### Pre-treinamento: supervisionado, contrastivo, mascarado, auto-destilado

O ViT 2020 foi pré-treinado com classificação supervisionada no JFT-300M. Substituído rapidamente por:

- CLIP (2021): texto de imagem contrastante em pares 400M. Lição 12.02.
- MAE (2021, He et al.): mascar 75% dos patches, reconstruir pixels. Auto-supervisionado, trabalha em imagens puras.
- DINO (2021) / DINOv2 (2023): auto-distilação com aluno-professor, sem rótulos, sem legendas. O 2023 DINOv2 ViT-g/14 é a espinha dorsal puramente visual mais forte e o padrão para casos de uso de "características densas".
- SigLIP / SigLIP 2 (2023, 2025): CLIP com perda sigmoide e NaFlex para relação de aspecto nativa. A torre de visão dominante em 2026 VLMs abertos (Qwen, Idefics2, LLaVA-OneVision).

A escolha de um pré-treino determina para que a coluna vertebral é boa: CLIP/SigLIP para a correspondência semântica com o texto, DINOv2 para características visuais densas, MAE como ponto de partida para a sintonização de fundo.

### Leis de escalagem

A escalação ViT (Zhai et al. 2022) estabeleceu que a qualidade de uma ViT obedece a leis previsíveis no tamanho do modelo, tamanho dos dados e computação.
- Um modelo maior + mais dados → melhor qualidade.
- O tamanho do patch é uma alavanca no comprimento da sequência versus fidelidade. Patch 14 (típico para DINOv2/SigLIP SO400m) dá mais tokens por imagem do que patch 16; melhor para OCR e tarefas densas, pior para velocidade.
- A resolução é a outra grande alavanca. Passar de 224 para 384 para 512 quase sempre ajuda, a um custo quadrático em FLOPs.

ViT-g/14 (1B params, patch 14, resolução 224 → 256 tokens) e SigLIP SO400m/14 (400M params, patch 14) são os dois codificadores de cavalo de trabalho para 2026 VLMs abertos.

### Contagem de parâmetros para um ViT

O cálculo completo está em`code/main.py`Para ViT-B/16 em 224:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

Estabeleça cada ViT desta forma antes de carregar o ponto de controlo.

### Configuração de produção 2026

O codificador mais aberto que os VLMs enviam em 2026 é SigLIP 2 SO400m/14 em resolução nativa (NaFlex).
- Parâmetros de 400M.
- Tamanho do parche 14, resolução padrão 384 → 729 tokens de parche por imagem.
- Pool médio para tarefas de nível de imagem; todos os 729 patches fluem para o LLM para VQA.
- 4 fichas de registro, descartadas antes da entrega do LLM.
- 2D-RoPE com escalação de nível de imagem para a relação de aspecto nativa.

Cada decisão nesse config remonta a um jornal que você pode ler.

```figure
image-patch-tokens
```

## Usá-lo

`code/main.py`é um tokenizer de parche e calculadora de geometria.

- Forma da grade e comprimento da sequência após a fixação.
- Seqüência de tokens para uma imagem de brinquedo sintética de 8x8 pixels (caminhar pela trajetória plano + projeto).
- Contagem de parâmetros dividida por inserção de parche, inserção de posição, blocos de transformador e cabeça.
- FLOPs por passagem avançada na resolução-alvo.
- Uma tabela de comparação em ViT-B/16 @ 224, ViT-L/14 @ 336, DINOv2 ViT-g/14 @ 224, SigLIP SO400m/14 @ 384.

Aplique o número de parâmetros com os números publicados, use o tamanho e a resolução do parche para sentir o custo da contagem de tokens.

## Envia-o

Esta lição produz`outputs/skill-patch-geometry-reader.md`. Dada uma configuração ViT ( tamanho do parche, resolução, escuridão oculta, profundidade), produz uma contagem de tokens, contagem de parâmetros e estimativa VRAM com justificativas.

## Exercícios

1. Calcule o comprimento da sequência de patch-token para Qwen2.5-VL na entrada nativa 1280x720 com tamanho do patch 14. Como isso se compara a uma representação apenas CLS?

2. Um quadro 1080p (1920x1080) no patch 14 produz quantos tokens? A 30 FPS em um vídeo de 5 minutos, quantos tokens visuais totais? Qual é o custo mais economizado: pooling, amostragem de quadro ou fusão de tokens?

3. Implementar o pooling médio sobre tokens de patch em Python puro. Verifique se o pool médio sobre 196 tokens de uma saída DINOv2 corresponde ao modelo `forward`Retorna quando pedem uma incorporação em conjunto.

4. Leia a Seção 3 do livro "Os Transformadores de Visão precisam de Registros" (arXiv:2309.16588). Descreva em duas frases o que os registros absorvem e por que é importante para a previsão densa a jusante.

5. Modificar`code/main.py`Para suportar o patch-n'-pack: dada uma lista de imagens de diferentes resoluções, produzir uma única sequência de embalagens e a máscara de atenção de diagonal de blocos.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Patch | "16x16 pixel square" | A fixed-size non-overlapping region of the input image; becomes one token |
| Patch embedding | "Linear projection" | A shared learned matrix (or Conv2d with stride=P) mapping flattened patch pixels to D-dim vectors |
| CLS token | "Class token" | Prepended learnable vector whose final hidden state represents the whole image; optional in 2026 |
| Register token | "Sink token" | Extra learnable tokens that absorb the high-norm attention artifacts ViTs develop during pretraining |
| Position embedding | "Positional info" | Per-position vector or rotation making the sequence-order-aware; 2D-RoPE is the modern default |
| Grid | "Patch grid" | The (H/P) x (W/P) 2D array of patches for a given resolution and patch size |
| NaFlex | "Native flexible resolution" | SigLIP 2 feature: single model serves multiple aspect ratios and resolutions without retraining |
| Backbone | "Vision tower" | The pretrained image encoder whose patch-token outputs feed the LLM in a VLM |
| Pooling | "Image-level summary" | Strategy to turn patch tokens into one vector: CLS, mean, attention pool, or register-based |
| Patch 14 vs 16 | "Finer vs coarser grid" | Patch 14 produces more tokens per image, better fidelity for OCR, slower; patch 16 is the classic default |

## Mais leitura

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929)- ViT original.
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) MAE, auto-supervisão pré- treino.
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193)- Auto-distilação em escala, sem rótulos.
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) registar tokens e análise de artefatos.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) a torre de visão padrão de 2026.
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) leis empíricas de escala.
