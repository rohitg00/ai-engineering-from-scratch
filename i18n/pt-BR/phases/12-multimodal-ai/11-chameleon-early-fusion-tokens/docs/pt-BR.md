# Modelos multimodal de chameleão e tokens de fusão inicial apenas

> Todos os VLM que vimos até agora mantêm imagens e texto separados. Os tokens visuais vêm de um codificador de visão, fluem para um projetor, e depois encontram texto dentro do LLM. O vocabulário da visão e do texto nunca se sobrepõem. O camaleão (Meta, maio de 2024) perguntou: e se fizessem? Treinar um VQ-VAE que transforma uma imagem em uma sequência de tokens discretos de um vocabulário compartilhado. Cada documento multimodal é agora uma sequência de tokens de texto e tokens de imagem intercalados, uma única perda autoregressiva. Efeito secundário: o modelo pode gerar saídas de modalidade mista  tokens alternando texto e imagem em uma única chamada de inferência. Esta lição lê a tese da fusão inicial e constrói uma versão de brinquedo de ponta a ponta.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, VQ-VAE tokenizer + interleaved decoder)
**Prerequisites:** Phase 12 · 05, Phase 8 (Generative AI)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Explique por que um vocabulário compartilhado + perda única muda o que o modelo pode fazer.
- Descreva como um VQ-VAE tokeniza uma imagem em uma sequência discreta compatível com o próximo objetivo de tokens de um transformador.
- Nomear os truques de treinamento-estabilidade do Chameleon: QK-Norm, colocação de abandono, LayerNorm encomenda.
- Compare a abordagem Q-Former do Chameleon vs BLIP-2 e descreva quando cada uma é a escolha certa.

## O problema

Os VLMs baseados em adaptadores (LLaVA, BLIP-2, Qwen-VL) tratam texto e imagem como duas coisas diferentes.`embed(text_token)`Uma imagem passa por lá .`visual_encoder(image) → projector → ... pseudo_tokens`O modelo tem dois caminhos de entrada que se fundem em parte.

Três consequências:

1. O LLM só pode consumir imagens, não emitir.
2. Documentos de modalidade mista (alternação de parágrafos e imagens, como em um artigo) são estranhos  você analisa a entrada multimodal fora do modelo ou gerações de cadeia.
3. Descoincidência distributiva. Tokens visuais e tokens de texto vivem em diferentes regiões do espaço oculto, criando problemas de alinhamento sutis.

O Camelão rejeita a premissa: as imagens são apenas sequências de tokens discretos de um vocabulário compartilhado. Treinar o modelo em documentos entrelaçados, uma perda, um decodificador autoregressivo, e você desbloqueia a geração de modalidade mista gratuitamente.

## O conceito

### VQ-VAE como tokenizer de imagem

O tokenizer é um autoencodeador variável quantizado por vetores.

- Encoder: CNN + ViT que mapeia imagem para um mapa de recursos espaciais, digamos 32x32 recursos de dim 256.
- Código: um vocabulário aprendido de vetores K (Chameleon usa 8192), também dim 256.
- Quantização: para cada característica espacial, procure a entrada de código mais próxima por distância L2. Substitua a característica contínua pelo índice de números inteiros.
- Decodificador: CNN que leva recursos quantizados de volta para pixels.

Formação: perda de reconstrução de VAE + perda de compromisso + perda de livro de códigos.

Para Chameleon: uma imagem torna-se 32*32 = 1024 tokens extraídos de um vocabulário de 8192. Coloque esses IDs de imagem no mesmo espaço de ID que os tokens BPE de texto. O tokenizer único do Chameleon tem 65.536 entradas, e essa contagem já inclui os códigos de imagem 8192 e os tokens especiais, como os separadores de imagem. O transformador vê uma sequência, uma perda.

### O vocabulário compartilhado

O vocabulário do Chameleon combina tokens de texto, tokens de imagem e separadores de modalidade. Cada token tem um único ID. A camada de inserção de entrada mapeia cada ID para um vetor oculto D-dim. O mapa de projeção de saída oculta para logits de vocab. Softmax escolhe o próximo token, seja qual for a modalidade.

Os separadores são importantes: `<image>`E ...`</image>`tags brackets a sequência de imagem-token. no momento de geração, se o modelo emite `<image>`O software de baixo nível sabe que os próximos 1024 tokens são índices VQ para enviar ao decodificador para render de pixels.

### Geração de modalidade mista

A inferência é a previsão de next-token no vocabulário compartilhado.

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

O modelo escolhe a ordem de forma autônoma. Pode produzir imagem, depois texto, texto, depois imagem ou interlease.

Comparar com os VLMs adaptadores onde a geração é apenas de texto.

### Estabilidade de formação  QK-Norm, abandono, LayerNorm

O treinamento de fusão precoce é instável em escala.

- QK-Norm. Aplicar LayerNorm para a consulta e projeções-chave dentro da atenção, antes do produto ponto. Prevenção da explosão de magnitude logit em profundidade. Usado por vários modelos grandes pós-2024.
- Colocação de abandono. abandono após cada adição residual, não apenas após atenção e MLP. Mais regularização necessária quando os gradientes dos tokens de imagem podem dominar.
- LayerNorm ordenamento. Pre-LN no ramo residual (padrão), mais um LN extra na conexão skip do último bloco. Estabiliza o fluxo de gradiente de camada final.

