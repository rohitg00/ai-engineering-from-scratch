# Flamingo e Atensão cruzada por porta para VLMs com poucas tiros

> O Flamingo de DeepMind (2022) fez duas coisas antes de qualquer outra pessoa. Mostrou que um único modelo poderia processar sequências arbitrariamente entrelaçadas de imagens, vídeos e texto. E mostrou que os VLMs podiam aprender no contexto  dar um prompt de alguns tiros com três pares de exemplos (imagem, legenda) e o modelo substitui uma nova imagem sem qualquer passo de gradiente. O mecanismo: camadas de atenção cruzada fechadas, inseridas entre as camadas existentes do LLM congelado, com um portal tanh aprendido que começa a zero para que a capacidade de texto do LLM seja preservada na inicialização. Esta lição percorre o re-sampler Perceptor do Flamingo e a arquitetura de atenção cruzada fechada, o ancestral das entradas entrelaçadas do Gemini e dos tokens visuais do Idefics2.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, gated cross-attention + Perceiver resampler demo)
**Prerequisites:** Phase 12 · 03 (BLIP-2 Q-Former)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Explique como a atenção cruzada por gate preserva a capacidade de texto do LLM congelado na inicialização via tanh(gate) = 0.
- Passe por um resampler Perceptor: N patches de imagem → K fixa "latentes" consultas através da atenção cruzada.
- Descreva como Flamingo lida com sequências de imagem-texto entrelaçadas com mascaramento causal que respeita a colocação da imagem.
- Reproduzir uma estrutura de prompt multimodal de algumas fotos (3 exemplos de captura de imagem e depois uma imagem de consulta).

## O problema

BLIP-2 alimenta 32 tokens visuais na camada de entrada de um LLM congelado. Funciona para uma imagem por pedido. Mas e se quiserem alimentar *muitas* imagens entrelaçadas com texto, como em "aqui está a imagem A, subtítulo; aqui está a imagem B, subtítulo; agora aqui está a imagem C, subtítulo"? A auto-atenção do LLM precisaria lidar com tokens de imagem e tokens de texto em um único fluxo, e a questão de quais posições podem atender a quais imagens se torna agitada.

A resposta do Flamingo: não alterem o fluxo de entrada do LLM. Insira camadas de atenção cruzada extra entre os blocos de LLM existentes. Os tokens de texto ainda fluem através da auto-atenção causal do LLM como sempre. Entre cada poucos blocos de LLM, tokens de texto também atendam às características da imagem através de uma nova camada fechada. O portal (iniciado para zero) significa que no passo zero as novas camadas são sem operações  o modelo se comporta exatamente como o LLM pré-treinado. À medida que o treinamento progride, o portão abre-se e a informação visual começa a fluir.

A segunda pergunta que Flamingo respondeu: como lidar com um número variável de imagens (0, 1 ou muitas) por pedido? Um resampler Perceptor  um pequeno módulo de atenção cruzada que toma o número de patches que você tem e produz um número fixo de tokens visuais latentes por imagem. O total cresce com a contagem de imagens, mas cada token de texto lê apenas os latentes de uma imagem, então o que qualquer token de texto vê em atenção cruzada tem a mesma forma, independentemente de quantas imagens estão no prompt.

## O conceito

### O LLM congelado

Flamingo começa com um LLM congelado Chinchilla 70B. Todos os pesos 70B intactos.

### Re-estampilador de percepção

