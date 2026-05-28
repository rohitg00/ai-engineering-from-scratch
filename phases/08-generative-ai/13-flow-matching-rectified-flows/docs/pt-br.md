# Flow Matching e Rectified Flows

> Modelos de difusão precisam de 20-50 passos de amostragem porque caminham por um caminho curvado do ruído para os dados. Flow matching (Lipman et al., 2023) e rectified flow (Liu et al., 2022) treinaram caminhos retos. Caminhos mais retos significam menos passos significam inferência mais rápida. Stable Diffusion 3, Flux.1 e AudioCraft 2 todos mudaram para flow matching em 2024.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 8 · 06 (DDPM), Fase 1 · Cálculo
**Tempo:** ~45 minutos

## O Problema

O processo reverso do DDPM é uma caminhada estocástica de 1000 passos de `N(0, I)` de volta para a distribuição dos dados. O DDIM colapsou para 20-50 passos determinísticos. Você quer menos passos — idealmente um. O obstáculo é que a EDO resolvendo o processo reverso é rígida; o caminho é curvado.

Se você pudesse treinar o modelo tal que o caminho do ruído para os dados fosse uma *linha reta*, um único passo de Euler de `t=1` para `t=0` funcionaria. Flow matching constrói isso diretamente: defina uma interpolação em linha reta de `x_1 ∼ N(0, I)` para `x_0 ∼ dados`, treine um campo vetorial `v_θ(x, t)` para corresponder à sua derivada temporal, integre em inferência.

Rectified flow (Liu 2022) vai além: endireite os caminhos iterativamente com um procedimento de reflow que produz um ODE progressivamente mais próximo do linear. Após duas iterações de reflow, um amostrador de 2 passos corresponde à qualidade de 50 passos do DDPM.

## O Conceito

![Flow matching: interpolação em linha reta entre ruído e dados](../assets/flow-matching.svg)

### Flow em linha reta

Defina:

```
x_t = t · x_1 + (1 - t) · x_0,   t ∈ [0, 1]
```

onde `x_0 ~ dados` e `x_1 ~ N(0, I)`. A derivada temporal ao longo dessa linha reta é constante:

```
dx_t / dt = x_1 - x_0
```

Defina um campo vetorial neural `v_θ(x_t, t)` e treine-o para corresponder a essa derivada:

```
L = E_{x_0, x_1, t} || v_θ(x_t, t) - (x_1 - x_0) ||²
```

Esta é a perda de **flow matching condicional** (Lipman 2023). O treino é sem simulação: você nunca desenrola a EDO. Apenas amostra `(x_0, x_1, t)` e faz regressão.

### Amostragem

Em inferência, integre o campo vetorial aprendido *para trás* no tempo:

```
x_{t-Δt} = x_t - Δt · v_θ(x_t, t)
```

Comece em `x_1 ~ N(0, I)`, dê passos de Euler até `t=0`.

### Rectified flow (Liu 2022)

O flow em linha reta funciona mas os caminhos aprendidos *não são realmente retos* — eles curvam porque muitos `x_0`s podem mapear para o mesmo `x_1`. O passo de reflow do rectified flow:

1. Treine o modelo de fluxo v_1 com pareamentos aleatórios.
2. Amostra N pares `(x_1, x_0)` integrando v_1 de `x_1` até seu `x_0` de chegada.
3. Treine v_2 nesses exemplos pareados. Como os pareados agora são "pareados por ODE", o interpolante em linha reta entre eles é genuinamente mais plano.
4. Repita.

Na prática, 2 iterações de reflow te levam ao quase-linear, habilitando inferência de 2-4 passos. SDXL-Turbo, SD3-Turbo, LCM são todos destilados de flow matching.

### Por que venceu para imagens em 2024

Três razões:

1. **Treino sem simulação** — sem desenrolamento de EDO durante treino, trivial de implementar.
2. **Melhor geometria de perda** — caminhos retos têm sinal-ruído consistente, enquanto a perda ε do DDPM tem SNR ruim nas bordas do agendamento.
3. **Inferência mais rápida** — 4-8 passos com qualidade SDXL-Turbo; 1 passo com destilação por consistência.

## Flow matching vs DDPM — a conexão exata

Flow matching com caminho condicional gaussiano é difusão *com um agendamento de ruído eespecificaçãoífico*. Escolha o agendamento `x_t = α(t) x_0 + σ(t) x_1` e flow matching recupera a difusão reformulada de Stratonovich com `v = α'·x_0 - σ'·x_1`. Os dois são algebricamente equivalentes para caminhos gaussianos.

O que o flow matching adicionou: a *clareza* do alvo (uma velocidade simples), uma perda mais limpa, e a licença para experimentar com interpolantes não gaussianos.

## Construa

`code/main.py` implementa flow matching 1D em uma mistura gaussiana bimodal. O campo vetorial `v_θ(x, t)` é um MLP minúsculo treinado com o alvo em linha reta. Em inferência, integre 1, 2, 4 e 20 passos de Euler e compare a qualidade das amostras.

### Passo 1: perda de treino

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

### Passo 2: inferência multi-passo

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### Passo 3: compare contagens de passos

Espere que o amostrador de 4 passos já corresponda à qualidade de 20 passos — uma grande diferença para latência.

## Armadilhas

