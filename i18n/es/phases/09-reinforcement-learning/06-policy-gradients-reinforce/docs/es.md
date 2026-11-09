# Gradiente de política  REINFORCE desde cero

> Dejar de estimar el valor. Parametrizar la política directamente, calcular el gradiente de la rentabilidad esperada, paso hacia arriba. Williams (1992) lo escribió en un teorema. Es por eso que existen PPO, GRPO y cada bucle LLM RL.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 03 (Monte Carlo), Phase 9 · 04 (TD Learning)
**Time:** ~75 minutes

## El problema

El aprendizaje Q y DQN paramétrean la función de *valor*.`argmax Q`Se rompe cuando las acciones son continuas (que son`argmax`¿O cuando se quiere una política estocástica (`argmax`es determinista por construcción).

Los gradientes de política paramétrean la política en su lugar. $\pi_\theta(a \mid s)$Es una red neuronal que produce una distribución sobre acciones.$\theta$- Un paso hacia arriba.`argmax`No hay recursión de Bellman, sólo ascenso de gradiente en$J(\theta) = \mathbb E_{\pi_\theta}[G]$¿ Qué ?

El teorema de la REINFORCE (Williams 1992) dice que este gradiente es computable: $\nabla J(\theta) = \mathbb E_\pi[ G \cdot \nabla_\theta \log \pi_\theta(a \mid s) ]$Ejecutar un episodio, calcular el rendimiento, multiplicar por$\nabla \log \pi_\theta(a \mid s)$En promedio, en escala, terminado.

Cada algoritmo LLM-RL en 2026  PPO, DPO, GRPO  es un refinamiento de REINFORCE.

## El concepto

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**The policy gradient theorem.**Para cualquier política$\pi_\theta$parametrizado por $\theta$¿Qué es esto ?

```math
\nabla J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta}[ \sum_{t=0}^{T} G_t \cdot \nabla_\theta \log \pi_\theta(a_t \mid s_t) ]
```

donde$G_t = \sum_{k=t}^{T} \gamma^{k-t} r_{k+1}$es el retorno descuento de paso $t$La expectativa está sobre las trayectorias completas .$\tau$muestras de $\pi_\theta$¿ Qué ?

**The proof is short.**Diferenciar$J(\theta) = \sum_\tau P(\tau; \theta) G(\tau)$El uso de la información$\nabla P(\tau; \theta) = P(\tau; \theta) \nabla \log P(\tau; \theta)$(el truco de la derivación de registro).$\log P(\tau; \theta) = \sum \log \pi_\theta(a_t \mid s_t) + \text{environment terms that do not depend on } \theta$Los términos de entorno desaparecen. Dos líneas de álgebra te dan el teorema.

**Variance reduction tricks.**Vanilla ReINFORCE tiene una varianza asesina  los retornos son ruidosos, $\nabla \log \pi$es ruidoso, su producto es muy ruidoso. Dos soluciones estándar:

1. **Baseline subtraction.**Reemplazar$G_t$con$G_t - b(s_t)$para cualquier línea de base $b(s_t)$que no depende de $a_t$No es imparcial porque$\mathbb{E}[b(s_t) \cdot \nabla \log \pi(a_t \mid s_t)] = 0$. Escoge típico: $b(s_t) = \hat{V}(s_t)$Aprendió un crítico → actor-crítico (Lesión 07).
2. **Reward-to-go.**Reemplazar$\sum_t G_t \cdot \nabla \log \pi_\theta(a_t \mid s_t)$con$\sum_t G_t^{\text{from } t} \cdot \nabla \log \pi_\theta(a_t \mid s_t)$. Sólo los retornos futuros son importantes para una acción dada  Las recompensas pasadas contribuyen con ruido cero-medio.

Combinado, obtienes:

```math
\nabla J \approx (1/N) \sum_{i=1}^{N} \sum_{t=0}^{T_i} [ G_t^{(i)} - \hat{V}(s_t^{(i)}) ] \cdot \nabla_\theta \log \pi_\theta(a_t^{(i)} \mid s_t^{(i)})
```

que es REINFORCE con un valor de referencia  el antepasado directo de A2C (lección 07) y PPO (lección 08).

**Softmax policy parameterization.**Para las acciones discretas, la opción estándar:

```math
\pi_\theta(a \mid s) = \exp(f_\theta(s, a)) / \sum_{a'} \exp(f_\theta(s, a'))
```

donde$f_\theta$es cualquier red neuronal que emite un puntaje por acción. El gradiente tiene una forma limpia:

```math
\nabla_\theta \log \pi_\theta(a \mid s) = \nabla_\theta f_\theta(s, a) - \sum_{a'} \pi_\theta(a' \mid s) \nabla_\theta f_\theta(s, a')
```

Es decir, el puntaje de la acción tomada menos su valor esperado en el marco de la póliza.

**Gaussian policy for continuous actions.** $\pi_\theta(a \mid s) = N(\mu_\theta(s), \sigma_\theta(s))$- ¿ Qué ?$\nabla \log N(a; \mu, \sigma)$El proyecto de investigación de la Comisión de Agricultura y Desarrollo de la Agricultura, la Agricultura y la Agricultura tiene un formulario cerrado.

```figure
policy-gradient-landscape
```

## Construye el mismo

### Paso 1: red de políticas softmax

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

Utilice una política lineal (un vector de peso por acción) para un entorno tabular. Para Atari, intercambiar en una CNN y mantener la cabeza de softmax.

### Paso 2: muestreo y probabilidad de registro

```python
def sample_action(probs, rng):
    x = rng.random()
    cum = 0
    for a, p in enumerate(probs):
        cum += p
        if x <= cum:
            return a
    return len(probs) - 1

def log_prob(probs, a):
    return log(probs[a] + 1e-12)
```

### Paso 3: despliegue con log-probes capturados

```python
def rollout(theta, env, rng, gamma):
    trajectory = []
    s = env.reset()
    while not done:
        logits = policy_logits(theta, s)
        probs = softmax(logits)
        a = sample_action(probs, rng)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r, probs))
        s = s_next
    return trajectory
```

### Paso 4: actualización de la REINFORCE

```python
def reinforce_step(theta, trajectory, gamma, lr, baseline=0.0):
    returns = compute_returns(trajectory, gamma)
    for (s, a, _, probs), G in zip(trajectory, returns):
        advantage = G - baseline
        grad_log_pi_a = [-p for p in probs]
        grad_log_pi_a[a] += 1.0
        for i in range(N_ACTIONS):
            for j in range(len(s)):
                theta[i][j] += lr * advantage * grad_log_pi_a[i] * s[j]
```

El gradiente $\nabla \log \pi(a \mid s) = e_a - \pi(\cdot \mid s)$(en el caso de $a$- probabilidades) es el corazón de los gradientes de política de softmax.

### Paso 5: líneas de base

Un medio corriente de $G$En los últimos episodios, la reducción de varianza es suficiente para que un GridWorld 4×4 funcione; se necesitan ~ 500 episodios para converger.$\hat{V}(s)$y tienes crítico de actores.

## Las trampas

- **Exploding gradients.**Las devoluciones pueden ser enormes.$G$¿ Qué ?`~N(0, 1)`en el lote antes de multiplicarse por $\nabla \log \pi$¿ Qué ?
- **Entropy collapse.**La política converge a una acción casi determinista demasiado pronto, deja de explorar, se queda atascada.$\beta \cdot H(\pi(\cdot \mid s))$al objetivo.
- **High variance.**Vanilla REINFORCE necesita miles de episodios. Una línea de base crítica (lección 07) o la región de confianza de TRPO/PPO (lección 08) es la solución estándar.
- **Sample inefficiency.**En política significa que se descarta cada transición después de una actualización. Las correcciones fuera de política a través de muestreo de importancia traen datos, a costa de la variación (la proporción de la OPP es un peso de IS recortado).
- **Non-stationary gradients.**El mismo gradiente de hace 100 episodios usa el antiguo .$\pi$Los métodos en política se actualizan cada pocos lanzamientos por esta razón.
- **Credit assignment.**Sin recompensas, las recompensas pasadas contribuyen al ruido.

## Usalo

En 2026, REINFORCE rara vez se ejecuta directamente, pero su fórmula de gradiente está en todas partes:

| Use case | Derived method |
|----------|---------------|
| Continuous control | PPO / SAC with Gaussian policy |
| LLM RLHF | PPO with KL penalty, running on token-level policy |
| LLM reasoning (DeepSeek) | GRPO — REINFORCE with group-relative baseline, no critic |
| Multi-agent | Centralized-critic REINFORCE (MADDPG, COMA) |
| Discrete action robotics | A2C, A3C, PPO |
| Preference-only settings | DPO — REINFORCE rewritten as a preference-likelihood loss, no sampling |

Cuando usted lee`loss = -advantage * log_prob`En un guión de formación de 2026, es decir, REINFORCE con una línea de base.

## Envío

Salvo como`outputs/skill-policy-gradient-trainer.md`¿Qué es esto ?

```markdown
---
name: policy-gradient-trainer
description: Produce a REINFORCE / actor-critic / PPO training config for a given task and diagnose variance issues.
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

Given an environment (discrete / continuous actions, horizon, reward stats), output:

1. Policy head. Softmax (discrete) or Gaussian (continuous) with parameter counts.
2. Baseline. None (vanilla), running mean, learned `V̂(s)`, or A2C critic.
3. Variance controls. Reward-to-go on by default, return normalization, gradient clip value.
4. Entropy bonus. Coefficient β and decay schedule.
5. Batch size. Episodes per update; on-policy data freshness contract.

Refuse REINFORCE-no-baseline on horizons > 500 steps. Refuse continuous-action control with a softmax head. Flag any run with `β = 0` and observed policy entropy < 0.1 as entropy-collapsed.
```

## Los ejercicios

1. **Easy.**Implemente REINFORCE en 4×4 GridWorld con una política de softmax lineal. Entrenar durante 1.000 episodios sin una línea de base. Trazar la curva de aprendizaje; medir la variación (std de rendimientos).
2. **Medium.**Añadir una línea de base de la media de ejecución. Entrenar de nuevo. Comparar la eficiencia de la muestra y la variación con la carrera de vainilla. ¿En qué medida la línea de base reduce los pasos a la convergencia?
3. **Hard.**Añadir una bonificación de entropía $\beta \cdot H(\pi)$- Específico .$\beta \in \lbrace 0, 0.01, 0.1, 1.0 \rbrace$¿Dónde está el punto de interés de esta tarea?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy gradient | "Train the policy directly" | $\nabla J(\theta) = \mathbb{E}[G \cdot \nabla \log \pi_\theta(a \mid s)]$; derived from the log-derivative trick. |
| REINFORCE | "The original PG algorithm" | Williams (1992); Monte Carlo returns multiplied by log-policy gradient. |
| Log-derivative trick | "Score function estimator" | $\nabla P(\tau;\theta) = P(\tau;\theta) \cdot \nabla \log P(\tau;\theta)$; makes gradients of expectations tractable. |
| Baseline | "Variance reduction" | Any $b(s)$ subtracted from $G$; unbiased because $\mathbb{E}[b \cdot \nabla \log \pi] = 0$. |
| Reward-to-go | "Only future returns count" | $G_t^{\text{from } t}$ instead of the full $G_0$; correct and lower-variance. |
| Entropy bonus | "Encourage exploration" | $+\beta \cdot H(\pi(\cdot \mid s))$ term keeps the policy from collapsing. |
| On-policy | "Train on what you just saw" | Gradient expectation is w.r.t. the current policy — cannot reuse old data directly. |
| Advantage | "How much better than average" | $A(s, a) = G(s, a) - V(s)$; the signed quantity REINFORCE-with-baseline multiplies. |

## Leer más

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) el papel original de REINFORCE.
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) el teorema moderno de la política-gradiente con aproximación de funciones.
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) Presentación de libros de texto.
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) Exposición pedagógica clara con código PyTorch.
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) Reducción de la varianza y la visión natural-gradiente que conecta REINFORCE a la familia de la región de confianza (TRPO, PPO).
