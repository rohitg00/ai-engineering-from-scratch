# Actrices y críticos  A2C y A3C

> ReINFORCE es ruidoso.$\hat{V}(s)$, restar de la vuelta, y usted obtiene una ventaja que tiene la misma expectativa pero mucho menor varianza. Eso es actor-crítica. A2C lo ejecuta sincrónicamente; A3C lo ejecuta a través de hilos. Ambos son el modelo mental para cada método moderno de RL profundo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## El problema

Vanilla ReINFORCE funciona, pero su variación es terrible.$G_t$puede oscilar sobre un factor de 10 entre episodios.$\nabla \log \pi$y la media produce un estimador de gradientes que toma miles de episodios para mover la póliza a la misma distancia que podrías moverla con muchas menos actualizaciones de DQN.

La variación proviene del uso de resultados crudos. Si restas una línea de base $b(s_t)$ cualquier función de estado, incluyendo un valor aprendido  la expectativa es inmutable y la varianza disminuye.$\hat{V}(s_t)$Ahora la cantidad multiplicándose$\nabla \log \pi$es la * ventaja*:

```math
A(s, a) = G - \hat{V}(s)
```

Una acción es buena si produjo un rendimiento superior al promedio; mala si está por debajo. REINFORCE con un crítico aprendido es *actor-crítico*. El crítico le da al actor un maestro de baja variación. Este es cada método de política profunda después de 2015 (A2C, A3C, PPO, SAC, IMPALA).

## El concepto

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** $\pi_\theta(a \mid s)$La política. Muestras para actuar.
- **Critic** $V_\phi(s)$Estimativas de retorno esperado del estado.$(V_\phi(s) - \text{target})^2$¿ Qué ?

**The advantage.**Dos formularios estándar:

- *Vantaje de la MC:* $A_t = G_t - V_\phi(s_t)$- Inparcial, mayor variación.
- *Vantaje de la TD:* $A_t = r_{t+1} + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)$. Prejuicios (usados $V_\phi$), una varianza mucho menor.$\delta_t$¿ Qué ?

**n-step advantage.**Interpolar entre los dos:

```math
A_t^{(n)} = r_{t+1} + \gamma r_{t+2} + \ldots + \gamma^{n-1} r_{t+n} + \gamma^n V_\phi(s_{t+n}) - V_\phi(s_t)
```

$n = 1$es TD puro. $n = \infty$La mayoría de las implementaciones utilizan $n = 5$para Atari, $n = 2048$para el PPO en MuJoCo.

**Generalized Advantage Estimation (GAE).**Schulman et al. (2016) propuso una media ponderada exponencialmente sobre todas las ventajas de n-pasos:

```math
A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}
```

con$\lambda \in [0, 1]$- ¿ Qué ?$\lambda = 0$es TD (baja varianza, alto sesgo). $\lambda = 1$es MC (alta varianza, imparcial). $\lambda = 0.95$es el 2026 de la tune  por defecto hasta que la dial de sesgo / variación es donde lo desea.

**A2C: synchronous advantage actor-critic.**Recolectar$T$pasos de la otra parte $N$En el juego de juego, el juego de juego es un juego de juego paralelo.

**A3C: asynchronous advantage actor-critic.**Mnih et al. (2016). Spawn $N$Cada trabajador calcula los gradientes localmente en su propio despliegue, luego los aplica sincrónicamente a un servidor de parámetros compartido. No se necesita buffer de repetición  los trabajadores se descorregan ejecutando diferentes trayectorias. A3C demostró que se puede entrenar en CPUs a escala. En 2026, A2C basado en GPU (envases paralelos en lote) domina porque las GPUs quieren lotes grandes.

**The combined loss.**

```math
L(\theta, \phi) = -\mathbb{E}[ A_t \cdot \log \pi_\theta(a_t \mid s_t) ] + c_v \cdot \mathbb{E}[(V_\phi(s_t) - G_t)^2] - c_e \cdot \mathbb{E}[H(\pi_\theta(\cdot \mid s_t))]
```

Tres términos: pérdida de la política, regresión de valor, bonificación de entropía. `c_v ~ 0.5`¿ Qué ?`c_e ~ 0.01`son puntos de partida canónicos.

```figure
actor-critic
```

## Construye el mismo

### Paso 1: un crítico

Crítico lineal $V_\phi(s) = w \cdot \text{features}(s)$actualizada con MSE:

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

En un entorno tabular el crítico converge en unos cientos de episodios. En Atari, reemplaza al crítico lineal con un compartimento de CNN trunk + valor cabeza.

### Paso 2: ventaja de n-paso

