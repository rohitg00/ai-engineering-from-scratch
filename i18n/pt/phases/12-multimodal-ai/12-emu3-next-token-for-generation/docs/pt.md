# Emu3: Próxima previsão para geração de imagens e vídeos

> O Emu3 da BAAI (Wang et al., setembro de 2024) é o resultado de 2024 que deveria ter terminado o debate difusão versus autorregressão. Um único transformador de decodificador de estilo Llama, treinado apenas no objetivo de previsão de tokens próximos, através de um vocabulário unificado de texto + tokens de imagem VQ + tokens de vídeo VQ 3D, bate o SDXL na geração de imagem e o LLaVA-1.6 na percepção. Sem perda de CLIP. Não há programa de difusão. A orientação sem classificador é usada na inferência para a qualidade, mas o objetivo principal do treinamento é a previsão do próximo token com o professor forçando. Publicado na revista Nature. Esta lição lê a tese Emu3  por que um melhor tokenizer mais escala é tudo que você precisa  e contrasta com as abordagens de difusão.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 3D video tokenizer math + autoregressive sampler skeleton)
**Prerequisites:** Phase 12 · 11 (Chameleon)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Explique por que o objetivo de tokens de próxima perda única da Emu3 funciona apesar da suposição de que a difusão é necessária para a qualidade da imagem.
- Descreva o tokenizer de vídeo 3D: como é um livro de códigos VQ espacial-temporal, por que os patches duram o tempo.
- Compare Emu3 vs. Stable Diffusion XL (computação de formação, custo de inferência, limite de qualidade).
- Nomear os três papéis que o mesmo modelo Emu3 desempenha: Emu3-Gen (gênero de imagem), Emu3-Chat (percepção), Emu3-Stage2 (gênero de vídeo).

## O problema

A sabedoria convencional até 2024: geração de imagens precisa de difusão. O argumento: os tokens de imagem discretos perdem muita informação para reconstruir detalhes, e a amostragem autoregressiva acumula erro em milhares de tokens. Estabilidade de difusão, DALL- E 3, Imagen, Midjourney todos usam alguma forma de difusão. O Camelão (Lessão 12.11) refutou parcialmente esta conclusão em pequena escala, mas não foi igual à SDXL em termos de qualidade.

Emu3 atacou o argumento de frente. A alegação: melhor tokenizer visual + escala suficiente + perda de token seguinte = geração de imagem de difusão em batimento no mesmo modelo que também faz percepção.

A aposta foi controversa quando foi publicada. Dois anos depois, a família de geração unificada de código aberto (Emu3, Show-o, Janus-Pro, Transfusion) é o caminho padrão para a pesquisa; modelos de fronteira de produção parecem usar alguma variante.

## O conceito

### O tokenizer Emu3

O ingrediente chave é o tokenizer visual. Emu3 treina um tokenizer personalizado da classe IBQ (Quantizer de garganta inversa, família SBER-MoVQGAN) a 8x8 de redução de resolução por token. Uma imagem de 512x512 torna-se 64x64 = 4096 tokens no tamanho do livro de código 32768.

O valor é maior que os 1024 tokens de Chameleon por 512x512 em K=8192 em ambos os eixos: quatro vezes os tokens e um livro de códigos quatro vezes maior. A capacidade extra compra qualidade de reconstrução. A métrica chave: reconstrução PSNR a 30,5 dB, competitiva com o espaço latente contínuo da Stable Diffusion a 32 dB.

Para vídeo: um tokenizer VQ 3D codifica um patch espaciotemporal (4 quadros x 8x8 pixels) para um número inteiro. Um clip 4s em 8 FPS tem 32 quadros; em 256x256 com redução espacial 8x e temporal 4x, a contagem de tokens é (256/8) * (256/8) * (32/4) = 32 * 32 * 8 = 8.192 tokens.

A qualidade do tokenizer é o teto.

### Formação de perda única

O Emu3 usa um objetivo: previsão do próximo token em um vocabulário compartilhado entre tokens de texto, tokens de imagem 2D e tokens de vídeo 3D. Os pesos são multiplicados por fatores específicos da modalidade durante o treinamento para equilibrar a contribuição, mas a função de perda é idêntica.

Trem em uma mistura de:
- Gênero de imagem: `<text caption> <image> image_tokens </image>`
- Percepção de imagem: `<image> image_tokens </image> <question> text_tokens`
- Gênero de vídeo: `<text caption> <video> video_tokens </video>`
- Percepção de vídeo: análogo.
- Apenas texto: NTP padrão.

O modelo aprende quando emitir tokens de imagem versus tokens de texto a partir da distribuição de dados.`<image>`- Não.

### Orientação e temperatura sem classificador

A geração de imagens autoregressivas fica muito melhor com a orientação sem classificador (CFG) na inferência. Emu3 usa: gerar duas vezes, uma vez com a legenda completa, uma vez com uma legenda vazia, misturar os logits com um peso de orientação (típico 3.0-7.0).