- **Parametrização temporal.** Flow matching usa `t ∈ [0, 1]` com `t=0` nos dados, `t=1` no ruído. DDPM usa `t ∈ [0, T]` com `t=0` nos dados, `t=T` no ruído. Mesma direção, escala diferente. Papers erram isso constantemente.
- **Escolha do agendamento.** A linha reta do rectified flow é "o" agendamento de flow matching, mas você pode usar amostragem de `t` cosine ou logit-normal (SD3 faz isso) para melhor cobertura de escala.
- **Custo do reflow.** Gerar o conjunto de dados pareados para reflow é uma passada completa de inferência por amostra. Só faça reflow quando você realmente precisa de inferência de 1-2 passos.
- **Classifier-free guidance ainda se aplica.** Apenas troque ε por v na combinação linear: `v_cfg = (1+w) v_cond - w v_uncond`.

## Use

|| Caso de uso | Stack de 2026 ||
||----------|-----------||
|| Text-to-image, melhor qualidade | Flow matching: SD3, Flux.1-dev ||
|| Text-to-image, 1-4 passos | Flow matching destilado: Flux.1-schnell, SD3-Turbo, SDXL-Turbo ||
|| Inferência em tempo real | Destilação por consistência a partir de base flow-matched (LCM, PCM) ||
|| Geração de áudio | Flow matching: Stable Audio 2.5, AudioCraft 2 ||
|| Geração de vídeo | Flow matching misturado com difusão (Sora, Veo, Stable Video) ||
|| Ciência / física (trajetórias de partículas, moléculas) | Flow matching + campo vetorial equivariante ||

Sempre que um paper diz "mais rápido que difusão" em 2025-2026, quase sempre é flow matching + destilação.

## Entregue

Salve `outputs/skill-fm-tuner.md`. A skill recebe uma eespecificaçãoificação de modelo estilo difusão e a converte em uma configuração de treino de flow matching: escolha de agendamento, distribuição amostral de tempo (uniforme / logit-normal), otimizador, plano de reflow, contagem de passos alvo, protocolo de avaliação.

## Exercícios

1. **Fácil.** Execute `code/main.py` e compare MSE de 1-passo vs 20-passos contra a verdadeira distribuição de dados.
2. **Médio.** Mude da amostragem uniforme de `t` para logit-normal (concentra amostragem no meio do `t`). A qualidade do modelo melhora?
3. **Difícil.** Implemente uma iteração de reflow: gere pares (x_0, x_1) integrando o primeiro modelo, treine um segundo modelo nos pares, e compare a qualidade de amostra de 1-passo.

## Termos Chave

|| Termo | O que as pessoas dizem | O que realmente significa ||
||------|-----------------|-----------------------||
|| Flow matching | "Difusão em linha reta" | Treinar `v_θ(x, t)` para corresponder a `x_1 - x_0` ao longo de um interpolante. ||
|| Rectified flow | "Reflow" | Procedimento iterativo que endireita fluxos aprendidos. ||
|| Campo vetorial | "v_θ" | Saída do modelo — a direção para mover `x_t`. ||
|| Interpolante em linha reta | "O caminho" | `x_t = (1-t)·x_0 + t·x_1`; derivada alvo trivial. ||
|| Amostrador de Euler | "Resolvedor de EDO de 1ª ordem" | Integrador mais simples; funciona bem quando os caminhos são retos. ||
|| Logit-normal t | "Amostragem SD3" | Concentrar amostragem de `t` em valores intermediários onde os gradientes são mais fortes. ||
|| Destilação por consistência | "Amostrador de 1-passo" | Treinar um aluno para mapear qualquer `x_t` diretamente para `x_0`. ||
|| CFG com velocidade | "v-CFG" | `v_cfg = (1+w) v_cond - w v_uncond`; mesmo truque, nova variável. |

## Nota de produção: Flux.1-schnell é flow matching no mais rápido

A vitória em produção do flow matching é o Flux.1-schnell — um DiT flow-matched destilado para 1-4 passos de inferência mantendo qualidade de nível Flux-dev. O notebook "Run Flux on an 8GB machine" do Niels é a receita de implantação de referência: T5 + CLIP codificam, MMDiT quantizado denoisa (em 4 passos para schnell vs 50 para dev), VAE decodifica. Contabilidade de custos:

|| Variante | Passos | Latência em 1024² em L4 | FLOPs totais (relativo) ||
||---------|-------|------------------------|------------------------||
|| Flux.1-dev (raw) | 50 | ~15 s | 1,0× ||
|| Flux.1-schnell | 4 | ~1,2 s | 0,08× (12× mais rápido) ||
|| SDXL-base | 30 | ~4 s | 0,25× ||
|| SDXL-Lightning 2-step | 2 | ~0,3 s | 0,03× ||

A regra de produção: **base flow-matched + destilação = o padrão de 2026 para texto-to-image rápido.** Todo grande fornecedor entrega essa combinação: SD3-Turbo (SD3 + flow + destilação), Flux-schnell (Flux-dev + endireitamento por rectified-flow), CogView-4-Flash. Bases puras de difusão existem apenas para checkpoints legados.

## Leituras Complementares

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) — rectified flow.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) — flow matching.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) — SD3, rectified flow em escala.
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) — framework geral que cobre FM + difusão.
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) — destilação de 1-passo de difusão / flow.
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) — variante turbo.
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) — flow matching em produção.
