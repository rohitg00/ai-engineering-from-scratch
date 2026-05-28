# Modelos de Difusão — DDPM do Zero

> Ho, Jain, Abbeel (2020) deram ao campo uma receita que ele não conseguiu largar. Destroi os dados com ruído em mil pequenos passos. Treine uma rede neural para prever o ruído. Inverta o processo na inferência. Hoje todo modelo de imagem, vídeo, 3D e música roda nesse loop, possivelmente com flow matching ou truques de consistência por cima.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 3 · 02 (Backprop), Fase 8 · 02 (VAE)
**Tempo:** ~75 minutos

## O Problema

Você quer um sampler para `p_data(x)`. GANs jogam um jogo minimax que frequentemente diverge. VAEs produzem amostras borradas de um decoder Gaussiano. O que você realmente quer é um objetivo de treinamento que é (a) uma loss estável sem saddle point, sem minimax, (b) um limite inferior em `log p(x)` (para ter verossimilhanças), e (c) amostras que combinam com qualidade SOTA.

Sohl-Dickstein et al. (2015) tiveram uma resposta teórica: defina uma cadeia de Markov `q(x_t | x_{t-1})` que adiciona ruído Gaussiano gradualmente, e treine uma cadeia reversa `p_θ(x_{t-1} | x_t)` para denoising. Ho, Jain, Abbeel (2020) mostraram que a loss poderia ser simplificada para uma linha — prever o ruído — e limparam a matemática. Em 2020 isso era uma curiosidade. Em 2021 produziu amostras SOTA. Em 2022 se tornou Stable Diffusion. Em 2026 é o substrato.

## O Conceito

![DDPM: ruído forward, denoising reverso](../assets/ddpm.svg)

**Processo forward `q`.** Adiciona ruído Gaussiano em `T` pequenos passos. A forma fechada — a razão pela qual a matemática é tratável — é que o passo cumulativo também é Gaussiano:

```
q(x_t | x_0) = N( sqrt(α̅_t) · x_0,  (1 - α̅_t) · I )
```

onde `α̅_t = ∏_{s=1..t} (1 - β_s)` para um agendamento de `β_t`. Escolha `β_t` de 1e-4 a 0.02 linearmente ao longo de T=1000 passos e `x_T` é aproximadamente `N(0, I)`.

**Processo reverso `p_θ`.** Aprende uma rede `ε_θ(x_t, t)` que prevê o ruído que foi adicionado. Dado `x_t`, denoisa:

```
x_{t-1} = (1 / sqrt(α_t)) · ( x_t - (β_t / sqrt(1 - α̅_t)) · ε_θ(x_t, t) )  +  σ_t · z
```

onde `σ_t` é `sqrt(β_t)` ou uma variância aprendida. A expressão é feia mas é só álgebra — resolvendo `x_{t-1}` dado o posterior `q(x_{t-1} | x_t, x_0)` e substituindo `x_0` por sua estimativa predita de ruído.

**Loss de treinamento.**

```
L_simple = E_{x_0, t, ε} [ || ε - ε_θ( sqrt(α̅_t) · x_0 + sqrt(1 - α̅_t) · ε,  t ) ||² ]
```

Amostra `x_0` dos dados, escolhe um `t` aleatório, amostra `ε ~ N(0, I)`, calcula o `x_t` ruidoso de uma vez via forma fechada, e regredita no ruído. Uma loss, sem minimax, sem KL, sem truques de reparametrização.

**Amostragem.** Começa `x_T ~ N(0, I)`. Itera o passo reverso de `t = T` até `1`. Pronto.

## Por que funciona

Três intuições:

1. **Denoising é fácil; gerar é difícil.** Em `t=T`, os dados são puro ruído — a rede resolve um problema trivial. Em `t=0`, a rede só precisa limpar uns poucos pixels. Em `t` intermediário, o problema é difícil mas a rede tem muitos gradientes fluindo pelos mesmos pesos de cada nível de ruído.

2. **Score matching disfarçado.** Vincent (2011) provou que prever o ruído é equivalente a estimar `∇_x log q(x_t | x_0)`, o *score*. A EDE reversa usa esse score para subir o gradiente da densidade — uma caminhada aleatória guiada em direção a regiões de alta probabilidade.

3. **O ELBO se reduz a MSE simples.** O limite inferior variacional completo tem um termo KL por timestep. Com a parametrização do DDPM, esses termos KL se simplificam em MSE na previsão de ruído com coeficientes eespecificaçãoíficos; Ho eliminou os coeficientes (chamando de loss "simples") e a qualidade *melhorou*.

## Construa

`code/main.py` implementa um DDPM 1-D. Dados são uma mistura de dois modos. A "rede" é um MLP minúsculo que recebe `(x_t, t)` e sai ruído predito. Treinamento é a loss de uma linha. Amostragem itera a cadeia reversa.

### Passo 1: agendamento forward (forma fechada)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### Passo 2: amostra `x_t` de uma vez

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### Passo 3: um passo de treinamento

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### Passo 4: amostragem reversa

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

Para um problema 1-D com 40 timesteps e um MLP de 24 unidades, isso aprende a mistura de dois modos em ~200 épocas.

## Condicionamento temporal

A rede precisa saber qual timestep está denoising. Duas opções padrão:

- **Embedding sinusoidal.** Como codificação posicional de Transformer. `embed(t) = [sin(t/ω_0), cos(t/ω_0), sin(t/ω_1), ...]`. Passa por um MLP, propaga para a rede.
- **Condicionamento FiLM / group-norm.** Projeta embedding para scale/bias por canal (FiLM) em cada bloco.

Nosso código de brinquedo usa sinusoidal → concat. U-Nets de produção usam FiLM.

## Armadilhas

