# Modelos de difusão  DDPM a partir do zero

> Ho, Jain, Abbeel (2020) deu ao campo uma receita que não podia parar. Destruir os dados com ruído em mil pequenos passos. Treinar uma rede neural para prever o ruído. Reverte o processo à inferência. Hoje todo modelo de imagem, vídeo, 3D e música da corrente dominante funciona neste loop, possivelmente com a combinação de fluxo ou truques de consistência no topo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## O problema

Queres uma amostra para ?$p_{\text{data}}(x)$O que realmente se quer é um objetivo de treinamento que seja (a) uma única perda estável (sem ponto de sela, sem minimax), (b) um limite inferior em $\log p(x)$(de modo que tenha probabilidades), e (c) amostras que correspondam à qualidade do SOTA.

Sohl-Dickstein et al. (2015) teve uma resposta teórica: definir uma cadeia de Markov $q(x_t \mid x_{t-1})$que gradualmente adiciona ruído gaussiano, e treinar uma cadeia inversa$p_\theta(x_{t-1} \mid x_t)$Ho, Jain, Abbeel (2020) mostrou que a perda pode ser simplificada para uma linha  prever o ruído  e limpar a matemática. Em 2020 isso foi uma curiosidade. Em 2021 produziu amostras de última geração. Em 2022 tornou-se Diffusão estável. Em 2026 é o substrato.

## O conceito

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**Forward process $q$.**Adicionar ruído Gaussiano .$T$A forma fechada  a razão pela qual a matemática é tratável  é que o passo acumulativo é também gaussiano:

```math
q(x_t \mid x_0) = \mathcal{N}\left( \sqrt{\bar{\alpha}_t} \cdot x_0, (1 - \bar{\alpha}_t) \cdot I \right)
```

onde$\bar\alpha_t = \prod_{s=1}^{t} (1 - \beta_s)$para um calendário de $\beta_t$- Escolha .$\beta_t$de 1e-4 a 0,02 linearmente $T=1000$Passo e $x_T$é aproximadamente $\mathcal{N}(0, I)$- Não .

**Reverse process $p_\theta$.**Aprenda uma rede neural .$\epsilon_\theta(x_t, t)$que prevê o ruído que foi adicionado.$x_t$, denotado por:

```math
x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \cdot \left( x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}} \cdot \epsilon_\theta(x_t, t) \right) + \sigma_t \cdot z
```

onde$\sigma_t$É um dos dois .$\sqrt{\beta_t}$A expressão é feia, mas é apenas álgebra.$x_{t-1}$dada a posterior $q(x_{t-1} \mid x_t, x_0)$e substituindo$x_0$com a sua estimativa prévia de ruído.

**Training loss.**

```math
L_{\text{simple}} = \mathbb{E}_{x_0, t, \epsilon} \left[ \left\lVert \epsilon - \epsilon_\theta\left( \sqrt{\bar{\alpha}_t} \cdot x_0 + \sqrt{1 - \bar{\alpha}_t} \cdot \epsilon, t \right) \right\rVert^2 \right]
```

Amostra $x_0$De dados, escolha um aleatório$t$, amostra $\epsilon \sim \mathcal{N}(0, I)$, calcular o barulho .$x_t$Uma perda, sem minimos, sem KL, sem truques de reparametrização.

**Sampling.**Começa .$x_T \sim \mathcal{N}(0, I)$Repita o passo inverso de$t = T$- Já está.

## Por que funciona

Três intuições:

1. **Denoising is easy; generating is hard.**- Não .$t=T$A rede tem de resolver um problema trivial.$t=0$A rede só tem de limpar alguns pixels.$t$O problema é difícil, mas a rede tem muitos gradientes fluindo através dos mesmos pesos de todos os níveis de ruído.

2. **Score matching in disguise.**Vincent (2011) provou que prever o ruído é equivalente a estimar $\nabla_x \log q(x_t \mid x_0)$O SDE inverso usa esta pontuação para subir o gradiente de densidade  um caminho aleatório guiado em direção a regiões de alta probabilidade.

3. **The ELBO reduces to simple MSE.**O limite inferior variável completo tem um termo KL por etapa de tempo. Com a parâmetrizagem do DDPM, esses termos KL simplificam para MSE na previsão de ruído com coeficientes específicos; Ho caiu os coeficientes (chamando-o de perda "simples") e a qualidade *melhorou*.

```figure
diffusion-denoise
```

## Construí-lo

`code/main.py`O "net" é um pequeno MLP que leva$(x_t, t)$O treinamento é a perda de uma linha.

### Passo 1: calendário de execução (formulario fechado)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### Passo 2: amostra `x_t`em uma só vez

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### Passo 3: um passo de formação

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### Passo 4: amostragem inversa

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

Para um problema 1-D com 40 passos de tempo e um MLP de 24 unidades, este aprende a mistura de dois modos em ~ 200 épocas.

## Condicionamento de tempo

A rede precisa saber qual é o passo a seguir.

- **Sinusoidal embedding.**Como codificação posicional do Transformer.$\text{embed}(t) = [\sin(t/\omega_0), \cos(t/\omega_0), \sin(t/\omega_1), \ldots]$Passa por um MLP, transmite-se à rede.
- **Film / group-norm conditioning.**Projecto de inserção em escala/bias por canal (FiLM) em cada bloco.

Nosso código de brinquedo usa sinusoidal → concat.

## Encurralagens

