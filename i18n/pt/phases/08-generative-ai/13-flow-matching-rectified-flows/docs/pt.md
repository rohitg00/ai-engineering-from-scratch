# Fluxo de correção e fluxos corrigidos

> Os modelos de difusão tomam 20-50 passos de amostragem porque percorrem um caminho curvo do ruído para os dados. A combinação de fluxo (Lipman et al., 2023) e fluxo retificado (Liu et al., 2022) treinaram caminhos retos. Os caminhos mais retos significam menos passos significam inferência mais rápida.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## O problema

O processo inverso do DDPM é um passeio estocástico de 1000 passos de $\mathcal{N}(0, I)$O DDIM desmoronou-o para 20-50 passos deterministas. Você quer menos passos  idealmente um. O bloqueador é que o ODE resolvendo o processo inverso é rígido; o caminho é curvo.

Se pudesse treinar o modelo de tal forma que o caminho do ruído para os dados fosse uma *linha reta*, um único passo de Euler de $t=1$- Não .$t=0$A combinação de fluxos constrói isto diretamente: definir uma interpolação reta a partir de$x_1 \sim \mathcal{N}(0, I)$- Não .$x_0 \sim \text{data}$, treinar um campo vetorial $v_\theta(x, t)$para combinar a sua derivada do tempo, integrar na inferência.

O fluxo retificado (Liu 2022) vai mais longe: endireita iterativamente os caminhos com um procedimento de refluxo que produz um ODE progressivo mais próximo a linear. Após duas iterações de refluxo, um amostragem de 2 passos corresponde à qualidade de DDPM de 50 passos.

## O conceito

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### Fluxo em linha reta

Define:

```math
x_t = t \cdot x_1 + (1 - t) \cdot x_0, \quad t \in [0, 1]
```

onde$x_0 \sim \text{data}$E ...$x_1 \sim \mathcal{N}(0, I)$A derivada temporal ao longo desta reta é constante:

```math
\frac{dx_t}{dt} = x_1 - x_0
```

Defina um campo de vetor neural $v_\theta(x_t, t)$e treinar para combinar com esta derivada:

```math
L = \mathbb{E}_{x_0, x_1, t} \left\lVert v_\theta(x_t, t) - (x_1 - x_0) \right\rVert^2
```

É o que eu faço .**conditional flow matching**O programa de formação é gratuito: nunca se desbloqueia o ODE.$(x_0, x_1, t)$e regressão.

### Amostragem

Na inferência, integra o campo vetorial aprendido * para trás* no tempo:

```math
x_{t-\Delta t} = x_t - \Delta t \cdot v_\theta(x_t, t)
```

Começa em$x_1 \sim \mathcal{N}(0, I)$, Euler-passo para baixo para $t=0$- Não .

### Fluxo rectificado (Liu 2022)

O fluxo em linha reta funciona, mas os caminhos aprendidos não são realmente retos.$x_0$O mapa pode ser o mesmo .$x_1$. Passo de refluxo do fluxo corrigido:

1. Modelo de fluxo de trem $v_1$com acaso emparelhamento.
2. Amostra N pares $(x_1, x_0)$através da integração $v_1$de$x_1$até ao seu pouso .$x_0$- Não .
3. Trem $v_2$Como os pares estão agora "compatíveis com ODE", o interpolante de linha reta entre eles é realmente mais plano.
4. Repito. - Não.

Na prática, 2 iterações de reflow levam você a quase linear, permitindo inferência de 2-4 passos. SDXL-Turbo, SD3-Turbo, LCM são todos modelos destilados de fluxo-matching.

### Por que isto ganhou por imagens em 2024

Três razões:

1. **Simulation-free training** não haverá ODE que se desenrolem durante a formação, sendo trivial a implementar.
2. **Better loss geometry** Os caminhos retos têm um sinal-ruído consistente, enquanto o DDPM ε-loss tem um SNR ruim nas bordas do cronograma.
3. **Faster inference** 4-8 etapas com qualidade SDXL-Turbo; 1 etapa com destilação de consistência.

## Correspondência de fluxo versus DDPM  a conexão exata

A correspondência de fluxo com um caminho condicional de Gauss é difusão *com um cronograma específico de ruído*.$x_t = \alpha(t) x_0 + \sigma(t) x_1$O calendário e o fluxo correspondentes recuperam a difusão reformulada por Stratonovich com $v = \alpha' \cdot x_0 - \sigma' \cdot x_1$Os dois são algébricos equivalentes para os caminhos de Gaussian.

O que o fluxo de correspondência adicionou: a *clarity* do alvo (uma velocidade simples), uma perda mais limpa, e a licença para experimentar com interpolantes não gaussianos.

```figure
normalizing-flow
```

## Construí-lo