- **Agendamento importa muito.** `β` linear é o padrão DDPM mas agendamento cosseno (Nichol & Dhariwal, 2021) dá melhor FID para o mesmo compute. Mude de agendamento se a qualidade estagnar.
- **Embedding de timestep é frágil.** Passar `t` cru como float funciona para 1-D brinquedo mas falha para imagens; sempre use um embedding adequado.
- **V-prediction vs ε-prediction.** Para regimes estreitos (t muito pequeno ou muito grande), `ε` tem relação sinal-ruído ruim. V-prediction (`v = α·ε - σ·x`) é mais estável; SDXL, SD3 e Flux usam isso.
- **Guidance sem classificador.** Na inferência, calcula tanto `ε` condicional quanto incondicional, depois `ε_cfg = (1 + w) · ε_cond - w · ε_uncond` com `w ≈ 3-7`. Coberto na Lição 08.
- **1000 passos é muito.** Produção usa DDIM (20-50 passos), DPM-Solver (10-20 passos) ou destilação (1-4 passos). Ver Lição 12.

## Use

| Função | Stack típica em 2026 |
|------|-----------------------|
| Difusão no espaço de pixels de imagem (pequeno, brinquedo) | DDPM + U-Net |
| Difusão latente de imagem | Encoder VAE + U-Net ou DiT (Lição 07) |
| Difusão latente de vídeo | DiT espaciotemporal (Sora, Veo, WAN) |
| Difusão latente de áudio | Encodec + transformer de difusão |
| Ciência (moléculas, proteínas, física) | Difusão equivariante (EDM, RFdiffusion, AlphaFold3) |

Difusão é a espinha dorsal generativa universal. Flow matching (Lição 13) é o competidor de 2024-2026 que geralmente vence em velocidade de inferência para a mesma qualidade.

## Entregue

Salve `outputs/skill-diffusion-trainer.md`. Skill recebe um dataset + orçamento de compute e gera: agendamento (linear/cosseno/sigmoid), alvo de previsão (ε/v/x), número de passos, escala de guidance, família de sampler e protocolo de avaliação.

## Exercícios

1. **Fácil.** Mude T de 40 para 10 em `code/main.py`. Como a qualidade das amostras (histograma visual das saídas) degrada? Em qual T a estrutura de dois modos colapsa?
2. **Médio.** Mude de ε-prediction para v-prediction. Derive novamente o passo reverso. Compare qualidade final das amostras.
3. **Difícil.** Adicione guidance sem classificador. Condiciona em um label de classe `c ∈ {0, 1}`, descarta 10% do tempo durante treinamento, e no momento da amostragem usa `ε = (1+w)·ε_cond - w·ε_uncond`. Meça a taxa de acerto do modo condicional em `w = 0, 1, 3, 7`.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|-----------------|-----------------------|
| Processo forward | "Adicionando ruído" | Cadeia de Markov fixa `q(x_t \\| x_{t-1})` que destrói os dados. |
| Processo reverso | "Denoising" | Cadeia aprendida `p_θ(x_{t-1} \\| x_t)` que reconstrói os dados. |
| Agendamento β | "A escada de ruído" | Variância por passo; linear, cosseno ou sigmoid. |
| α̅ | "Alpha bar" | Produto cumulativo `∏(1 - β)`; dá `x_t` em forma fechada a partir de `x_0`. |
| Loss simples | "MSE no ruído" | `\\|\\|ε - ε_θ(x_t, t)\\|\\|²`; todas as derivações variacionais colapsam nisso. |
| ε-prediction | "Prever ruído" | Saída é o ruído adicionado; DDPM padrão. |
| V-prediction | "Prever velocidade" | Saída é `α·ε - σ·x`; melhor condicionamento entre t. |
| DDPM | "O paper" | Ho et al. 2020; β linear, 1000 passos, U-Net. |
| DDIM | "Sampler determinístico" | Sampler não Markoviano, 20-50 passos, mesmo objetivo de treinamento. |
| Guidance sem classificador | "CFG" | Mistura previsões de ruído condicional e incondicional para amplificar condicionamento. |

## Nota de produção: inferência de difusão é um problema de contagem de passos

O paper DDPM roda T=1000 passos reversos. Ninguém distribui isso em produção. Toda stack de inferência real escolhe uma de três estratégias — e cada uma mapeia limposamente para o enquadramento de produção de "de onde vem a latência":

1. **Sampler mais rápido, mesmo modelo.** DDIM (20-50 passos), DPM-Solver++ (10-20), UniPC (8-16). Substituição direta do loop reverso; os pesos `ε_θ` treinados não são tocados. Reduz latência 20-50×.
2. **Destilação.** Treina um estudante para combinar o professor em menos passos: Progressive Distillation (2 → 1), Consistency Models (arbitrário → 1-4), LCM, SDXL-Turbo, SD3-Turbo. Reduz latência mais 5-10×, requer retreinamento.
3. **Cache e compilação.** `torch.compile(unet, mode="reduce-overhead")`, backends de difusão do TensorRT-LLM, attention `xformers`/SDPA, pesos bf16. Reduz latência por passo ~2×. Empilha com (1) e (2).

Para um servidor de difusão em produção a conversa de orçamento é a mesma que a literatura descreve para LLMs: latência é `num_steps × step_cost + VAE_decode`, throughput é `batch_size × (num_steps × step_cost)^-1`. TTFT é pequeno (um passo); equivalente a TPOT é o tempo total de resposta porque geração de imagem é "tudo de uma vez" na perespecificaçãotiva do usuário.

## Leitura Adicional

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) — o paper de difusão, à frente do seu tempo.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) — DDPM.
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) — DDIM, menos passos.
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672) — agendamento cosseno, variância aprendida.
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) — guidance com classificador.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) — CFG.
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) — notação unificada, receita mais limpa.
