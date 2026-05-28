# Geração de Vídeo

> Uma imagem é um tensor 2D. Um vídeo é um tensor 3D. A teoria é a mesma; a computação é 10-100x mais difícil. O Sora da OpenAI (Fev 2024) provou que era possível. Até 2026, Veo 2, Kling 1.5, Runway Gen-3, Pika 2.0 e WAN 2.2 entregam vídeo production a partir de texto em 1080p — e o stack de pesos abertos (CogVideoX, HunyuanVideo, Mochi-1, WAN 2.2) está 12 meses atrás.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 8 · 07 (Latent Diffusion), Fase 7 · 09 (ViT), Fase 8 · 06 (DDPM)
**Tempo:** ~45 minutos

## O Problema

Um vídeo de 10 segundos em 1080p a 24fps são 240 frames de 1920×1080×3 pixels. Isso é ~1,5 GB de dados brutos por clip. Difusão em espaço de pixel é inviável. Você precisa:

1. **Compressão espaço-temporal.** Um VAE que codifica vídeos, não frames, em uma sequência de patches espaço-temporais.
2. **Coerência temporal.** Os frames precisam compartilhar conteúdo, iluminação e identidade de objetos ao longo de segundos. A rede precisa modelar movimento.
3. **Orçamento computacional.** Treino de vídeo é 10-100x mais caro que imagem para o mesmo tamanho de modelo.
4. **Condicionalização.** Texto, imagem (primeiro frame), áudio ou outro vídeo. A maioria dos modelos production aceita os quatro.

A arquitetura que resolveu isso é o **Diffusion Transformer (DiT)** aplicado a patches espaço-temporais, treinado em datasets enormes de (prompt, legenda, vídeo). Mesma perda de difusão da Aula 06.

## O Conceito

