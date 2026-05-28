# Vision Transformers e a Primitiva Patch-Token

> Antes de qualquer coisa multimodal, uma imagem tem que virar uma sequência de tokens que um transformer consiga digerir. O artigo do ViT de 2020 resolveu isso com patches de 16x16 pixels, uma projeção linear e um embedding posicional. Cinco anos depois, todo modelo frontier de 2026 (Claude Opus 4.7 com 2576px nativo, Gemini 3.1 Pro, Qwen3.5-Omni) ainda começa assim — o encoder mudou de ViT pra DINOv2 pra SigLIP 2, tokens de registro foram adicionados, o esquema posicional virou 2D-RoPE, mas a primitiva permaneceu. Essa lição percorre o pipeline patch-token de ponta a ponta e constrói ele em Python stdlib, pra que o resto da Fase 12 tenha um modelo mental concreto pra "tokens visuais."

**Tipo:** Aprendizado
**Linguagens:** Python (stdib, tokenizador de patches + calculadora de geometria)
**Pré-requisitos:** Fase 7 (Transformers), Fase 4 (Visão Computacional)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Converter uma imagem HxWx3 numa sequência de patch tokens com codificação posicional correta.
- Calcular tamanho da sequência, contagem de parâmetros e FLOPs pra um ViT com configuração (tamanho do patch, resolução, dimensão oculta, profundidade).
- Nomear as três melhorias que levaram o ViT de pesquisa em 2020 a produção em 2026: pré-treinamento auto-supervisionado (DINO / MAE), tokens de registro e empacotamento de resolução nativa.
- Escolher entre pooling CLS, pooling médio e tokens de registro pra uma tarefa downstream.

## O Problema

Transformers operam em sequências de vetores. Texto já é uma sequência (bytes ou tokens). Uma imagem é uma grade 2D de pixels com três canais de cor — não é uma sequência. Se você achatar cada pixel, uma imagem RGB de 224x224 vira 150.528 tokens, e self-attention nesse tamanho não rola (quadrático no tamanho da sequência).

Abordagens pré-2020 encaixavam um extrator de features CNN na frente: ResNet produz um mapa de features 7x7 com vetores de 2048 dimensões, alimenta esses 49 tokens num transformer. Funciona, mas herda os vieses da CNN (equivariância por translação, campos receptivos locais) e perde a fome do transformer por escala.

Dosovitskiy et al. (2020) fizeram a pergunta direta: e se a gente pulasse a CNN? Divide a imagem em patches de tamanho fixo (digamos 16x16 pixels), projeta linearmente cada patch num vetor, adiciona um embedding posicional e alimenta a sequência num transformer vanilla. Na época, isso era heresia — visão sem convoluções. Com dados suficientes (JFT-300M, depois LAION), superou o ResNet no ImageNet e continuou melhorando.

Até 2026, a primitiva ViT é a fundação inquestionável. A torre de visão de todo VLM de pesos abertos é algum descendente (DINOv2, SigLIP 2, CLIP, EVA, InternViT). A questão não é mais "devemos usar patches?" mas "qual tamanho de patch, qual cronograma de resolução, qual objetivo de pré-treinamento, qual codificação posicional."

## O Conceito

### Patches como tokens

Dada uma imagem `x` de forma `(H, W, 3)` e um tamanho de patch `P`, você corta a imagem numa grade de `(H/P) x (W/P)` patches não-sobrepostos. Cada patch é um cubo de pixels `P x P x 3`. Achata cada cubo num vetor de `3 P^2`. Aplica uma projeção linear compartilhada `W_E` de forma `(3 P^2, D)` pra mapear cada patch pra dimensão oculta do modelo `D`.

Na configuração canônica ViT-B/16:
- Resolução 224, tamanho do patch 16 → grade 14x14 → 196 patch tokens.
- Cada patch tem `16 x 16 x 3 = 768` valores de pixel, projetados pra `D = 768`.
- Adiciona um token `[CLS]` aprendível → tamanho da sequência 197.

A projeção de patches é matematicamente idêntica a uma convolução 2D com kernel de tamanho `P`, stride `P` e `D` canais de saída. É assim que o código de produção realmente implementa — `nn.Conv2d(3, D, kernel_size=P, stride=P)`. O enquadramento de "projeção linear" é conceitual; o enquadramento de kernel é eficiente.

### Embeddings posicionais

Patches não têm ordem inerente — o transformer os vê como um saco. ViTs iniciais adicionavam um embedding posicional 1D aprendível (um vetor de 768 dimensões por posição, 197 deles). Funciona, mas amarra o modelo à resolução de treino: na inferência, você tem que interpolar a tabela de posições se mudar a grade.

