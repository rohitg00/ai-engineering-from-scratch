# ReWOO y Planificación y ejecución: Planificación desacoplada

> ReAct intercalara el pensamiento y la acción en un flujo. ReWOO los separa: un plan grande por delante, luego ejecutar. 5 veces menos tokens, +4% de precisión en HotpotQA, y se puede destilar el planificador en un modelo 7B. Plan-and-Ejecutar lo generalizó; Plan-and-Act lo escalaron a la navegación web.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Explica por qué la división Planner / Worker / Solver de ReWOO ahorra tokens y mejora la robustez sobre el bucle intercaído de ReAct.
- Implementar un plan DAG, un ejecutor de orden de dependencia y un solver que compone las salidas de trabajador  todos stdlib.
- Decidir cuándo una tarea debe ejecutarse como plan-then-execute vs. ReAct intercalados, utilizando el marco de 2026 "cinco patrones de flujo de trabajo" (Antropic).
- Reconocer cuándo se necesitan los datos de los planes sintéticos de Plan-and-Act para tareas web o móviles de largo horizonte.

## El problema

El ciclo de observación de pensamiento-acción-observación intercalados de ReAct es simple y flexible, pero cada llamada de herramienta tiene que llevar el contexto previo completo  incluyendo cada pensamiento anterior. El uso de tokens crece cuadráticamente con la profundidad. Peor: cuando una herramienta falla en medio del ciclo, el modelo tiene que derivar de nuevo todo el plan de la observación de errores.

ReWOO (Xu et al., arXiv:2305.18323, mayo 2023) notó esto y hizo una apuesta: planear todo de antemano, buscar evidencia en paralelo, componer la respuesta al final. Una llamada de LLM a planificar, N herramienta pide evidencia (puede ser paralelo), una llamada de LLM a resolver. El comercio es menos flexible (el plan es estático) para una mayor eficiencia de tokens y modos de fracaso más claros.

## El concepto

