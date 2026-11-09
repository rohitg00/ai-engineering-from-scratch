# Optimización de la gama de LLM (PSO, ACO)

> La optimización bio-inspirada está haciendo un regreso de LLM. **LMPSO**(arXiv:2504.09247) utiliza PSO donde la velocidad de cada partícula es un prompt y el LLM genera el siguiente candidato; funciona bien en las salidas de secuencias estructuradas (expresiones matemáticas, programas). **Model Swarms**(arXiv:2410.11163) trata a cada experto en LLM como una partícula de PSO en un colectivo de modelos y informes **13.3% average gain**más de 12 líneas de base en 9 conjuntos de datos con sólo 200 instancias. **SwarmPrompt**(ICAART 2025) hibrida PSO + Grey Wolf para una optimización rápida. **AMRO-S**(arXiv:2603.12933) es un especialista en feromonas inspirado en ACO para el enrutamiento de LLM multiagente  **4.7x speedup**Esta lección implementa PSO en el espacio de parámetros rápidos y ACO en el enrutamiento de agentes, mide por qué estos algoritmos clásicos se ajustan a la era LLM y cuándo no.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## El problema

El resultado de la prueba es que el resultado de la prueba es un resultado de una prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba

La optimización clásica de bio-inspirada  PSO para espacios de búsqueda continua, ACO para la selección de trayectoria  fue diseñada exactamente para este régimen: libre de gradientes, basado en la población, barato por evaluación.

Los mismos patrones se aplican al agente *routing* en sistemas multi-agentes. Un tipo ACO registra el rastro de feromonas en el que el agente trabajó mejor en qué tipo de tarea, permite al router explotar el rastro y descompone las feromonas para que se puedan redescubrir las rutas.

## Concepto

### Reforma de la OPS (Kennedy & Eberhart 1995)

Optimización de las partículas en un espacio de búsqueda continua.`x_i`y velocidad.`v_i`Cada iteración:

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

¿ Dónde ?`p_best`es lo mejor de la partícula,`g_best`es el mejor de los enjambre,`w, c1, c2`son la inercia + cognitivo + pesos sociales, `r1, r2`son factores aleatorios.

### OPS sobre resultados de LLM  LMPSO

ArXiv: 2504.09247 adapta PSO para las salidas estructuradas generadas por LLM (expresiones matemáticas, programas). Cada partícula es una salida candidata. Velocidad es una *prompt* que describe cómo modificar la salida actual hacia lo mejor personal / global. El LLM genera la nueva salida a partir del prompt de velocidad. La "inercia" de la velocidad es un prompt como "hacer pequeños cambios incrementales".

Esto funciona bien cuando:
- La salida está estructurada (percibible, evaluable).
- La aptitud es automática (teste de pruebas, evaluación aritmética).
- La población es pequeña (~ 10-30 partículas) por lo que las llamadas totales de LLM siguen siendo manejables.

No funciona bien cuando la aptitud necesita revisión humana  el costo de la repetición se vuelve prohibitivo.

### Un grupo de ejemplos

ArXiv:2410.11163 saca el PSO de la capa de salida y en la capa de *modelo*. Cada "partícula" es un LLM experto (parámetros). El enjambre mueve los parámetros hacia el mejor colectivo a través de una actualización libre de gradientes.

La idea clave es que los modelos expertos de LLM ya están cerca en un variedad compartida de parámetros (pesos de adaptadores, deltas de LoRA).

### Actualización de la ACO (Dorigo 1992)

La optimización de la colonia de hormigas: las hormigas atraviesan un gráfico; cada camino tiene una pista de feromonas. Las hormigas mueven las probabilidades de peso por la fuerza de feromonas. Las hormigas que completan la tarea depositan feromonas proporcionales a la calidad de la solución.

### AMRO-S  ACO para el enrutamiento de agentes

ArXiv:2603.12933 utiliza ACO para el enrutamiento multi-agente. Cada tipo de tarea es un "destino"; cada agente es una ruta posible.

- **Interpretable routing evidence.**La fuerza de feromonas es una señal legible para el hombre.
- **Quality-gated asynchronous update.**Las feromonas se actualizan sólo después de que se hayan superado las comprobaciones de calidad, desacoplando la inferencia del aprendizaje.
- **4.7x speedup**en el índice de referencia de enrutamiento de múltiples agentes.

La puerta de calidad es importante: sin ella, los agentes rápidos pero equivocados acumulan feromonas, y el sistema se bloquea en malas rutas.

### Cuándo utilizar PSO / ACO para LLM

**Use PSO when:**
- El espacio de búsqueda es continuo o mapas a parámetros continuos (embedings de inmediato, pesos de LoRA, parámetros de generación numérica).
- El fitness es barato y automático.
- La población puede ser pequeña (10-30).

**Use ACO when:**
- Tienes un problema de enrutamiento o de selección de ruta.
- Las decisiones se refuerzan con el tiempo (los mismos tipos de tareas vuelven).
- Necesitas pruebas interpretables para las decisiones de enrutamiento.

**Do not use either when:**
- La aptitud requiere revisión humana (demasiado costosa por iteración).
- El espacio de búsqueda es discreto y combinatorial de una manera que la PSO no cubre (use algoritmos genéticos en su lugar).
- Las decisiones en tiempo real requieren una latencia estricta (PSO/ACO convergen lentamente en relación con las heurísticas de paso único).

