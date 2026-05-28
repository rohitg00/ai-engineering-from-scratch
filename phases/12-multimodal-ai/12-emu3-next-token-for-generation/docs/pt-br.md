# Emu3: Previsão de Próximo Token para Geração de Imagem e Vídeo

> O Emu3 do BAAI (Wang et al., setembro 2024) é o resultado de 2024 que deveria ter encerrado o debate entre diffusão e abordagem autoregressiva. Um único transformer decoder-only estilo Llama, treinado apenas com o objetivo de previsão de próximo token, em um vocabulário unificado de texto + tokens VQ de imagem + tokens VQ 3D de vídeo, supera o SDXL em geração de imagem e o LLaVA-1.6 em percepção. Sem loss de CLIP. Sem cronograma de difusão. Classifier-free guidance é usado na inferência pra qualidade, mas o objetivo principal de treinamento é previsão de próximo token com teacher forcing. Publicado na Nature. Esta aula analisa a tese do Emu3 — por que um tokenizer melhor + escala é tudo que você precisa — e contrasta com abordagens de difusão.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, matemática do tokenizer de vídeo 3D + esqueleto de sampler autoregressivo)
**Pré-requisitos:** Fase 12 · 11 (Chameleon)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Explicar por que o objetivo de único loss de previsão de próximo token do Emu3 funciona apesar da premissa de longa data de que difusão é necessária pra qualidade de imagem.
- Descrever o tokenizer de vídeo 3D: como é um codebook VQ espaciotemporal, por que patches atravessam o tempo.
- Comparar Emu3 vs Stable Diffusion XL em (compute de treinamento, custo de inferência, teto de qualidade).
- Nomear os três papéis que o mesmo modelo Emu3 desempenha: Emu3-Gen (geração de imagem), Emu3-Chat (percepção), Emu3-Stage2 (geração de vídeo).

## O Problemo

A sabedoria convencional até 2024: geração de imagem precisa de difusão. O argumento: tokens de imagem discretos perdem muita informação pra reconstruir detalhe, e amostragem autoregressiva acumula erro ao longo de milhares de tokens. Stable Diffusion, DALL-E 3, Imagen, Midjourney todos usam alguma forma de difusão. Chameleon (Aula 12.11) parcialmente desprovou isso em escala pequena, mas não rivalizou com SDXL em qualidade.

Emu3 atacou o argumento de frente. A alegação: tokenizer visual melhor + escala suficiente + loss de próximo token = geração de imagem superando difusão no mesmo modelo que também faz percepção.

A aposta foi controversa na publicação. Dois anos depois, a família de geração unificada open-source (Emu3, Show-o, Janus-Pro, Transfusion) é o caminho padrão pra pesquisa; modelos frontier de produção parecem usar alguma variante.

## O Conceito

### O tokenizer do Emu3

O ingrediente chave é o tokenizer visual. Emu3 treina um tokenizer customizado classe IBQ (Inverse Bottleneck Quantizer, família SBER-MoVQGAN) com redução de resolução 8x8 por token. Uma imagem 512x512 vira 64x64 = 4096 tokens com codebook de tamanho 32768.

Isso é maior que os 1024 tokens do Chameleon por 512x512 com K=8192, mas mais barato por token (lookups de codebook menores, codec mais simples). A métrica chave: PSNR de reconstrução de 30.5 dB, competitivo com o espaço latente contínuo do Stable Diffusion em 32 dB.

Pra vídeo: um tokenizer VQ 3D codifica um patch espaciotemporal (4x4x4 pixels) pra um inteiro. Um clip de 4s a 8 FPS tem 32 frames; a 256x256 com redução 4x espacial e 4x temporal, a contagem de tokens é (256/4) * (256/4) * (32/4) = 64 * 64 * 8 = 32.768 tokens.

Qualidade do tokenizer é o teto. A contribuição do Emu3 em parte é "nós treinamos um tokenizer muito bom."

### Treinamento com loss única

Emu3 usa um objetivo: previsão de próximo token em um vocabulário compartilhado entre tokens de texto, tokens de imagem 2D e tokens de vídeo 3D. Os pesos são multiplicados por fatores eespecificaçãoíficos por modalidade durante o treinamento pra equilibrar a contribuição, mas a loss é idêntica.

Treina em um mix de:
- Geração de imagem: `<text caption> <image> image_tokens </image>`
- Percepção de imagem: `<image> image_tokens </image> <question> text_tokens`
- Geração de vídeo: `<text caption> <video> video_tokens </video>`
- Percepção de vídeo: análogo.
- Só texto: NTP padrão.

O modelo aprende quando emitir tokens de imagem vs tokens de texto a partir da distribuição dos dados. Geração emerge do modelo prevendo tokens de imagem após a tag `<image>`.

### Classifier-free guidance e temperatura

Geração de imagem autoregressiva fica muito melhor com classifier-free guidance (CFG) na inferência. Emu3 usa: gera duas vezes, uma com a legenda completa, outra com legenda vazia, mistura os logits com um peso de orientação (típico 3.0-7.0). É o mesmo truque CFG que difusão usa, emprestado pro cenário autoregressivo.

Temperatura importa: alta demais, artefatos; baixa demais, colapso de modos. A temperatura recomendada do Emu3 é 1.0 pra percepção, 0.8 pra geração de imagem.

### Três papéis, um modelo

