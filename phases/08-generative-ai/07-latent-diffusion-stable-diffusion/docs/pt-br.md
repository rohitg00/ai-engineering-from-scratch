# Latent Diffusion e Stable Diffusion

> Difusão em espaço de pixel em imagens 512×512 é um crime de guerra computacional. Rombach et al. (2022) percebeu que você não precisa de todas as 786k dimensões para gerar uma imagem — precisa de suficiente para capturar a estrutura semântica, e um decoder separado para o resto. Rode difusão dentro do espaço latente de um VAE. Essa ideia é o Stable Diffusion.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 8 · 02 (VAE), Fase 8 · 06 (DDPM), Fase 7 · 09 (ViT)
**Tempo:** ~75 minutos

## O Problema

Difusão em espaço de pixel em 512² significa que o U-Net roda em tensores de forma `[B, 3, 512, 512]`. Cada passo de amostragem é ~100 GFLOPS para um U-Net com 500M de parâmetros. Cinquenta passos são 5 TFLOPS por imagem. Treine em um bilhão de imagens e a conta de computação é absurda.

A maioria desses FLOPS vai para empurrar detalhes perceptualmente insignificantes pela rede — a textura de alta frequência que um VAE com perdas poderia comprimir. A ideia de Rombach: treine um VAE uma vez (*primeiro estágio*), congele-o, e rode difusão inteiramente no espaço latente de 4 canais 64×64 (*segundo estágio*). Mesmo U-Net. 1/16 dos pixels. ~64x menos FLOPS para qualidade comparável.

Essa é a receita do Stable Diffusion. SD 1.x / 2.x usou um U-Net de 860M sobre latentes `64×64×4`, SDXL usou um U-Net de 2,6B sobre `128×128×4`, SD3 trocou o U-Net por um Diffusion Transformer (DiT) com flow matching. Flux.1-dev (Black Forest Labs, 2024) entrega um DiT-MMDiT de 12B. Todos rodam no mesmo substrato de dois estágios.

## O Conceito

![Latent diffusion: compressão VAE + difusão no espaço latente](../assets/latent-diffusion.svg)

**Dois estágios, treinados separadamente.**

1. **Estágio 1 — VAE.** Encoder `E(x) → z`, decoder `D(z) → x`. Compressão alvo: 8× de downsampling em cada eixo espacial + ajuste de canais para que o tamanho total do latente seja ~1/16 da contagem de pixels. Perda = reconstrução (L1 + LPIPS perceptual) + KL (peso pequeno para que `z` não seja forçado a ser gaussiano demais, porque não precisamos de amostragem exata de `z`). Frequentemente treinado com perda adversarial para que as imagens decodificadas fiquem nítidas.

2. **Estágio 2 — difusão em `z`.** Trate `z = E(x_real)` como os dados. Treine um U-Net (ou DiT) para denoising de `z_t`. Em inferência: amostragem de `z_0` via difusão, depois `x = D(z_0)`.

**Condicionalização textual.** Dois componentes adicionais. Um encoder de texto congelado (CLIP-L para SD 1.x, CLIP-L+OpenCLIP-G para SD 2/XL, T5-XXL para SD3 e Flux). Uma injeção via cross-attention: cada bloco do U-Net recebe `[Q = features de imagem, K = V = tokens de texto]` e os mistura. Os tokens são a única forma como o texto influencia a imagem.

**A função de perda é idêntica à da Aula 06.** Mesmo MSE de DDPM / flow matching no ruído. Você apenas troca o domínio dos dados.

## Variantes de arquitetura

|| Modelo | Ano | Backbone | Forma latente | Encoder de texto | Params ||
||-------|------|----------|--------------|--------------|--------||
|| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M ||
|| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M ||
|| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2,6B + 6,6B ||
|| SDXL-Turbo | 2023 | Destilado | 128×128×4 | igual | amostragem 1-4 passos ||
|| SD3 | 2024 | MMDiT (DiT multimodal) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B ||
|| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B ||
|| Flux.1-schnell | 2024 | MMDiT destilado | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 passos ||

