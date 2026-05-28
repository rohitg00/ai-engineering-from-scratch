# Flamingo e Cross-Attention com Gate pra VLMs Few-Shot

> O Flamingo do DeepMind (2022) fez duas coisas antes de qualquer um. Mostrou que um único modelo podia processar sequências arbitrariamente intercaladas de imagens, vídeos e texto. E mostrou que VLMs podiam aprender in-context — dê um prompt few-shot com três pares exemplo (imagem, legenda) e o modelo legenda uma nova imagem sem nenhum passo de gradiente. O mecanismo: camadas de cross-attention com gate, inseridas entre as camadas existentes do LLM congelado, com um gate tanh aprendido que começa em zero pra que a capacidade de texto do LLM seja preservada na inicialização. Essa lição percorre o Perceiver resampler e a arquitetura de cross-attention com gate do Flamingo — o ancestral das entradas intercaladas do Gemini e dos tokens visuais do Idefics2.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, demonstração de cross-attention com gate + Perceiver resampler)
**Pré-requisitos:** Fase 12 · 03 (BLIP-2 Q-Former)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Explicar como a cross-attention com gate preserva a capacidade de texto de um LLM congelado na inicialização via tanh(gate) = 0.
- Percorrer um Perceiver resampler: N patches de imagem → K queries "latente" fixas via cross-attention.
- Descrever como o Flamingo lida com sequências intercaladas imagem-texto com máscara causal que respeita a posição das imagens.
- Reproduzir uma estrutura de prompt multimodal few-shot (3 exemplos imagem-legenda depois uma imagem consulta).

## O Problema

BLIP-2 alimenta 32 tokens visuais na camada de entrada de um LLM congelado. Funciona pra uma imagem por prompt. Mas e se você quiser alimentar *muitas* imagens intercaladas com texto, como em "aqui está a imagem A, legende; aqui está a imagem B, legende; agora aqui está a imagem C, legende"? A self-attention do LLM precisaria lidar com tokens de imagem e tokens de texto em um único fluxo, e a questão de quais posições podem atentar a quais imagens fica complicada.

A resposta do Flamingo: não muda o fluxo de entrada do LLM em nada. Insere camadas extras de cross-attention entre os blocos existentes do LLM. Tokens de texto continuam fluindo pela self-attention causal do LLM como sempre. A cada poucos blocos do LLM, tokens de texto também fazem cross-attention sobre features de imagem via uma nova camada com gate. O gate (inicializado em zero) significa que no passo zero as novas camadas são no-ops — o modelo se comporta exatamente como o LLM pré-treinado. Conforme o treino avança, o gate abre e informação visual começa a fluir.

A segunda pergunta que o Flamingo respondeu: como lidar com um número variável de imagens (0, 1 ou muitas) por prompt? Um Perceiver resampler — um módulo pequeno de cross-attention que pega qualquer número de patches que você tem e produz um número fixo de tokens latentes visuais. A camada de cross-attention do LLM vê a mesma forma independentemente de quantas imagens estão no prompt.

## O Conceito

### O LLM congelado

Flamingo começa com um LLM Chinchilla 70B congelado. Todos os 70B pesos intactos. A self-attention existente de texto e a FFN operam normalmente.

### Perceiver resampler

Pra cada imagem no prompt, o ViT produz N patch tokens. O Perceiver resampler tem K latentes fixos aprendíveis (Flamingo usa K=64). Cada bloco do resampler tem duas sub-etapas:

1. Cross-attention: os K latentes atentam sobre os N patch tokens (Q dos latentes, K/V dos patches).
2. Self-attention + FFN dentro dos latentes.

Após 6 blocos do resampler, a saída é K=64 tokens visuais de dim 1024, independentemente de quantos patches o ViT produziu. Uma imagem 224x224 (196 patches) e uma imagem 480x480 (900 patches) saem como 64 tokens do resampler.

Pra vídeo, o resampler é aplicado temporalmente: os patches de cada frame produzem 64 latentes, e um encoding posicional temporal permite que o modelo distinga t=0 de t=N. O vídeo inteiro vira T * 64 tokens visuais.