Emu3 vem como três APIs funcionalmente distintas mas com um mesmo conjunto de pesos:

- Emu3-Gen. Geração de imagem. Entrada texto, saída tokens de imagem.
- Emu3-Chat. VQA e legendagem. Entrada imagem (tokens), saída texto.
- Emu3-Stage2. Geração de vídeo e VQA de vídeo. Entrada texto ou vídeo, saída texto ou vídeo.

Sem cabeças eespecificaçãoíficas por tarefa. Só templates de prompt diferentes. Mesmo checkpoint.

### Benchmarks

Do paper do Emu3 (setembro 2024):

- Geração de imagem: supera SDXL no FID do MJHQ-30K (5.4 vs 5.6), no GenEval geral (0.54 vs 0.55 — empate estatístico), e no Deep-Eval composto em par.
- Percepção de imagem: supera LLaVA-1.6 no VQAv2 (75.1 vs 72.4) e mais ou menos empata no MMMU.
- Geração de vídeo: qualidade de clip de 4 segundos com FVD competitivo com modelos benchmarkados publicamente da era Sora.

Os números nem sempre estão ganhando — Emu3 troca um ponto aqui por outro ali — mas a alegação "previsão de próximo token é tudo que você precisa" é defensável entre modalidades.

### Custo de compute

Emu3 foi treinado com ~300 bilhões de tokens multimodais com um modelo de 7B de parâmetros. GPU-hours mais ou menos comparáveis ao pré-treinamento do Llama-2-7B (2k-4k GPU-years em silício classe A100). Modelos de difusão como Stable Diffusion 3 treinam em orçamentos similares, mas precisam de encoders de texto separados e pipelines mais complexos.

Na inferência, Emu3 é mais lento que SDXL por imagem: 4096 tokens de imagem a 30 tok/s é ~2 minutos por imagem 512x512, vs 2-5 segundos pro SDXL. Decodificação eespecificaçãoulativa e otimização de KV-cache reduzem a差距 mas não fecham. Geração de imagem autoregressiva é pesada em compute; esse é o trade-off permanente.

### Por que importa

A contribuição profunda do Emu3 é conceitual. Se previsão de próximo token escala pra igualar difusão em geração de imagem, o caminho de modelo unificado (uma loss, uma backbone, qualquer modalidade) é viável. Modelos futuros não precisam de encoders de texto separados, cronogramas de difusão separados, VAEs separados. Um transformer, um tokenizer por modalidade, escala.

Show-o, Janus-Pro e InternVL-U todos constroem em cima ou desafiam essa tese. Laboratórios chineses (BAAI, DeepSeek) publicam mais agressivamente nessa direção que laboratórios americanos até 2025.

## Use

`code/main.py` constrói duas peças toy:

- Um calculador de contagem de tokens VQ 2D vs 3D: dado (resolução, patch, clip_length, FPS), calcula contagens de tokens pra imagem vs vídeo.
- Um sampler autoregressivo de tokens de imagem com classifier-free guidance na temperatura.

A implementação de CFG segue a receita do Emu3 — mistura logits condicionais e incondicionais com um peso de orientação.

## Implemente

Esta aula produz `outputs/skill-token-gen-cost-analyzer.md`. Dada uma eespecificaçãoificação de produto de geração (imagem ou vídeo, resolução alvo, tier de qualidade, orçamento de latência), calcula contagens de tokens, custo de inferência e escolhe família Emu3 vs difusão.

## Exercícios

1. Emu3 produz 4096 tokens por imagem 512x512 com redução 8x8. Calcule o equivalente pra 1024x1024 e 2048x2048. O que acontece com a latência de inferência?

2. Leia a Seção 3.3 do Emu3 sobre o tokenizer de vídeo. Descreva o formato do patch VQ 3D e por que é 4x4x4 e não 8x8x1.

3. Classifier-free guidance peso 5.0 vs 3.0: qual efeito visual? Trace a matemática em `code/main.py`.

4. Calcule FLOPs de treinamento pro Emu3-7B com 300B tokens e compare com Stable Diffusion 3. Qual foi mais caro de treinar?

5. Emu3 supera SDXL no FID mas não no VQAv2 vs VLMs eespecificaçãoializados. Explique por que a abordagem de loss unificada mostra forças diferentes vs eespecificaçãoialistas em benchmarks diferentes.

## Termos-Chave

| Termo | O que a galera diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Previsão de próximo token | "NTP" | Loss autoregressiva padrão: prever token[i+1] dado token[0..i]; funciona pra qualquer modalidade quando tokenizada |
| Tokenizer IBQ | "Quantizador de gargalo invertido" | Uma classe de VQ-VAE com codebooks maiores (32768+) e reconstrução melhor que o do Chameleon |
| VQ 3D | "Quantizador espaciotemporal" | Codebook indexado por (tempo, linha, coluna); um token cobre um cubo de pixels 4x4x4 |
| Classifier-free guidance | "CFG" | Mistura logits condicionais e incondicionais com peso gamma; melhora qualidade de imagem na inferência |
| Vocabulário unificado | "Tokens compartilhados" | Texto + imagem + vídeo todos tirados do mesmo espaço inteiro; modelo prevê qualquer modalidade que vier em seguida |
| MJHQ-30K | "Benchmark de geração de imagem" | Benchmark de qualidade Midjourney com 30k prompts; Emu3 reporta FID aqui |

## Leitura Complementar

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
