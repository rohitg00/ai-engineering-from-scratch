# CLIP e treinamento de linguagem visual contraditório

> O CLIP (2021) da OpenAI provou uma única ideia grande o suficiente para alimentar os próximos cinco anos: alinhar um codificador de imagem e um codificador de texto no mesmo espaço vetorial usando apenas pares ruidosos de imagem-caption da web e uma perda contrastiva. Zero rótulos supervisionados. 400 milhões de pares. O espaço de incorporação resultante faz classificação de tiro zero, recuperação de imagem-texto e conecta-se a cada VLM de 2026 como sua torre de visão. SigLIP 2 (2025) substituiu o softmax pelo sigmoide e ultrapassou o CLIP a um custo mais baixo. Esta lição percorre as matemáticas do InfoNCE para a perda pares sigmoid e constrói o passo de treinamento em stdlib Python.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, InfoNCE + sigmoid loss implementations)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 7 (Transformers)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Derivar a perda de InfoNCE a partir de informações mútuas e implementar uma versão vectorizada numericamente estável.
- Explique por que a perda em pares sigmoide (SigLIP) se escala para lote 32768+ sem as exigências de softmax de carga total.
- Execute classificação de imagem de zero-shot construindo modelos de texto (`a photo of a {class}`) e tomar argmax em vez de similaridade cosínica.
- Nomear as quatro alavancas que o CLIP / SigLIP pré-treino lhe dá: tamanho do lote, temperatura, modelo de solicitação, qualidade dos dados.

## O problema

A visão pré-CLIP foi supervisionada. Coletar conjuntos de dados rotulados (ImageNet: 1.2M imagens, 1000 classes), treinar uma CNN, enviá-la.

A web de captura de imagens tem mais de um bilhão de pares de rotulagem vagas gratuitamente. Uma foto de um retriever de ouro com texto alternativo "meu cão Max no parque" carrega um sinal de supervisão.

A resposta do CLIP: trate os pares de imagens-caption como uma tarefa de correspondência. Dado um lote de imagens N e captions N, aprenda a combinar cada imagem com sua própria legenda contra distractores N-1. A supervisão é "estas duas coisas pertencem juntas; estes N-1 não".

O espaço de inserção resultante faz mais do que o CLIP foi treinado para. ImageNet funciona com tiros zero porque "uma foto de um gato" se inclui perto de fotos de gatos que nunca foram expressamente rotulados gatos. Esta é a aposta que gerou cada 2026 VLM.

## O conceito

### O duplo codificador

O CLIP tem duas torres:

- Encoder de imagem `f`: ViT ou ResNet, produz um vetor D-dim por imagem.
- Encoder de texto`g`: transformador pequeno, produz um vetor D-dim por subtítulo.

Ambas as torres normalizam suas saídas para a extensão da unidade.`cos(f(x), g(y)) = f(x)^T g(y)`já que ambas são norma-unidade.

Para um lote de$N$(imagem, legenda) pares, construir a matriz de semelhança `S`de forma`(N, N)`- Não .

```math
S[i, j] = \cos(f(x_i), g(y_j)) / \tau
```

onde`tau`é uma temperatura aprendida (CLIP inicializa-se em 0,07; aprendida no log-space).

### Perda de InfoNCE

O CLIP utiliza uma entropia cruzada simétrica sobre linhas e colunas:

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

Esta é a InfoNCE. A softmax em CE obriga cada imagem a corresponder à sua legenda mais do que qualquer outra legenda no lote. Os "negativos" são todos os outros itens do lote. Batches maiores = mais negativos = sinal mais forte. CLIP treinado no lote 32k; escala importa.

### Temperatura

`tau`Controla a nitidez da suavidade máxima.$\tau$→ Distribuição acentuada, efeito de mineração duro negativo.$\tau$→ suave, todas as amostras contribuem.$\log(1/\tau)$O SigLIP 2 corrige o inicial.$\tau$e usa um viés aprendido em vez disso.

### Por que a sigmoide se balança melhor (SigLIP)

Softmax precisa de toda a matriz de semelhança em sincronia. No treinamento distribuído você deve reunir todas as incorporações para cada réplica, então fazer o softmax.

SigLIP substitui softmax por sigmoide por elemento: para cada par `(i, j)`, a perda é uma classificação binária de "estes são o par de correspondência?"

```math
L = -\frac{1}{N} \sum_{(i, j)} \Big[ y_{ij} \log \mathop{\mathrm{sigmoid}}(S[i,j]) + (1-y_{ij}) \log \mathop{\mathrm{sigmoid}}(-S[i,j]) \Big]
```

`y_ij = 1`se`i == j`Cada GPU calcula seu bloco local e somas. SigLIP 2 escala para lotes 32k-512k a baixo custo onde CLIP precisaria de proporcionalmente mais comunicação.

### Classificação de tiros zero

Dados nomes de classes N, para cada classe criar um modelo de texto:

```
"a photo of a {class}"
```

Embed cada modelo com o codificador de texto. Embed sua imagem com o codificador de imagem. Argmax cosine similaridade = classe prevista. Nenhum treinamento sobre as classes alvo.

Templates de imediato importam. O papel original do CLIP usava 80 modelos por classe (planos, artísticos, fotos, pinturas, etc.) e mediou os embutidos. +3 pontos ImageNet. O uso moderno normalmente escolhe um ou dois modelos.

### Análises lineares e ajustes finos

A sonda linear (treinar uma camada linear em cima de recursos CLIP congelados para suas classes alvo) supera a sonda linear em tarefas no domínio.

### SigLIP 2: NaFlex e características densas