![Vídeo diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### Patchify

Codifique o vídeo com um VAE 3D (compressão espaço-temporal aprendida). O latente tem forma `[T_latent, H_latent, W_latent, C_latent]`. Divida em patches de tamanho `[t_p, h_p, w_p]`. Para modelos estilo Sora, `t_p = 1` (patches por frame) ou `t_p = 2` (a cada dois frames). Um vídeo de 10 segundos em 1080p comprime para ~20.000-100.000 patches.

### DiT espaço-temporal

Um transformer processa a sequência plana de patches. Cada patch tem uma embedding posicional 3D (tempo + y + x). A attention é geralmente fatorizada:

- **Attention espacial** dentro dos patches de cada frame.
- **Attention temporal** entre frames na mesma posição espacial.
- **Attention 3D completa** é 16-100x mais cara; usada apenas em baixa resolução ou em pesquisa.

### Condicionalização textual

Cross-attention com um encoder de texto grande (T5-XXL para Sora, CogVideoX-5B usa T5-XXL). Prompts longos importam — o conjunto de treino do Sora tinha re-capções densas geradas por GPT com média de 200 tokens por clip.

### Treino

Perda padrão de difusão (previsão ε ou v) sobre latentes espaço-temporais. Dados: vídeos web + ~100M clips curados + legendas sintéticas de texto. Computação: 10.000+ GPU-hours até para uma corrida de pesquisa pequena; na escala do Sora são 100.000+.

## O cenário production de 2026

|| Modelo | Data | Duração máx | Res máx | Pesos abertos? | Destaque ||
||-------|------|--------------|---------|---------------|---------||
|| Sora (OpenAI) | 2024-02 | 60s | 1080p | Não | Primeiro modelo a mostrar propriedades de simulador de mundo em escala ||
|| Sora Turbo | 2024-12 | 20s | 1080p | Não | Sora production com inferência 5x mais rápida ||
|| Veo 2 (Google) | 2024-12 | 8s | 4K | Não | Maior qualidade + física em 2025 ||
|| Veo 3 | 2025 Q3 | 15s | 4K | Não | Áudio nativo e controle de câmera mais forte ||
|| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | Não | Melhor movimento humano em 2025 Q1 ||
|| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | Não | Ferramentas profissionais de vídeo por cima ||
|| Pika 2.0 | 2024-10 | 5s | 1080p | Não | Maior consistência de personagem ||
|| CogVideoX (THUDM) | 2024 | 10s | 720p | Sim (2B, 5B) | Primeiro vídeo aberto de escala 5B ||
|| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | Sim (13B) | SOTA aberto fim de 2024 ||
|| Mochi-1 (Genmo) | 2024-10 | 5,4s | 480p | Sim (10B) | Licença mais permissiva ||
|| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | Sim | Modelo aberto mais forte em meados de 2025 ||

Pesos abertos estão fechando o gap mais rápido que no espaço de imagem: HunyuanVideo + WAN 2.2 LoRAs já operam a maioria dos workflows open-source até meados de 2026.

## Construa

`code/main.py` simula a ideia central do DiT espaço-temporal: patchify um pequeno vídeo sintético, adicione uma embedding posicional por patch, e denoise a sequência inteira com uma attention estilo transformer sobre patches. Sem numpy; Python puro. Mostramos que a coerência temporal emerge mesmo em 1D quando patches de frames adjacentes compartilham um denoiser e embeddings posicionais.

### Passo 1: patchify um "vídeo" 1D sintético

```python
def make_video(T_frames=8, rng=None):
    # um "vídeo" é uma sequência de valores 1D seguindo uma trajetória suave
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### Passo 2: embedding posicional por frame

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### Passo 3: denoiser vê a sequência inteira

Em vez de denoizar cada frame independentemente, nossa rede minúscula concatena todos os valores de frame + suas embeddings posicionais e prevê o ruído para todos os frames conjuntamente.

### Passo 4: teste de coerência temporal

Após treinar, amostragem um vídeo. Meça o delta frame-a-frame. Se o modelo aprendeu a estrutura temporal, os deltas ficam menores que amostrar cada frame independentemente.

## Armadilhas

- **Amostragem independente por frame = flicker.** Se você roda difusão de imagem em cada frame separadamente, o output flickera porque o ruído de cada frame é independente. Difusão de vídeo resolve isso acoplando os frames via attention ou ruído compartilhado.
- **Attention 3D ingênua = OOM.** Attention 3D completa em um latente de 10 segundos em 1080p são centenas de bilhões de operações. Fatorize em espacial + temporal.
- **Legendagem de dados importa mais que tamanho.** A principal melhoria do Sora sobre trabalhos anteriores foi treinar com ~10x mais legendas detalhadas (clips re-rotulados por GPT-4). O relatório técnico da OpenAI é explícito sobre isso.
- **Condicionalização do primeiro frame.** A maioria dos modelos production também aceita uma imagem como primeiro frame. Este é o modo "image-to-video"; o treino inclui essa variante.
- **Deriva de física.** Clips longos (>10s) acumulam inconsistências sutis. Geração por sliding-window + ancoragem por keyframes ajuda.

## Use

|| Caso de uso | Escolha de 2026 ||
||----------|-----------||
|| Text-to-video de maior qualidade, hospedado | Veo 3 ou Sora ||
|| Câmera controlada cinematográfica | Runway Gen-3 com motion brushes ||
|| Consistência de personagem entre clips | Pika 2.0 ou Kling 2.1 ||
|| Pesos abertos, fine-tune rápido | WAN 2.2 + LoRA ||
|| Image-to-video | WAN 2.2-I2V, Kling 2.1 I2V ou Runway ||
|| Lip sync áudio-to-video | Veo 3 (áudio nativo) ou modelo dedicado de lip sync ||
|| Edição de vídeo | Runway Act-Two, Kling Motion Brush, Flux-Kontext (quadro estático) ||

O custo por segundo de vídeo em paridade de qualidade caiu 20x entre 2024 e 2026.

## Entregue

Salve `outputs/skill-video-brief.md`. A skill recebe um briefing de vídeo (duração, proporção, estilo, plano de câmera, consistência de sujeito, áudio) e gera: modelo + hospedagem, scaffolding de prompt (linguagem de câmera, descrição de sujeito, descritores de movimento), semente + protocolo de reprodutibilidade, e um checklist de QA a nível de frame.

## Exercícios

1. **Fácil.** Em `code/main.py`, compare o delta frame-a-frame para (a) amostragem independente por frame, (b) amostragem conjunta de sequência. Reporte a média e variância dos deltas.
2. **Médio.** Adicione uma condição de primeiro frame: fixe o frame 0 em um dado valor e amostragem o resto. Meça como o valor fixado se propaga.
3. **Difícil.** Use o diffusers do HuggingFace para rodar CogVideoX-2B em uma GPU local. Cronometre 20 passos de inferência em 720p para um clip de 6 segundos. Profile a attention espaço-temporal para identificar o gargalo.

## Termos Chave

|| Termo | O que as pessoas dizem | O que realmente significa ||
||------|-----------------|-----------------------||
|| Vídeo VAE | "VAE 3D" | Encoder que comprime `(T, H, W, C)` → latente espaço-temporal. ||
|| Patches | "Os tokens" | Blocos 3D de tamanho fixo do latente; entrada para o DiT. ||
|| Attention fatorizada | "Espacial + temporal" | Rode attention sobre o espaço, depois sobre o tempo; pule a attention 3D completa. ||
|| Image-to-video (I2V) | "Anime essa foto" | Modelo recebe imagem + texto, gera vídeo que começa a partir dela. ||
|| Condicionamento por keyframe | "Ancorar frames" | Fixar frames eespecificaçãoíficos para controlar o arco do vídeo. ||
|| Motion brush | "Dica direcional" | Entrada de UI onde o usuário pinta vetores de movimento sobre a imagem. ||
|| Re-capção | "Legendas densas" | Usar um LLM para re-rotular clips de treino com prompts detalhados. ||
|| Flicker | "Artefato temporal" | Inconsistência frame-a-frame; resolvido com denoising acoplado. |

## Nota de produção: latentes de vídeo são um problema de largura de banda de memória

Um clip de 10 segundos em 1080p a 24 fps são 240 frames × 1920 × 1080 × 3 ≈ 1,5 GB de pixels brutos. Após compressão de 4× por vídeo VAE (`2 × espacial × 2 × temporal`) o latente fica com ~100 MB por requisição. Rode isso por um DiT espaço-temporal por 30 passos em batch 1 e você está movendo ~3 GB/step através da HBM — largura de banda de memória, não FLOPS, é o gargalo.

Três botões de produção, todos direto da literatura de inferência de produção:

- **TP no DiT.** Modelos de texto-to-video rotineiramente têm ≥10B parâmetros. TP=4 em 4 H100s é padrão; PP=2 × TP=2 para modelos de escala 405B. A latência por passo cai aproximadamente linearmente com TP até o muro do all-reduce.
- **Frame batching = batch contínuo.** Na hora da geração, o vídeo é conceitualmente um batch de frames linkados por attention. Batch contínuo (agendamento in-flight) se aplica: comece a renderizar o frame `t+1` enquanto o frame `t-1` está sendo retornado, se a arquitetura do modelo permitir geração por sliding-window.
- **Cache de prefill a nível de clip.** Para image-to-video, o condicionamento do primeiro frame é análogo ao prefill de prompt de um LLM: calcule uma vez, reutilize nas passes temporais do decoder. Isso é efetivamente um KV-cache para vídeo.

## Leituras Complementares

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) — relatório técnico do Sora.
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) — CogVideoX.
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) — HunyuanVideo.
- [Genmo (2024). Mochi-1 Technical Report](https://www.genmo.ai/blog/mochi) — Mochi-1.
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) — SOTA aberto em meados de 2025.
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) — o paper seminal de difusão de vídeo.
- [Blattmann et al. (2023). Align your Latents (Video LLM)](https://arxiv.org/abs/2304.08818) — ancestral do Stable Video Diffusion.
