# RL de múltiples agentes

> El RL de agente único supone que el entorno está estacionario. Colocar dos agentes de aprendizaje en el mismo mundo y esa suposición se rompe: cada agente es parte del entorno del otro, y ambos están cambiando.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## El problema

Un robot que aprende a navegar por una habitación es un problema de RL de un solo agente. Un equipo de fútbol no lo es. Los oponentes de AlphaStar vs StarCraft no lo son. Un mercado de agentes de licitación no lo es. Dos coches negociando una parada de cuatro vías no lo son. Muchos problemas en el mundo real no lo son.

En cada entorno multi-agente, desde la perspectiva de cualquier agente, los otros agentes son parte del medio ambiente. A medida que aprenden y cambian su comportamiento, el entorno se vuelve no estacionario. La propiedad de Markov  "el próximo estado depende sólo del estado actual y mi acción"  se viola porque el siguiente estado también depende de lo que los otros agentes eligieron, y sus políticas son objetivos móviles.

Esto rompe las pruebas de convergencia tabular (la garantía de Q-learning asume un entorno estacionario). También rompe la RL profunda ingenuo: los agentes se persiguen unos a otros en bucles, nunca convergen a una política estable. Se necesitan técnicas específicas de múltiples agentes: entrenamiento centralizado / ejecución descentralizada, líneas de base contrafactuales, juego de liga, auto-juego.

Aplicaciones 2026: enjambres de robots, enrutamiento de tráfico, flotas de vehículos autónomos, simuladores de mercado, sistemas LLM multiagente (fase 16) y cualquier juego con más de un jugador inteligente.

## El concepto

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**Formalism: Markov Game.**Una generalización de la MDP: estados $S$, una acción conjunta $a = (a_1, \ldots, a_n)$, transición $P(s' \mid s, a)$, y recompensas por agente $R_i(s, a, s')$Cada agente .$i$maximiza su propio rendimiento bajo su propia política $\pi_i$Si las recompensas son idénticas, es**fully cooperative**Si es suma cero, es**adversarial**Si se mezcla, es**general-sum**¿ Qué ?

**Core challenges:**

