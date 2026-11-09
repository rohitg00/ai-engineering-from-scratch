# Modelos geracionais  Taxonomia e História

> Cada modelo de imagem, modelo de texto, modelo de vídeo e modelo 3D cabe em um dos cinco baldes. Escolha o balde errado e você lutará com a matemática por semanas. Escolha o certo e os últimos 12 anos de progresso do campo se acumula limpo em sua cabeça.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## O problema

Um modelo gerativo faz um trabalho: fornece amostras de formação extraídas de uma distribuição desconhecida $p_{\text{data}}(x)$As faces, frases, arquivos MIDI, estruturas de proteínas, todos os mesmos problemas se você piscar.

O problema é que ...$p_{\text{data}}$A maioria dos modelos de geradores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de computadores de comput

Cinco famílias sobreviveram nos últimos doze anos. Saber que compromisso cada família faz nos diz por que ganha em algumas tarefas e desmorona em outras.

## O conceito

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.**Escreva .$\log p(x)$Os modelos autoregressivos (PixelCNN, WaveNet, GPT) factorizam$p(x) = \prod_i p(x_i \mid x_{<i})$- Construção de fluxos normalizados (RealNVP, Glow) $p(x)$Pro: probabilidade exata, perda de treinamento limpa. Con: inferência autoregressiva é sequencial (lento para sequências longas), fluxos precisam de arquiteturas invertíveis (arquiteturicamente restritivas).

**2. Explicit density, approximate.**- Não .$\log p(x)$Os modelos de difusão (DDPM, Ho 2020) treinam um denoizador que otimiza implícitamente um ELBO ponderado. A difusão é a espinha dorsal dominante de imagem, vídeo e 3D em 2026.

**3. Implicit density.**Salte a densidade inteiramente; aprenda um gerador $G(z)$que produz amostras e um discriminador $D(x)$GANs (Goodfellow 2014). Rapidos na inferência (uma passagem para frente) mas notoriamente instáveis durante o treinamento. StyleGAN 1/2/3 permanece o estado da arte para fotorealismo de domínio fixo (faces, quartos) mesmo em 2026.

**4. Score-based / continuous-time.**Aprenda a gradiente da densidade de tronco.$\nabla_x \log p(x)$Song & Ermon (2019) mostrou que a correspondência de pontuação generaliza a difusão para um SDE. A correspondência de fluxo (Lipman 2023) é a temperatura de 2024-2026: treinamento sem simulação, caminhos mais retos, amostragem 4-10 vezes mais rápida do que o DDPM.

**5. Token-based autoregressive over discrete codes.**Comprime dados de alta dim com um VQ-VAE ou quantificador residual em uma curta sequência de tokens discretos, em seguida, use um transformador para modelar a sequência de tokens. Parti, MuseNet, AudioLM, VALL-E, o tokenizer de patch de Sora todos usam isso. Este é um balde 1 mais um tokenizer aprendido.

## Uma breve história

| Year | Model | Why it mattered |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | First deep generative model with a usable training loss. |
| 2014 | GAN (Goodfellow) | Implicit density, no likelihood — shockingly sharp samples. |
| 2015 | DRAW, PixelCNN | Sequential image generation. |
| 2017 | Glow, RealNVP | Invertible flows; exact likelihood with depth. |
| 2017 | Progressive GAN | First megapixel faces. |
| 2019 | StyleGAN / StyleGAN2 | Photorealistic faces still hard to beat for that one domain. |
| 2020 | DDPM (Ho) | Diffusion becomes practical. |
| 2021 | CLIP, DALL-E 1, VQGAN | Text-to-image goes mainstream. |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | Latent diffusion + text conditioning = commodity. |
| 2022 | ControlNet, LoRA | Fine control over pretrained diffusion. |
| 2023 | SDXL, Midjourney v5, Flow matching | Scale + better training dynamics. |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | Video diffusion; flow matching wins. |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | Production-grade video. |
| 2026 | Consistency + Rectified Flow | One-step sampling from diffusion backbones. |

## A triagem de cinco perguntas

Quando um novo modelo gerativo cair, responda a estas cinco perguntas antes de ler a seção de métodos.

1. **What is being modeled?**Pixels, latentes, tokens discretos, Gaussians 3D, malhas, formas de onda?
2. **Is the density explicit or implicit?**Eles escrevem .$\log p(x)$- Não .
3. **Sampling: one-shot or iterative?**Iterativo significa inferência mais lenta; um tiro geralmente significa adversário ou destilado.
4. **Conditioning: unconditional, class, text, image, pose?**Isto determina a perda e o andaime de arquitetura.
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?**Cada um tem modos de falha conhecidos (ver Lição 14).

Responde-lhes-á estas cinco lições para cada aula nesta fase.

```figure
autoencoder-bottleneck
```