Backbones modernos de visão usam 2D-RoPE (M-RoPE do Qwen2-VL, padrão do SigLIP 2) ou posições 2D fatorizadas. 2D-RoPE rotaciona os vetores de consulta e key baseado no índice (linha, coluna) do patch, então o modelo infere a posição 2D relativa a partir do ângulo de rotação. Sem tabela de posições. O modelo lida com tamanhos de grade arbitrários na inferência.

### Token CLS, saída com pooling e tokens de registro

Qual é a representação no nível da imagem? Três escolhas coexistem:

1. Token `[CLS]`. Antecede um vetor aprendível à sequência de patches. Depois de todos os blocos transformer, o estado oculto do token CLS é a representação da imagem. Herdado do BERT. Usado pelo ViT original, CLIP.
2. Pooling médio. Faz média dos estados ocultos de saída dos patch tokens. Usado por SigLIP, DINOv2, a maioria dos VLMs modernos.
3. Tokens de registro. Darcet et al. (2023) observaram que ViTs treinados sem um token sink explícito desenvolvem patches de "artefato" com alta norma que sequestram a self-attention. Adicionar 4–16 tokens de registro aprendíveis absorve essa carga e melhora a qualidade de predições densas (segmentação, profundidade). Tanto DINOv2 quanto SigLIP 2 vêm com registros.

A escolha importa pra tarefas downstream. CLS é bom pra classificação. Pra VLMs que alimentam patch tokens num LLM, você pula o pooling completamente — cada patch vira um token de entrada do LLM. Registros são descartados antes da transferência (são andaime, não conteúdo).

### Pré-treinamento: supervisionado, contrastivo, mascarado, auto-distilado

O ViT de 2020 foi pré-treinado com classificação supervisionada no JFT-300M. Rapidamente substituído por:

- CLIP (2021): aprendizado contrastivo imagem-texto em 400M pares. Lição 12.02.
- MAE (2021, He et al.): mascara 75% dos patches, reconstrói pixels. Auto-supervisionado, funciona com imagens puras.
- DINO (2021) / DINOv2 (2023): auto-distilação com estudante-professor, sem rótulos, sem legendas. O ViT-g/14 DINOv2 de 2023 é o backbone puramente visual mais forte e o padrão pra casos de uso com "features densas."
- SigLIP / SigLIP 2 (2023, 2025): CLIP com perda sigmoid e NaFlex pra proporção de aespecificaçãoto nativa. A torre de visão dominante em VLMs abertos de 2026 (Qwen, Idefics2, LLaVA-OneVision).

Sua escolha de pré-treinamento determina pra que o backbone é bom: CLIP/SigLIP pra correspondência semântica com texto, DINOv2 pra features visuais densas, MAE como ponto de partida pra fine-tuning downstream.

### Leis de escala

O escalonamento do ViT (Zhai et al. 2022) estabeleceu que a qualidade de um ViT obedece leis previsíveis no tamanho do modelo, tamanho dos dados e computação. Com computação fixa:
- Modelo maior + mais dados → qualidade melhor.
- Tamanho do patch é uma alavanca no tamanho da sequência vs. fidelidade. Patch 14 (típico pra DINOv2/SigLIP SO400m) dá mais tokens por imagem que patch 16; melhor pra OCR e tarefas densas, pior pra velocidade.
- Resolução é a outra grande alavanca. Ir de 224 pra 384 pra 512 quase sempre ajuda, com custo quadrático em FLOPs.

ViT-g/14 (1B parâmetros, patch 14, resolução 224 → 256 tokens) e SigLIP SO400m/14 (400M parâmetros, patch 14) são os dois encoders workhorse pra VLMs abertos de 2026.

### Contagem de parâmetros pra um ViT

O cálculo completo está em `code/main.py`. Pra ViT-B/16 em 224:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

Faça uma estimativa de todo ViT assim antes de carregar o checkpoint. O tamanho do backbone define seu piso de VRAM em qualquer VLM downstream.

### Configuração de produção de 2026

O encoder que a maioria dos VLMs abertos entrega em 2026 é SigLIP 2 SO400m/14 em resolução nativa (NaFlex). Ele tem:
- 400M parâmetros.
- Tamanho do patch 14, resolução padrão 384 → 729 patch tokens por imagem.
- Pooling médio pra tarefas no nível da imagem; todos os 729 patches fluem pro LLM pra VQA.
- 4 tokens de registro, descartados antes da transferência pro LLM.
- 2D-RoPE com escala no nível da imagem pra proporção de aespecificaçãoto nativa.