### ¿Por qué la bio-inspirada todavía gana?

Los métodos basados en gradientes necesitan señales diferenciables. Las salidas de LLM y las decisiones de enrutamiento no son triviales. Los métodos pseudo-gradientes (routers de refuerzo, ajustes de instrucción de tipo DPO) funcionan, pero requieren una formación costosa.

PSO y ACO sólo necesitan una función de *evaluador* Si puedes marcar una salida de candidato o una decisión de enrutamiento, puedes optimizar el espacio. Eso hace que la barra de aplicabilidad sea mucho menor.

### Limitos prácticos

- **Population budget.**N partículas × T iteraciones × costo por eval. Para evaluaciones LLM en ~$0.02 / call, a 20-particle PSO running 50 iterations costs ~$Planar en consecuencia.
- **Exploration vs exploitation.**La tasa de descomposición de feromonas y la inercia de PSO se deshacen; descomposición demasiado rápida → olvidar soluciones; demasiado lento → atascado en las primeras óptimas locales.
- **Catastrophic drift.**Los dos algoritmos pueden converger y luego divergir si el panorama de fitness cambia (nueva distribución de datos).

```figure
swarm-stigmergy
```

## Construye el mismo

`code/main.py`los instrumentos:

- `LMPSO` PSO sobre parámetros de respuesta numéricos (temperatura, pesos top_k). La "generación LLM" de cada partícula se simula como una función de aptitud scripted.
- `AMRO_S` Enrutamiento en estilo ACO. 3 agentes, 4 tipos de tareas, matriz feromónica, 100 tareas enrutadas. Impresiones (task_type → opciones de agente) distribución a lo largo del tiempo para mostrar la formación de la trayectoria.
- Comparación: enrutamiento aleatorio vs ACO en el mismo flujo de tareas.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Producción esperada:
- LMPSO: g_best fitness mejora de aleatorio a casi óptimo en más de 30 iteraciones.
- AMRO-S: la tabla de feromonas se estabiliza en el agente correcto por tipo de tarea; el enrutamiento ACO supera al azar en ~ 30-40% en calidad y también reduce la latencia (menos retemplajes).

## Usalo

`outputs/skill-swarm-optimizer.md`ayuda a elegir entre PSO, ACO, algoritmos genéticos y optimizadores basados en gradientes para problemas de optimización de LLM / agente.

## Envío

- **Start small.**10-20 partículas, 20 a 50 iteraciones. escalar sólo si la curva de convergencia muestra una ganancia clara.
- **Log pheromones or g_best per iteration.**Desarmar los optimizadores de enjambre sin rastro es doloroso.
- **Quality-gate updates.**Especialmente para el enrutamiento de ACO: los agentes rápidos y incorrectos no deben acumular feromonas.
- **Reset decay on distribution shift.**Cuando la distribución de la evaluación cambia, las feromonas envejecidas se quedan obsoletas; restablezca o duplique temporalmente la tasa de descomposición.
- **Cap the per-iteration cost.**Emírese una métrica de costo por iteración. PSO que cuesta $500 / iteración y gana el 0,5% no es enviable.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Observe la convergencia de LMPSO. ¿A qué tamaño se satura el tiempo para converger?
2. Implementar un experimento de "drift catastrófico": después de la iteración 30, cambiar la función de aptitud. ¿Qué tan rápido se adapta el PSO? ¿Reiniciará la configuración `p_best`¿Cómo puedo ayudar?
3. Añadir una puerta de calidad a AMRO-S: depósito de feromonas sólo en carreras con puntaje de evaluación > 0.7. ¿Cómo cambia esta convergencia frente a la versión no-garada?
4. Leer LMPSO (arXiv:2504.09247). Mapa de la "velocidad como un prompt" del papel de vuelta a su velocidad numérica. ¿Qué se pierde en la simulación y qué se conserva?
5. Leer AMRO-S (arXiv:2603.12933). Implementar el "camino rápido de inferencia" descoplado con actualización feromónica asíncrona. ¿Cómo cambia esta latencia del sistema bajo carga sostenida?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PSO | "Particle Swarm Optimization" | Kennedy-Eberhart 1995. Population-based gradient-free optimizer. |
| ACO | "Ant Colony Optimization" | Dorigo 1992. Path/route optimization via pheromone trails. |
| LMPSO | "PSO with LLM generation" | arXiv:2504.09247. Velocity is a prompt; LLM produces candidates. |
| Model Swarms | "PSO on expert weights" | arXiv:2410.11163. Gradient-free update on model parameter subspace. |
| AMRO-S | "ACO for agent routing" | arXiv:2603.12933. Pheromone matrix over task-type × agent. |
| p_best / g_best | "Personal / global best" | Per-particle and swarm-wide best solutions found so far. |
| Pheromone | "Routing memory" | Strength on an edge; decays over time; deposits on quality. |
| Quality-gated update | "Only learn from good runs" | Pheromone deposit conditioned on quality check. |
| Catastrophic drift | "Distribution shift" | Fitness landscape changes; old p_best and pheromones become stale. |

## Leer más

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) el documento de 1995 de la OPS
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) 1992 fundaciones de la ACO
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) OPS para los resultados estructurados de MLL
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163) PSO en el subespacio de peso del modelo
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) Enrutamiento con feromonas con puerta de calidad