A tendência: substituir U-Net por DiT (transformer sobre patches latentes), escalar o encoder de texto (T5 supera CLIP na aderência ao prompt), aumentar os canais latentes (4 → 16 dá mais espaço para detalhes).

## Construa

`code/main.py` empilha um "VAE" 1D de brinquedo (encoder identidade + decoder, para demonstração; um VAE real seria uma rede convolucional) sobre o DDPM da Aula 06 e adiciona condicionalização por classe com classifier-free guidance. Mostra que a mesma perda de difusão funciona tanto se você roda em valores 1D brutos quanto em valores codificados — a principal sacada.

### Passo 1: encoder/decoder

```python
def encode(x):    return x * 0.5          # compressão "de brinquedo" para escala menor
def decode(z):    return z * 2.0
```

Um VAE real tem pesos treinados. Para fins pedagógicos, esse mapeamento linear é suficiente para mostrar que a difusão opera em `z` sem se importar com o espaço de dados original.

### Passo 2: difusão no espaço `z`

Mesmo DDPM da Aula 06. Os dados que a rede vê são `z = E(x)`. Após amostrar `z_0`, decodifique com `D(z_0)`.

### Passo 3: classifier-free guidance

Durante o treinamento, descarte o rótulo de classe 10% do tempo (substitua por um token nulo). Em inferência, calcule `ε_cond` e `ε_uncond`, depois:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

`w = 0` = sem guidance (diversidade total), `w = 3` = padrão, `w = 7+` = saturado / excessivamente nítido.

### Passo 4: condicionalização textual (conceito, não código)

Substitua o rótulo de classe pela saída de um encoder de texto congelado. Alimente o embedding de texto no U-Net via cross-attention:

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

Esta é a única diferença substancial entre um modelo de difusão condicional por classe e o Stable Diffusion.

## Armadilhas

- **Incompatibilidade de escala VAE.** Os VAEs do SD 1.x têm uma constante de escala (`scaling_factor ≈ 0,18215`) aplicada após a codificação. Esquecer isso faz o U-Net treinar em latentes com variância absurdamente errada. Todo checkpoint traz um.
- **Encoder de texto silenciosamente errado.** SD3 precisa de T5-XXL com >=128 tokens, e o reserva para apenas CLIP é com perdas. Sempre verifique `use_t5=True` ou a fidelidade do prompt despencará.
- **Misturando espaços latentes.** SDXL, SD3, Flux usam VAEs diferentes. Um LoRA treinado em latentes SDXL não funcionará no SD3. O diffusers 0.30+ do Hugging Face se recusa a carregar checkpoints incompatíveis.
- **CFG alto demais. `w > 10` produz imagens saturadas e oleosas e sobreadapta o prompt em detrimento da diversidade. O ponto ideal é `w = 3-7`.
- **Negative prompts vazios.** Um negative prompt vazio vira o token nulo; um preenchido vira o `ε_uncond`. Não são a mesma coisa; alguns pipelines defaultam silenciosamente para o nulo.

## Use

Pilhas de produção em 2026:

|| Alvo | Backbone recomendado ||
||--------|----------------------||
|| Domínio estreito, dados pareados, treinar modelo do zero | Fine-tune SDXL (LoRA / completo) — mais rápido pra lançar ||
|| Text-to-image aberto, pesos abertos | Flux.1-dev (12B, Apache / não-comercial) ou SD3.5-Large ||
|| Inferência mais rápida, pesos abertos | Flux.1-schnell (1-4 passos, Apache) ou SDXL-Lightning ||
|| Melhor aderência ao prompt, hospedado | GPT-Image / DALL-E 3 (ainda), Midjourney v7, Imagen 4 ||
|| Fluxos de edição | Flux.1-Kontext (Dez 2024) — aceita nativamente imagem + texto ||
|| Pesquisa, baseline | SD 1.5 — antigo mas bem estudado ||