Para cada imagem no prompt, o ViT produz $N$O re-estamplador do Perceptor tem$K$- a utilização de sistemas de informação e de informação (Flamingo utiliza $K=64$Cada bloco de resampler é constituído por duas sub-passas:

1. A atenção cruzada: o $K$As pessoas que estão latentes assistem ao longo do $N$Tokens de patches (Q de patches latentes, K/V de patches).
2. Auto-atenção + FFN dentro dos latentes.

Após 6 blocos de resampler, a saída é $K=64$As imagens de dim 1024 são de 224x224 (196 patches) e de 480x480 (900 patches) e ambos são de 64 resampler.

Para o vídeo, o resampler é aplicado temporalmente: os patches de cada quadro produzem 64 latentes, e uma codificação posicional temporal permite que o modelo distinja $t=0$de$t=N$O vídeo completo torna-se$T \cdot 64$Tokens visuais.

### Atensão transversal

Entre cada um .$M$As camadas do MLL congelado (Flamingo utiliza $M=4$), inserir um novo bloco de atenção cruzada fechado:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha`é um escalar aprendizagem iniciado em zero.
- `tanh(0) = 0`, então no init o ramo fechado contribui com zero.
- Como ...`alpha`Se a contribuição de atenção cruzada se afastar do zero, a contribuição cresce sem problemas.
- A conexão residual significa que mesmo um portal totalmente aberto não sobreescreve a representação do texto do LLM; apenas adiciona informações visuais no topo.

Esta é a escolha de design mais importante no Flamingo: o condicionamento visual é aditivo, fechado e zero na inicialização.

### A atenção cruzada mascarada para entradas entrelaçadas

Em um prompt como "<imagem A> legenda A <imagem B> legenda B <imagem C> ?", cada token de texto deve ver apenas imagens que vieram antes dele na sequência. A máscara de atenção cruzada impõe: token de texto na posição `t`Atende apenas aos tokens de resampler de imagem `i_t`, onde`i_t`é a imagem mais recente antes da posição `t`"Vede apenas a última imagem anterior" ou "vê todas as imagens anteriores" são ambas opções válidas; Flamingo escolheu a primeira.

### Aprendizagem em poucos tiros no contexto

Um sinal do Flamingo parece:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

O modelo vê o padrão de conclusão e produz " pássaro" (ou o que a imagem 3 mostra). Não há passos de gradiente. A capacidade de aprendizagem no contexto do LLM congelado leva através da atenção cruzada fechada.

### Dados de formação

Flamingo treinado em três conjuntos de dados:

1. MultiModal MassiveWeb (M3W): 43 milhões de páginas web com imagens e texto entrelaçados, reconstruindo a ordem de leitura.
2. Pairos de imagem-texto: ALIGN (1.8B pares) mais LTIP (312M pares), cerca de 2,1B pares no total.
3. Pairagem de vídeo-texto (VTP): 27 milhões de clips de vídeo curtos.

OBELICS (2023) é uma reprodução aberta do corpus web entrelaçado, que Idefics, Idefics2 e os modelos mais abertos "como Flamingo" treinam.

### OpenFlamingo e Otter

O OpenFlamingo (2023) é a reprodução aberta. Arquitetura idêntica (re-sampler do perceptor + atenção cruzada fechada em LLaMA congelado ou MPT).

Otter (2023) baseia-se no OpenFlamingo com sintonização de instruções no MIMIC-IT (um conjunto de dados de instruções multimodal), mostrando também funções de atenção cruzada fechada para instruções seguidas.

### Os descendentes

- Idefics / Idefics2 / Idefics3: A linhagem de atenção cruzada fechada do Hugging Face, progressivamente mais simples (Idefics2 deixou cair o resampler em favor de tokens de parche direto com pooling adaptativo).
- Transição Flamingo-Chameleon: até 2024, muitas equipes mudaram para fusão precoce (Lessão 12.11); A atenção cruzada fechada no estilo Flamingo permanece em produção onde é necessária a congelação da espinha dorsal.
- A entrada entrelaçada de Gémeos: conceitualmente herda a flexibilidade de formato entrelaçado do Flamingo, embora o mecanismo exato seja proprietário.

### Comparar com BLIP-2

| | BLIP-2 | Flamingo |
|---|---|---|
| Visual bridge | Q-Former once at input | Gated cross-attention at every M layers |
| Visual tokens | 32 per image | 64 per image per cross-attn layer |
| Frozen LLM | Yes | Yes |
| Few-shot in-context | Weak | Strong — the paper's centerpiece |
| Interleaved inputs | No native support | Yes, the design target |
| Training data | 130M pairs | ~2.1B pairs + 27M video clips + 43M interleaved pages |
| Parameter count | 188M trained | ~10B trained (cross-attn layers) |
| Compute | Days on 8 A100s | Weeks on thousands of TPUv4 |

Escolha BLIP-2 para VQA de imagem única em um orçamento. Escolha Flamingo/Idefics2 para raciocínio interligado, de poucas fotos ou de imagem múltipla.

```figure
cross-attention-fusion
```

## Usá-lo

`code/main.py`demonstra:

1. Um resampler Perceptor em 36 tokens de patch falsos com 8 latentes aprendizes (pura atenção cruzada Python).
2. Um passo de atenção cruzada com um portão .`alpha = 0`→ saída é igual a entrada (LLM inalterado), então `alpha = 2.0`→ contribuição visual misturada.
3. Um construtor de máscaras entrelaçadas que produz a máscara de atenção 2D para uma sequência "(imagem 1) (texto 1) (imagem 2) (texto 2)".

## Envia-o

Esta lição produz`outputs/skill-gated-bridge-diagnostic.md`. Dada a configuração de um VLM aberto (resampler Y/N, frequência de atn, esquema de gate), ele identifica os elementos da linhagem Flamingo e explica a estratégia de congelamento. Útil para depurar por que um ajuste fino degradou o desempenho do texto (resposta: o gate se alargou demais e rapidamente).

## Exercícios

1. Compute o número de parâmetros visuais do Flamingo-9B: 9B LLM + 1,4B camadas de atenção cruzada fechadas + 64M resampler. Que fração dos parâmetros totais é treinada?

2. Implementar o resíduo fechado `y = tanh(alpha) * cross + x`Demonstre experimentalmente que com`alpha=0`- Não .`y==x`- Exactamente no início.

3. Leia a Seção 3.2 do OpenFlamingo (arXiv:2308.01390) sobre como eles tratam várias imagens em um lote quando cada prompt tem uma contagem de imagens diferente. Descreva a estratégia de enchimento.

4. Por que a máscara de atenção cruzada do Flamingo permite que um token de texto atenda apenas à imagem anterior mais recente do que a todas as imagens anteriores?

5. Pouco-choque no contexto: construa um prompt com 4 exemplos de "imagem → cor do objeto principal" para uma nova variante do Flamingo. Descreva o padrão de precisão esperado ao variar o número de exemplos de 0 a 8.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Perceiver resampler | "Fixed-latent cross-attention" | Module that produces K fixed tokens from a variable number of input patches |
| Gated cross-attention | "Tanh-gated bridge" | Residual layer `y = tanh(alpha)*cross + x`, learnable alpha, init 0 |
| Interleaved input | "Mixed sequence" | Prompt format with images and text mixed freely in reading order |
| Frozen LLM | "No LLM gradients" | The text LLM's weights do not update; only resampler + cross-attn layers train |
| Few-shot | "In-context examples" | Give a few (image, answer) pairs in the prompt; model generalizes without finetuning |
| OBELICS | "Interleaved web corpus" | Open dataset of 141M web pages with images and text in reading order |
| Chinchilla | "70B frozen base" | Flamingo's frozen text LLM, from DeepMind's Chinchilla paper |
| Gate schedule | "How alpha moves" | The rate at which the cross-attention gate opens during training |
| Cross-attn frequency | "Every M layers" | How often a gated cross-attention block is inserted; Flamingo uses $M=4$ |
| OpenFlamingo | "Open reproduction" | MosaicML/LAION open checkpoint at 3-9B; architecture-identical to Flamingo |

## Mais leitura

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198)- O papel original.
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) Reprodução aberta.
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) Corpus de telas entrelaçadas.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795)A arquitetura geral do Perceptor.
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726)- Descendente flamingo com instruções.
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) simplificação moderna da abordagem Flamingo.
