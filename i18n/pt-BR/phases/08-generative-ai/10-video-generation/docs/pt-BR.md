# Geração de vídeos

> Uma imagem é um tensor 2D. Um vídeo é um 3D. A teoria é a mesma; a computação é 10-100 vezes mais difícil. Sora da OpenAI (Feb 2024) provou que era possível. Em 2026 Veo 2, Kling 1.5, Runway Gen-3, Pika 2.0, e WAN 2.2 vídeo de produção de navio a partir de texto em 1080p  e o open-weights stack (CogVideoX, HunyuanVideo, Mochi-1, WAN 2.2) está 12 meses atrás.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 7 · 09 (ViT), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## O problema

Um vídeo 1080p de 10 segundos a 24 fps é de 240 quadros de 1920×1080×3 pixels. Isso é cerca de 1,5 GB de dados brutos por clip. A difusão no espaço de pixels é impossível. Você precisa:

1. **Spatiotemporal compression.**Um VAE que codifica vídeos, não quadros, em uma sequência de parches espaciais-temporais.
2. **Temporal coherence.**Os quadros precisam compartilhar conteúdo, iluminação e identidade de objeto em segundos.
3. **Compute budget.**O treinamento por vídeo é 10-100 vezes mais caro do que a imagem para o mesmo tamanho do modelo.
4. **Conditioning.**Texto, imagem (primeira tela), áudio ou outro vídeo.

A arquitetura que resolveu isto é a**Diffusion Transformer (DiT)**A primeira é a de um grupo de dados de um grupo de dados, que é aplicado a parches espaciotemporais, treinados em grandes conjuntos de dados (impressão, legenda, vídeo).

## O conceito

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### Paragem

O vídeo é codificado com um VAE 3D (compressão espaciotemporal aprendida).`[T_latent, H_latent, W_latent, C_latent]`Dividido em pedaços de tamanho .`[t_p, h_p, w_p]`Para modelos de estilo Sora,`t_p = 1`(parches por quadro) ou `t_p = 2`Um vídeo 1080p de 10 segundos comprime para cerca de 20.000 a 100.000 parches.

### Dieta de espaço-tempo

Um transformador processa a sequência plana de patches. Cada patch tem uma inserção posicional 3D (tempo + y + x).

- **Spatial attention**dentro dos parches de cada quadro.
- **Temporal attention**através de quadros no mesmo local espacial.
- **Full 3D attention**É 16-100 vezes mais caro; só é utilizado em baixa resolução ou em investigação.

### Condicionamento de texto

Atensão cruzada com um grande codificador de texto (T5-XXL para Sora, CogVideoX-5B usa T5-XXL).

### Formação

Perda de difusão padrão (ε ou v previsão) sobre latentes espaciotemporais. Dados: vídeo web + ~ 100M clips curados + legendas de texto sintéticas. Computação: 10.000+ horas de GPU para mesmo uma pequena pesquisa; escala Sora é 100.000+.

## O cenário de produção de 2026

| Model | Date | Max duration | Max res | Open weights? | Notable |
|-------|------|--------------|---------|---------------|---------|
| Sora (OpenAI) | 2024-02 | 60s | 1080p | No | First model to show world simulator properties at scale |
| Sora Turbo | 2024-12 | 20s | 1080p | No | Production Sora at 5x faster inference |
| Veo 2 (Google) | 2024-12 | 8s | 4K | No | Highest quality + physics in 2025 |
| Veo 3 | 2025 Q3 | 15s | 4K | No | Native audio and stronger camera control |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | No | Best human motion in 2025 Q1 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | No | Professional video tools on top |
| Pika 2.0 | 2024-10 | 5s | 1080p | No | Strongest character consistency |
| CogVideoX (THUDM) | 2024 | 10s | 720p | Yes (2B, 5B) | First open 5B-scale video |
| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | Yes (13B) | Open SOTA late 2024 |
| Mochi-1 (Genmo) | 2024-10 | 5.4s | 480p | Yes (10B) | Most permissively licensed |
| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | Yes | Strongest open model mid-2025 |

Os pesos abertos estão a fechar a lacuna mais rapidamente do que no espaço de imagem: HunyuanVideo + WAN 2.2 LoRAs já alimentam a maioria dos fluxos de trabalho de código aberto até meados de 2026.

```figure
video-diffusion-denoise
```

## Construí-lo

`code/main.py`Simula a ideia principal de DiT espacial-temporal: parchear um pequeno vídeo sintético, adicionar um inserimento de posição por parche e denotar toda a sequência com uma atenção de estilo transformador sobre os parches.

### Passo 1: parche um "vídeo" sintético 1D

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### Passo 2: inserção de posição por quadro

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### Passo 3: Denoiser vê toda a sequência

Em vez de denotar cada quadro de forma independente, nossa pequena rede concatenar todos os valores do quadro + suas inserções de posição e prever o ruído para todos os quadros em conjunto.

### Passo 4: Teste de coerência temporal