### Los tres papeles

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planner produce un DAG. Cada nodo nombra una herramienta, sus argumentos y de qué nodos anteriores depende (referencias como `#E1`¿ Qué ?`#E2`Los trabajadores ejecutan los nodos en orden topológico.

### ¿Por qué 5 veces menos tokens?

ReAct crece la longitud del momento linealmente con el recuento de pasos. En el paso 10, el momento contiene pensamiento 1 más acción 1 más observación 1 más pensamiento 2 más acción 2 más observación 2, etc. Cada paso intermedio también incluye redundantemente el momento original.

ReWOO paga un planador de instrucciones (gran), N de trabajadores pequeños (cada uno sólo la llamada de herramienta, sin cadena), y un solver de instrucciones.

### Por qué es más robusto

Si el trabajador 3 falla en ReAct, el bucle tiene que razonar fuera del error en medio del flujo. En ReWOO, el trabajador 3 devuelve una cadena de error; el solucionador lo ve en contexto con el plan original y puede degradar con gracia. La localización del fallo es por nodo, no por paso.

### Destilación de planificadores

El segundo resultado del artículo: debido a que el planificador no ve observaciones, se puede ajustar un modelo 7B en las salidas del planificador de un maestro 175B. El modelo pequeño maneja la planificación; el modelo grande no es necesario en la inferencia. Esto es ahora estándar  muchos agentes de producción 2026 usan un planificador pequeño y un ejecutor grande o viceversa.

### Plan y ejecución (2023)

El post de agosto de 2023 del equipo de LangChain generalizó ReWOO en un nombre de patrón: Plan-and-Ejecute. El planificador de adelanto emite una lista de pasos, el ejecutor ejecuta cada paso, un replanificador opcional puede revisar después de observar los resultados. Esto es más cercano a ReAct que ReWOO (el replanificador trae las observaciones de nuevo a la planificación) pero conserva los ahorros de tokens.

### Plan y Acta (Erdogan et al., arXiv:2503.09572, ICML 2025)

Plan-and-Act escala el patrón a agentes web y móviles de largo horizonte. La contribución clave son los datos de planes sintéticos: un generador de trayectoria etiquetado produce datos de entrenamiento donde el plan es explícito. Se utiliza para ajustar a los modelos de planificador que siguen trabajando más allá de 3050 pasos en tareas similares a WebArena donde una sola trayectoria de ReAct pierde coherencia.

### ¿Cuándo elegir cuál

| Pattern | When |
|---------|------|
| ReAct | Short tasks, unknown environment, need reactive exception handling |
| ReWOO | Structured tasks with known tools, token-sensitive, parallelizable evidence |
| Plan-and-Execute | Like ReWOO but with replanning after partial execution |
| Plan-and-Act | Long-horizon (>30 steps), web/mobile/computer-use |
| Tree of Thoughts | Search is worth paying for (Lesson 04) |

Guía de Anthropic de diciembre 2024: comience con lo más simple. Si la tarea es una llamada de herramienta más un resumen, no construya ReWOO. Si la tarea es una tarea de investigación de 40 pasos, no haga ReAct solo.

```figure
rewoo-plan
```

## Construye el mismo

`code/main.py`Implementa un juguete ReWOO:

- `Planner` una política guionada que emite un plan DAG desde una solicitud.
- `Worker` Envía la llamada de herramienta de cada nodo a través del registro.
- `Solver` Compuesto escrito que lee pruebas y produce una respuesta final.
- Resolución de dependencia  referencias como `#E1`se sustituyen por resultados de trabajadores anteriores.

La demostración responde a "Cuál es la población de la capital de Francia, redondeada a millones?" utilizando un plan de dos pasos: (1) buscar la capital, (2) buscar la población, y luego resolver.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra el plan completo primero, luego los resultados del trabajador, luego la composición del solver. Comparar el recuento de tokens (imprimiremos un recuento de caracteres aproximado) con una ejecución interleaved de estilo ReAct  ReWOO gana en este tipo de tarea estructurada.

## Usalo

LangGraph envía Plan-and-Execute como receta (`create_react_agent`Para ReAct, gráficos personalizados para ejecutar el plan). Los flujos de CrewAI codifican el patrón directamente: se definen las tareas de antemano y el Flow DAG las ejecuta.

## Envío

`outputs/skill-rewoo-planner.md`genera un plan DAG de ReWOO a partir de una solicitud del usuario, dado un catálogo de herramientas. Valida el plan (acíclico, cada referencia resuelta, cada herramienta existe) antes de entregarlo a un ejecutor.

## Los ejercicios

1. Paralelamente ejecución de trabajadores para nodos de plan independientes. ¿Qué te compra en un DAG de 6 nodos con 2 grupos paralelos?
2. Añadir un nodo de replanificación que se dispara si algún trabajador devuelve un error. ¿Cuál es el menor cambio en ReWOO que lo hace Plan-and-Ejecute?
3. Reemplazar`Planner`con un modelo pequeño (clase 7B) y mantener `Solver`¿Cuál es el resultado de la división?
4. Leer la sección 4 del documento de ReWOO sobre la destilación de planificadores.
5. Portar el juguete a la forma de trayectoria de Plan-y-Act: plan es una secuencia, no un DAG. ¿Qué compensaciones cambian?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ReWOO | "Reasoning without observations" | Plan, then fetch evidence in parallel, then solve — no observations in the planning prompt |
| Plan-and-Execute | "LangChain's plan-execute pattern" | ReWOO with an optional replanner node after execution |
| Plan-and-Act | "Scaled plan-execute" | Explicit planner/executor split with synthetic plan training data for long-horizon tasks |
| Evidence reference | "#E1, #E2, ..." | Plan-node placeholder substituted with prior worker output at dispatch time |
| Planner distillation | "Small planner, big executor" | Fine-tune a small model on planner traces from a large teacher |
| Token efficiency | "Fewer round trips" | 5x fewer tokens on HotpotQA vs ReAct in the paper |
| DAG executor | "Topological dispatcher" | Runs plan nodes in dependency order; parallel at each level |

## Leer más

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) el papel canónico
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) planificador ejecutor a escala con planes sintéticos
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) la receta marco
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) Elige el patrón más simple que funcione
