# GANs  Generador vs Discriminador

> O truque de Goodfellow em 2014 foi ignorar a densidade inteiramente. Duas redes. Uma faz falsas. Uma as apanha. Eles lutam até que as falsas sejam indistinguíveis do real. Não deveria funcionar. Muitas vezes não funciona. Quando acontece, as amostras ainda são as mais nítidas na literatura para domínios estreitos.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## O problema

Os VAEs produzem amostras borrosas porque a perda do decodificador MSE é Bayes-óptima para a imagem * média *  e a média de muitos dígitos plausíveis é um dígito confuso. Você quer uma perda que recompensa * plausibilidade*, não proximidade de pixel para um alvo. Não há forma fechada para plausibilidade. Você tem que aprender.

A ideia do Goodfellow: treinar um classificador.$D(x)$Para distinguir imagens reais de falsas.$G(z)$Para enganar .$D$O sinal de perda para o$G$É o que quer que seja.$D$O sinal atualiza-se como:$G$Se as duas redes convergem,$G$Aprendeu a distribuição de dados sem escrever.`log p(x)`- Não .

Isto é treinamento adversário.

```math
\min_G \max_D \; \mathbb{E}_{\text{real}}[\log D(x)] + \mathbb{E}_{\text{fake}}[\log(1 - D(G(z)))]
```

Em 2026 os GANs não são mais o gerador de SOTA (difusão e fluxo de correspondência cometeu essa coroa). Mas o StyleGAN 2/3 continua sendo os modelos de rosto mais nítidos já enviados, os discriminadores GAN são usados como *perdas perceptivas* no treinamento de difusão, e o treinamento adversário alimenta as destilações rápidas em 1 passo (SDXL-Turbo, SD3-Turbo, LCM) que permitem enviar difusão em tempo real.

## O conceito

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator $G(z)$.**Mapas de um vetor de ruído $z \sim \mathcal{N}(0, I)$para uma amostra $\hat{x}$- Uma rede em forma de decodificador (conventes densos ou transpostos).

**Discriminator $D(x)$.**Mapas de uma amostra para uma probabilidade escalar (ou pontuação).

**Loss.**Duas atualizações alternativas:

- **Train $D$:** $\text{loss}_D = -[ \log D(x) + \log(1 - D(G(z))) ]$Entropia binária cruzada em real=1, falso=0.
- **Train $G$:** $\text{loss}_G = -\log D(G(z))$Esta é a forma * não saturante * usada por Goodfellow (original $\log(1 - D(G(z)))$satura e mata os gradientes quando $D$- Não é um problema.

**Training loop.**Um passo de $D$, um passo de $G$Repito.

**Why it works.**Se$G$- Sim . - Sim .$p_{\text{data}}$, então$D$Não pode fazer melhor do que o acaso e as saídas 0,5 em todos os lugares; $G$Não há mais gradiente.

**Why it breaks.**Colapso de modo ($G$encontra um modo $D$Não podemos classificar e minar para sempre), desvanecendo gradiente ($D$Aprende muito rápido e $\log D$A Comissão propõe que os programas de formação sejam desenvolvidos em todos os Estados-Membros.

## Variantes que fizeram funcionar os GAN

| Year | Innovation | Fix |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv, batch norm, LeakyReLU — the first stable architecture. |
| 2017 | WGAN, WGAN-GP | Replace BCE with Wasserstein distance + gradient penalty. Fixes vanishing gradient. |
| 2017 | Spectral normalization | Lipschitz-bound the discriminator. Still used in 2026 discriminators. |
| 2018 | Progressive GAN | Train low-res first, add layers. First megapixel results. |
| 2019 | StyleGAN / StyleGAN2 | Mapping network + adaptive instance norm. State of the art for fixed-domain photorealism. |
| 2021 | StyleGAN3 | Alias-free, translation-equivariant — still the face gold standard in 2026. |
| 2022 | StyleGAN-XL | Conditional, class-aware, larger scale. |
| 2024 | R3GAN | Rebrands with stronger regularization; works on 1024² without tricks. |

```figure
gan-minimax
```

## Construí-lo

`code/main.py`O gerador e o discriminador são MLPs de camada única oculta. Implementamos o loop avançado, retroativo e mínimox à mão. O objetivo é ver os dois modos de falha chave (collapso de modo + gradiente de desaparecimento) à medida que acontecem.

### Passo 1: perda não saturante

A perda do Vanilla Goodfellow .$\log(1 - D(G(z)))$O gradiente para G é basicamente zero  G não pode melhorar. A forma não saturante $-\log D(G(z))$tem a asintóte oposta: explode quando D está confiante, dando a G um sinal forte.

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### Passo 2: um passo discriminador por passo gerador

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

Falsas frescas para o G, caso contrário, os gradientes são velhos.

### Passo 3: vigilância para o colapso do modo

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

O sintoma canônico: um dos dois modos reais deixa de ser gerado. O discriminador deixa de corrigi-lo porque nunca é visto como falso.

## Encurralagens

- **Discriminator too strong.**Reduzir a taxa de aprendizagem de D em 2-5x, ou adicionar ruído de instância/camada.
- **Generator memorizes a mode.**Adicionar ruído às entradas D, usar uma camada de minibatch-discriminator, ou mudar para WGAN-GP.
- **Batch norm leaking statistics.**Batch real + batch falso fluindo através da mesma camada BN mistura suas estatísticas.
- **Inception-score gaming.**FID e IS são barulhentos em baixas quantidades de amostras.
- **One-shot sampling is a lie for conditional tasks.**Ainda precisas de escalas CFG, truques de truncamento e re-muitas para obter resultados utilizáveis.

## Usá-lo

A pilha de GAN 2026:

| Situation | Pick |
|-----------|------|
| Photoreal human faces, fixed pose | StyleGAN3 (sharpest, smallest) |
| Anime / stylized faces | StyleGAN-XL or Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN (Phase 8 · 04) or ControlNet (Phase 8 · 08) |
| Fast 1-step text-to-image | Adversarial distillation of diffusion (SDXL-Turbo, SD3-Turbo) |
| Perceptual loss inside a diffusion trainer | Small GAN discriminator on image crops |
| Anything multi-modal, open-ended | Don't — use diffusion or flow matching |

O GAN é agudo, mas estreito. Uma vez que o seu domínio abre fotos, instruções de texto arbitrárias, vídeo, comuta para difusão.

## Envia-o

Salvar`outputs/skill-gan-debugger.md`. A Skill toma uma execução GAN falha (curvas de perda, rede de amostragem, tamanho do conjunto de dados) e produz uma lista classificada de causas prováveis, correções de uma linha e um protocolo de reiniciação.

## Exercícios

1. **Easy.**Corra .`code/main.py`com as configurações de ações.`D_LR = 5 * G_LR`A perda do G desmorona-se rapidamente para uma constante.
2. **Medium.**Substituir a perda do Goodfellow BCE pela perda do WGAN: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$- Não .$\text{loss}_G = -\mathbb{E}[D(\text{fake})]$, e clip D pesos para `[-0.01, 0.01]`Comparar a convergência entre o relógio de parede.
3. **Hard.**Extenda o exemplo 1-D para dados 2-D (mistura de 8 Gaussians em um anel).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generator | "G" | Noise-to-sample network, `G: z → x̂`. |
| Discriminator | "D" | Classifier `D: x → [0, 1]`, real vs fake. |
| Minimax | "The game" | $\min_G \max_D$ of a joint objective. |
| Non-saturating loss | "The fix" | Use $-\log D(G(z))$ for G instead of $\log(1 - D(G(z)))$. |
| Mode collapse | "G memorized one thing" | Generator produces few distinct outputs despite diverse data. |
| WGAN | "Wasserstein" | Replace BCE with Earth-Mover distance + gradient penalty; smoother gradient. |
| Spectral norm | "Lipschitz trick" | Constrain D's weight norms to bound its slope; stabilizes training. |
| StyleGAN | "The one that works" | Mapping network + AdaIN; best-in-class for faces, still in 2026. |

## Nota de produção: a inferência de um só tiro é a vantagem duradoura da GAN

Os GANs não ganham mais a qualidade da amostra para a geração de domínio aberto, mas ainda ganham o custo de inferência.

- **No prefill, no decode stages.**Um único .$G(z)$Passagem para a frente. TTFT ≈ latência total.
- **No KV-cache pressure.**O tamanho do lote é limitado pela memória de ativação, não pelo cache.
- **Trivial continuous batching.**Uma vez que cada solicitação recebe os mesmos FLOPs fixos, um lote estático na ocupação alvo do servidor é geralmente ideal.

É por isso que a destilação GAN (SDXL-Turbo, SD3-Turbo, ADD, LCM) é a técnica dominante para a rápida transmissão de texto para imagem em 2026: desintegra um tubo de difusão de 20 a 50 passos em passes avançadas de 1 a 4 GAN ao mesmo tempo que mantém a distribuição de uma base de difusão.

## Mais leitura

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) o papel original do GAN.
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434)A primeira arquitetura estável.
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) WGAN.
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) SN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958)- StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423)- StyleGAN3.
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042)- SDXL-Turbo.
