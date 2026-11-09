# MDPs, Estados, Acciones y Recompensas

> Un proceso de decisión de Markov es de cinco cosas: estados, acciones, transiciones, recompensas, un descuento. Todo en RL  Q-learning, PPO, DPO, GRPO  optimiza sobre esta forma. Aprenda una vez, lea el resto del aprendizaje de refuerzo de forma gratuita.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Probability & Distributions), Phase 2 · 01 (ML Taxonomy)
**Time:** ~45 minutes

## El problema

Es un bot de ajedrez, un planificador de inventario, un agente de comercio, o un ciclo de PPO que entrena un modelo de razonamiento, cuatro dominios diferentes, un hecho sorprendente: los cuatro se desmoronan en el mismo objeto matemático.

El aprendizaje supervisado te da `(x, y)`¿El aprendizaje de refuerzo no le da etiquetas, sólo un flujo de estados, las acciones que tomó y una recompensa escalar? ¿Ganó el juego el movimiento? ¿La decisión de reabastecimiento ahorró dinero? ¿Ha hecho un beneficio el comercio? ¿El token que acaba de producir el LLM llevó a una recompensa mayor del juez?

No puedes aprender de esta corriente hasta que no la formalizes. "Lo que vi", "lo que hice", "lo que pasó después", "qué tan bueno fue"  cada uno tiene que convertirse en un objeto sobre el que puedes razonar. Esa formalización es un Proceso de Decisión Markov. Cada algoritmo RL en esta fase, incluidos los bucles RLHF y GRPO al final, optimiza sobre esta forma.

## El concepto

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**The five objects.**

