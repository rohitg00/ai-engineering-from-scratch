# Votación, autoconcordancia y topología del debate

> La agregación más barata: muestra N de agentes independientes, mayoría-voto. Wang et al. 2022 autoconsistencia hizo esto con un modelo muestrado N veces.**heterogeneous**Los agentes para escapar de la monocultura  diferentes modelos, diferentes indicaciones, diferentes temperaturas, diferentes contextos. Más allá de la mayoría de votos, el debate sobre la topología es importante: MultiAgentBench (arXiv:2503.01935, ACL 2025) evaluó la coordinación estrella / cadena / árbol / gráfico y se encontró **graph best for research**AgentVerse (ICLR 2024) documenta dos patrones emergentes  comportamientos voluntarios y comportamientos de conformidad  y la conformidad es tanto una característica (encontrar consenso) como un riesgo (pensamiento grupal, Lección 24).

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## El problema

El debate puede mejorar la precisión (Du et al., arXiv:2305.14325). También puede degradarla.

1. ¿Quién habla con quién (topología).
2. Cuántas rondas (Du 2023: ambas rondas y agentes importan de forma independiente).
3. Si los agentes son heterogéneos (modelos base diferentes rompen la monocultura).
4. Si hay una voz adversaria (steel-manning vs. straw-manning).

Los equipos que " ejecutan 5 agentes y votan " en una tarea a menudo regresan frente a un solo agente. Los fracasos no son aleatorios.

## Concepto

### Autoconsistencia, línea de base de un modelo único

Wang et al. 2022 ("Autoconsistencia mejora la cadena de razonamiento del pensamiento") muestran el mismo modelo N veces a temperatura > 0 y votan por mayoría en respuestas de la vía de razonamiento. El resultado en GSM8K: ganancias sustanciales con muestras N=40 sobre un solo decodificación codiciosa.

Limite: la autoconsistencia utiliza un modelo base. Los errores se correlacionan por construcción. Si el modelo tiene un sesgo sistemático, todas las muestras N lo comparten.

### Voto multi-agente, extensión heterogénea

Los resultados de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la ciencia de la ciencia de los resultados de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de los científicos de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de cuíman se han cambianananan (clínrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr

El nombre canónico para el debate heterogéneo para 2026 es **A-HMAD** Debate heterogéneo multiagente adversario. No es universalmente adoptado, pero los artículos utilizan el término para "debate de modelos diferentes, que reduce los errores correlacionados del colapso de la monocultura".

### Las cuatro topologías

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

Estrella: un centro, todos los demás hablan solo con el centro.
Cadena: lineal, cada agente ve la salida de la anterior.
Árbol: jerárquico, utilizado por los sistemas de agentes jerárquicos (lección 06).
Grafico: cualquier a cualquier. Incluye clique totalmente conectado y DAG arbitrarios.

### El impuesto de coordinación (MultiAgentBench)

MultiAgentBench (MARBLE, ACL 2025, arXiv:2503.01935) comparó estrellas, cadenas, árboles, gráficos en un conjunto de tareas que incluyen investigación, codificación y planificación.

- **Graph**La topología gana en las tareas de investigación. La información fluye de cualquiera a cualquiera; los agentes pueden criticarse entre sí.
- **Star**El centro de filtración y consolidación.
- **Chain**ganancias en oleoductos graduados (refinamiento por etapas).
- **Coordination tax**El valor de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de la cuentas de los valores de los valores de los valores de los valores de los valores de la cuentas de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de la cuento de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de la cuento de los valores de los valores de los valores de los valores de los valores de la cuento de los valores de los valores de los valores de los valores de los valores de la cuento de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los valores de los cuento de la cuento de los cuento de los cuento de los cuento de los cuento de los cuento de los cuento de los cuento de los cuento de los cu

El límite de 4 agentes es empírico, no fundamental. Reflecta la capacidad de contexto de 2026 LLM: el contexto de cada agente se llena de resultados de pares, y el valor marginal de agregar el agente N + 1 disminuye una vez que todos puedan ver a todos.

### Estrategias de debate multi-agentes ("¿Deberíamos estar volviéndonos locos?")

ArXiv:2311.17371 es la encuesta de 2023 de estrategias de MAD. Los hallazgos clave replicados por otros: las variantes de MAD que son *estructuralmente similares* a la autoconsistencia (muestreo independiente + agregación) a menudo tienen un rendimiento inferior a la autoconsistencia cuando se utiliza el mismo presupuesto.

### Los patrones emergentes de agenteVerse

El objetivo de la Comisión es garantizar la seguridad de los trabajadores.https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) documenta dos comportamientos que surgen del debate multiagente incluso sin un diseño explícito:

- **Volunteer.**Un agente ofrece ayuda ("puedo dar el siguiente paso") sin ser solicitado.
- **Conformity.**El agente ajusta su postura para que coincida con la de un crítico, incluso cuando el crítico está equivocado.

La conformidad es la razón por la que el debate hasta el acuerdo recompensa a los matones.

### Heterogeneidad: el botón real que mueve la precisión

Un patrón 2024-2026 en la literatura práctica: intercambiar uno de sus agentes N por un modelo base diferente da una mayor acceleración que aumentar N por 1. La intuición es monocultura  cada nueva fuente de error independiente vale más que una muestra correlacionada adicional.

En el límite, la heterogeneidad supera a la numerosidad. Tres modelos diferentes superan cinco copias de un modelo en la mayoría de las tareas que tienen verdad en el suelo limpio.