- **Non-stationarity.** $P(s' \mid s, a_i)$de un agente .$i$La visión depende de$\pi_{-i}$, que está cambiando.
- **Credit assignment.**Con una recompensa compartida, ¿qué agente la causó?
- **Exploration coordination.**Los agentes deben explorar estrategias complementarias, no explorar redundantemente el mismo estado.
- **Scalability.**El espacio de acción conjunta crece exponencialmente en $n$¿ Qué ?
- **Partial observability.**Cada agente sólo ve su propia observación; el estado global está oculto.

**Four dominant regimes:**

**1. Independent Q-learning / independent PPO (IQL, IPPO).**Cada agente aprende su propia Q o política, tratando a los demás como parte del entorno. Simple, a veces funciona (especialmente con la repetición de la experiencia que actúa como un truco de modelado de agente suavizante). Convergencia teórica: ninguno.

**2. Centralized training, decentralized execution (CTDE).**El paradigma moderno más común.$\pi_i$que las condiciones de la observación local $o_i$ ejecución descentralizada estándar en el despliegue.$Q(s, a_1, \ldots, a_n)$condiciones sobre el estado global completo y la acción conjunta.
- **MADDPG**(Lowe et al. 2017): DDPG con un crítico centralizado por agente.
- **COMA**(Foerster et al. 2017): base contrafactual  preguntar "cuál habría sido mi recompensa si hubiera tomado medidas $a'$¿En cambio?"  aisla mi contribución.
- **MAPPO**- ¿ Qué ?**IPPO**con crítico compartido (Yu et al. 2022): PPO con función de valor centralizada.
- **QMIX**(Rashid et al. 2018): descomposición del valor  $Q_{\text{tot}}(s, a) = f(Q_1(s, a_1), \ldots, Q_n(s, a_n))$con mezcla monótona.

**3. Self-play.**Dos copias del mismo agente se juegan entre sí. La política del oponente es mi política de un instante pasado. AlphaGo / AlphaZero / MuZero. OpenAI Five. Funciona mejor para juegos de suma cero; la señal de entrenamiento es simétrica.

**4. League play.**Una extensión del juego propio a entornos de suma general / adversarial: mantener una población de políticas pasadas y actuales, probar un oponente de la liga, entrenar contra ellos. Agrega explotadores (especializados en vencer a los mejores actuales) y explotadores principales (especializados en vencer a explotadores). AlphaStar (StarCraft II). Necesitado cuando el juego admite ciclos de estrategia "rock-paper-scissors".

**Communication.**Permita a los agentes enviar mensajes aprendidos .$m_i$Foerster et al. (2016) mostró que la comunicación inter-agente diferenciable se puede entrenar de extremo a extremo.

```figure
f3-marl-orbit
```

## Construye el mismo

Esta lección utiliza un GridWorld 6×6 con dos agentes cooperativos. Comienzan en esquinas opuestas y deben alcanzar un objetivo compartido.`-1`por paso mientras cualquiera de los agentes está todavía en movimiento,`+10`Cuando ambos lleguen.`code/main.py`¿ Qué ?

### Paso 1: el entorno multiagente

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # two agents

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

El espacio de acción *joint* es `|A|² = 16`El estado global es de dos posiciones.

### Paso 2: aprendizaje Q independiente

Cada agente ejecuta su propia tabla Q con teclado en estado conjunto. En cada paso: ambos eligen acciones ε-avidas, recogen transición conjunta, cada uno actualiza su propio Q con la recompensa compartida.

```python
def independent_q(env, episodes, alpha, gamma, epsilon):
    Q1, Q2 = defaultdict(default_q), defaultdict(default_q)
    for _ in range(episodes):
        s = env.reset()
        done = False
        while not done:
            a1 = epsilon_greedy(Q1, s, epsilon)
            a2 = epsilon_greedy(Q2, s, epsilon)
            s_next, r, done = env.step(s, (a1, a2))
            if done:
                Q1[s][a1] += alpha * (r - Q1[s][a1])
                Q2[s][a2] += alpha * (r - Q2[s][a2])
                break
            target1 = r + gamma * max(Q1[s_next].values())
            target2 = r + gamma * max(Q2[s_next].values())
            Q1[s][a1] += alpha * (target1 - Q1[s][a1])
            Q2[s][a2] += alpha * (target2 - Q2[s][a2])
            s = s_next
```

Trabaja en esta tarea porque las recompensas son densas y alineadas. No logra tareas estrechamente vinculadas (por ejemplo, donde un agente tiene que *esperar* al otro).

### Paso 3: Q centralizado con actualización de valor descompuesto

Utilice un Q en las acciones conjuntas $Q(s, a_1, a_2)$Actualización de la recompensa compartida. Descentraliza en la ejecución marginalizando: $\pi_i(s) = \arg\max_{a_i} \max_{a_{-i}} Q(s, a_1, a_2)$. Trades espacio de acción conjunto exponencial para una visión global *correcta*

### Paso 4: juego propio simple (adversario 2-agente)

El mismo agente, dos papeles.$K$Los episodios, copiar los pesos de A en B. Entrenamiento simétrico, progreso constante.

## Las trampas

- **Non-stationary replay.**La experiencia de repetición con agentes independientes es peor que la de un solo agente porque las viejas transiciones fueron generadas por oponentes ahora obsoletos.
- **Credit assignment ambiguity.**Recompensa compartida después de un largo episodio; no hay manera clara de decir qué agente contribuyó.
- **Policy drift / chasing.**Las mejores respuestas de cada agente cambian con la actualización de los demás.
- **Reward hacking via coordination.**Los agentes encuentran exploits coordinados que el diseñador no anticipó. Los agentes de subastas convergen a la oferta cero.
- **Exploration redundancy.**Ambos agentes exploran los mismos pares de acciones de estado.
- **League cycles.**El juego puro puede quedar atrapado en un ciclo de dominación.
- **Sample explosion.** `n`Los agentes × espacio de estado × acciones conjuntas. Aproximado con aproximación de funciones; espacios de acción factorizados (una cabeza de salida de política por agente).

## Usalo

El mapa de aplicaciones MARL 2026:

| Domain | Method | Notes |
|--------|--------|-------|
| Cooperative navigation / manipulation | MAPPO / QMIX | CTDE; shared critic + decentralized actors. |
| Two-player games (chess, Go, poker) | Self-play with MCTS (AlphaZero) | Zero-sum; symmetric training. |
| Complex multiplayer (Dota, StarCraft) | League play + imitation pretraining | OpenAI Five, AlphaStar. |
| Autonomous-vehicle fleets | CTDE MAPPO / PPO with attention | Partial obs; variable team sizes. |
| Auction markets | Game-theoretic equilibrium + RL | Mean-field RL when `n` → ∞. |
| LLM multi-agent systems (Phase 16) | Natural-language comm + role conditioning | RL loop at the agent-planning layer. |

En 2026, el área de crecimiento más grande de MARL es la base de LLM: enjambres de agentes del modelo de lenguaje que negocian, debaten, construyen software.

## Envío

Salvo como`outputs/skill-marl-architect.md`¿Qué es esto ?

```markdown
---
name: marl-architect
description: Pick the right multi-agent RL regime (IPPO, CTDE, self-play, league) for a given task.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Given a task with `n` agents, output:

1. Regime classification. Cooperative / adversarial / general-sum. Justify.
2. Algorithm. IPPO / MAPPO / QMIX / self-play / league. Reason tied to coupling tightness and reward structure.
3. Information access. Centralized training (what global info goes to the critic)? Decentralized execution?
4. Credit assignment. Counterfactual baseline, value decomposition, or reward shaping.
5. Exploration plan. Per-agent entropy, population-based training, or league.

Refuse independent Q-learning on tightly-coupled cooperative tasks. Refuse to recommend self-play for general-sum with cycle risks. Flag any MARL pipeline without a fixed-opponent eval (cherry-picked self-play numbers are common).
```

## Los ejercicios

1. **Easy.**Entrenamiento independiente de aprendizaje Q en la cooperativa de 2 agentes GridWorld. ¿Cuántos episodios hasta que el retorno medio > 0?
2. **Medium.**Añadir una tarea de "coordinación": el objetivo se alcanza sólo cuando ambos agentes se acercan a él en el mismo giro. ¿Q independiente todavía converge? ¿Qué se rompe?
3. **Hard.**Implementar un critico centralizado para la formación al estilo MAPPO y comparar la velocidad de convergencia con la PPO independiente en la tarea de coordinación.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Markov game | "Multi-agent MDP" | $(S, A_1, \ldots, A_n, P, R_1, \ldots, R_n)$; each agent has its own reward. |
| CTDE | "Centralized training, decentralized execution" | Joint critic at training time; each agent's policy uses only local obs. |
| IPPO | "Independent PPO" | Each agent runs PPO separately. Simple baseline; often underrated. |
| MAPPO | "Multi-agent PPO" | PPO with a centralized value function conditioned on global state. |
| QMIX | "Monotonic value decomposition" | $Q_{\text{tot}} = f_{\text{monotone}}(Q_1, \ldots, Q_n)$ allows decentralized argmax. |
| COMA | "Counterfactual multi-agent" | Advantage = my Q minus expected Q marginalizing over my action. |
| Self-play | "Agent vs past self" | Single agent, two roles; standard for zero-sum games. |
| League play | "Population training" | Cache past policies, sample opponents from the pool; handles strategy cycles. |

## Leer más

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) CTDE con un crítico centralizado.
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) líneas de base contrafactuales para la asignación de créditos.
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) Descomposición de valores con monotonía.
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955) La PPO es sorprendentemente fuerte para MARL.
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) juego de liga en escala.
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) juego puro en juegos de suma cero.
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) incluye el tratamiento corto del manual de configuraciones de múltiples agentes y el problema de no estacionalidad que CTDE está diseñado para resolver.
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) encuesta que abarca las LMA cooperativas, competitivas y mixtas con resultados de convergencia.