`code/main.py`Implementa a correspondência de fluxo 1-D em uma mistura de Gaussian de dois modos.$v_\theta(x, t)$A conclusão é que, ao fazer uma conclusão, integrar 1, 2, 4 e 20 passos de Euler e comparar a qualidade da amostra.

### Passo 1: perda de formação

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### Passo 2: inferência em várias etapas

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### Passo 3: comparação de números de passos

Esperem que o amostragem de 4 passos já corresponda à qualidade de 20 passos, um grande problema para a latência.

## Encurralagens

- **Time parameterization.**Utilizações de correspondência de fluxo $t \in [0, 1]$com$t=0$em dados, $t=1$- a utilização de DDPM$t \in [0, T]$com$t=0$em dados, $t=T$O mesmo rumo, em escala diferente, os papéis estão sempre errados.
- **Schedule choice.**A linha reta do fluxo corrigido é "o" cronograma de correspondência de fluxo, mas você pode usar o cosino ou logit-normal t-sampling (SD3 faz isso) para uma melhor cobertura em escala.
- **Reflow cost.**Gerar o conjunto de dados emparelhados para refluxo é uma passagem completa de inferência por amostra. Só fazer refluxo quando você realmente precisa de inferência de 1-2 passos.
- **Classifier-free guidance still applies.**Apenas troca .$\epsilon$Para$v$na combinação linear: $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$- Não .

## Usá-lo

| Use case | 2026 stack |
|----------|-----------|
| Text-to-image, best quality | Flow matching: SD3, Flux.1-dev |
| Text-to-image, 1-4 steps | Distilled flow matching: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Real-time inference | Consistency distillation from a flow-matched base (LCM, PCM) |
| Audio generation | Flow matching: Stable Audio 2.5, AudioCraft 2 |
| Video generation | Flow matching mixed with diffusion (Sora, Veo, Stable Video) |
| Science / physics (particle trajectories, molecules) | Flow matching + equivariant vector field |

Sempre que um artigo diz "mais rápido do que a difusão" em 2025-2026, é quase sempre o fluxo de correspondência + destilação.

## Envia-o

Salvar`outputs/skill-fm-tuner.md`. A Skill toma uma especificação de modelo de estilo difusão e converte-a em uma configuração de treinamento de correspondência de fluxo: escolha de horário, distribuição de amostragem de tempo (uniforme / logit-normal), optimizador, plano de refluxo, contagem de etapas-alvo, protocolo de avaliação.

## Exercícios

1. **Easy.**Corra .`code/main.py`e comparar a distribuição de dados real com a MSE de 1 passo versus 20 passos.
2. **Medium.**- Desliga-te do uniforme .$t$A amostragem para logit-normal (concentra a amostragem em meados de t).
3. **Hard.**Implementar uma iteração de reflow: gerar emparelhado $(x_0, x_1)$integrando o primeiro modelo, treinar um segundo modelo nos pares e comparar a qualidade da amostra em um passo.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Flow matching | "Straight-line diffusion" | Train $v_\theta(x, t)$ to match $x_1 - x_0$ along an interpolant. |
| Rectified flow | "Reflow" | Iterative procedure that straightens learned flows. |
| Velocity field | "v_θ" | Output of the model — the direction to move $x_t$. |
| Straight-line interpolant | "The path" | $x_t = (1-t) \cdot x_0 + t \cdot x_1$; trivial target derivative. |
| Euler sampler | "1st order ODE solver" | Simplest integrator; works well when paths are straight. |
| Logit-normal t | "SD3 sampling" | Concentrate $t$ sampling toward mid-values where gradients are strongest. |
| Consistency distillation | "1-step sampler" | Train a student to map any $x_t$ directly to $x_0$. |
| CFG with velocity | "v-CFG" | $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$; same trick, new variable. |

## Nota de produção: Flux.1-schnell está a corresponder fluxo em seu mais rápido

A vitória de produção do fluxo de correspondência é Flux.1-schnell  um fluxo-correspondente DiT destilado para 1-4 passos de inferência mantendo a qualidade de grau Flux-dev. O notebook de Niels "Run Flux em uma máquina de 8GB" é a receita de implantação de referência: T5 + código CLIP, denotação quantizada de MMDiT (em 4 passos para rápido vs 50 para dev), decodificação VAE. A contabilidade de custos:

| Variant | Steps | Latency at 1024² on L4 | Total FLOPs (relative) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

Regra de produção: **flow-matched base + distillation = the 2026 default for fast text-to-image.**Todos os principais fornecedores enviam esta combinação: SD3-Turbo (SD3 + fluxo + destilação), Flux-schnell (Flux-dev + rectified-flow straightening), CogView-4-Flash.

## Mais leitura

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) fluxo rectificado.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) correspondência de fluxo.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, fluxo rectificado em escala.
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) quadro geral que abrange a difusão FM+.
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) Destilação em 1 etapa de difusão/ fluxo.
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042)- Variante turbo.
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) correspondência de fluxo na produção.
