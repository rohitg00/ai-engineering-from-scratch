# Autoencodadores e Autoencodadores Variáveis (VAE)

> Um autoencoder simples comprime e reconstrui. Ele memorizou. Não gera. Adicione um truque  forçar o código para parecer Gaussian  e você obtém um amostragem. Esse truque único, a reparameterization de $z = \mu + \sigma \cdot \epsilon$, é por isso que cada modelo de imagem de difusão latente e de correspondência de fluxo que você usa em 2026 tem um VAE na entrada.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## O problema

Compre uma cifra MNIST de 784 pixels para um código de 16 números, e depois reconstruir. Um autoencoder simples irá reconstruir MSE mas o espaço de código é um desastre. Escolha um ponto aleatório no espaço de código, decodifique-o e você obtém ruído. Não tem amostragem. É um modelo de compressão vestido bem.

O que você realmente quer é: (a) o espaço de código é uma distribuição limpa e suave que você pode amostrar a partir de  digamos um Gaussian isotrópico $\mathcal{N}(0, I)$A descrição de um modelo é uma análise de dados que permite a análise de dados e de dados.

O VAE 2013 da Kingma resolve isso treinando o codificador para emitir uma *distribuição* $q(z \mid x) = \mathcal{N}(\mu(x), \sigma(x)^2)$, puxando essa distribuição para o prior$\mathcal{N}(0, I)$através de uma penalidade KL, e depois de amostragem $z$de$q(z \mid x)$Antes de decodificar. Na hora de inferir, solte o codificador, amostra $z \sim \mathcal{N}(0, I)$A penalidade KL é o que obriga o espaço de código a ser estruturado.

Em 2026 os VAEs raramente enviam independentemente  eles foram superados pela difusão pela qualidade de imagem crua  mas são o codificador de escolha para todos os modelos de difusão latente (SD 1/2/XL/3, Flux, AudioCraft).

## O conceito

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**Autoencoder.** $z = \text{encoder}(x)$- Não .$\hat{x} = \text{decoder}(z)$, perda = $\lVert x - \hat{x} \rVert^2$- Espaço de código não estruturado.

**VAE encoder.**As saídas de dois vetores: $\mu(x)$E ...$\log \sigma^2(x)$Estes definem$q(z \mid x) = \mathcal{N}(\mu, \mathop{\mathrm{diag}}(\sigma^2))$- Não .

**Reparameterization trick.**Amostragem de $q(z \mid x)$Não é diferenciável. Reescrever a amostra como $z = \mu + \sigma \cdot \epsilon$onde$\epsilon \sim \mathcal{N}(0, I)$Agora .$z$é uma função determinista de $(\mu, \sigma)$+ um ruído não-parâmetro  gradientes fluem através `μ`E ...$\sigma$- Não .

**Loss.**Evidência Bando inferior (ELBO), dois termos:

```math
\begin{aligned}
\text{loss} &= \text{reconstruction} + \beta \cdot \mathrm{KL}[q(z \mid x) \,\Vert\, \mathcal{N}(0, I)] \\
&= \lVert x - \hat{x} \rVert^2 + \beta \cdot \sum_i \frac{\sigma_i^2 + \mu_i^2 - \log \sigma_i^2 - 1}{2}
\end{aligned}
```

A reconstrução impulsiona .$\hat{x}$- Para o lado .$x$- KL empurra .$q(z \mid x)$- Eles trocam-se.$\beta$($<1$) = amostras mais nítidas, espaço de código menos Gaussian.$\beta$($>1$O β-VAE (Higgins 2017) tornou este botão famoso e iniciou a pesquisa de desembaraçamento.

**Sampling.**Em inferência: desenho $z \sim \mathcal{N}(0, I)$Uma passagem avançada, sem amostragem iterativa como a difusão.

```figure
vae-latent-grid
```

## Construí-lo

`code/main.py`Implementa um pequeno VAE sem numpy ou tocha. A entrada é dados sintéticos 8-dimensionais extraídos de uma mistura gaussiana de 2 componentes em 8-D. Encoder e decodificador são MLPs de camada oculta única. Implementamos ativação tanh, passagem para frente, perda e passagem para trás escrita à mão. Não produção  pedagogia.

### Passo 1: encode para a frente

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

$\log \sigma^2$Em vez de$\sigma$Assim, a saída da rede é livre (softplus de σ é uma armadilha  gradientes morrem em $\sigma \approx 0$)).

### Passo 2: reparametrizar e decodificar

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### Passo 3: ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

Exato KL fechado porque ambas as distribuições são gaussianas. Não se integram numericamente. As pessoas ainda enviam código com as estimativas de monte-carlo KL em 2026  é 3x mais lento sem razão.

### Passo 4: gerar

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

É o modelo generativo.

## Encurralagens