- **States** $S$Todo lo que el agente necesita decidir en el GridWorld, la célula, en el ajedrez, la tabla, en un LLM, la ventana de contexto más cualquier memoria.
- **Actions** $A$Las opciones, subir/bajar/izquierda/derecha, jugar un movimiento, emitir un token.
- **Transitions** $P(s' \mid s, a)$- Dado el estado .$s$y la acción $a$Determinista en ajedrez, estocástico en inventario, casi determinista en decodificación LLM.
- **Rewards** $R(s, a, s')$La señal escalar. ganancia = +1, pérdida = -1. ingresos menos costo. El término de la relación log-probabilidad en GRPO.
- **Discount** $\gamma \in [0, 1)$¿Cuánto cuentan las recompensas futuras frente al presente?$\gamma = 0.99$compra un horizonte de ~ 100 pasos; $\gamma = 0.9$Comprará ~10.

**The Markov property** $P(s_{t+1} \mid s_t, a_t) = P(s_{t+1} \mid s_0, a_0, \ldots, s_t, a_t)$El futuro depende sólo del estado presente. Si no lo hace, la representación del estado es incompleta.

**Policies and returns.**Una política$\pi(a \mid s)$Los estados de mapas a las distribuciones de acción.$G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \ldots$Es la suma descuentada de las recompensas futuras.$V^\pi(s) = \mathbb{E}[G_t \mid s_t = s]$es el rendimiento esperado a partir de $s$en el marco de la política $\pi$El valor Q$Q^\pi(s, a) = \mathbb{E}[G_t \mid s_t = s, a_t = a]$El algoritmo RL estima uno de estos dos, y luego mejora $\pi$En consecuencia.

**The Bellman equations.**Las ecuaciones de punto fijo que todo en esta fase utiliza:

```math
\begin{aligned}
V^\pi(s) &= \sum_a \pi(a \mid s) \sum_{s', r} P(s', r \mid s, a) [r + \gamma V^\pi(s')] \\
Q^\pi(s, a) &= \sum_{s', r} P(s', r \mid s, a) [r + \gamma \sum_{a'} \pi(a' \mid s') Q^\pi(s', a')]
\end{aligned}
```

Estos divididos esperados regresan a "la recompensa de este paso" más "valor descuento de donde aterrizas". Recursivo. Cada algoritmo en la Fase 9 o bien repite esta ecuación a convergencia (programación dinámica), muestras de ella (Monte Carlo), o arranca un paso (diferencia temporal).

```figure
discount-horizon
```

## Construye el mismo

### Paso 1: un pequeño MDP determinista

Un 4x4 GridWorld. El agente comienza en la parte superior izquierda, la terminal en la parte inferior derecha, recompensa de -1 por paso, acciones.`{up, down, left, right}`- ¿ Qué ?`code/main.py`¿ Qué ?

```python
GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}

def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL
```

Cinco líneas, todo el entorno, transiciones deterministas, penas de paso constantes, estado terminal de absorción.

### Paso 2: elaborar una política

Una política es una función de la distribución del estado a la acción.

```python
def uniform_policy(state):
    return {a: 0.25 for a in ACTIONS}

def rollout(policy, max_steps=200):
    s, total, steps = (0, 0), 0.0, 0
    for _ in range(max_steps):
        a = sample(policy(s))
        s, r, done = step(s, a)
        total += r
        steps += 1
        if done:
            break
    return total, steps
```

ejecuta la política aleatoria 1000 veces. el retorno promedio es de alrededor de -60 a -80 para esta tabla 4×4. el retorno óptimo es -6 (camino de línea recta hacia abajo a la derecha). cerrar esa brecha es todo en la Fase 9.

### Paso 3: computación `V^π`exactamente a través de la ecuación de Bellman

Para MDPs pequeños la ecuación de Bellman es un sistema lineal. Enumera estados, aplica la expectativa, itera hasta que los valores dejan de cambiar.

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in all_states()}
    while True:
        delta = 0.0
        for s in all_states():
            if s == TERMINAL:
                continue
            v = 0.0
            for a, pi_a in policy(s).items():
                s_next, r, _ = step(s, a)
                v += pi_a * (r + gamma * V[s_next])
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

Este es el primer algoritmo en Sutton & Barto y la base teórica de cada método RL que sigue.

### Paso 4:`γ`es un hiperparámetro con significado físico

El horizonte efectivo es aproximadamente $1 / (1 - \gamma)$- ¿ Qué ?$\gamma = 0.9$→ 10 pasos. $\gamma = 0.99$→ 100 pasos. $\gamma = 0.999$→ 1000 pasos.

El agente actúa de manera miope y la asignación de créditos se vuelve ruidosa, ya que muchos pasos iniciales comparten la responsabilidad de la recompensa de un futuro lejano.$\gamma = 1$Los controles de las tareas de control utilizan`0.95–0.99`Los juegos de estrategia de largo horizonte usan`0.999`¿ Qué ?

## Las trampas

- **Non-Markovian state.**Si necesita las últimas tres observaciones para decidir, el "estado" no es solo la observación actual.
- **Sparse rewards.**Las recompensas sólo para ganar hacen que el aprendizaje sea casi imposible en grandes espacios de estado.
- **Reward hacking.**Optimizar una recompensa por proxy a menudo produce comportamiento patológico. El agente de carreras de barcos de OpenAI gira en círculos recogiendo powerups para siempre en lugar de terminar la carrera. Siempre define la recompensa por el resultado objetivo, no por el proxy.
- **Discount mis-spec.** $\gamma = 1$En una tarea de horizonte infinito hace que cada valor sea infinito.$\gamma < 1$¿ Qué ?
- **Reward scale.**Las recompensas de {+100, -100} vs {+1, -1} dan políticas óptimas idénticas pero magnitudes de gradiente muy diferentes.`[-1, 1]`- antes de conectarse a PPO/DQN.

## Usalo

La pila 2026 reduce cada tubería RL a un MDP antes de tocar el código:

| Situation | State | Action | Reward | γ |
|-----------|-------|--------|--------|---|
| Control (locomotion, manipulation) | Joint angles + velocities | Continuous torques | Task-specific shaped | 0.99 |
| Games (chess, Go, poker) | Board + history | Legal move | Win=+1 / loss=-1 | 1.0 (finite) |
| Inventory / pricing | Stock + demand | Order qty | Revenue - cost | 0.95 |
| RLHF for LLMs | Context tokens | Next token | Reward-model score at end | 1.0 (episode ~200 tokens) |
| GRPO for reasoning | Prompt + partial response | Next token | Verifier 0/1 at end | 1.0 |

Escriba los cinco tuples antes de escribir cualquier bucle de entrenamiento. La mayoría de los informes de errores "RL no funciona" se remontan a una formulación MDP que se rompió en papel.

## Envío

Salvo como`outputs/skill-mdp-modeler.md`¿Qué es esto ?

```markdown
---
name: mdp-modeler
description: Given a task description, produce a Markov Decision Process spec and flag formulation risks before training.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Given a task (control / game / recommendation / LLM fine-tuning), output:

1. State. Exact feature vector or tensor spec. Justify Markov property.
2. Action. Discrete set or continuous range. Dimensionality.
3. Transition. Deterministic, stochastic-with-known-model, or sample-only.
4. Reward. Function and source. Sparse vs shaped. Terminal vs per-step.
5. Discount. Value and horizon justification.

Refuse to ship any MDP where the state is non-Markovian without explicit mention of frame-stacking or recurrent state. Refuse any reward that was not defined in terms of the target outcome. Flag any `γ ≥ 1.0` on an infinite-horizon task. Flag any reward range >100x the typical step reward as a likely gradient-explosion source.
```

## Los ejercicios

1. **Easy.**Implementar el 4×4 GridWorld y el despliegue de políticas aleatorias en `code/main.py`- Cancelar 10.000 episodios. Informar el promedio y el std de retorno. Comparar con el retorno óptimo (-6).
2. **Medium.**- ¿ Qué ?`policy_evaluation`con$\gamma \in \lbrace 0.5, 0.9, 0.99 \rbrace$para la política uniforme aleatoria.`V`Explique por qué los valores de estado cerca de la terminal crecen más rápido con mayor tamaño.$\gamma$¿ Qué ?
3. **Hard.**Vuelve la GridWorld estocástica: cada acción se desliza hacia una dirección adyacente con probabilidad $p = 0.1$Reevaluar la política de uniforme.`V[start]`¿Mejor o peor?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MDP | "Reinforcement learning setup" | Tuple $(S, A, P, R, \gamma)$ satisfying the Markov property. |
| State | "What the agent sees" | Sufficient statistic for future dynamics under the chosen policy class. |
| Policy | "Agent's behavior" | Conditional distribution $\pi(a \mid s)$ or deterministic map $s \to a$. |
| Return | "Total reward" | Discounted sum $\sum \gamma^t r_t$ from the current step. |
| Value | "How good a state is" | Expected return under $\pi$ starting from $s$. |
| Q-value | "How good an action is" | Expected return under $\pi$ starting from $s$ with first action $a$. |
| Bellman equation | "Dynamic programming recursion" | Fixed-point decomposition of value / Q into one-step reward plus discounted successor value. |
| Discount $\gamma$ | "Future vs present" | Geometric weight on far-future reward; effective horizon $\approx 1/(1-\gamma)$. |

## Leer más

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf)El capítulo 3 cubre las ecuaciones de MDP y Bellman; el capítulo 1 motiva la hipótesis de recompensa que subyace en cada lección posterior.
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) el origen de la ecuación de Bellman.
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) Primer conciso de MDP desde un ángulo de RL profundo.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) la referencia de investigación de operaciones sobre los PMP y los métodos de solución exactos.
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://cs.brown.edu/media/filer_public/d1/a6/d1a6f66a-289a-4b81-9596-417114843489/littman.pdf) la derivación más limpia de los MDP como especialización de programación dinámica.
