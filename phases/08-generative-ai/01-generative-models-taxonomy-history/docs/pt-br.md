# Modelos Generativos — Taxonomia e História

> Todo modelo de imagem, texto, vídeo e 3D se encaixa em um de cinco baldes. Escolhe o balde errado e você vai brigar com a matemática por semanas. Escolhe o certo e os últimos doze anos de progresso do campo se encaixam na sua cabeça.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 2 (Fundamentos de ML), Fase 3 (Deep Learning Core), Fase 7 · 14 (Transformers)
**Tempo:** ~45 minutos

## O Problema

Um modelo generativo faz um trabalho: dados amostras de treinamento extraídas de alguma distribuição desconhecida `p_data(x)`, gera novas amostras que parecem ter vindo da mesma distribuição. Rostos, frases, arquivos MIDI, estruturas de proteínas — tudo o mesmo problema se você apertar os olhos.

O problema é que `p_data` vive num espaço com milhões de dimensões (uma imagem RGB de 512×512 tem ~786 mil dimensões), as amostras ficam num variedade fina dentro desse espaço, e você só tem uns 10M de exemplos. Forçar a densidade na marra é impossível. Todo modelo generativo é um compromisso que troca um problema difícil por um menos difícil.

Cinco famílias sobreviveram nos últimos doze anos. Saber qual compromisso cada família faz te diz porque ela ganha em algumas tarefas e colapsa em outras.

## O Conceito

![Cinco famílias de modelos generativos — taxonomia por o que eles modelam](../assets/taxonomy.svg)

**1. Densidade explícita, tratável.** Escreve `log p(x)` como uma soma que você pode avaliar. Modelos autoregressivos (PixelCNN, WaveNet, GPT) fatoram `p(x) = ∏ p(x_i | x_<i)`. Flows normalizadores (RealNVP, Glow) constroem `p(x)` como uma transformação invertível de uma base simples. Pró: verossimilhança exata, loss de treinamento limpa. Contra: inferência autoregressiva é sequencial (lenta para sequências longas), flows precisam de arquiteturas invertíveis (restritivo).

**2. Densidade explícita, aproximada.** Limitam `log p(x)` por baixo (ELBO) e otimizam o limite. VAEs (Kingma 2013) usam um encoder-decoder com posterior variacional. Modelos de difusão (DDPM, Ho 2020) treinam um denoiser que otimiza implicitamente um ELBO ponderado. Difusão é a espinha dorsal dominante de imagem, vídeo e 3D em 2026.

**3. Densidade implícita.** Pulam a densidade inteiramente; aprendem um gerador `G(z)` que produz amostras e um discriminador `D(x)` que distingue real de falso. GANs (Goodfellow 2014). Rápido na inferência (um forward pass), mas notoriamente instável durante treinamento. StyleGAN 1/2/3 continuam state-of-the-art para fotorrealismo em domínio fixo (rostos, quartos) mesmo em 2026.

**4. Baseado em score / tempo contínuo.** Aprendem o gradiente da log-densidade `∇_x log p(x)` (o score) diretamente. Song & Ermon (2019) mostraram que score matching generaliza difusão para uma EDE. Flow matching (Lipman 2023) é a novidade quente de 2024-2026: treinamento sem simulação, caminhos mais retos, 4-10x mais rápido que DDPM. Stable Diffusion 3, Flux, AudioCraft 2 usam flow matching.

**5. Autoregressivo baseado em tokens sobre códigos discretos.** Comprimem dados de alta dimensão com VQ-VAE ou quantizador residual em uma sequência curta de tokens discretos, depois usam um Transformer para modelar a sequência de tokens. Parti, MuseNet, AudioLM, VALL-E, o patch tokenizer do Sora usam isso. É o balde 1 mais um tokenizer aprendido.

## Uma breve história

| Ano | Modelo | Por que importou |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | Primeiro modelo generativo profundo com loss de treinamento utilizável. |
| 2014 | GAN (Goodfellow) | Densidade implícita, sem verossimilhança — amostras surpreendentemente nítidas. |
| 2015 | DRAW, PixelCNN | Geração sequencial de imagens. |
| 2017 | Glow, RealNVP | Flows invertíveis; verossimilhança exata com profundidade. |
| 2017 | Progressive GAN | Primeiros rostos de megapixel. |
| 2019 | StyleGAN / StyleGAN2 | Rostos fotorrealistas ainda difíceis de superar nesse domínio. |
| 2020 | DDPM (Ho) | Difusão se torna prática. |
| 2021 | CLIP, DALL-E 1, VQGAN | Texto-para-imagem entra no mainstream. |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | Difusão latente + condicionamento por texto = commodity. |
| 2022 | ControlNet, LoRA | Controle fino sobre difusão pré-treinada. |
| 2023 | SDXL, Midjourney v5, Flow matching | Escala + melhores dinâmicas de treinamento. |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | Difusão de vídeo; flow matching vence. |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | Vídeo de nível de produção. |
| 2026 | Consistency + Rectified Flow | Amostragem em um passo a partir de backbones de difusão. |

## As cinco perguntas de triagem

Quando um paper novo de modelo generativo cai, responda essas cinco perguntas antes de ler a seção de método.

1. **O que está sendo modelado?** Pixels, latents, tokens discretos, Gaussianas 3D, malhas, formas de onda?
2. **A densidade é explícita ou implícita?** Eles escrevem `log p(x)`?
3. **Amostragem: one-shot ou iterativa?** Iterativa significa inferência mais lenta; one-shot geralmente significa adversarial ou destilado.
4. **Condicionamento: incondicional, classe, texto, imagem, pose?** Isso determina a loss e a estrutura da arquitetura.
5. **Avaliação: FID, CLIP score, IS, preferência humana, acurácia em tarefa?** Cada um tem modos de falha conhecidos (ver Lição 14).

