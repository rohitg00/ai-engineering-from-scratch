# Chameleon e Modelos Multimodais de Fusão Precoce com Apenas Tokens

> Todo VLM que vimos até agora mantém imagens e texto separados. Tokens visuais vêm de um encoder de visão, passam por um projetor, e depois se encontram com o texto dentro do LLM. Os vocabulários de visão e texto nunca se sobrepõem. O Chameleon (Meta, maio 2024) perguntou: e se sobrepusessem? Treine um VQ-VAE que transforma uma imagem em uma sequência de tokens discretos de um vocabulário compartilhado. Todo documento multimodal agora é uma sequência — tokens de texto e tokens de imagem intercalados, uma loss autoregressiva única. Efeito colateral: o modelo pode gerar saídas de modalidade mista — alternando tokens de texto e imagem em uma única chamada de inferência. Esta aula analisa a tese da fusão precoce e constrói uma versão toy de ponta a ponta.

**Tipo:** Construção
**Linguagens:** Python (stdlib, tokenizer VQ-VAE + decoder intercalado)
**Pré-requisitos:** Fase 12 · 05, Fase 8 (IA Generativa)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Explicar por que um vocabulário compartilhado + loss única muda o que o modelo consegue fazer.
- Descrever como um VQ-VAE tokeniza uma imagem em uma sequência discreta compatível com o objetivo de next-token do transformer.
- Nomear os truques de estabilidade de treinamento do Chameleon: QK-Norm, posicionamento de dropout, ordenação de LayerNorm.
- Comparar Chameleon vs abordagem Q-Former do BLIP-2 e descrever quando cada uma é a escolha certa.

## O Problemo

VLMs baseados em adapter (LLaVA, BLIP-2, Qwen-VL) tratam texto e imagem como duas coisas diferentes. Um token de texto passa por `embed(text_token)`; uma imagem passa por `visual_encoder(image) → projector → ... pseudo_tokens`. O modelo tem dois caminhos de entrada que se fundem no meio.

Três consequências:

1. O LLM só consegue consumir imagens, não emitir. Saída é só texto.
2. Documentos de modalidade mista (parágrafos e imagens alternados, como em um artigo) são estranhos — ou você faz parse da entrada multimodal fora do modelo ou encadeia gerações.
3. Incompatibilidade distribucional. Tokens visuais e tokens de texto vivem em regiões diferentes do espaço oculto, criando problemas sutis de alinhamento.

Chameleon rejeita o premissa: imagens são apenas sequências de tokens discretos de um vocabulário compartilhado. Treine o modelo em documentos intercalados, uma loss, um decoder autoregressivo, e você desbloqueia geração de modalidade mista de graça.

## O Conceito

### VQ-VAE como tokenizer de imagem

O tokenizer é um autoencoder variacional com quantização vetorial. A arquitetura:

- Encoder: CNN + ViT que mapeia imagem para um mapa de features espacial, digamos 32x32 features de dim 256.
- Codebook: um vocabulário aprendido de K vetores (Chameleon usa 8192), também dim 256.
- Quantização: pra cada feature espacial, busca a entrada mais próxima do codebook por distância L2. Substitui a feature contínua pelo índice inteiro.
- Decoder: CNN que leva features quantizadas de volta pra pixels.

Treinamento: loss de reconstrução do VAE + loss de compromisso + loss do codebook. Os índices do codebook formam um alfabeto discreto pra imagens.

Pro Chameleon: uma imagem vira 32*32 = 1024 tokens tirados de um vocabulário de 8192. Concatena com tokens de texto (do vocabulário BPE do LLM, digamos 32000). Vocabulário final: 40192. O transformer vê uma sequência, uma loss.

### O vocabulário compartilhado

O vocabulário do Chameleon combina tokens de texto, tokens de imagem e separadores de modalidade. Cada token tem um ID único. A camada de embedding mapeia cada ID pra um vetor oculto D-dimensional. A projeção de saída mapeia de volta pro logit do vocabulário. Softmax escolhe o próximo token, qualquer que seja a modalidade.

Separadores importam: tags `<image>` e `</image>` delimitam a sequência de tokens de imagem. Na hora de gerar, se o modelo emite `<image>`, o software downstream sabe que os próximos 1024 tokens são índices VQ pra mandar pro decoder renderizar pixels.

### Geração de modalidade mista

Inferência é previsão de próximo token no vocabulário compartilhado. Prompt de exemplo: "Desenhe um gato e descreva-o." Chameleon emite:

```
<image> 4821 1029 2891 ... (1024 tokens de imagem) </image>
O gato é laranja, sentado num parapeito de janela...
```

O modelo escolhe a ordem autonomamente — pode produzir imagem depois de texto, texto depois de imagem, ou intercalar. Mesmo decoder, mesma loss.

Comparado com VLMs de adapter onde a geração é só texto, Chameleon reabre a questão das modalidades de saída do modelo.

### Estabilidade de treinamento — QK-Norm, dropout, ordenação de LayerNorm

Treinamento de fusão precoce é instável em escala. O paper do Chameleon documenta três truques:

- QK-Norm. Aplica LayerNorm nas projeções de query e key dentro da attention, antes do produto escalar. Previne explosão de magnitude de logits em profundidade. Usado por múltiplos modelos grandes pós-2024.
- Posicionamento de dropout. Dropout após cada soma residual, não só após attention e MLP. Regularização mais necessária quando gradientes de tokens visuais podem dominar.
- Ordenação de LayerNorm. Pre-LN no ramo residual (padrão), mais um LN extra na skip connection do último bloco. Estabiliza o fluxo de gradiente na última camada.

