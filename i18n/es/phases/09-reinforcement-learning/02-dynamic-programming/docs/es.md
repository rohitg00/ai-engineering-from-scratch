# Programación dinámica  Iteración de políticas y iteración de valores

> La programación dinámica es RL con el engaño. Ya sabes las funciones de transición y recompensa; sólo se repite la ecuación de Bellman hasta que$V$o $\pi$El método de referencia es el que todos los métodos basados en muestreo intentan abordar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## El problema

Tiene un MDP con un modelo conocido: puede consultar $P(s' \mid s, a)$y $R(s, a, s')$Un gerente de inventario conoce la distribución de la demanda. un juego de mesa tiene transiciones deterministas. un mundo de cuadrícula es cuatro líneas de Python. tienes un *modelo*.

La RL libre de modelos (Q-learning, PPO, REINFORCE) fue inventada para el caso en el que no tienes un modelo  solo puedes tomar muestras del entorno. Pero cuando lo tienes, hay métodos más rápidos y mejores: programación dinámica. Bellman las diseñó en 1957.

Los datos de la investigación de RL (GridWorld, FrozenLake, CliffWalking) se resuelven con DP para producir la política estándar de oro.$V^{\ast}(s_0)$En tercer lugar, los métodos modernos de RL y planificación fuera de línea (MCTS, búsqueda de AlphaZero, RL basado en el modelo en la Fase 9 · 10) reiteran todos una copia de seguridad Bellman sobre un modelo aprendido o dado.

## El concepto

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**Two algorithms, both fixed-point iteration on Bellman.**

**Policy iteration.**Alterna dos pasos hasta que la política deje de cambiar.

1. *Evaluación:* política dada $\pi$, computación $V^\pi$mediante la aplicación repetida $V(s) \leftarrow \sum_a \pi(a \mid s) \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$hasta que converge.
2. *Mejora: * dada $V^\pi$, hacer$\pi$codicioso W.R.T.$V^\pi$¿ Qué es esto ?$\pi(s) \leftarrow \arg\max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$¿ Qué ?

La convergencia está garantizada porque a) cada paso de mejora mantiene o$\pi$el mismo o aumentan estrictamente $V^\pi$Para algunos estados, (b) el espacio de las políticas deterministas es finito. generalmente converge en ~ 520 iteraciones externas incluso para grandes espacios de estados.

**Value iteration.**Se desmorona la evaluación y la mejora en un solo barrido. Aplique la ecuación Bellman *optimalidad*:

```math
V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]
```

Repita hasta que$\max_s \lvert V_{\text{new}}(s) - V(s) \rvert < \epsilon$. Extraer la política al final tomando la acción codiciosa. Estrictamente más rápido por iteración  no hay bucle de evaluación interna  pero normalmente necesita más iteraciones para converger.

**Generalized policy iteration (GPI).**La estructura unificadora. La función de valor y la política están bloqueadas en un bucle de mejora bidireccional; cualquier método que impulse ambos hacia la consistencia mutua (iteración de valores sincronizados, iteración de políticas modificadas, Q-learning, actor-critico, PPO) es una instancia de GPI.

**Why $\gamma < 1$ matters.**El operador Bellman es un$\gamma$- contracción en la norma de sup: $\lVert T V - T V' \rVert_\infty \le \gamma \lVert V - V' \rVert_\infty$La contracción implica un punto fijo único y una convergencia geométrica.$\gamma < 1$y pierdes la garantía necesitas un horizonte finito o un estado terminal de absorción.

```figure
value-iteration-gamma
```

## Construye el mismo

### Paso 1: construir el modelo de MDP de GridWorld

Usamos el mismo 4x4 GridWorld de la Lección 01. Añadimos una variante estocástica: con probabilidad `0.1`El agente se desliza hacia una dirección perpendicular aleatoria.

```python
SLIP = 0.1

def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    for direction, prob in action_probs(action):
        outcomes.append((apply_move(state, direction), -1.0, prob))
    return outcomes
```

`transitions(s, a)`devuelve una lista de `(s', r, p)`Este es todo el modelo.

### Paso 2: Evaluación de las políticas

Dado que hay una política `π(s) = {action: prob}`, repite la ecuación de Bellman hasta que $V$Se detiene:

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = sum(pi_a * sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a))
                   for a, pi_a in policy(s).items())
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

### Paso 3: Mejora de las políticas

Reemplazar$\pi$con la política codiciosa W.R.T.$V$Si ...$\pi$No cambió, regreso  estamos en el óptimo.

```python
def policy_improvement(V, gamma=0.99):
    new_policy = {}
    for s in states():
        best_a = max(
            ACTIONS,
            key=lambda a: sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a)),
        )
        new_policy[s] = best_a
    return new_policy
```

### Paso 4: Conectadlos

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # arbitrary start
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

Convergencia típica en 4×4: 46 iteraciones externas.$V^{\ast}(0,0) \approx -6$y una política que reduce estrictamente el número de pasos.

### Paso 5: Iteración de valor (versión de un bucle)