Você vai re-responder essas cinco em cada lição dessa fase. No final, serão um reflexo.

## Construa

O código dessa lição é uma visualização leve: ajusta uma mistura de Gaussianas 1D a partir de amostras usando três abordagens de brinquedo (densidade de kernel, histograma discretos, e um gerador "estilo GAN" de amostra mais próxima) para que você veja a diferença entre densidade explícita vs implícita num problema que cabe numa tela.

Execute `code/main.py`. Ele desenha 2000 amostras de uma mistura gaussiana de dois modos, depois imprime:

```
densidade explícita (histograma): p(x em [-0.5, 0.5]) ≈ 0.38
densidade aproximada (KDE):     p(x em [-0.5, 0.5]) ≈ 0.41
implícita (gen por amostra mais próxima): 20 novas amostras impressas, sem p(x)
```

Note: os dois primeiros deixam você perguntar "quão provável é esse ponto?" O terceiro não. Essa é a distinção *explícita vs implícita* que vai importar em toda lição futura.

## Use

Qual família, para qual tarefa, em 2026?

| Tarefa | Melhor família | Por quê |
|------|-------------|-----|
| Rostos fotorrealistas, domínio estreito | StyleGAN 2/3 | Ainda o mais nítido, inferência mais rápida. |
| Texto-para-imagem geral | Difusão latente + flow matching | SD3, Flux.1, DALL-E 3. |
| Texto-para-imagem rápido | Rectified flow + destilação | SDXL-Turbo, SD3-Turbo, LCM. |
| Texto-para-vídeo | Diffusion Transformer + flow matching | Sora, Veo 2, Kling. |
| Fala + música | Token-based AR (AudioLM, VALL-E, MusicGen) ou flow matching (AudioCraft 2) | Tokens discretos escalam barato. |
| Cenas 3D | Gaussian Splatting ajustado, diffusion prior | 3D-GS para reconstrução, difusão para nova-view. |
| Estimativa de densidade (sem amostragem) | Flows | Única família com `log p(x)` exato. |
| Simulação / física | Flow matching, score SDE | Caminhos em linha reta, campos vetoriais suaves. |

## Entregue

Salve como `outputs/skill-model-chooser.md`.

A skill recebe uma descrição de tarefa e gera: (1) qual família usar, (2) uma lista ranqueada de três opções open e três hospedadas, (3) o provável modo de falha que você deve observar, e (4) um orçamento de compute/tempo.

## Exercícios

1. **Fácil.** Para cada um desses cinco produtos, identifique a família e o backbone: ChatGPT image, Midjourney v7, Sora, Runway Gen-3, ElevenLabs. Evidência deve vir de relatórios técnicos públicos.
2. **Médio.** O paper que você vai ler amanhã afirma 100x mais rápido que difusão. Escreva três perguntas para verificar se a aceleração sobrevive ao condicionamento e alta resolução.
3. **Difícil.** Pegue um domínio que você se importa (ex: estrutura de proteína, CAD, moléculas, trajetórias). Responda as cinco perguntas de triagem para o modelo SOTA atual nesse domínio e esboce o que um modelo melhor mudaria.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|-----------------|-----------------------|
| Modelo generativo | "Ele faz coisas novas" | Aprende um sampler para `p_data(x)`, opcionalmente expõe `log p(x)`. |
| Densidade explícita | "Você pode avaliar" | Modelo fornece `log p(x)` em forma fechada ou tratável. |
| Densidade implícita | "Estilo GAN" | Apenas um sampler — sem forma de avaliar `p(x)` de um ponto dado. |
| ELBO | "Limite inferior da evidência" | Um limite inferior tratável para `log p(x)`; VAEs e difusão otimizam. |
| Score | "Gradiente da log-densidade" | `∇_x log p(x)`; difusão e modelos SDE aprendem esse campo. |
| Hipótese da variedade | "Dados vivem numa superfície" | Dados de alta dimensão se concentram numa variedade de baixa dimensão; por que redução de dimensionalidade funciona. |
| Autoregressivo | "Prever o próximo pedaço" | Fatora a conjunta como produto de condicionais. |
| Latent | "Código comprimido" | Representação de baixa dimensão a partir da qual um decoder pode reconstruir o input. |

## Nota de produção: cinco famílias, cinco formatos de inferência

Cada família mapeia para uma curva de custo diferente no servidor de inferência. A literatura de inferência em produção enquadra inferência LLM como prefill + decode; a mesma decomposição se aplica aqui:

- **Autoregressivo (balde 1 e 5).** Decode sequencial domina a latência; KV-cache, batch contínuo e decode eespecificaçãoulativo se aplicam diretamente.
- **VAE / difusão / flow-matching (balde 2 e 4).** Não tem decode no sentido de LLM. Custo = `num_steps × step_cost`, e o `step_cost` é um transformer ou U-Net forward na resolução latente completa. Os parâmetros de produção são contagem de passos (DDIM / DPM-Solver / destilação), tamanho do lote e precisão (bf16 / fp8 / int4).
- **GAN (balde 3).** Um forward pass. Sem agendamento, sem KV-cache. TTFT ≈ latência total. É por isso que StyleGAN ainda vence em UX de domínio estreito.

Quando você ver "mais rápido que difusão" no abstract de um paper, traduza para "menos passos × mesmo custo por passo" ou "mesmos passos × custo por passo mais barato". Todo o resto é marketing.

## Leitura Adicional

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) — o paper das GAN.
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) — o paper do VAE.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) — o paper do DDPM.
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) — difusão como EDE.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) — o paper de flow matching.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) — Stable Diffusion 3.