A SigLIP 2 (2025) acrescenta:
- NaFlex: um modelo único lida com proporções de aspecto e resoluções variáveis.
- Melhores características densas para a segmentação e a estimativa da profundidade, com foco na utilização como espinha dorsal congelada em VLMs.
- Multilíngue: formado em mais de 100 línguas, onde o CLIP era apenas em inglês.
- 1B escala paramétrica onde o CLIP alcançou o topo em 400M.

Em 2026 VLMs abertos, SigLIP 2 SO400m/14 é a torre de visão padrão. CLIP continua a ser o padrão para recuperação de texto de imagem pura, onde a distribuição de treinamento específica LAION-2B corresponde ao padrão de consulta.

### A Comissão deve apresentar ao Parlamento Europeu e ao Conselho um relatório sobre a aplicação do artigo 108.o, n.o 1, do Regulamento (CE) n.o 1069/2009 do Parlamento Europeu e do Conselho.

ALIGN (Google, 2021): a mesma ideia que CLIP, escala de pares 1,8B, 90% barulhento. Escalas de dados barulhentos comprovadas. OpenCLIP (LAION): reprodução aberta de CLIP no LAION-400M / 2B, escalas múltiplas, o ponto de verificação de entrada para abertura. EVA-CLIP: inicializa a partir de modelagem de imagem mascarada; forte espinha dorsal para VLMs. Básico: híbrido CLIP+ALIGN do Google. Todas as mesmas famílias, dados diferentes e sintonização.

### O teto de tiro zero

Os modelos CLIP-class cobrem cerca de 76% ImageNet zero-shot (CLIP-G, OpenCLIP-G). Além disso, requer dados muito maiores (SigLIP 2 obtém 80% +) ou mudanças de arquitetura (cabeças supervisionadas, mais parâmetros).

```figure
multimodal-fusion
```

## Usá-lo

`code/main.py`Implementos:

1. Um duplo codificador de brinquedo (funções de imagem baseadas em hash, funções de gráfico de texto) para que você possa ver a forma InfoNCE sem numpy.
2. Perda de InfoNCE em Python puro (estabilidade numérica através de log-sum-exp).
3. Perda em pares Sigmoide para comparação.
4. Uma rotina de classificação de tiro zero: computa a semelhança cosínica contra um conjunto de instruções de texto, argmax para previsão.

Os números absolutos são brinquedos, a forma corresponde ao que um treinador real emite.

## Envia-o

Esta lição produz`outputs/skill-clip-zero-shot.md`. Tendo em conta um conjunto de imagens (via caminho) e uma lista de classes-alvo, ele cria instruções de texto com o modelo CLIP, incorpora ambos os lados com um ponto de controlo indicado (por exemplo, `openai/clip-vit-large-patch14`A habilidade recusa-se a fazer alegações sobre classes não na lista de solicitações.

## Exercícios

1. Implementar InfoNCE para um lote de 4 pares à mão. Construa a matriz de semelhança 4x4, execute softmax, escolha a diagonal, computa entropia cruzada. Verifique sua implementação Python contra este cálculo manual.

2. O SigLIP utiliza um parâmetro de preconceito `b`Além da temperatura: `S'[i,j] = S[i,j]/tau + b`- Que papel faz ?`b`A série de jogo é executada quando o lote apresenta um grande desequilíbrio de classes (muitos mais negativos do que positivos por fila)?

3. Construir um classificador de tiros zero para gatos versus cães. Tente dois modelos rápidos: `a photo of a {class}`E ...`a picture of a {class}`- Medir a precisão em 100 imagens de teste.

4. Calcule o custo de comunicação de softmax InfoNCE vs sigmoid em pares para uma corrida de 512 GPU em lote 32k.$O(N)$, que como $O(N^2)$Cite a secção 4 do Siglip.

5. Leia o artigo sobre as leis de escalagem do OpenCLIP (arXiv:2212.07143, Cherti et al.). Reproduzir a sua conclusão para a escalagem de dados a partir dos números: em tamanho fixo do modelo, qual é a relação log-linear entre a precisão de imagem de imagem de imagem de imagem de imagem zero e o tamanho dos dados de treinamento?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| InfoNCE | "Contrastive loss" | Cross-entropy over a batch's similarity matrix; each item's positive is its paired item, negatives are everything else |
| Sigmoid loss | "SigLIP loss" | Per-pair binary cross-entropy; no softmax, no all-gather, scales cheaply in distributed training |
| Temperature | "tau" | Scalar that scales logits before softmax/sigmoid; controls sharpness of the distribution |
| Zero-shot | "no-finetune classification" | Use text prompts to construct class embeddings and classify by cosine similarity; no training on target classes |
| Prompt template | "a photo of a ..." | Text scaffold around a class name; affects zero-shot accuracy by 1-5 points |
| Dual encoder | "Two-tower" | One image encoder + one text encoder, outputs in shared D-dim space |
| Hard negative | "Tough distractor" | A negative similar enough to the positive that the model has to work to separate them |
| Linear probe | "Frozen + one layer" | Train only a linear classifier on top of frozen features; measures feature quality |
| NaFlex | "Native flexible resolution" | SigLIP 2 capability to ingest images at any aspect ratio and resolution without resizing |
| Temperature scaling | "log-parametrized tau" | CLIP parametrizes `log(1/tau)` so gradients behave; clips to prevent collapse to near-zero tau |

## Mais leitura

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020)- O documento CLIP.
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) SigLIP.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) multilíngue + NaFlex.
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) Escala com dados da web barulhentos.
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) Leis de escalação OpenCLIP.