Cada decisão nessa configuração remonta a um artigo que você pode ler.

## Use

`code/main.py` é um tokenizador de patches e calculadora de geometria. Ele recebe (H da imagem, W, P do patch, D oculto, L profundidade) e reporta:

- Formato da grade e tamanho da sequência após o patching.
- Sequência de tokens pra uma imagem de brinquedo sintética de 8x8 pixels (percorre o caminho de achatar + projetar).
- Contagem de parâmetros detalhada por patch embed, position embed, blocos transformer e head.
- FLOPs por passo forward na resolução-alvo.
- Uma tabela comparativa entre ViT-B/16 @ 224, ViT-L/14 @ 336, DINOv2 ViT-g/14 @ 224, SigLIP SO400m/14 @ 384.

Rode. Compara as contagens de parâmetros com os números publicados. Brinca com o tamanho do patch e a resolução pra sentir o custo no número de tokens.

## Entregue

Essa lição produz `outputs/skill-patch-geometry-reader.md`. Dada uma configuração de ViT (tamanho do patch, resolução, dimensão oculta, profundidade), produz contagem de tokens, contagem de parâmetros e estimativa de VRAM com justificativas. Use essa skill sempre que escolher um backbone de visão pra um VLM — ela evita surpresas de "os tokens explodiram e o contexto do meu LLM encheu."

## Exercícios

1. Calcule o tamanho da sequência de patch tokens pra Qwen2.5-VL em entrada nativa de 1280x720 com tamanho de patch 14. Como isso se compara com uma representação apenas CLS?

2. Um frame 1080p (1920x1080) em patch 14 produz quantos tokens? A 30 FPS durante um vídeo de 5 minutos, quantos tokens visuais no total? Qual custo te economiza mais: pooling, amostragem de frames ou fusão de tokens?

3. Implemente pooling médio sobre patch tokens em Python puro. Verifique que o pooling médio sobre 196 tokens de uma saída do DINOv2 bate com o que o `forward` do modelo retorna quando você pede um embedding com pooling.

4. Leia a Seção 3 de "Vision Transformers Need Registers" (arXiv:2309.16588). Descreva em duas frases qual artefato os registros absorvem e por que isso importa pra predição densa downstream.

5. Modifique `code/main.py` pra suportar patch-n'-pack: dada uma lista de imagens com diferentes resoluções, produza uma sequência empacotada única e a máscara de attention em bloco diagonal. Verifique contra a Lição 12.06 quando chegar nela.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|-------------------------|
| Patch | "quadrado de 16x16 pixels" | Uma região de tamanho fixo e não-sobreposta da imagem de entrada; vira um token |
| Patch embedding | "projeção linear" | Uma matriz aprendida compartilhada (ou Conv2d com stride=P) que mapeia pixels achatados de patch pra vetores de D dimensões |
| Token CLS | "token de classe" | Vetor aprendível antecedido ao começo cujo estado oculto final representa a imagem inteira; opcional em 2026 |
| Token de registro | "token sink" | Tokens aprendíveis extras que absorvem os artefatos de attention com alta norma que ViTs desenvolvem durante pré-treinamento |
| Embedding posicional | "informação posicional" | Vetor ou rotação por posição que torna a sequência consciente da ordem; 2D-RoPE é o padrão moderno |
| Grade | "grade de patches" | A matriz 2D de (H/P) x (W/P) patches pra uma resolução e tamanho de patch dados |
| NaFlex | "resolução flexível nativa" | Recurso do SigLIP 2: modelo único serve múltiplas proporções e resoluções sem retreinamento |
| Backbone | "torre de visão" | O encoder de imagens pré-treinado cujos tokens de saída de patches alimentam o LLM num VLM |
| Pooling | "resumo no nível da imagem" | Estratégia pra transformar patch tokens num vetor: CLS, médio, attention pooling ou baseado em registro |
| Patch 14 vs 16 | "grade mais fina vs mais grossa" | Patch 14 produz mais tokens por imagem, melhor fidelidade pra OCR, mais lento; patch 16 é o padrão clássico |

## Leitura Complementar

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) — ViT original.
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) — MAE, pré-treinamento auto-supervisionado.
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) — auto-distilação em escala, sem rótulos.
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) — tokens de registro e análise de artefatos.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — a torre de visão padrão de 2026.
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) — leis de escala empíricas.