Após o treino, mostre um vídeo. Messe o delta frame-to-frame. Se o modelo tiver aprendido a estrutura temporal, os deltas permanecem menores do que a amostragem de cada quadro de forma independente.

## Encurralagens

- **Independent per-frame sampling = flicker.**Se executar a difusão de imagem em cada quadro separadamente, a saída de flash porque o ruído de cada quadro é independente.
- **Naive 3D attention = OOM.**A atenção 3D completa em uma 1080p latente de 10 segundos é centenas de bilhões de operações. Factorizem em espacial + temporal.
- **Data captioning matters more than size.**A principal atualização de Sora em relação ao trabalho anterior foi a formação em legendas mais detalhadas (clipes reetiquetados GPT-4).
- **First-frame conditioning.**A maioria dos modelos de produção também aceita uma imagem como a primeira tela.
- **Physics drift.**Os clips longos (> 10s) acumulam subtis inconsistências.

## Usá-lo

| Use case | 2026 pick |
|----------|-----------|
| Highest-quality text-to-video, hosted | Veo 3 or Sora |
| Camera-controlled cinematic | Runway Gen-3 with motion brushes |
| Character consistency across clips | Pika 2.0 or Kling 2.1 |
| Open weights, fast fine-tune | WAN 2.2 + LoRA |
| Image-to-video | WAN 2.2-I2V, Kling 2.1 I2V, or Runway |
| Audio-to-video lip sync | Veo 3 (native audio) or a dedicated lip-sync model |
| Video editing | Runway Act-Two, Kling Motion Brush, Flux-Kontext (still-frame) |

O custo por segundo de vídeo na paridade de qualidade caiu 20 vezes entre 2024 e 2026.

## Envia-o

Salvar`outputs/skill-video-brief.md`. A competência assume um vídeo breve (durada, relação de aspecto, estilo, plano da câmera, consistência do assunto, áudio) e as saídas: modelo + hospedagem, esquadrão de execução (linguagem da câmera, descrição do assunto, descrição de movimento), protocolo de semente + reprodução e uma lista de verificação de qualidade a nível de quadro.

## Exercícios

1. **Easy.**- Não .`code/main.py`, comparar delta de quadro a quadro para a) amostragem independente por quadro, b) amostragem conjunta de sequência.
2. **Medium.**Adicione uma condição de primeiro quadro: quadro de pin 0 a um determinado valor e amostre o resto.
3. **Hard.**Use os difusores HuggingFace para executar o CogVideoX-2B em uma GPU local. Tempo 20 de inferência passa a 720p para um clipe de 6 segundos. Profila a atenção espaciotemporal para identificar o gargalo de engarrafamento.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Video VAE | "3-D VAE" | Encoder that compresses `(T, H, W, C)` → spatiotemporal latent. |
| Patches | "The tokens" | Fixed-size 3-D blocks of the latent; input to the DiT. |
| Factorized attention | "Spatial + temporal" | Run attention over space, then over time; skip full 3-D attention. |
| Image-to-video (I2V) | "Animate this photo" | Model takes an image + text, outputs a video that starts from it. |
| Keyframe conditioning | "Anchor frames" | Pin specific frames to control the video's arc. |
| Motion brush | "Directional hint" | UI input where the user paints motion vectors onto the image. |
| Re-captioning | "Dense captions" | Using an LLM to re-label training clips with detailed prompts. |
| Flicker | "Temporal artifact" | Frame-to-frame inconsistency; fixed with coupled denoising. |

## Nota de produção: os latentes de vídeo são um problema de largura de banda de memória

Um clip de 10 segundos em 1080p a 24 fps é de 240 quadros × 1920 × 1080 × 3 ≈ 1,5 GB de pixels brutos.`2 × spatial × 2 × temporal`O que é o problema é que o tempo de transmissão é de aproximadamente 100 MB por pedido.

Três botões de produção, todos diretamente do capítulo de inferência da literatura de produção-inferência:

- **TP across the DiT.**Os modelos de texto a vídeo são rotineiramente ≥10B parâmetros. TP = 4 em 4 H100s é padrão; PP = 2 × TP = 2 para modelos da classe 405B. A latência por passo cai aproximadamente linearmente com TP até a parede totalmente reduzida.
- **Frame batching = continuous batching.**No momento da geração, o vídeo é conceitualmente um lote de quadros ligados pela atenção.`t+1`enquanto enquadram`t-1`está a ser devolvido, se a arquitetura do modelo permitir a geração de janelas deslizantes.
- **Clip-level prefill cache.**Para imagem-a-vídeo, o condicionamento de primeira tela é análogo ao preenchimento de um LLM: compute-o uma vez, reutilize-o através dos passes do decodificador temporal.

## Mais leitura

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) Relatório técnico da Sora.
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) CogVideoX.
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) HunyuanVideo.
- [Genmo (2024). Mochi 1 preview model card](https://huggingface.co/genmo/mochi-1-preview)Mochi-1.
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) abertura da SOTA em meados de 2025.
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) o papel de difusão de vídeo seminal.
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) Ancestral da Difusão de Vídeo Estabilizada.
