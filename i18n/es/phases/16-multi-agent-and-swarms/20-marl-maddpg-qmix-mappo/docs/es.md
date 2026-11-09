# MARL  MADDPG, QMIX, MAPPO

> El patrimonio de aprendizaje reforzado de la coordinación multiagente, que todavía informa a los sistemas de LLM-agente en 2026. **MADDPG**(Lowe et al., NeurIPS 2017, arXiv:1706.02275) introdujo la Capacitación Centralizada, Ejecución Descentralizada (CTDE): cada crítico ve todos los estados y acciones de los agentes durante la capacitación; en el momento de la prueba solo ejecutan actores locales. Trabaja para entornos cooperativos, competitivos y mixtos. **QMIX**(Rashid et al., ICML 2018, arXiv:1803.11485) es la descomposición de valor con una red de mezcla monótona; por agente Qs se combinan en conjunto Q así `argmax`distribuye limpiamente  dominante en el StarCraft Multi-Agent Challenge (SMAC). **MAPPO**(Yu et al., NeurIPS 2022, arXiv:2103.01955) es PPO con una función de valor centralizada; "sorprendentemente eficaz" en el mundo de partículas, SMAC, Google Research Football, Hanabi con ajuste mínimo. Estas políticas sustentan las políticas de entrenamiento para equipos de agentes que deben actuar de manera descentralizada.**default 2026 cooperative-MARL baseline**Esta lección construye cada uno de ellos desde un pequeño juguete de la red y aterriza las tres ideas en la memoria muscular antes de tocar el entrenamiento de agente LLM.

**Type:** Learn
**Languages:** Python (stdlib, small NumPy-free implementations), TypeScript
**Prerequisites:** Phase 09 (Reinforcement Learning), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~90 minutes

## El problema

Los sistemas de LLM-agentes entrenan cada vez más políticas para la coordinación entre agentes: cuándo diferir, cuándo actuar, cuál peer a llamar.

La lectura de los artículos MARL sin el vocabulario de patrones es dolorosa.

- El RL independiente (cada agente aprende solo) no es estacionario desde la perspectiva de cada agente.
- La RL centralizada (un agente controla a todos) no escala y viola las restricciones de ejecución.
- CTDE obtiene lo mejor de ambos: entrenar con información global, desplegar con políticas locales.

## Concepto

### Tres entornos que utilizan los periódicos

- **Particle World (multi-agent particle env).**Física 2D simple con tareas cooperativas y competitivas.
- **StarCraft Multi-Agent Challenge (SMAC).**La micro gestión cooperativa, la observación parcial, el banco de pruebas de QMIX, acciones discretas, estados continuos.
- **Google Research Football, Hanabi, MPE.**Las líneas de base de MAPPO.

Los diferentes entornos tienen diferentes tipos de acción/observación.

### MADDPG (2017)  el patrón CTDE

Cada agente .`i`Tiene un actor.`mu_i(o_i)`El objetivo de la Comisión es que la Comisión pueda adoptar medidas de seguridad y de seguridad para garantizar que las medidas adoptadas sean eficaces.`Q_i(x, a_1, ..., a_n)`El actor se actualiza por gradiente de política frente a la evaluación del crítico.

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

Por qué CTDE: en el tiempo de entrenamiento, conocemos las acciones de todos; lo utilizamos para reducir la variación en cada crítico.`o_i`y llamadas .`mu_i(o_i)`¿ Qué ?

Modo de falla: los críticos crecen con N agentes (la entrada incluye todas las acciones). No se escala más allá de ~ 10 agentes sin aproximaciones.

### QMIX (2018)  Descomposición de valor

El valor común de acción `Q_tot`es una función de mezcla monótona de valores Q por agente:

```math
Q_{\text{tot}}(\tau, a) = f\big(Q_1(\tau_1, a_1), \ldots, Q_n(\tau_n, a_n)\big), \quad \frac{\partial f}{\partial Q_i} \ge 0
```

