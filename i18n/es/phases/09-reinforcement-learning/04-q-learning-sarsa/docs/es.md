# Diferencia temporal  Q-Learning y SARSA

> Monte Carlo espera hasta que termine el episodio. TD actualiza después de cada paso al iniciar la siguiente estimación de valor. Q-learning es fuera de política y optimista; SARSA es en política y cauteloso. Ambos son una línea de código. Ambos sustentan cada método de RL profundo en esta fase.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## El problema

Monte Carlo funciona pero tiene dos demandas caras. Necesita episodios que terminen, y sólo se actualiza después de que el regreso final está en. Si tu episodio es de 1.000 pasos, MC espera 1.000 pasos para actualizar cualquier cosa. Es de alta variación, baja prejuicio, y lento en la práctica.

La programación dinámica tiene el perfil opuesto  copias de seguridad de boot de varianza cero  pero requiere un modelo conocido.

El aprendizaje de la diferencia temporal (TD) divide la diferencia.$(s, a, r, s')$, formar un objetivo de un paso .$r + \gamma V(s')$y empujar .$V(s)$No hay modelo, no hay episodios completos, ni sesgo de usar una aproximación.$V$en el RHS, pero con una variación dramáticamente menor que MC y actualizaciones en línea desde el primer paso.

Este es el pivote en el que se giran todas las modernas RL  DQN, A2C, PPO, SAC . El resto de la Fase 9 son capas de aproximación de funciones y trucos construidos sobre la actualización TD de un paso que escribirás en esta lección.

## El concepto

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

```math
V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]
```

La cantidad entre paréntesis es el error TD $\delta = r + \gamma V(s') - V(s)$Es el análogo en línea de $G_t - V(s_t)$en MC. La convergencia requiere$\alpha$satisfacer a Robbins-Monro ($\sum \alpha = \infty$¿ Qué ?$\sum \alpha^2 < \infty$) y todos los estados visitados con infinita frecuencia.

**Q-learning.**Un método de control TD fuera de la política:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]
```

El `max`La política de la "compromisora" se seguirá desde$s'$El desacoplamiento hace que el aprendizaje Q aprenda.$Q^{\ast}$Mnih et al. (2015) convirtió esto en aprendizaje profundo de Q en Atari (Ley 05).

**SARSA.**Un método de TD en política:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]
```

El nombre es el tuple$(s, a, r, s', a')$. SARSA utiliza la acción $a'$El agente toma el siguiente, no el codicioso.`argmax`- Converge a$Q^\pi$Por lo que sea que sea avaro.$\pi$está funcionando, que en el límite $\epsilon \to 0$Se convierte en$Q^{\ast}$¿ Qué ?

**The cliff-walking difference.**En la tarea clásica de caminar por acantilados (caída-descance-acantilado = recompensa -100), el aprendizaje Q aprende el camino óptimo a lo largo del borde del acantilado, pero ocasionalmente toma la penalidad durante la exploración. SARSA aprende un camino más seguro a un paso del acantilado porque tiene en cuenta el ruido de exploración en su valor Q.$\epsilon \to 0$En la práctica importa: cuando la exploración se realiza en realidad en el despliegue, el comportamiento de SARSA es más conservador.