```python
def value_iteration(gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = max(sum(p * (r + gamma * V[s_prime])
                       for s_prime, r, p in transitions(s, a))
                   for a in ACTIONS)
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            break
    policy = policy_improvement(V, gamma)
    return V, policy
```

El mismo punto fijo, menos líneas de código.

## Las trampas

- **Forgetting to handle terminals.**Si aplicas Bellman a un estado de absorción, sigue recogiendo una "mejor acción" que no cambia nada.`if s == terminal: V[s] = 0`¿ Qué ?
- **Sup-norm vs L2 convergence.**Usar`max |V_new - V|`La garantía teórica está en la sup-norma.
- **In-place vs synchronous updates.**Actualización `V[s]`En el lugar (Gauss-Seidel) converge más rápido que en un lugar separado `V_new`El código de producción utiliza en el lugar.
- **Policy ties.**Si dos acciones tienen el mismo valor Q,`argmax`El sistema de correlación puede romper los vínculos de manera diferente en cada iteración, causando que el control de "estabilidad de política" oscile.
- **State-space explosion.**DP es$O(\lvert S \rvert \cdot \lvert A \rvert)$Para el análisis de la función, el valor de la función se calcula en un punto de referencia.

## Usalo

En 2026, DP es la línea de base de corrección y el bucle interno de los planificadores:

| Use case | Method |
|----------|--------|
| Solve a small tabular MDP exactly | Value iteration (simpler) or policy iteration (fewer outer steps) |
| Verify a Q-learning / PPO implementation | Compare to DP-optimal $V^{\ast}$ on a toy environment |
| Model-based RL (Phase 9 · 10) | Bellman backup on a learned transition model |
| Planning in AlphaZero / MuZero | Monte Carlo Tree Search = async Bellman backup |
| Offline RL (CQL, IQL) | Conservative Q-iteration — DP with a penalty on OOD actions |

Cada vez que alguien dice "la función de valor óptimo", se refiere a "el punto fijo DP".$V^{\ast}$o $Q^{\ast}$en un periódico, imagínate este bucle.

## Envío

Salvo como`outputs/skill-dp-solver.md`¿Qué es esto ?

```markdown
---
name: dp-solver
description: Solve a small tabular MDP exactly via policy iteration or value iteration. Report convergence behavior.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Given an MDP with a known model, output:

1. Choice. Policy iteration vs value iteration. Reason tied to |S|, |A|, γ.
2. Initialization. V_0, starting policy. Convergence sensitivity.
3. Stopping. Sup-norm tolerance ε. Expected number of sweeps.
4. Verification. V*(s_0) computed exactly. Greedy policy extracted.
5. Use. How this baseline will be used to debug/evaluate sampling-based methods.

Refuse to run DP on state spaces > 10⁷. Refuse to claim convergence without a sup-norm check. Flag any γ ≥ 1 on an infinite-horizon task as a guarantee violation.
```

## Los ejercicios

1. **Easy.**Ejecutar la iteración de valor en la 4×4 GridWorld con $\gamma \in \lbrace 0.9, 0.99 \rbrace$¿ Cuántas barradas hasta ?$\max \lvert \Delta V \rvert < 10^{-6}$¿ Impresión ?$V^{\ast}$como una cuadrícula 4×4.
2. **Medium.**Comparación de la iteración de la política vs iteración de valor en la *estocástica* GridWorld (probabilidad de deslizamiento `0.1`Contar: barridos, tiempo del reloj de la pared, final $V^{\ast}(0,0)$¿Cuál converge más rápido en iteraciones?
3. **Hard.**Construir una iteración de política modificada: en la etapa de evaluación, ejecutar sólo $k$Se desliza en lugar de convergir.$V^{\ast}(0,0)$error vs $k$por$k \in \lbrace 1, 2, 5, 10, 50 \rbrace$¿Qué le dice la curva sobre la compensación entre evaluación y mejora?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy iteration | "DP algorithm" | Alternating evaluation ($V^\pi$) and improvement (greedy $\pi$ w.r.t. $V^\pi$) until the policy stops changing. |
| Value iteration | "Faster DP" | Bellman optimality backup applied in one sweep; converges to $V^{\ast}$ geometrically. |
| Bellman operator | "The recursion" | $(T V)(s) = \max_a \sum P (r + \gamma V(s'))$; a $\gamma$-contraction in sup-norm. |
| Contraction | "Why DP converges" | Any operator $T$ with $\lVert T x - T y \rVert \le \gamma \lVert x - y \rVert$ has a unique fixed point. |
| GPI | "Everything is DP" | Generalized Policy Iteration: any method driving $V$ and $\pi$ to mutual consistency. |
| Synchronous update | "Jacobi-style" | Use old $V$ throughout a sweep; cleanly analyzable but slower. |
| In-place update | "Gauss-Seidel-style" | Use $V$ as it's being updated; converges faster in practice. |

## Leer más

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) la presentación canónica de la iteración de políticas y la iteración de valores.
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) tratamiento riguroso de los argumentos de cartografía de contracción.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) la iteración de las políticas modificadas y su análisis de convergencia.
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) el documento original de iteración de la política.
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) el puente desde el DP hasta el aproximado-DP / RL profundo utilizado en cada lección posterior.