## Construí-lo

O código para esta lição é uma visualização leve: ajuste uma mistura de Gauss de 1D de amostras usando três abordagens de brinquedo (densidade do núcleo, histograma discreto e gerador de "GAN-ish" da amostra mais próxima) para que você possa ver a diferença entre densidade explícita vs implícita em um problema que você pode imprimir em uma tela.

Corra .`code/main.py`Extrai 2000 amostras de uma mistura gaussiana de dois modos, e depois imprime:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

Observe: as duas primeiras deixam você perguntar "quão provável é este ponto?" A terceira não pode. Esta é a distinção *explicita vs implícita* que será importante para cada lição futura.

## Usá-lo

Que família, para que tarefa, em 2026?

| Task | Best family | Why |
|------|-------------|-----|
| Photoreal faces, narrow domain | StyleGAN 2/3 | Still sharpest, fastest inference. |
| General text-to-image | Latent diffusion + flow matching | SD3, Flux.1, DALL-E 3. |
| Fast text-to-image | Rectified flow + distillation | SDXL-Turbo, SD3-Turbo, LCM. |
| Text-to-video | Diffusion Transformer + flow matching | Sora, Veo 2, Kling. |
| Speech + music | Token-based AR (AudioLM, VALL-E, MusicGen) or flow matching (AudioCraft 2) | Discrete tokens scale cheaply. |
| 3D scenes | Gaussian Splatting fit, diffusion prior | 3D-GS for reconstruction, diffusion for novel-view. |
| Density estimation (no sampling) | Flows | Only family with exact $\log p(x)$. |
| Simulation / physics | Flow matching, score SDE | Straight-line paths, smooth vector fields. |

## Envia-o

Salva como`outputs/skill-model-chooser.md`- Não .

A habilidade requer uma descrição da tarefa e resultados: (1) qual família usar, (2) uma lista classificada de três opções abertas e três hospedadas, (3) o modo de falha provável que você deve procurar, e (4) um orçamento computacional/temporal.

## Exercícios

1. **Easy.**Para cada um destes cinco produtos, identifique a família e a espinha dorsal: imagem ChatGPT, Midjourney v7, Sora, Runway Gen-3, ElevenLabs.
2. **Medium.**O artigo que você está prestes a ler amanhã afirma que a amostragem é 100 vezes mais rápida do que a difusão.
3. **Hard.**Tome um domínio que lhe interessa (por exemplo, estrutura de proteínas, CAD, moléculas, trajetórias). Responda à triagem de cinco perguntas para o modelo SOTA atual nesse domínio e esboce o que um modelo melhor mudaria.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generative model | "It makes new stuff" | Learns a sampler for $p_{\text{data}}(x)$, optionally exposes $\log p(x)$. |
| Explicit density | "You can evaluate it" | Model provides a closed-form or tractable $\log p(x)$. |
| Implicit density | "GAN-style" | Only a sampler — no way to evaluate $p(x)$ of a given point. |
| ELBO | "Evidence lower bound" | A tractable lower bound on $\log p(x)$; VAEs and diffusion optimize it. |
| Score | "Gradient of log-density" | $\nabla_x \log p(x)$; diffusion and SDE models learn this field. |
| Manifold hypothesis | "Data lives on a surface" | High-dim data concentrates on a low-dim manifold; why dimensionality reduction works. |
| Autoregressive | "Predict the next piece" | Factorize joint as product of conditionals. |
| Latent | "Compressed code" | Low-dim representation from which a decoder can reconstruct the input. |

## Nota de produção: cinco famílias, cinco formas de inferência

Cada família mapeia uma curva de custo inferência-servidor diferente. literatura de produção-inferação enquadra inferência LLM como prefill + decode; a mesma decomposição aplica-se aqui:

- **Autoregressive (bucket 1 and 5).**O decodificação sequencial domina a latência; o cache KV, o batch contínuo e a decodificação especulativa aplicam-se diretamente.
- **VAE / diffusion / flow-matching (buckets 2 and 4).**Não há decodificação no sentido de LLM.`num_steps × step_cost`, e o `step_cost`O botão de produção é de contagem de etapas (DDIM / DPM-Solver / destilação), tamanho de lote e precisão (bf16 / fp8 / int4).
- **GAN (bucket 3).**Não há cronograma, não há cache KV, TTFT ≈ latência total, é por isso que o StyleGAN ainda vence no UX de domínio estreito.

Quando você vê "mais rápido que a difusão" em um resumo de papel, traduza-o para "menos passos × o mesmo custo de passos" ou "os mesmos passos × mais barato custo de passos".

## Mais leitura

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661)O papel GAN.
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) o papel do VAE.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) o documento do DDPM.
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) difusão como SDE.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) papel de correspondência de fluxo.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) Difusão estável 3.