- **Posterior collapse.**- Dispositivos de termo KL$q(z \mid x) \to \mathcal{N}(0, I)$tão agressivamente que$z$Não tem informações sobre $x$- Correcção: β- anulação (iniciada $\beta=0$, rampa para 1), bits livres, ou saltar o KL em dimensões inativas.
- **Blurry samples.**A probabilidade do decodificador gaussiano implica a reconstrução do MSE, que é Bayes-ótima para L2 (a média)  a média de um conjunto de dígitos plausíveis é um dígito confuso.
- **β too large, too early.**Veja o colapso posterior.$\beta \approx 0.01$e a rampa.
- **Latent dim too small.**16-D funciona para MNIST, 256-D para ImageNet 2562, 2048-D para ImageNet 10242. VAE da Stable Diffusion comprime 512×512×3 → 64×64×4 (8x downsample por lado, 64x em área espacial; canais vão de 3 para 4, então cerca de 48x menos valores no geral).

## Usá-lo

A pilha de 2026 VAE:

| Situation | Pick |
|-----------|------|
| Image-latent encoder for diffusion | Stable Diffusion VAE (`sd-vae-ft-ema`) or Flux VAE |
| Audio-latent encoder | Encodec (Meta), SoundStream, or DAC (Descript) |
| Video latents | Sora's spatiotemporal patches, Latte VAE, WAN VAE |
| Disentangled representation learning | β-VAE, FactorVAE, TCVAE |
| Discrete latents (for transformer modelling) | VQ-VAE, RVQ (ResidualVQ) |
| Continuous latents for generation | Plain VAE, then condition a flow/diffusion model in that latent space |

Um modelo de difusão latente é um VAE com um modelo de difusão que vive entre o codificador e o decodificador. O VAE faz compressão grosseira, o modelo de difusão faz o levantamento pesado. O mesmo padrão para vídeo (VAE + video-difusão DiT) e áudio (Encodec + MusicGen transformador).

## Envia-o

Salvar`outputs/skill-vae-trainer.md`- Não .

As competências são: perfil do conjunto de dados + meta de diminuição latente + uso a jusante (reconstrução, amostragem ou entrada de difusão latente) e resultados: escolha de arquitetura (planos/β/VQ/RVQ), programação β, diminuição latente, probabilidade de decodificação (Gaussian vs categorical) e plano de avaliação (recon MSE, KL por dim, distância Fréchet entre $q(z \mid x)$E ...$\mathcal{N}(0, I))$- Não .

## Exercícios

1. **Easy.**Mudança .$\beta$em `code/main.py`- Não .`0.01`- Não .`0.1`- Não .`1.0`- Não .`5.0`- Registram a reconstrução final da MSE e da KL .$\beta$É o Pareto melhor para os seus dados sintéticos?
2. **Medium.**Substitua a probabilidade de descodificação gaussiana por uma probabilidade de Bernoulli (perda de entropia cruzada). Compare a qualidade da amostra em uma versão binária dos mesmos dados sintéticos.
3. **Hard.**Extensão`code/main.py`em um mini VQ-VAE: substituir o contínuo $z$Comparar a reconstrução MSE e relatar quantas entradas de código são utilizadas (o colapso do código é real).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Autoencoder | Encode-decode network | $x \to z \to \hat{x}$, learn MSE. Not generative. |
| VAE | AE with a sampler | Encoder outputs a distribution, KL penalty shapes code space. |
| ELBO | Evidence lower bound | $\log p(x) \ge \text{recon} - \mathrm{KL}[q(z \mid x) \Vert p(z)]$; tight when $q = p(z \mid x)$. |
| Reparameterization | $z = \mu + \sigma \cdot \epsilon$ | Rewrites stochastic node as deterministic + pure noise. Enables backprop through sampling. |
| Prior | $p(z)$ | Target distribution for the latent, typically $\mathcal{N}(0, I)$. |
| Posterior collapse | "KL term wins" | Encoder ignores $x$, outputs the prior; decoder must hallucinate. |
| β-VAE | Tunable KL weight | $\text{loss} = \text{recon} + \beta \cdot \mathrm{KL}$. Higher $\beta$ = more disentangled but blurrier. |
| VQ-VAE | Discrete latent | Replace continuous $z$ with nearest codebook vector; enables transformer modelling. |

## Nota de produção: o VAE é o caminho mais quente em um servidor de difusão

Em um fluxo / fluxo / SD3 de fluxo estável, o VAE é chamado duas vezes por pedido  uma vez para codificar (se fazendo img2img / inpainting) e uma vez para decodificar.`128×128×16`Latentes de volta para `1024×1024×3`Duas consequências práticas:

- **Slice or tile the decode.** `diffusers`expõe`pipe.vae.enable_slicing()`E ...`pipe.vae.enable_tiling()`O Tiling negocia um pequeno artefato de costura para$O(\text{tile}^2)$Memória em vez de $O(H \cdot W)$É essencial para 10242+ em GPUs de consumo.
- **bf16 decoder, fp32 numerics for the final resize.**O SD 1.x VAE foi lançado em fp32 e *produz silenciosamente NaNs* quando lançado para fp16 em 10242+. navios SDXL `madebyollin/sdxl-vae-fp16-fix` sempre prefira a variante fp16-fix ou use bf16.

## Mais leitura

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) o papel do VAE.
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) dissociado β- VAE.
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) VQ-VAE.
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) imagem de última geração VAE.
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) Difusão estável; VAE como codificador.
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) Encodec, o padrão de áudio VAE.
