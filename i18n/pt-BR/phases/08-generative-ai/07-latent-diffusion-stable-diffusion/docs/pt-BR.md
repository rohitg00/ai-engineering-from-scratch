# Difusão latente e difusão estável

> A difusão de pixels em imagens 512×512 é um crime de guerra computacional. Rombach et al. (2022) notou que você não precisa de todas as dimensões 786k para gerar uma imagem.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## O problema

A difusão no espaço-pixel no 5122 significa que a U-Net funciona em tensores de forma .`[B, 3, 512, 512]`Cada passo de amostragem é de ~100 GFLOPS para uma rede U-Net de 500M. Cinquenta passos são 5 TFLOPS por imagem.

A maioria desses FLOPs vai empurrar detalhes perceptivamente não importantes através da rede  a textura de alta frequência que um VAE perdedor poderia comprimir. A ideia de Rombach: treinar um VAE uma vez (o * primeiro estágio *), congelar-o e executar a difusão inteiramente no espaço latente de 4 canais 64×64 (o * segundo estágio *).

Esta é a receita da Estabilidade de Difusão.`64×64×4`Os dados dos dados de dados dos sistemas de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados`128×128×4`O SD3 trocou a U-Net por um Transformador de Difusão (DiT) com correspondência de fluxo. Flux.1-dev (Black Forest Labs, 2024) envia um DiT-MMDiT de 12B-param. Todos funcionam no mesmo substrato de dois estágios.

## O conceito

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**Two stages, separately trained.**

