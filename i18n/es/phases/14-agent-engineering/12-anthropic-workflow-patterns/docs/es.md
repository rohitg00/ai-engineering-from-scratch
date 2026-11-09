# Los patrones de flujo de trabajo de Anthropic: sencillos y complejos

> Schluntz y Zhang (Anthropic, Dec 2024) distinguen los flujos de trabajo (caminos predefinidos) de los agentes (uso de herramientas dinámicas).

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre de los cinco patrones de flujo de trabajo de Anthropic: cadena de respuesta, enrutamiento, paralelalización, orquesta-trabajadores, evaluador-optimizador.
- Explica la distinción entre el flujo de trabajo y el costo de ingeniería de cada uno.
- Identificar cuándo elegir un flujo de trabajo en lugar de un agente (y viceversa).
- Implementar los cinco patrones en el STDlib contra un LLM con guión.

## El problema

Los equipos buscan marcos multiagentes para problemas que requieren una sola llamada de función. El costo es real: los marcos añaden capas que oscurecen las instrucciones, ocultan el flujo de control e invitan a la complejidad prematura.

## El concepto

### Flujos de trabajo contra agentes

- **Workflow.**Los LLM y las herramientas orquestadas a través de caminos de código predefinidos.
- **Agent.**Los LLM dirigen dinámicamente sus propias herramientas y toman sus propios pasos.

Los agentes desbloquean problemas sin fin, pero hacen que los modos de falla sean más difíciles de razonar.

### El LLM aumentado

Fundamento para los cinco patrones: un LLM con tres capacidades conectadas en  búsqueda (recuperar), herramientas (acciones), memoria (persistencia).

### Los cinco patrones

1. **Prompt chaining.**La salida de llamada 1 es la entrada a llamada 2. Se utiliza cuando una tarea tiene una descomposición lineal limpia. Puertas programáticas opcionales entre pasos.

2. **Routing.**Un LLM clasificador elige qué LLM o herramienta a invocar.

3. **Parallelization.**Se ejecutan N LLM llamadas simultáneamente, resultados agregados. Dos formas: sección (parcelaciones diferentes) y votación (el mismo prompt, N ejecutan, mayoría/síntesis).

4. **Orchestrator-workers.**Un LLM orquestador decide dinámicamente qué trabajadores (también LLM) ejecutar y sintetiza su producción.

5. **Evaluator-optimizer.**Un LLM propone una respuesta, otro LLM la evalúa. Iterar hasta que el evaluador pasa. Esto es auto-refinado (lección 05) generalizado.

### Donde los flujos de trabajo vencen a los agentes

- **Predictable tasks.**Si puedes enumerar los pasos, deberías.
- **Cost-bound tasks.**Los flujos de trabajo tienen un número limitado de pasos; los agentes pueden espiral.
- **Compliance-bound tasks.**Los auditores quieren leer el gráfico, no deducirlo a partir de las trayectorias.

### Donde los agentes superan los flujos de trabajo

- **Open-ended research.**Cuándo el siguiente paso depende de lo que el último paso regresó.
- **Variable-length tasks.**Minutos a horas de trabajo donde el número de pasos es desconocido.
- **Novel domains.**Cuando aún no conozcas el flujo de trabajo correcto, primero explora, codifica después.

### El acompañante de ingeniería de contexto

"Ingeniería de contexto eficaz para agentes de IA" (Antropic 2025) formaliza la disciplina adyacente: la ventana 200k es un presupuesto, no un contenedor. Qué incluir, cuándo compactar, cuándo dejar crecer el contexto. Cuberto en detalle en la lección de Fase 14 sobre compresión de contexto (Fase 14 lección 06 anterior en este currículo antes de la renumeración).

```figure
workflow-chain
```

## Construye el mismo

`code/main.py`Implementa los cinco patrones de flujo de trabajo en contra de un `ScriptedLLM`¿Qué es esto ?

- `prompt_chain(input, steps)` secuencial.
- `route(input, classifier, handlers)` Clasificación + expedición.
- `parallel_vote(prompt, n, aggregator)` N carreras, agregado.
- `orchestrator_workers(task, workers)` Orquestación elige trabajadores.
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` bucle hasta el paso.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Cada patrón imprime su rastro. El total de líneas de código por patrón es de ~10-15; el costo de un marco se mide en miles.

## Usalo

- La API directa requiere la mayoría de las tareas.
- Marco sólo cuando el patrón realmente necesita estado duradero (LangGraph), concurrencia actor-modelo (AutoGen v0.4), o plantilla de rol (CrewAI).
- Busca el SDK de Claude Agent cuando quieras la forma del arnés de código Claude sin reconstruirlo.

## Envío

`outputs/skill-workflow-picker.md`elige el patrón adecuado para una descripción de tarea dada, incluida la razón de decisión y el camino de refactor hacia un agente si los flujos de trabajo no son suficientes.

## Los ejercicios

1. Implementar el enrutamiento con un umbral de confianza. Por debajo del umbral -> escala a humano. ¿Dónde aterriza el umbral para un caso de uso de soporte de nivel 1?
2. Añadir un tiempo de descanso a `parallel_vote`¿Qué pasa cuando se hace una llamada? ¿Cómo se agrega con los votos faltantes?
3. - ¿ Qué ?`evaluator_optimizer`en un bandido: mantener las salidas de 2 en las iteraciones para que un resultado bueno tardío no sea superado por uno malo tardío.
4. Combine la cadena de prompto con el enrutamiento: un router elige una de las tres cadenas. Medir el costo de los tokens frente a una sola alternativa de gran prompto.
5. Elige una de tus características de producción, dibuja el gráfico del flujo de trabajo, cuenta los pasos. ¿Sería mejor un agente aquí?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Workflow | "Predefined flow" | Engineer-owned graph of LLM and tool calls |
| Agent | "Autonomous AI" | Model-owned graph; dynamic tool direction |
| Augmented LLM | "LLM with tools" | LLM + search + tools + memory; the atomic unit |
| Prompt chaining | "Sequential calls" | Output of call N is input to call N+1 |
| Routing | "Classifier dispatch" | Pick which chain/model handles the input |
| Parallelization | "Fan out" | N concurrent calls; aggregate by sectioning or voting |
| Orchestrator-workers | "Dispatcher agent" | Orchestrator LLM picks specialist LLMs dynamically |
| Evaluator-optimizer | "Proposer + judge" | Iterate until evaluator passes; Self-Refine generalized |

## Leer más

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) los cinco patrones de flujo de trabajo
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) la disciplina del compañero
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) cuando los gráficos estatales ganan su costo
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) el patrón de orquesta­dor-trabajadores, producido