Temperatura é importante: muito alta, artefatos; muito baixa, colapso de modo.

### Três papéis, um modelo

Navio Emu3 como três APIs funcionalmente distintas, mas um conjunto de peso subjacente:

- Emu3-Gen. geração de imagens.
- Emu3-Chat. VQA e legendas. Imagem de entrada (tokens), texto de saída.
- Emu3-Stage2. Geração de vídeo e VQA de vídeo. Entrada de texto ou vídeo, saída de texto ou vídeo.

Sem cabeças específicas, apenas modelos de instruções diferentes, o mesmo ponto de controlo.

### Indicadores de referência

Do artigo Emu3 (septembro 2024):

- Geração de imagem: supera a SDXL no MJHQ-30K FID (5.4 vs 5.6), GenEval em geral (0.54 vs 0.55  empatia estatística), e o composto de Deep-Eval no par.
- Percepção de imagem: segue LLaVA-1.6 no VQAv2 (75.1 vs 81.8) e MMMU (31.6 vs 35.1), mas supera no SEED-Bench, OCRBench e ChartQA.
- Geração de vídeo: qualidade de vídeo de 4 segundos em FVD competitivo com modelos de referência pública da era Sora.

Os números nem sempre estão ganhando  Emu3 negocia um ponto aqui por um ponto lá  mas a afirmação "a previsão do próximo token é tudo o que você precisa" é defensivel em todas as modalidades.

### Custo de cálculo

O Emu3 é um modelo de parâmetro 8B. O artigo não publica um total de horas de GPU; para escala, o pre-treinamento Llama-2-7B usou cerca de 184k A100 horas de GPU, aproximadamente 21 anos de GPU.

Em inferência, Emu3 é mais lento do que SDXL por imagem: 4096 tokens de imagem a 30 tok/s é ~2 minutos por imagem 512x512 versus 2-5 segundos para SDXL. A descodificação especulativa e a otimização do cache KV reduzem a lacuna, mas não a fecham.

### Por que é importante

A contribuição profunda do Emu3 é conceitual. Se a escala de previsão do token seguinte corresponder à difusão na geração de imagem, o caminho do modelo unificado (uma perda, uma espinha dorsal, qualquer modalidade) é viável. Os modelos futuros não precisam de codificadores de texto separados, agendadores de difusão separados, VAEs separados. Um transformador, um tokenizer por modalidade, escala.

Show-o, Janus-Pro e InternVL-U todos se baseiam ou desafiam essa tese. Os laboratórios chineses (BAAI, DeepSeek) publicam mais agressivamente nesta direção do que os laboratórios dos EUA até 2025.

```figure
l5-emu3-next-token
```

## Usá-lo

`code/main.py`Construi duas peças de brinquedo:

- Uma calculadora de contagem de tokenizer VQ 2D vs 3D: dada (resolução, correção, comprimento de clip, FPS), contagem de tokens de computação para imagem vs vídeo.
- Um amostragem autoregressiva de imagem-token com orientação de temperatura livre de classificador.

A implementação do CFG corresponde à receita da Emu3  misturar logitas condicionais e incondicionais com um peso de orientação.

## Envia-o

Esta lição produz`outputs/skill-token-gen-cost-analyzer.md`. Dada uma especificação de produto de geração (imagem ou vídeo, resolução-alvo, nível de qualidade, orçamento de latência), ele calcula o conteúdo dos tokens, o custo de inferência e escolhe a família Emu3 versus difusão.

## Exercícios

1. Emu3 produz 4096 tokens por imagem de 512x512 com redução de 8x8.

2. Leia a Seção 3.3 do Emu3 no tokenizer de vídeo. Descreva a forma do patch VQ 3D e por que abrange 4 quadros x 8x8 pixels em vez de um único quadro.

3. Peso de orientação livre de classificadores 5.0 vs 3.0: que efeito visual?`code/main.py`- Não .

4. Compute os FLOP de formação para Emu3 (8B) a um suposto valor de 300B e compare com a Diffusão Estabil 3.

5. A Emu3 supera a SDXL na FID, mas não na VQAv2 versus VLM especializados.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Next-token prediction | "NTP" | Standard autoregressive loss: predict token[i+1] given token[0..i]; works for every modality when tokenized |
| IBQ tokenizer | "Inverse bottleneck quantizer" | A class of VQ-VAE with larger codebooks (32768+) and better reconstruction than Chameleon's |
| 3D VQ | "Spatiotemporal quantizer" | Codebook indexed by (time, row, col); one token covers 4 frames x 8x8 pixels |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional logits with weight gamma; boosts image quality at inference |
| Unified vocabulary | "Shared tokens" | Text + image + video all draw from the same integer space; model predicts whichever modality comes next |
| MJHQ-30K | "Image gen benchmark" | Midjourney-quality benchmark with 30k prompts; Emu3 reports FID here |

## Mais leitura

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