- **Schedule matters a lot.**Linear $\beta$O programa de cálculo é o DDPM padrão, mas o cronograma cosínico (Nichol & Dhariwal, 2021) dá uma melhor FID para a mesma computação.
- **Timestep embedding is fragile.**Passando cru$t$como um float funciona para brinquedo 1-D mas falha para imagens; sempre use um incorporado adequado.
- **V-prediction vs ε-prediction.**Para regimes estreitos (t muito pequenos ou muito grandes), $\epsilon$- a previsão de V ($v = \alpha \cdot \epsilon - \sigma \cdot x$) é mais estável; SDXL, SD3 e Flux utilizam-na.
- **Classifier-free guidance.**Na inferência, calcular as condições e as incondições.$\epsilon$, então$\epsilon_{\text{cfg}} = (1 + w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$com$w \approx 3\text{-}7$- Coberto na lição 8.
- **1000 steps is a lot.**A produção utiliza DDIM (20-50 passos), DPM-Solver (10-20 passos) ou destilação (1-4 passos).

## Usá-lo

| Role | Typical stack in 2026 |
|------|-----------------------|
| Image pixel-space diffusion (small, toy) | DDPM + U-Net |
| Image latent diffusion | VAE encoder + U-Net or DiT (Lesson 07) |
| Video latent diffusion | Spatiotemporal DiT (Sora, Veo, WAN) |
| Audio latent diffusion | Encodec + diffusion transformer |
| Science (molecules, proteins, physics) | Equivariant diffusion (EDM, RFdiffusion, AlphaFold3) |

A difusão é a espinha dorsal generativa universal. A combinação de fluxos (Lessão 13) é o concorrente 2024-2026, que geralmente ganha na velocidade de inferência pela mesma qualidade.

## Envia-o

Salvar`outputs/skill-diffusion-trainer.md`. A competência assume um conjunto de dados + orçamento e resultados de cálculo: cronograma (linear/cosino/sigmoide), meta de previsão (ε/v/x), número de etapas, escala de orientação, família de amostragens e um protocolo de avaliação.

## Exercícios

1. **Easy.**Mudança de T de 40 para 10 em `code/main.py`Como a qualidade da amostra (histograma visual das saídas) se degrada?
2. **Medium.**Passe da previsão ε para a previsão v. Retrai a passagem inversa. Comparar a qualidade final da amostra.
3. **Hard.**Adicionar orientação sem classificador. Condição em um rótulo de classe $c \in \lbrace 0, 1 \rbrace$, diminuir 10% do tempo durante o treinamento e no tempo de amostragem de uso $\epsilon = (1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$. Medir a taxa de acidentes no modo condicional em $w = 0, 1, 3, 7$- Não .

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Forward process | "Adding noise" | Fixed Markov chain $q(x_t \mid x_{t-1})$ that destroys the data. |
| Reverse process | "Denoising" | Learned chain $p_\theta(x_{t-1} \mid x_t)$ that reconstructs the data. |
| β schedule | "The noise ladder" | Per-step variance; linear, cosine, or sigmoid. |
| α̅ | "Alpha bar" | Cumulative product $\prod (1 - \beta)$; gives closed-form $x_t$ from $x_0$. |
| Simple loss | "MSE on noise" | $\lVert \epsilon - \epsilon_\theta(x_t, t) \rVert^2$; all variational derivations collapse to this. |
| ε-prediction | "Predict noise" | Output is the noise added; standard DDPM. |
| V-prediction | "Predict velocity" | Output is $\alpha \cdot \epsilon - \sigma \cdot x$; better conditioning across t. |
| DDPM | "The paper" | Ho et al. 2020; linear β, 1000 steps, U-Net. |
| DDIM | "Deterministic sampler" | Non-Markov sampler, 20-50 steps, same training objective. |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional noise predictions to amplify conditioning. |

## Nota de produção: a inferência de difusão é um problema de contagem de etapas

O documento DDPM executar T=1000 passos reversa. Ninguém envia isso na produção. Cada pilha de inferência real escolhe uma das três estratégias  e cada mapa limpo para enquadramento de produção de "de onde vem a latência":

1. **Faster sampler, same model.**DDIM (20-50 passos), DPM-Solver++ (10-20), UniPC (8-16). Substituição de drop-in do loop inverso; o treinado $\epsilon_\theta$Os pesos são intocados, reduz a latência 20 a 50 vezes.
2. **Distillation.**Treinar um aluno para se adequar ao professor em menos passos: Distilação Progressiva (2 → 1), Modelos de Consistência (arbitrário → 1-4), LCM, SDXL-Turbo, SD3-Turbo. Cortar a latência mais 5-10x, requer reformulação.
3. **Caching and compilation.** `torch.compile(unet, mode="reduce-overhead")`, os retrospectivos de difusão do TensorRT-LLM,`xformers`/SDPA atenção, bf16 pesos. Cortes por etapa latência ~ 2×.

Para um servidor de difusão de produção, a conversação orçamental é a mesma que a literatura de produção descreve para os LLM: a latência é `num_steps × step_cost + VAE_decode`, o volume é `batch_size × (num_steps × step_cost)^-1`. O TTFT é pequeno (um passo); o TPOT é equivalente ao tempo de resposta total porque a geração de imagens é "todo ao mesmo tempo" da perspectiva do utilizador.

## Mais leitura

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) o papel de difusão, antes do seu tempo.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) DDPM.
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502)- DDIM, menos passos.
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672)- Calendário cosínico, variação aprendida.
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) Orientações para o classificador.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598)- CFG.
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364)- Notação unificada, receita mais limpa.