**Expected SARSA.**Reemplazar$Q(s', a')$con su valor esperado inferior a $\pi$¿Qué es esto ?

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \sum_{a'} \pi(a' \mid s') Q(s', a') - Q(s, a)]
```

Varianza menor que la SARSA (no hay muestra de $a'$), el mismo objetivo en materia de política.

**n-step TD and TD(λ).**Interpolar entre TD(0) y MC esperando $n$pasos antes de arrancar. $n=1$es TD, $n=\infty$es MC. TD(λ) promedios sobre todos $n$con pesos geométricos $(1-\lambda)\lambda^{n-1}$La mayoría de los usos de RL profundos$n$entre 3 y 20.

```figure
qlearning-gridworld
```

## Construye el mismo

### Paso 1: SARSA sobre la política de avaricia

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

La única diferencia con el aprendizaje Q es la línea de objetivo.

### Paso 2: Aprendizaje de Q

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

El `max`El símbolo es la diferencia entre la política y la política.

### Paso 3: Curvas de aprendizaje

El estudio de la C.A.R.S.A. se ha desarrollado en el campo de la C.A.R.S.A. en el campo de la C.A.R.S.A.R.S.A. en el campo de la C.A.R.S.A.R.S.A. en el campo de la C.A.R.S.A.R.S.A. en el campo de la C.A.R.S.A.R.S.A.R.S.A. en el campo de la C.A.R.S.A.R.S.A. en el campo de la C.A.R.S.A.R.S.A. en el campo de la C.A.R.S.A.R.S.A. en el campo de la C.A.R.S.A.R.S.A.R.S.A. en el campo de la C.A.R.S.R.S.A.R.S.R.S.A.R.R.S.R.S.R.R.S.R.R.R.R.S.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R.R`code/main.py`, ambos son casi óptimos después de ~ 2.000 episodios con $\alpha=0.1, \epsilon=0.1$¿ Qué ?

### Paso 4: comparación con la verdad de DP

Ejecutar la iteración del valor (lección 02) para obtener $Q^{\ast}$- ¿ Qué ?$\max_{s,a} \lvert Q_{\text{learned}}(s,a) - Q^{\ast}(s,a) \rvert$Un agente TD saludable tabulear aterriza dentro de la`~0.5`en el 4×4 GridWorld después de 10.000 episodios.

## Las trampas

- **Initial Q values matter.**Inicialmente optimista ($Q = 0$El principio pesimista puede atrapar una política codiciosa para siempre.
- **α schedule.**Constantemente .$\alpha$Es bueno para problemas no estacionarios.$\alpha_n = 1/n$da convergencia en teoría pero es demasiado lento en la práctica  pin $\alpha$En el`[0.05, 0.3]`y monitorear la curva de aprendizaje.
- **ε schedule.**Comienza con alto ($\epsilon=1.0$), la descomposición a $\epsilon=0.05$. "GLIE" (compulsivo en el límite con una exploración infinita) es la condición de convergencia.
- **Max bias in Q-learning.**El `max`el operador está sesgado hacia arriba cuando $Q$El doble aprendizaje Q de Hasselt (utilizado por DDQN en la Lección 05) corrige esto con dos tablas de Q.
- **Non-terminating episodes.**TD puede aprender sin terminales, pero debe captar los pasos o manejar correctamente la banda de arranque en la banda.
- **State hashing.**Si los estados son tuples/tensores, utilice una clave hashable (tuplo, no lista; tuple de flotantes redondeados, no crudo).

## Usalo

El panorama de la TD para 2026:

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

El 90% de la "RL" que se lee en los artículos 2026 es una elaboración de Q-learning o SARSA.

## Envío

Salvo como`outputs/skill-td-agent.md`¿Qué es esto ?

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## Los ejercicios

1. **Easy.**Implemente Q-learning y SARSA en el GridWorld 4×4. Plot de curvas de aprendizaje (retorno medio por 100 episodios) para 2.000 episodios. ¿Quién converge más rápido?
2. **Medium.**Construir un entorno de caminar en acantilados (4×12, la última fila es el acantilado con recompensa -100 y restablecer para comenzar). Comparar las políticas finales de Q-learning y SARSA.
3. **Hard.**Implementar el doble aprendizaje Q. En un GridWorld (ruido gaussiano)$\sigma=5$se añade a la recompensa por paso), muestra sobrevaloraciones de Q-learning $V^{\ast}(0,0)$En el caso de los estudiantes de doble Q, el aprendizaje no es un aprendizaje de doble Q.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TD error | "The update signal" | $\delta = r + \gamma V(s') - V(s)$, the bootstrapped residual. |
| TD(0) | "One-step TD" | Update after every transition using only the next state's estimate. |
| Q-learning | "Off-policy RL 101" | TD update with `max` over next-state actions; learns $Q^{\ast}$ regardless of behavior policy. |
| SARSA | "On-policy Q-learning" | TD update using the actual next action; learns $Q^\pi$ for current ε-greedy π. |
| Expected SARSA | "The low-variance SARSA" | Replace sampled $a'$ with its expectation under π. |
| GLIE | "Correct exploration schedule" | Greedy in the Limit with Infinite Exploration; needed for Q-learning convergence. |
| Bootstrapping | "Using current estimate in the target" | What distinguishes TD from MC. Source of bias but massive variance reduction. |
| Maximization bias | "Q-learning overestimates" | `max` over noisy estimates is upward-biased; fixed by Double Q-learning. |

## Leer más

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) el papel original y la prueba de convergencia.
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) TD(0), SARSA, aprendizaje Q, SARSA esperada.
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) fijar el sesgo de maximización.
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) la motivación esperada por SARSA.
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) el documento que acuñó SARSA (entonces llamado "aprendizaje Q-conexionista modificado").
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) generaliza TD(0) a TD(n), el camino desde el aprendizaje Q hasta los rastros de elegibilidad y, más tarde, GAE en PPO.