Sem estes truques, o treinamento do 34B-param Camelão divergiu em vários pontos de controle. Com eles, converge. A receita de treinamento é tanto da contribuição quanto a arquitetura.

### O teto de reconstrução do tokenizer

VQ-VAE é perdedor. Em 8192 entradas de código e 1024 tokens por imagem 512x512, a reconstrução PSNR limita-se em torno de 26-28 dB. Isso é suficiente para uma imagem reconhecível, mas visiblemente pior do que a difusão no espaço contínuo (Stable Diffusion 3 atinge 32+ dB).

O tokenizer é o gargalo. O melhor tokenizer (MAGVIT-v2, IBQ, SBER-MoVQGAN) levanta o teto.

### Camelão vs BLIP-2 / LLaVA

Camelão (fuso precoce, vocabulário compartilhado):
- Uma perda, um decodificador.
- Gera saída de modalidade mista.
- O tokenizer é o teto de qualidade.
- Preço: Decodificador VQ-VAE por imagem gerada no caminho de inferência.

BLIP-2 / LLaVA (fusão tardia, torres separadas):
- Visão, só mensagens de texto.
- Reutiliza o Mestrado em Direito.
- Não há gargalos de botelha para compreensão.
- Barata: passes individuais para frente.

Se precisarem de geração de imagens, família Chameleon, se precisarem de compreensão, o adaptador VLM é mais simples e reutiliza mais computação pré-treinada.

### Fuyu e AnyGPT

Fuyu (Adept, 2023) é uma abordagem relacionada: pular o codificador de visão separado inteiramente, alimentar os patches de imagem crua através da projeção de entrada do LLM como se fossem tokens, sem tokenizer.

AnyGPT (Zhan et al., 2024) estende o Chameleon a quatro modalidades: texto, imagem, fala, música.

```figure
vq-codebook
```

## Usá-lo

`code/main.py`Construirá um modelo de fusão precoce de brinquedo de ponta a ponta:

- Um pequeno quantificador de estilo VQ-VAE que mapeia 8x8 patches para índices de código (K=16).
- Um vocabulário compartilhado de (id de texto 0..31) + (id de imagem 32..47) + (separadores 48, 49).
- Um decodificador autoregressivo de brinquedo (tabela de bigramas) treinado em legendas sintéticas + sequências de imagem-token.
- Loop de amostragem que emite tokens de texto + imagem alternados dados um pedido.

O código intencionalmente mantém o transformador pequeno (bigramas) para que você possa rastrear o fluxo de sinal de ponta a ponta.

## Envia-o

Esta lição produz`outputs/skill-tokenizer-vs-adapter-picker.md`. Dada uma especificação do produto (entender apenas versus compreender + gerar, qualidade de imagem exigida, orçamento de custos), ele escolhe entre família Chameleon (fusão precoce) e família LLaVA (fusão tardia) e justifica com regras quantitativas.

## Exercícios

1. O Chameleon usa K=8192 entradas de código e 1024 tokens por imagem 512x512. Estima a relação de compressão versus uma imagem RGB de 24 bits.

2. Uma imagem 4K (3840x2160) com a mesma densidade VQ-VAE produz quantos tokens de imagem? Um modelo de estilo camaleão pode gerar uma imagem 4K em uma chamada de inferência? O que rompe primeiro o contexto, a qualidade do tokenizer ou o cache KV?

3. Implementar QK-Norm em Python puro. Dado uma consulta e chave de 64 dimensões, mostre o produto de pontos antes e depois do LayerNorm. Por que o controle de magnitude é importante na profundidade?

4. Leia a Seção 2.3 do Camelão sobre estabilidade de treinamento. Descreva o modo de falha exato observado no papel no 34B sem QK-Norm. Qual foi a assinatura de "explosão normal"?

5. Extenda o decodificador de brinquedo para emitir uma resposta de modalidade mista dada uma solicitação apenas de texto. Messa com que frequência o modelo escolhe imagem em primeiro lugar versus texto em primeiro lugar dada formação - distribuição de dados 60% texto em primeiro lugar / 40% imagem em primeiro lugar.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Early fusion | "Unified tokens" | Images converted to discrete tokens sharing the transformer's vocabulary from step one |
| VQ-VAE | "Image tokenizer" | CNN + ViT + codebook that maps images to integer indices the transformer can predict |
| Shared vocabulary | "One dictionary" | A single token ID space covering text + image + modality separators |
| QK-Norm | "Attention stabilizer" | LayerNorm applied to query and key before their dot product, prevents norm blowup |
| Mixed-modality generation | "Text + image output" | Inference that autonomously produces interleaved text and image tokens in one pass |
| Codebook size | "K entries" | Number of discrete vectors the VQ-VAE can quantize to; trades compression for fidelity |
| Tokenizer ceiling | "Reconstruction limit" | Best PSNR achievable by decoding VQ tokens; bounds the model's image quality |

## Mais leitura

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