### Métodos de los jurados

El marco de la Sibyl (citado en la literatura de Minsky-LLM) formaliza un "jurado"  un pequeño conjunto de agentes especializados que refinan las respuestas votando en cada etapa. A diferencia del voto de mayoría simple, un jurado tiene funciones: un agente interexamina, uno proporciona contexto, uno califica la plausibilidad. Los métodos del jurado son un punto medio entre el voto simple (barato, propenso a la monocultura) y el MAD completo (costo, propenso a la conformidad).

### Cuando el voto con debate domina

- La pregunta tiene la verdad fundamental (hechos, matemáticas, comportamiento de código).
- Los agentes pueden acceder a diferentes fuentes o herramientas (la heterogeneidad está disponible).
- Las rondas están delimitadas (2-3 típicamente) y hay un juez o verificador separado.
- El presupuesto permite 3-5 agentes. Más allá de 5-7 en la topología gráfica, el impuesto de coordinación domina.

### Cuando el voto con el debate duele

- La pregunta es de opinión, los agentes convergen a la respuesta que parece más segura, no más correcta.
- Todos los agentes comparten un modelo base.
- Las rondas son ilimitadas.
- La tarea es simple: un agente único con autoconsistencia en N=5 es más barato y tan preciso.

```figure
sw-debate-topology
```

## Construye el mismo

`code/main.py`los instrumentos:

- `run_star(agents, hub, question)` encuestas de cada trabajador, agregados.
- `run_chain(agents, question)` refinamiento secuencial.
- `run_tree(root, children, question)` jerárquico con agregación de profundidad-2.
- `run_graph(agents, question, rounds)`Debate general, rondas limitadas.
- Un dial de heterogeneidad con guión: cada agente tiene un `error_bias`que indique su error sistemático.
- Un arnés de medición que ejecuta cada topología en N=3, 5, 7 y informa (acurateza, total_tokens, wallclock_simulated).

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado esperado: una tabla de topología × N → (acurateza, tokens, latencia). El gráfico gana en N=3-5 en las tareas de estilo de investigación; la estrella gana en las tareas de hecho rápido; el gráfico en N=7 muestra el impuesto de coordinación (la latencia se infla más rápido que la precisión).

## Usalo

`outputs/skill-topology-picker.md`es una habilidad que lee una descripción de tarea y recomienda una topología (estrella / cadena / árbol / gráfico), un N (número de agentes), un perfil de heterogeneidad (modelos básicos para usar) y un límite redondo.

## Envío

Para cualquier conjunto:

- Comience con**self-consistency at N=5**El modelo base es el más barato.
- Actualización a **heterogeneous voting at N=3**Si la precisión importa, mide el delta.
- Sólo actualizar a **debate topology**si la tarea tiene estructura (investigación, múltiples pasos) y son factibles rondas limitadas.
- Siempre registren el grupo de minorías. Cuando una minoría está persistentemente en lo correcto, tienen una señal de diversidad.
- "Mejor precisión a 10 veces el costo" es una decisión comercial.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Trazar la curva de coordinación-taxa para la topología del gráfico: exactitud vs N, tokens vs N. ¿A qué N se inclina la curva?
2. Implementar A-HMAD: tres agentes con prejuicios deliberadamente diferentes. ¿Cómo se compara el mismo prejuicio de base con A-HMAD en el ataque de monocultura de la Lección 14?
3. Añadir un papel de "juzgador" a la topología del gráfico que no vota, sólo obtiene el consenso final. ¿Cambia esto el comportamiento de conformidad emergente?
4. En el artículo de AgenVerse (ICLR 2024) se indica qué comportamiento emergente muestra más fuerte su implementación. ¿Puede provocar el comportamiento opuesto mediante un cambio rápido?
5. Lea MultiAgentBench (arXiv:2503.01935) Sección 4 (experimentos topológicos). Reproduce el resultado de "grafo-ganas-investigación" en una tarea del papel utilizando su arnés.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-consistency | "Sample N times, vote" | Wang 2022. Single model, N temperature>0 samples, majority vote on reasoning paths. |
| Heterogeneity | "Different models" | Ensemble of different base models or prompt families. Breaks monoculture. |
| MAD | "Multi-agent debate" | Generic term for agents exchanging critiques over rounds. See Du 2023. |
| A-HMAD | "Adversarial Heterogeneous MAD" | MAD variant emphasizing different models + adversarial structure. |
| Topology | "Who talks to whom" | Star, chain, tree, graph. Determines information flow. |
| Coordination tax | "Diminishing returns" | Above ~4 agents on graph, cost grows faster than quality. |
| Volunteer behavior | "Unprompted help" | AgentVerse emergent pattern: an agent offers to take a step. |
| Conformity behavior | "Agreement under pressure" | AgentVerse emergent pattern: an agent aligns with a critic. |
| Jury | "Small specialized panel" | Sibyl-style ensemble with roles (examiner, context, scorer). |

## Leer más

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) Línea de base para un modelo único
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) ambos agentes y rondas son importantes de forma independiente
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) índice de referencia de topología que muestra el gráfico mejor para la investigación, cadena para las tuberías
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) Encuesta de estrategia de MAD; encuentra que la MAD a menudo pierde en la autoconsistencia con un presupuesto igual
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) patrones emergentes de voluntariado y de conformidad
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) Implementación de los índices de referencia