1. **Stage 1 — VAE.**Encoder $E(x) \to z$, decodificador$D(z) \to x$. Compressão alvo: 8x amostra descendente em cada eixo espacial + ajuste de canais para que o tamanho total latente seja ~1/16 da contagem de pixels. perda = reconstrução (L1 + LPIPS perceptivo) + KL (pequeno peso, portanto $z$Não é forçado Gaussian, porque não precisamos de amostragem exata de$z$O que é que é uma forma de fazer isso?

2. **Stage 2 — diffusion on $z$.**Tratar$z = E(x_{\text{real}})$- A formação de uma rede U-Net (ou DiT) para denúncia$z_t$- Em inferência: amostra$z_0$através da difusão, então $x = D(z_0)$- Não .

**Text conditioning.**Dois componentes adicionais: um codificador de texto congelado (CLIP-L para SD 1.x, CLIP-L+OpenCLIP-G para SD 2/XL, T5-XXL para SD3 e Flux).`[Q = image features, K = V = text tokens]`Os tokens são a única forma de texto influenciar a imagem.

**The loss function is identical to Lesson 06.**O mesmo DDPM / fluxo de correspondência MSE no ruído.

## Variantes de arquitetura

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

A tendência: substituir a U-Net por DiT (transformador sobre patches latentes), escalar o codificador de texto (T5 supera o CLIP para adesão rápida), aumentar os canais latentes (4 → 16 dá mais espaço de detalhe).

```figure
noise-schedule
```

## Construí-lo

`code/main.py`A primeira fase do processo de classificação é a de um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados, que é um sistema de classificação de dados.

### Passo 1: codificador/decodificador

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

Para a pedagogia, este mapa linear é suficiente para mostrar que a difusão opera em$z$sem se preocupar com o espaço de dados original.

### Passo 2: difusão em`z`- Espaço

A mesma DDPM que a lição 06.$z = E(x)$Após a amostragem$z_0$, decodificar com $D(z_0)$- Não .

### Passo 3: Orientação sem classificador

Durante o treino, deixe de lado a etiqueta de classe 10% do tempo (substitua-a por um token zero).$\epsilon_{\text{cond}}$E ...$\epsilon_{\text{uncond}}$, então:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

$w = 0$= não há orientação (plena diversidade), $w = 3$= padrão, $w = 7+$= saturado / demasiado nítido.

### Passo 4: condicionamento de texto (conceito, não código)

Substitua o rótulo de classe com uma saída de codificador de texto congelado. Alimenta o texto incorporado para a U-Net através da atenção cruzada:

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

Esta é a única diferença substancial entre um modelo de difusão condicional de classe e a difusão estável.

## Encurralagens

- **VAE-scale mismatch.**SD 1.x VAEs têm uma constante de escala (`scaling_factor ≈ 0.18215`O que é que é o problema é que a rede U-Net está em latência com variação muito errada.
- **Text encoder silently wrong.**SD3 precisa de T5-XXL com >=128 tokens, e o regresso para CLIP-só é perdedor.`use_t5=True`ou crateras de fidelidade.
- **Mixing latent spaces.**SDXL, SD3, Flux todos usam diferentes VAEs. Um LoRA treinado em latentes SDXL não funcionará em SD3.
- **CFG too high.** `w > 10`O ponto mais interessante é que a sua qualidade de vida é muito mais elevada.`w = 3-7`- Não .
- **Negative prompts leaking.**Um prompt negativo vazio torna-se o token zero; um prompt negativo preenchido torna-se o $\epsilon_{\text{uncond}}$Não são os mesmos; alguns oleodutos silenciosamente param para o zero.

## Usá-lo

Estacas de produção em 2026:

| Target | Recommended backbone |
|--------|----------------------|
| Narrow domain, paired data, training a model from scratch | SDXL fine-tune (LoRA / full) — fastest to ship |
| Open-domain text-to-image, open weights | Flux.1-dev (12B, Apache / non-commercial) or SD3.5-Large |
| Fastest inference, open weights | Flux.1-schnell (1-4 step, Apache) or SDXL-Lightning |
| Best prompt adherence, hosted | GPT-Image / DALL-E 3 (still), Midjourney v7, Imagen 4 |
| Edit workflows | Flux.1-Kontext (Dec 2024) — natively accepts image + text |
| Research, baseline | SD 1.5 — ancient but well-studied |

## Envia-o

Salvar`outputs/skill-sd-prompter.md`. A Skill assume um prompt de texto + estilo de destino e as saídas: modelo + ponto de verificação, escala CFG, amostragem, prompt negativo, resolução, combinação opcional de ControlNet/IP-Adapter e uma lista de verificação de qualidade por etapa.

## Exercícios

1. **Easy.**Corra .`code/main.py`com orientação.$w \in \lbrace 0, 1, 3, 7, 15 \rbrace$- Registrar a amostra média por classe.$w$Os meios de classe divergem além dos meios de dados reais?
2. **Medium.**Troque o codificador linear do brinquedo por um par de codificador/decodificador tanh-MLP com perda de reconstrução. Retrain difusão nos novos latentes.
3. **Hard.**Configurar uma verdadeira inferência de difusão estável com difusores: carga `sdxl-base`, executar 30 passos de Euler com CFG=7, tempo. Agora, desligue para `sdxl-turbo`O mesmo assunto, qualidade diferente descreve o que mudou e porquê.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| First stage | "The VAE" | Trained encoder/decoder pair; compresses 512² to 64². |
| Second stage | "The U-Net" | Diffusion model over the latent space. |
| CFG | "Guidance scale" | $(1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$; tunes conditioning strength. |
| Null token | "Empty prompt embed" | Unconditional embed used for $\epsilon_{\text{uncond}}$. |
| Cross-attention | "How text gets in" | Each U-Net block attends to text tokens as K and V. |
| DiT | "Diffusion Transformer" | Replace U-Net with a transformer over latent patches; scales better. |
| MMDiT | "Multi-modal DiT" | SD3's architecture: text and image streams with joint attention. |
| VAE scaling factor | "Magic number" | Divides latents by ~5.4 so diffusion operates in unit-variance space. |

## Nota de produção: execução de Flux-12B em uma GPU de consumo de 8 GB

A integração de Flux de referência é a receita canônica "Eu tenho uma GPU de consumo, posso enviar isso?" O truque é o mesmo de três botões de receita de produção de inferência de literatura de listas aplicadas a uma difusão DiT:

1. **Staggered loading.**Flux tem quatro redes que nunca precisam coexistir na VRAM: T5-XXL codificador de texto (~ 10 GB em fp32), CLIP-L (pequeno), o 12B MMDiT e o VAE. Encode o prompt primeiro, * excluir* os codificadores, carregar o DiT, denoise, * excluir* o DiT, carregar o VAE, decodificar. GPUs de consumo de 8 GB apenas cabem em uma etapa por vez.
2. **4-bit quantization via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`No codificador T5 e no DiT. Cortando a memória 8x, a queda de qualidade é imperceptível para o texto-à-imagem por referências do Aritra (linkado no notebook).
3. **CPU offload.** `pipe.enable_model_cpu_offload()`Auto-swaps módulos entre CPU e GPU como cada passo avança. Adiciona 10-20% de latência, mas faz o pipeline funcionar em tudo.

A contabilidade da memória é: `10 GB T5 / 8 = 1.25 GB`quantizada, `12 B params × 0.5 bytes = ~6 GB`DiT quantizado, mais ativações. Em termos de stas00 esta é a extremidade da inferência TP=1  sem paralelismo de modelo, quantização máxima. Para produção você executaria TP=2 ou TP=4 em H100s; para um único laptop de desenvolvimento, esta é a receita.

## Mais leitura

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) Difusão estável.
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) SDXL.
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748)- Não.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, MMDiT.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598)- CFG.
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) Família Flux.1.
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) Implementação de referência para cada ponto de controlo acima.
