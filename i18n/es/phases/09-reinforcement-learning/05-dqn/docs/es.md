# Redes Q profundas (DQN)

> 2013: Mnih entrenó una red de aprendizaje Q en píxeles crudos, venció a todos los agentes RL clásicos en siete juegos Atari. 2015: ampliado a 49 juegos, publicado en Nature, desató la era de la RL profunda. DQN es Q-learning más tres trucos que hacen que la aproximación de funciones sea estable.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 04 (Q-learning, SARSA)
**Time:** ~75 minutes

## El problema

El aprendizaje de Q tabulare necesita un valor Q separado para cada par (estado, acción). Una tabla de ajedrez tiene ~1043 estados. Un marco Atari es 210×160×3 = 100,800 características.

La solución es obvia en retrospectiva: reemplazar la tabla Q por una red neuronal.$Q(s, a; \theta)$Pero la aproximación de funciones ingenuas con el aprendizaje Q diverge bajo la "triada mortal"  aproximación de funciones + bootstrapping + aprendizaje fuera de la política. Mnih et al. (2013, 2015) identificaron tres trucos de ingeniería que estabilizan el aprendizaje:

1. **Experience replay**Descorrelar las transiciones.
2. **Target network**congelará el objetivo de arranque.
3. **Reward clipping**normaliza las magnitudes de gradiente.

DQN en Atari fue la primera vez que una única arquitectura con un solo conjunto de hiperparámetros resolvió docenas de problemas de control a partir de píxeles crudos. Todo "deep-RL" construido desde DDQN, Rainbow, Dueling, Distribucional, R2D2, Agent57  está apilado en la parte superior de esta base de tres trucos.

## El concepto

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**The objective.**DQN minimiza la pérdida de TD en un paso en una función Q neuronal:

```math
L(\theta) = \mathbb{E}_{(s,a,r,s') \sim D}[ (r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2 ]
```

$\theta$= red en línea, actualizado cada paso por descenso de gradiente. $\theta^-$= red objetivo, copiada periódicamente desde $\theta$(cada ~ 10.000 pasos). $D$= Buffer de reproducción de las transiciones pasadas.

**The three tricks, in order of importance:**

**Experience replay.**Un amortiguador de anillos de `~10⁶`Cada paso de entrenamiento muestra un minibatch uniformemente al azar. Esto rompe la correlación temporal (los marcos sucesivos son casi idénticos), permite a la red aprender de raras transiciones gratificantes muchas veces y descorrela actualizaciones de gradiente consecutivas.

**Target network.**Usando la misma red $Q(\cdot; \theta)$En ambos lados de la ecuación Bellman hace que el objetivo se mueva cada actualización  "perseguir su propia cola". La solución: mantener una segunda red $Q(\cdot; \theta^-)$con pesos congelados.$C$pasos, copia $\theta \to \theta^-$Esto estabiliza el objetivo de regresión para miles de pasos de gradiente a la vez.$\theta^- \leftarrow \tau \theta + (1-\tau) \theta^-$(utilizado en DDPG, SAC) son una variante más suave.

**Reward clipping.**Las magnitudes de la recompensa de Atari varían de 1 a 1000+.$\lbrace-1, 0, +1 \rbrace$No es correcto cuando la magnitud de la recompensa importa, pero bueno para Atari cuando sólo importa la firma.

**Double DQN.**Hasselt (2016) corrige el sesgo de maximización: utiliza la red en línea para * seleccionar* la acción, la red objetivo para * evaluarla.

```math
\text{target} = r + \gamma Q(s', \arg\max_{a'} Q(s', a'; \theta); \theta^-)
```

El reemplazo de entrega es consistentemente mejor.