## Entregue

Salve `outputs/skill-sd-prompter.md`. A skill recebe um prompt de texto + estilo alvo e gera: modelo + checkpoint, escala CFG, sampler, negative prompt, resolução, combinação opcional ControlNet/IP-Adapter, e um checklist de QA por passo.

## Exercícios

1. **Fácil.** Execute `code/main.py` com guidance `w ∈ {0, 1, 3, 7, 15}`. Registre a média de amostra por classe. Em qual `w` as médias de classe divergem além das médias dos dados reais?
2. **Médio.** Troque o encoder linear de brinquedo por um par encoder/decoder tanh-MLP com perda de reconstrução. Retreine a difusão nos novos latentes. A qualidade da amostra muda?
3. **Difícil.** Configure uma inferência real do Stable Diffusion com diffusers: carregue `sdxl-base`, rode 30 passos Euler com CFG=7, cronometre. Agora mude para `sdxl-turbo` com 4 passos e CFG=0. Mesmo sujeito, qualidade diferente — descreva o que mudou e por quê.

## Termos Chave

|| Termo | O que as pessoas dizem | O que realmente significa ||
||------|-----------------|-----------------------||
|| Primeiro estágio | "O VAE" | Par encoder/decoder treinado; comprime 512² para 64². ||
|| Segundo estágio | "O U-Net" | Modelo de difusão sobre o espaço latente. ||
|| CFG | "Escala de guidance" | `(1+w)·ε_cond - w·ε_uncond`; ajusta a força da condicionalização. ||
|| Token nulo | "Embedding de prompt vazio" | Embedding incondicional usado para `ε_uncond`. ||
|| Cross-attention | "Como o texto entra" | Cada bloco do U-Net attende aos tokens de texto como K e V. ||
|| DiT | "Diffusion Transformer" | Substitui U-Net por um transformer sobre patches latentes; escala melhor. ||
|| MMDiT | "DiT multimodal" | Arquitetura do SD3: fluxos de texto e imagem com attention conjunta. ||
|| Fator de escala VAE | "Número mágico" | Divide os latentes por ~5,4 para que a difusão opere em espaço de variância unitária. |

## Nota de produção: rodando Flux-12B em uma GPU consumer de 8GB

A integração de referência do Flux é a receita canônica "tenho uma GPU consumer, consigo lançar isso?" O truque é a mesma receita de três botões que a literatura de inferência de produção lista, aplicada a um DiT de difusão:

1. **Carregamento escalonado.** Flux tem três redes que nunca precisam coexistir na VRAM: encoder de texto T5-XXL (~10 GB em fp32), CLIP-L (pequeno), o MMDiT de 12B, e o VAE. Codifique o prompt primeiro, *delete* os encoders, carregue o DiT, denoise, *delete* o DiT, carregue o VAE, decodifique. GPUs consumer de 8GB só comportam um estágio por vez.
2. **Quantização de 4 bits via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)` no encoder T5 e no DiT. Reduz a memória 8×, a queda de qualidade é imperceptível para text-to-image nos benchmarks de Aritra (links no notebook).
3. **Descarga para CPU.** `pipe.enable_model_cpu_offload()` troca automaticamente módulos entre CPU e GPU conforme cada passo direto avança. Adiciona 10-20% de latência mas faz o pipeline rodar.

O cálculo de memória é: `10 GB T5 / 8 = 1,25 GB` quantizado, `12 B params × 0,5 bytes = ~6 GB` DiT quantizado, mais ativações. Nos termos de stas00, isso é o extremo de inferência TP=1 — sem paralelismo de modelo, quantização máxima. Para produção você rodaria TP=2 ou TP=4 em H100s; para um notebook dev, essa é a receita.

## Leituras Complementares

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) — Stable Diffusion.
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) — SDXL.
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) — DiT.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) — SD3, MMDiT.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) — CFG.
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) — família Flux.1.
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) — implementação de referência para cada checkpoint acima.
