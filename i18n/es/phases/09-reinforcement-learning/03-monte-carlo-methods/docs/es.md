# Métodos de Monte Carlo  Aprender de episodios completos

> La programación dinámica necesita un modelo. Monte Carlo sólo necesita episodios. ejecuta la política, observa los rendimientos, promedio. La idea más simple en RL  y la que desbloquea todo aguas abajo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## El problema

La programación dinámica es elegante, pero asume que puedes hacer consultas.$P(s' \mid s, a)$En el mundo real casi nada funciona de esa manera. Un robot no puede calcular analíticamente la distribución de los píxeles de la cámara después de un par común. Un algoritmo de precios no puede integrarse sobre cada reacción posible del cliente.

Necesitas un método que sólo necesite la capacidad de tomar muestras del medio ambiente. ejecutar la política. obtener una trayectoria`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`Usalo para estimar los valores.

El cambio de DP a MC es filosóficamente importante: pasamos de *modelo conocido + copia de seguridad exacta* a *desarrollo de muestras + retorno promedio*. La varianza salta, pero la aplicabilidad explota. Cada algoritmo RL después de esta lección  TD, Q-learning, REINFORCE, PPO, GRPO  es un estimador de Monte Carlo en el corazón, a veces con arranque en capas arriba.

## El concepto

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**The core idea, in one line:** $V^\pi(s) = \mathbb E_\pi[G_t \mid s_t = s] \approx (1/N) \sum_i G^{(i)}(s)$donde$G^{(i)}(s)$se observan resultados tras las visitas a $s$en el marco de la política $\pi$¿ Qué ?

**First-visit vs every-visit MC.**Dado un episodio que visita el estado $s$En el caso de los MC de primera visita, el MC de primera visita cuenta sólo el retorno de la primera visita; cada visita MC cuenta todas las visitas. El MC de primera visita es imparcial. Cada visita MC puede ser ligeramente parcial después de un número finito de episodios, porque promedia un número aleatorio de retornos por episodio y ese número puede correlacionar con los retornos, pero ambos convergen a $V^\pi(s)$La primera visita es más sencilla de analizar (muestras de ID). cada visita utiliza más datos por episodio y suele converger más rápido en la práctica.

**Incremental mean.**En lugar de almacenar todos los resultados, actualice el promedio de ejecución:

```math
V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]
```

Reorganizar: $V_{\text{new}} = V_{\text{old}} + \alpha \cdot (\text{target} - V_{\text{old}})$con$\alpha = 1/n$- Cambiar .$1/n$para un tamaño de paso constante $\alpha \in (0, 1)$y obtienes un estimador de MC no estacionario que rastrea los cambios en$\pi$Ese movimiento es el salto completo de MC a TD a todos los algoritmos modernos de RL.

**Exploration is now a problem.**DP tocó a todos los estados por el recuento. MC sólo ve los estados las visitas de política.$\pi$Es determinista, regiones enteras del espacio del estado nunca se muestran, y sus estimaciones de valor permanecen en cero para siempre.

1. **Exploring starts.**Comience cada episodio desde un par aleatorio (s, a). Garantiza la cobertura; poco realista en la práctica (no se puede "resetar" un robot a un estado arbitrario).
2. **ε-greedy.**Actúa codicioso en el actual Q, pero con probabilidad.$\epsilon$Todos los pares de estados de acción se muestran de manera asimptotica.
3. **Off-policy MC.**Recoger datos bajo una política de comportamiento $\mu$, aprender sobre la política de objetivo $\pi$La varianza es alta, pero es el puente a los métodos de repetición como DQN.

**Monte Carlo Control.**Evaluar → mejorar → evaluar, al igual que la iteración de políticas, pero la evaluación se basa en muestras:

1. - ¿ Qué ?$\pi$, conseguir un episodio.
2. Actualización $Q(s, a)$de los resultados observados.
3. ¿ Qué haces ?$\pi$¡ ¡ ¡ ¡ ¡ ¡ ¡ El hombre codicioso !$Q$¿ Qué ?
4. Repito, ¿qué quieres?

Converge a $Q^{\ast}$y $\pi^{\ast}$con probabilidad 1 en condiciones suaves (cada par visitado con infinidad de frecuencia, $\alpha$satisface a Robbins-Monro).

```figure
epsilon-greedy
```

## Construye el mismo

### Paso 1: despliegue → lista de (s, a, r)

```python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
```

No hay modelo, sólo `env.reset()`y `env.step(s, a)`La misma interfaz que un entorno de gimnasio pero despojado.

### Paso 2: Regresos de cálculo (varrilamiento inverso)

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

Un pase,$O(T)$La recurrencia hacia atrás .$G_t = r_{t+1} + \gamma G_{t+1}$evita la re-suma.

### Paso 3: Evaluación de la primera visita de MC

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
```

Tres líneas hacen el trabajo: marcar el estado visto en la primera visita, el recuento de incrementos, la media de actualización en ejecución.

### Paso 4: control de MC codicioso (en política)

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
```

### Paso 5: comparación con el estándar de oro DP

Su estimativa de MC de $V^\pi$En la práctica: 50.000 episodios en 4×4 GridWorld te lleva dentro de `~0.1`de la respuesta del DP.

## Las trampas

- **Infinite episodes.**MC requiere que los episodios se terminen. Si su política puede circular para siempre, cap.`max_steps`GridWorld con una política aleatoria rotineamente veces fuera  que es normal, sólo asegúrese de contarlo correctamente.
- **Variance.**MC utiliza devoluciones completas. En episodios largos, la variación es enorme  una recompensa desafortunada en los turnos finales $V(s_0)$El método TD (lección 04) reduce esto mediante bootstrapping.
- **State coverage.**El MC codicioso en un Q fresco con corbatas sólo intentará una acción.
- **Non-stationary policies.**Si ...$\pi$En el caso de los controles de MC, los resultados anteriores son de una política diferente.
- **Off-policy importance sampling.**Los pesos .$\pi(a \mid s)/\mu(a \mid s)$La variación explotará con el horizonte, el límite con la IS ponderada por decisión o el cambio a TD.

## Usalo

El papel de los métodos de Monte Carlo para 2026:

| Use case | Why MC |
|----------|--------|
| Short-horizon games (blackjack, poker) | Episodes terminate naturally; returns are clean. |
| Offline evaluation of a logged policy | Average discounted returns over stored trajectories. |
| Monte Carlo Tree Search (AlphaZero) | MC rollouts from tree leaves guide selection. |
| LLM RL evaluation | Compute average reward over sampled completions for a given policy. |
| Baseline estimation in PPO | The advantage target $A_t = G_t - V(s_t)$ uses an MC $G_t$. |
| Teaching RL | Simplest algorithm that actually works — strip bootstrapping to see the core. |

Los algoritmos modernos de RL profundo (PPO, SAC) interpolan entre MC puro (retorno completo) y TD puro (bootstrap de un paso) a través de $n$Los dos puntos finales son ejemplos del mismo estimador.

## Envío

Salvo como`outputs/skill-mc-evaluator.md`¿Qué es esto ?

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## Los ejercicios

1. **Easy.**Implemente la evaluación de la primera visita de MC de la política uniforme al azar en 4×4 GridWorld. ejecuta 10.000 episodios.$V(0,0)$como función del recuento de episodios frente a la respuesta de DP.
2. **Medium.**Implementar el control de MC con $\epsilon \in \lbrace 0.01, 0.1, 0.3 \rbrace$Comparar el retorno medio después de 20.000 episodios. ¿Cómo es la curva? ¿Dónde vive el compromiso de variación de sesgo?
3. **Hard.**Implementar *extrapolíticas* MC con muestreo de importancia: recoger datos en el marco de una política uniforme aleatoria $\mu$, estimación $V^\pi$para la política óptima determinista $\pi$Comparar el IS puro vs. por decisión IS vs. IS ponderado. ¿Cuál tiene la menor variación?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Monte Carlo | "Random sampling" | Estimate expectations by averaging over iid samples from the distribution. |
| Return $G_t$ | "Future reward" | Sum of discounted rewards from step $t$ to episode end: $\sum_{k\ge 0} \gamma^k r_{t+k+1}$. |
| First-visit MC | "Count each state once" | Only the first visit in an episode contributes to the value estimate. |
| Every-visit MC | "Use all visits" | Every visit contributes; slightly biased for finite samples, consistent in the limit, and more sample-efficient. |
| ε-greedy | "Exploration noise" | Pick greedy action with prob $1-\epsilon$; random action with prob $\epsilon$. |
| Importance sampling | "Correcting for sampling from the wrong distribution" | Reweight returns by $\pi(a \mid s)/\mu(a \mid s)$ products to estimate $V^\pi$ from $\mu$ data. |
| On-policy | "Learn from my own data" | Target policy = behavior policy. Vanilla MC, PPO, SARSA. |
| Off-policy | "Learn from someone else's data" | Target policy ≠ behavior policy. Importance-sampled MC, Q-learning, DQN. |

## Leer más

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) el tratamiento canónico.
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) Análisis de primera visita frente a cada visita.
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) control de las variaciones y de las MC fuera de las políticas.
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) Estimadores modernos de IS de baja variación.
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) la primera demostración empírica a gran escala de la auto-juego MC/TD convergiendo al juego sobrehumano; precursor conceptual de cada lección en la segunda mitad de esta fase.