**Other improvements (Rainbow, 2017):**repetición priorizada (muestra de transiciones de alto TD-error más), arquitectura de duelo (separado $V(s)$El sistema de redes de acceso a Internet (C51/QR-DQN), las redes ruidosas (exploración aprendida), los retornos de n pasos, la distribución de Q (C51/QR-DQN), el arranque de múltiples pasos.

```figure
f3-dqn-stability
```

## Construye el mismo

El código aquí es stdlib-solo numpy-free  usamos un MLP de capa oculta única rodada a mano en un pequeño GridWorld continuo, por lo que cada paso de entrenamiento se ejecuta en microsecondas. El algoritmo es idéntico a Atari DQN en escala.

### Paso 1: Puente de reproducción

```python
class ReplayBuffer:
    def __init__(self, capacity):
        self.buf = []
        self.capacity = capacity
    def push(self, s, a, r, s_next, done):
        if len(self.buf) == self.capacity:
            self.buf.pop(0)
        self.buf.append((s, a, r, s_next, done))
    def sample(self, batch, rng):
        return rng.sample(self.buf, batch)
```

~106 capacidad para Atari, como en el DQN original (recolecta 50.000 transiciones antes de que comience el aprendizaje); 5.000 son suficientes para nuestro entorno de juguetes.

### Paso 2: una pequeña red Q (MLP manual)

```python
class QNet:
    def __init__(self, n_in, n_hidden, n_actions, rng):
        self.W1 = [[rng.gauss(0, 0.3) for _ in range(n_in)] for _ in range(n_hidden)]
        self.b1 = [0.0] * n_hidden
        self.W2 = [[rng.gauss(0, 0.3) for _ in range(n_hidden)] for _ in range(n_actions)]
        self.b2 = [0.0] * n_actions
    def forward(self, x):
        h = [max(0.0, sum(w * xi for w, xi in zip(row, x)) + b) for row, b in zip(self.W1, self.b1)]
        q = [sum(w * hi for w, hi in zip(row, h)) + b for row, b in zip(self.W2, self.b2)]
        return q, h
```

Pasado hacia adelante: lineal → ReLU → lineal. Esa es toda la red.

### Paso 3: actualización del DQN

```python
def train_step(online, target, batch, gamma, lr):
    grads = zeros_like(online)
    for s, a, r, s_next, done in batch:
        q, h = online.forward(s)
        if done:
            y = r
        else:
            q_next, _ = target.forward(s_next)
            y = r + gamma * max(q_next)
        td_error = q[a] - y
        accumulate_grads(grads, online, s, h, a, td_error)
    apply_sgd(online, grads, lr / len(batch))
```

La forma es Q-apprenticio de la lección 04 con dos diferencias: (a) nos retroacomponemos a través de un diferenciable $Q(\cdot; \theta)$En lugar de indexar una tabla, (b) los usos objetivo $Q(\cdot; \theta^-)$¿ Qué ?

### Paso 4: el bucle exterior

Para cada episodio, actúa en un acto de codicia.$Q(\cdot; \theta)$, empujar las transiciones en el amortiguador, muestran un minibatch, hacen un paso gradiente, sincronizan periódicamente$\theta^- \leftarrow \theta$El patrón:

```python
for episode in range(N):
    s = env.reset()
    while not done:
        a = epsilon_greedy(online, s, epsilon)
        s_next, r, done = env.step(s, a)
        buffer.push(s, a, r, s_next, done)
        if len(buffer) >= batch:
            train_step(online, target, buffer.sample(batch), gamma, lr)
        if steps % sync_every == 0:
            target = copy(online)
        s = s_next
```

En nuestro pequeño GridWorld con un estado de 16 dimensiones, el agente aprende una política casi óptima en aproximadamente 500 episodios.

## Las trampas

- **Deadly triad.**La aproximación de la función + fuera de la política + arranque puede divergir. DQN mitigó con red objetivo + repetición; no eliminar ninguno.
- **Exploration.**El sistema de detección de la red Q-net se descompone en el primer 10% del entrenamiento.
- **Overestimation.** `max`El uso de doble DQN en la producción siempre es de carácter ascendente.
- **Reward scale.**Clip o normalizar recompensas; la magnitud del gradiente es proporcional a la magnitud de la recompensa.
- **Replay buffer coldstart.**No entrenes hasta que el amortiguador tenga unos miles de transiciones.
- **Target sync frequency.**El sistema de control de velocidad de la navegación de Atari utiliza 10.000 pasos env.
- **Observation preprocessing.**Atari DQN apila 4 cuadros para hacer estado Markov. Cualquier entorno con información de velocidad necesita estado de cuadros o recurrente.

## Usalo

En 2026, DQN rara vez es de última generación, pero sigue siendo el algoritmo de referencia fuera de la política:

| Task | Method of choice | Why not DQN? |
|------|------------------|--------------|
| Discrete-action Atari-like | Rainbow DQN or Muesli | Same framework, more tricks. |
| Continuous control | SAC / TD3 (Phase 9 · 07) | DQN has no policy network. |
| On-policy / high-throughput | PPO (Phase 9 · 08) | No replay buffer; easier to scale. |
| Offline RL | CQL / IQL / Decision Transformer | Conservative Q targets, no bootstrapping blowups. |
| Large discrete action spaces (recommender) | DQN with action embedding, or IMPALA | Fine; decoration matters. |
| LLM RL | PPO / GRPO | Sequence-level, not step-level; different loss. |

Las lecciones siguen viajando. Replay y redes de destino aparecen en SAC, TD3, DDPG, SAC-X, el amortiguador de auto-juego de AlphaZero y todos los métodos de RL fuera de línea.

## Envío

Salvo como`outputs/skill-dqn-trainer.md`¿Qué es esto ?

```markdown
---
name: dqn-trainer
description: Produce a DQN training config (buffer, target sync, ε schedule, reward clipping) for a discrete-action RL task.
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

Given a discrete-action environment (observation shape, action count, horizon, reward scale), output:

1. Network. Architecture (MLP / CNN / Transformer), feature dim, depth.
2. Replay buffer. Capacity, minibatch size, warmup size.
3. Target network. Sync strategy (hard every C steps or soft τ).
4. Exploration. ε start / end / schedule length.
5. Loss. Huber vs MSE, gradient clip value, reward clipping rule.
6. Double DQN. On by default unless explicit reason to disable.

Refuse to ship a DQN with no target network, no replay buffer, or ε held at 1. Refuse continuous-action tasks (route to SAC / TD3). Flag any reward range > 10× per-step mean as needing clipping or scale normalization.
```

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`¿Cuántos episodios hasta que la media de ejecución exceda de -10?
2. **Medium.**Deshabilitar la red de destino (utilizar la red en línea para ambos lados del objetivo de Bellman).
3. **Hard.**Añadir DQN doble: utilizar la red en línea para seleccionar `argmax a'`, la red de objetivo para evaluar.`Q(s_0, best_a)`contra verdadero$V^{\ast}(s_0)$Después de 1.000 episodios con vs sin Double DQN en un grido de recompensas GridWorld.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DQN | "Deep Q-learning" | Q-learning with a neural Q-function, replay buffer, and target network. |
| Experience replay | "Shuffled transitions" | Ring buffer sampled uniformly each gradient step; decorrelates data. |
| Target network | "Frozen bootstrap" | Periodic copy of Q used in the Bellman target; stabilizes training. |
| Deadly triad | "Why RL diverges" | Function approximation + bootstrapping + off-policy = no convergence guarantee. |
| Double DQN | "Fix for maximization bias" | Online net selects action, target net evaluates it. |
| Dueling DQN | "V and A heads" | Decompose Q = V + A - mean(A); same output, better gradient flow. |
| Rainbow | "All the tricks" | DDQN + PER + dueling + n-step + noisy + distributional in one. |
| PER | "Prioritized Replay" | Sample transitions proportional to TD-error magnitude. |

## Leer más

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) el trabajo del taller de 2013 de NeurIPS que dio inicio a la RL profunda.
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) el artículo Nature, 49 juegos de DQN.
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) DDQN.
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581) Duelo de DQN.
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298) el papel de trucos apilados.
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) el tratamiento en libros de texto de la "triada mortal" (aproximado de la función + arranque + fuera de la política) que la red objetivo y el buffer de reproducción de DQN están diseñados para domesticar.
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) DQN de referencia de archivo único utilizado en estudios de ablación; bueno para leer junto con la versión de la lección desde cero.