La monotonía garantiza `argmax_a Q_tot`puede ser calculado por cada agente que elija`argmax_{a_i} Q_i`¿Qué es lo que se dice?**exactly the decentralized execution property**En el tiempo de entrenamiento, una red de mezcla produce`Q_tot`de los Qs por agente.

Por qué QMIX gana en SMAC: la micro gestión cooperativa StarCraft tiene agentes homogéneos, obs local, recompensa global  perfecto para la descomposición de valor.

Modo de falla: la restricción de monotonicidad es restrictiva; algunas tareas tienen estructuras de recompensa que no son monótonas descomponibles (un agente sacrificando para el equipo).

### MAPPO (2022)  el incumplimiento no observado

PPO multi-agente: PPO con una función de valor centralizada. Cada agente tiene su propia política; todos los agentes comparten (o tienen por agente) funciones de valor que ven el estado completo. Yu et al. 2022 compararon MAPPO con MADDPG, QMIX y sus extensiones en cinco puntos de referencia y encontraron:

- MAPPO coincide o supera los métodos MARL fuera de la política en el mundo de partículas, SMAC, Google Research Football, Hanabi, MPE.
- Se requiere un ajuste mínimo de los hiperparámetros.
- Formación estable; reproducible entre semillas.

La comunidad subestimó la política MARL hasta este documento. En 2026, MAPPO es la línea de base predeterminada para la MARL cooperativa; cualquier nuevo método debe vencerlo.

### ¿Por qué los ingenieros de LLM deben preocuparse

Tres usos directos:

1. **Router training.**Un meta-agente elige qué sub-agente maneja una tarea. Este es un problema MARL con N sub-agentes descentralizados y un router centralizado.
2. **Role emergence.**En las simulaciones de agentes generativos, los agentes de formación para adoptar roles complementarios con el tiempo es un problema MARL disfrazado.
3. **Multi-agent tool use.**Cuando los agentes comparten herramientas y compiten por el presupuesto, la formación de ellos a través de CTDE produce políticas locales desplegables que respetan las restricciones de recursos.

En el año 2026, la mayoría de los sistemas de agentes de LLM de producción impulsan sus políticas en lugar de entrenarlos. MARL entra cuando usted tiene (a) muchos datos de interacción, (b) una señal clara de recompensa y (c) la voluntad de invertir en infraestructura de capacitación.

### CTDE como patrón de diseño más allá de RL

Incluso sin formación, CTDE es un patrón arquitectónico útil:

- Durante el diseño, asuma la visibilidad del equipo.
- En *runtime*, ejecutar la ejecución descentralizada: cada agente sólo ve `o_i`¿ Qué ?

El patrón te obliga a mantener el estado por agente explícito y a pensar en la observabilidad parcial de antemano.

### El problema de la no estacionalidad

Cuando varios agentes aprenden simultáneamente, el entorno de cada agente (que incluye las políticas de otros) es no estacionario. Las pruebas clásicas de RL de un solo agente se rompen.

- MADDPG: el crítico global ve todas las acciones, por lo que su estimación de valor es estacionaria.
- QMIX: la descomposición de valores traslada el aprendizaje a un espacio de Q conjunta donde la óptimalidad está bien definida.
- MAPPO: la función de valor centralizado disminuye la variación de los cambios de política de otros.

En los sistemas de agentes LLM, la no estacionariedad se manifiesta como "mi agente trabajó el mes pasado, ahora que otro agente en el río arriba cambió, la mina se comporta mal". El entrenamiento MARL con CTDE es la solución de principio; las correcciones de nivel inmediato son más rápidas pero menos duraderas.

### Lo que esta lección NO abarca

El entrenamiento de las redes reales es un tema de la Fase 09 . Esta lección construye versiones de políticas scriptadas que demuestran los patrones de CTDE, de descomposición de valor y de valor centralizado sin actualizaciones de gradientes. El objetivo es internalizar los patrones antes de recoger una biblioteca MARL completa (PyMARL, MARLlib, RLlib multi-agente).

```figure
sw-ctde
```

## Construye el mismo

`code/main.py`Implementa tres demostraciones de patrones, todas en un pequeño mundo de red cooperativa de 2 agentes:

- Medio ambiente: 2 agentes en una cuadrícula 4x4, una pelleta de recompensa.
- `IndependentAgents` cada agente trata a los demás como el medio ambiente.
- `MADDPGStyle` El crítico centralizado calcula un valor común; las políticas de los actores se actualizan a partir de él.
- `QMIXStyle` Descomposición de valor con un mezclador monótono.
- `MAPPOStyle` función de valor centralizada; actualización de las políticas en relación con la línea de base compartida.

Las cuatro versiones de CTDE convergen a caminos más cortos que la línea de base independiente.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultados esperados: los agentes independientes toman ~ 6 pasos en promedio; las variantes CTDE convergen hacia ~ 3.5 pasos (el óptimo para la cuadrícula 4x4 es 3). La diferencia de patrón aparece a pesar de las políticas scriptadas.

## Usalo

`outputs/skill-marl-picker.md`es una habilidad que elige un algoritmo MARL para una tarea multi-agente dada: cooperativa vs competitiva, homogénea vs heterogénea, tipo de espacio de acción, escala, señal de recompensa.

## Envío

El MARL en producción es raro.

- **Start with MAPPO.**El documento de 2022 estableció esto como la línea de base; reproducirlo primero ahorra semanas de perseguir métodos más sofisticados.
- **Log every agent's observation and action stream.**Desarmar el MARL sin rastro de agente es inútil.
- **Separate training code from execution code.**El CTDE es una disciplina; deja que el camino de ejecución realmente sólo vea `o_i`¿ Qué ?
- **Reward shaping warning.**MARL es muy sensible al diseño de recompensas. un error de coordinación en la configuración y los agentes aprenden a explotarlo. ejecutar pruebas adversarias.
- **For LLM agents**En primer lugar, considere las políticas de nivel inmediato.Invertir en la formación MARL sólo cuando los datos de interacción + señal de recompensa + infraestructura están todos presentes.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Medir la brecha de pasos a objetivos entre agentes independientes y de tipo MAPPO. ¿La brecha crece o se reduce en una rejilla de 6x6?
2. Implementar una variante competitiva: dos agentes, una pelleta, sólo el primero en alcanzar recibe una recompensa. ¿Qué patrón maneja la competencia limpio?
3. Lea MADDPG (arXiv:1706.02275) Sección 3. Implemente simbólicamente la regla de actualización crítica exacta en pseudocodo en sus propias palabras.
4. ¿Por qué los autores argumentan que el valor centralizado + PPO supera a MARL fuera de la política en sus puntos de referencia?
5. Aplicar CTDE como patrón de diseño a un sistema hipotético de agentes de LLM (por ejemplo, agente de investigación + resumidor + codificador). ¿Cuál es la información conjunta disponible en el momento del diseño que no está disponible en el tiempo de ejecución?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARL | "Multi-Agent RL" | Reinforcement learning for multi-agent systems. |
| CTDE | "Centralized Training, Decentralized Execution" | Train with global info; deploy with local policies. |
| MADDPG | "Multi-Agent DDPG" | CTDE with per-agent critic seeing all observations + actions. |
| QMIX | "Value decomposition" | Monotonic mixing of per-agent Qs. Cooperative. |
| MAPPO | "Multi-Agent PPO" | PPO with centralized value function. 2026 default baseline. |
| Value decomposition | "Sum of individual Qs" | Joint Q represented as a monotone function of per-agent Qs. |
| Non-stationarity | "Moving targets" | Each agent's env changes as others learn. The core MARL problem. |
| On-policy / off-policy | "Learn from current / replay" | PPO is on-policy (MAPPO); DDPG and Q-learning are off-policy. |
| SMAC | "StarCraft Multi-Agent Challenge" | Cooperative micromanagement benchmark; QMIX's homegrown ground. |

## Leer más

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) MADDPG; NeurIPS 2017
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) QMIX; ICML 2018
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) MAPPO; NeurIPS 2022
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) Enmarcado legible del resultado de la MAPPO
- [SMAC repository](https://github.com/oxwhirl/smac) StarCraft Multi-Agent Challenge