### Cross-attention com gate

A cada M camadas do LLM congelado (Flamingo usa M=4), insere um novo bloco de cross-attention com gate:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha` é um escalar aprendível inicializado em zero.
- `tanh(0) = 0`, então na inicialização a ramificação gated contribui zero.
- Conforme `alpha` se afasta de zero, a contribuição da cross-attention cresce suavemente.
- A conexão residual significa que mesmo um gate totalmente aberto não sobrescreve a representação de texto do LLM; apenas adiciona informação visual por cima.

Essa é a escolha de design mais importante do Flamingo: a condicionamento visual é aditiva, com gate e zero na inicialização. Um Flamingo no passo zero é um Chinchilla 70B perfeito em entradas só de texto.

### Cross-attention mascarada pra entradas intercaladas

Num prompt como "<image A> legenda A <image B> legenda B <image C> ?", cada token de texto deve ver apenas imagens que vieram antes dele na sequência. A máscara de cross-attention força: token de texto na posição `t` atenta apenas a tokens de resampler de imagem cujo índice de imagem `i < i_t` onde `i_t` é a imagem mais recente antes da posição `t`. "Ver apenas a imagem anterior mais recente" ou "ver todas as imagens anteriores" são ambas escolhas válidas; Flamingo escolheu a primeira.

### Aprendizado in-context few-shot

Um prompt do Flamingo parece:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

O modelo vê o padrão de conclusão e emite "bird" (ou o que image3 mostra). Sem passos de gradiente. A capacidade de aprendizado in-context do LLM congelado se mantém através da cross-attention com gate — essa é a sacada do artigo e por que importa.

### Dados de treino

Flamingo treinou em três datasets:

1. MultiModal MassiveWeb (M3W): 43M páginas web com imagens e texto intercalados, reconstruindo a ordem de leitura.
2. Pares Imagem-Texto (ALIGN + LTIP): 4.4B pares.
3. Pares Vídeo-Texto (VTP): 27M clipes curtos de vídeo.

OBELICS (2023) é uma reprodução aberta do corpus web intercalado, no qual Idefics, Idefics2 e a maioria dos modelos abertos "estilo Flamingo" treinam.

### OpenFlamingo e Otter

OpenFlamingo (2023) é a reprodução aberta. Arquitetura idêntica (Perceiver resampler + cross-attention com gate no LLaMA ou MPT congelado). Checkpoints em 3B, 4B, 9B. Qualidade fica atrás do Flamingo por causa do LLM base menor e menos dados.

Otter (2023) se baseia no OpenFlamingo com ajuste de instrução no MIMIC-IT (dataset de instruções multimodais), mostrando que cross-attention com gate funciona pra seguidor de instruções também.

### Os descendentes

- Idefics / Idefics2 / Idefics3: linhagem de cross-attention com gate da Hugging Face, progressivamente mais simples (Idefics2 dropou o resampler em favor de patch tokens diretos com pooling adaptativo).
- Transição Flamingo-to-Chameleon: por 2024 muitos times migraram pra early-fusion (Lição 12.11); cross-attention com gate estilo Flamingo continua em produção onde congelamento de backbone é necessário.
- Entradas intercaladas do Gemini: herda conceitualmente a flexibilidade de formato intercalado do Flamingo, embora o mecanismo exato seja proprietário.

### Comparação com BLIP-2

| | BLIP-2 | Flamingo |
|---|---|---|
| Ponte visual | Q-Former uma vez na entrada | Cross-attention com gate a cada M camadas |
| Tokens visuais | 32 por imagem | 64 por imagem por camada de cross-attn |
| LLM congelado | Sim | Sim |
| Few-shot in-context | Fraco | Forte — o destaque do artigo |
| Entradas intercaladas | Sem suporte nativo | Sim, o objetivo de design |
| Dados de treino | 130M pares | 1.3B pares + 43M páginas intercaladas |
| Contagem de parâmetros | 188M treinados | ~10B treinados (camadas de cross-attn) |
| Computação | Dias em 8 A100s | Semanas em milhares de TPUv4 |

Escolha BLIP-2 pra VQA de imagem única no orçamento. Escolha Flamingo/Idefics2 pra intercalado, few-shot ou raciocínio multi-imagem.

## Use

`code/main.py` demonstra:

1. Um Perceiver resampler em 36 patch tokens falsos com 8 latentes aprendíveis (cross-attention em Python puro).
2. Um passo de cross-attention com gate com `alpha = 0` → saída igual à entrada (LLM inalterado), depois `alpha = 2.0` → contribuição visual misturada.
3. Um construtor de máscara intercalada que produz a máscara 2D de attention pra uma sequência "(imagem 1) (texto 1) (imagem 2) (texto 2)".

## Entregue

Essa lição produz `outputs/skill-gated-bridge-diagnostic.md`. Dada a configuração de um VLM aberto (resampler Y/N, frequência de cross-attn, esquema de gate), identifica os elementos da linhagem Flamingo e explica a estratégia de congelamento. Útil pra debugar por que um fine-tuning degradou performance de texto (resposta: o gate abriu rápido demais).

## Exercícios

1. Calcule a contagem de parâmetros visuais do Flamingo-9B: LLM de 9B + 1.4B camadas de cross-attention com gate + 64M resampler. Qual fração dos parâmetros totais é treinada?

2. Implemente o residual com gate `y = tanh(alpha) * cross + x` em PyTorch. Mostre experimentalmente que com `alpha=0`, `y==x` exatamente na inicialização.

3. Leia Seção 3.2 do OpenFlamingo (arXiv:2308.01390) sobre como eles lidam com múltiplas imagens em um batch quando cada prompt tem um número diferente de imagens. Descreva a estratégia de padding.

4. Por que a máscara de cross-attention do Flamingo permite que um token de texto atente *apenas à imagem anterior mais recente* em vez de todas as imagens anteriores? Leia Seção 2.4 do artigo do Flamingo e explique o trade-off.

5. Few-shot in-context: construa um prompt com 4 exemplos de "imagem → cor do objeto principal" pra uma nova variante do Flamingo. Descreva o padrão esperado de acurácia conforme você varia o número de exemplos de 0 a 8.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|-------------------------|
| Perceiver resampler | "Cross-attention com latente fixo" | Módulo que produz K tokens fixos de um número variável de patches de entrada |
| Cross-attention com gate | "Ponte com gate tanh" | Camada residual `y = tanh(alpha)*cross + x`, alpha aprendível, init 0 |
| Entradas intercaladas | "Sequência misturada" | Formato de prompt com imagens e texto misturados livremente na ordem de leitura |
| LLM congelado | "Sem gradientes no LLM" | Os pesos do LLM de texto não atualizam; só resampler + camadas de cross-attn treinam |
| Few-shot | "Exemplos in-context" | Dá alguns pares (imagem, resposta) no prompt; modelo generaliza sem fine-tuning |
| OBELICS | "Corpus web intercalado" | Dataset aberto de 141M páginas web com imagens e texto na ordem de leitura |
| Chinchilla | "70B base congelado" | LLM de texto congelado do Flamingo, do artigo Chinchilla do DeepMind |
| Cronograma de gate | "Como alpha se move" | A taxa na qual o gate de cross-attention abre durante o treino |
| Frequência de cross-attn | "A cada M camadas" | Com que frequência um bloco de cross-attention com gate é inserido; Flamingo usa M=4 |
| OpenFlamingo | "Reprodução aberta" | Checkpoint aberto do MosaicML/LAION em 3-9B; arquitetura idêntica ao Flamingo |

## Leitura Complementar

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) — o artigo original.
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) — reprodução aberta.
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) — corpus web intercalado.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — a arquitetura geral Perceiver.
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726) — descendente do Flamingo com ajuste de instrução.
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) — simplificação moderna da abordagem Flamingo.