Sem esses truques, o treinamento do Chameleon de 34B de parâmetros divergiu em múltiplos checkpoints. Com eles, converge. A receita de treinamento é tanta contribuição quanto a arquitetura.

### O teto de reconstrução do tokenizer

VQ-VAE é com perdas. Com 8192 entradas no codebook e 1024 tokens por imagem 512x512, o PSNR de reconstrução fica em torno de 26-28 dB. Isso é suficiente pra geração de imagem reconhecível, mas visivelmente pior que diffusão em espaço contínuo (Stable Diffusion 3 atinge 32+ dB).

O tokenizer é o gargalo. Tokenizers melhores (MAGVIT-v2, IBQ, SBER-MoVQGAN) elevam o teto. Emu3 (Aula 12.12) atinge qualidade SDXL com um tokenizer melhor apenas.

### Chameleon vs BLIP-2 / LLaVA

Chameleon (fusão precoce, vocabulário compartilhado):
- Uma loss, um decoder.
- Gera saída de modalidade mista.
- O tokenizer é o teto de qualidade.
- Caro: decoder VQ-VAE por imagem gerada no caminho de inferência.

BLIP-2 / LLaVA (fusão tardia, torres separadas):
- Visão pra dentro, texto pra fora apenas.
- Reutiliza LLM pré-treinado.
- Sem gargalo de tokenizer pra compreensão.
- Barato: passo forward único.

Escolha por tarefa. Se precisa de geração de imagem, família Chameleon. Se só precisa de compreensão, VLM de adapter é mais simples e reutiliza mais compute pré-treinado.

### Fuyu e AnyGPT

Fuyu (Adept, 2023) é uma abordagem relacionada: pule o encoder de visão separado completamente, alimente patches de imagem brutos pela projeção de entrada do LLM como se fossem tokens, sem tokenizer. Mais simples que Chameleon, perde a geração de saída com vocabulário compartilhado.

AnyGPT (Zhan et al., 2024) estende Chameleon pra quatro modalidades: texto, imagem, fala, música. Mesmo truque VQ-VAE pra cada, transformer compartilhado. Geração any-to-any. Coberto mais na Aula 12.16.

## Use

`code/main.py` constrói um modelo toy de fusão precoce de ponta a ponta:

- Um quantizer estilo VQ-VAE minúsculo que mapeia patches 8x8 pra índices de codebook (K=16).
- Um vocabulário compartilhado de (ids de texto 0..31) + (ids de imagem 32..47) + (separadores 48, 49).
- Um decoder autoregressivo toy (tabela de bigramas) treinado em legendas sintéticas + sequências de tokens de imagem.
- Loop de sampling que emite tokens de texto + imagem alternados dado um prompt.

O código intencionalmente mantém o transformer minúsculo (bigramas) pra você rastrear o fluxo de sinal de ponta a ponta.

## Implemente

Esta aula produz `outputs/skill-tokenizer-vs-adapter-picker.md`. Dada uma spec de produto (só compreensão vs compreensão + geração, qualidade de imagem requerida, orçamento de custo), escolhe entre família Chameleon (fusão precoce) e família LLaVA (fusão tardia) e justifica com regras de bolso quantitativas.

## Exercícios

1. Chameleon usa 8192 entradas no codebook e 1024 tokens por imagem 512x512. Estime a razão de compressão vs uma imagem RGB de 24 bits. É com perdas? Quanto de perda?

2. Uma imagem 4K (3840x2160) na mesma densidade VQ-VAE produz quantos tokens de imagem? Um modelo estilo Chameleon consegue gerar uma imagem 4K em uma chamada de inferência? O que quebra primeiro — contexto, qualidade do tokenizer, ou KV cache?

3. Implemente QK-Norm em Python puro. Dado uma query e key de 64 dims, mostre o produto escalar antes e depois do LayerNorm. Por que controle de magnitude é importante em profundidade?

4. Leia a Seção 2.3 do Chameleon sobre estabilidade de treinamento. Descreva o modo de falha exato que o paper observou no 34B sem QK-Norm. Qual era a "assinatura de explosão de norm"?

5. Estenda o decoder toy pra emitir uma resposta de modalidade mista dado um prompt puramente de texto. Meça com que frequência o modelo escolhe imagem-primeiro vs texto-primeiro dado distribuição de dados de treinamento 60% texto-primeiro / 40% imagem-primeiro.

## Termos-Chave

| Termo | O que a galera diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Fusão precoce | "Tokens unificados" | Imagens convertidas em tokens discretos compartilhando o vocabulário do transformer desde o step 1 |
| VQ-VAE | "Tokenizer de imagem" | CNN + ViT + codebook que mapeia imagens pra índices inteiros que o transformer pode prever |
| Vocabulário compartilhado | "Um dicionário" | Um único espaço de IDs de tokens cobrindo texto + imagem + separadores de modalidade |
| QK-Norm | "Estabilizador de attention" | LayerNorm aplicada em query e key antes do produto escalar, previne explosão de norm |
| Geração de modalidade mista | "Saída texto + imagem" | Inferência que produz autonomamente tokens de texto e imagem intercalados em uma passada |
| Tamanho do codebook | "K entradas" | Número de vetores discretos que o VQ-VAE pode quantizar; troca compressão por fidelidade |
| Teto do tokenizer | "Limite de reconstrução" | Melhor PSNR alcançável decodificando tokens VQ; limita a qualidade de imagem do modelo |

## Leitura Complementar

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