Dado el rollout de longitud $T$y una final sin salida .$V(s_T)$¿Qué es esto ?

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns`es el objetivo crítico. `advantages`es lo que se multiplica $\nabla \log \pi$¿ Qué ?

### Paso 3: actualización combinada

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

En política, una implementación por actualización, tasas de aprendizaje separadas para actores y críticos.

### Paso 4: paralelación (A3C vs. A2C)

- **A3C:**¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ ¡ Qué bien !$N$Cada uno ejecuta su propio env y su propio pase hacia adelante. Periódicamente empuje actualizaciones de gradiente a un maestro compartido. No hay cerraduras en el maestro  carreras están bien, sólo añaden ruido.
- **A2C:**¿ Qué ?$N$Env instancias en un solo proceso, apilar las observaciones en un `[N, obs_dim]`Batch, batch forward pass, batch backward pass. mayor utilización de GPU, determinista, más fácil de razonar.

Nuestro código de juguete es un hilo único para la claridad; reescribir a lotes de A2C es tres líneas de numpy.

## Las trampas

- **Critic bias before actor gradient.**Si el crítico es aleatorio, su línea de base no es informativa y usted está entrenando en ruido puro. Calentar al crítico durante unos cientos de pasos antes de activar el gradiente de política, o utilizar una tasa de aprendizaje de actores lenta.
- **Advantage normalization.**Normaliza las ventajas a cero promedio/unidad-std por lote. Estabiliza el entrenamiento masivamente a un costo cercano a cero.
- **Shared trunk.**Utilice un extractor de características compartidas para actores y críticos en entradas de imagen. cabezas separadas. Las características compartidas son de viaje libre en ambas pérdidas.
- **On-policy contract.**A2C reutiliza datos para exactamente una actualización. Más y su gradiente es sesgado (corrección de muestreo de importancia es lo que agrega PPO).
- **Entropy collapse.**Sin ...$c_e > 0$La política se vuelve casi determinista en unos cientos de actualizaciones y deja de explorar.
- **Reward scale.**Las magnitudes de ventaja dependen de la escala de recompensa. Normaliza las recompensas (por ejemplo, la división de run-std) para magnitudes de gradiente consistentes en las tareas.

## Usalo

A2C/A3C rara vez son la elección final en 2026 pero son la arquitectura que todo más tarde refinará:

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

Si ves "vantaj" en un artículo de 2026, piensa en actor-crítica.

## Envío

Salvo como`outputs/skill-actor-critic-trainer.md`¿Qué es esto ?

```markdown
---
name: actor-critic-trainer
description: Produce an A2C / A3C / GAE configuration for a given environment, with advantage estimation and loss weights specified.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Given an environment and compute budget, output:

1. Parallelism. A2C (GPU batched) vs A3C (CPU async) and the number of workers.
2. Rollout length T. Steps per env per update.
3. Advantage estimator. n-step or GAE(λ); specify λ.
4. Loss weights. `c_v` (value), `c_e` (entropy), gradient clip.
5. Learning rates. Actor and critic (separate if using).

Refuse single-worker A2C on environments with horizon > 1000 (too on-policy, too slow). Refuse to ship without advantage normalization. Flag any run with `c_e = 0` and observed entropy < 0.1 as entropy-collapsed.
```

## Los ejercicios

1. **Easy.**Entrenar a actores críticos con ventaja MC $(G_t - V(s_t))$Compare la eficiencia de la muestra con la línea de referencia de REINFORCE con el promedio de funcionamiento de la lección 06.
2. **Medium.**Cambiar a la ventaja residual TD $(r + \gamma V(s') - V(s))$¿Cuánto disminuye la variación de los lotes de ventajas?
3. **Hard.**Implementar GAE(λ).$\lambda \in \lbrace 0, 0.5, 0.9, 0.95, 1.0 \rbrace$¿Dónde está el punto de equilibrio de la variación/previación para esta tarea?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Actor | "The policy net" | $\pi_\theta(a \mid s)$, updated by policy gradient. |
| Critic | "The value net" | $V_\phi(s)$, updated by MSE regression to returns / TD targets. |
| Advantage | "How much better than average" | $A(s, a) = Q(s, a) - V(s)$ or its estimators. Multiplier for $\nabla \log \pi$. |
| TD residual | "δ" | $\delta_t = r + \gamma V(s') - V(s)$; one-step advantage estimate. |
| GAE | "The interpolation knob" | Exponentially weighted sum of n-step advantages, parameterized by $\lambda$. |
| A2C | "Synchronous actor-critic" | Batched across envs; one gradient step per rollout. |
| A3C | "Async actor-critic" | Worker threads push gradients to a shared param server. Original paper; less common in 2026. |
| Bootstrap | "Use V at the horizon" | Truncate the rollout, add $\gamma^n V(s_{t+n})$ to close the sum. |

## Leer más

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) A3C, el papel original de actores críticos sincronizados.
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) GAE.
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) fundamentos; emparejar esto con el capítulo 9 sobre aproximación de funciones cuando el crítico es una red neuronal.
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) escalable y distribuido de actores críticos con corrección fuera de la política de V-trace.
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) implementaciones de producción A2C/PPO que valgan la pena leer.
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) el resultado de convergencia fundamental para la descomposición actor-crítica en dos escalas.
