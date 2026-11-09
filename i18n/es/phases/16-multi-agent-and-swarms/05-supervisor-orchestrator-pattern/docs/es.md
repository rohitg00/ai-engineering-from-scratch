# Modelo de supervisor / orquesta-trabajador

> Un agente principal planea y delega; los trabajadores especializados ejecutan en contextos paralelos y informan. Este es el patrón detrás del sistema de investigación de Anthropic (Claude Opus 4 como plomo, Sonnet 4 como subagentes), medido en +90.2% sobre el Opus 4 de un solo agente en evaluaciones internas de investigación. El post de ingeniería de Anthropic informa que el 80% de la variación en BrowseComp se explica por el uso de tokens solo  multi-agente gana en gran medida porque cada subagente obtiene una nueva ventana de contexto. Esta lección construye el patrón de supervisor desde los primitivos y cubre las lecciones de ingeniería de 2026 de las implementaciones de producción.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## El problema

La investigación es la tarea prototipada que fallan los sistemas de agente único. Se pregunta "¿qué cambió en los sistemas de agentes múltiples entre 2023 y 2026?" Un agente único lee cinco artículos secuencialmente, llena la mitad de su contexto con su texto, y luego tiene que razonar sobre todos ellos juntos. Olvida el primer documento cuando llega al quinto. No puede paralelalizar.

El patrón de supervisor corrige esto: un agente principal planifica la búsqueda, delega cada subcuestión a un trabajador y la sintetiza. Cada trabajador obtiene su propia ventana de 200k-token para una pregunta estrecha. El líder nunca ve los papeles en bruto  sólo los resúmenes de los trabajadores.

El sistema de investigación de producción de Anthropic informa +90.2% sobre evaluaciones internas de investigación frente a un solo Opus 4.

## Concepto

### El patrón

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

El plomo nunca lee las materias primas. Los trabajadores nunca ven el trabajo del otro hasta que el plomo se sintetiza. Cada flecha es una entrega con un artefacto estrecho.

### Por qué gana

Tres mecanismos:

1. **Fresh context per subagent.**Un trabajador que explora "FIPA-ACL herencia" no lleva los 40k tokens que el plomo gastó planificación.
2. **Specialization via prompt.**El consejo del líder es "descompone y sintetize", no "investigue". El consejo de cada trabajador es estrecho: "Encuentra lo que ha cambiado en X". Los consejos enfocados producen resultados enfocados.
3. **Parallelism.**Los trabajadores funcionan simultáneamente.`max(worker_times) + plan + synthesis`No , no .`sum(worker_times)`¿ Qué ?

### Lecciones de ingeniería (antrópica 2025)

El post Anthropic enumera varias lecciones de producción que aún son relevantes para 2026:

- **Scale effort to query complexity.**Las consultas simples: un agente, 3-10 llamadas de herramientas. Las consultas complejas: 10+ agentes. El líder debe estimar esto, no el que llama.
- **Broad then narrow.**Descompón primero en subcuestiones amplias, luego despole más trabajadores por subcuestión si la respuesta justifica profundidad.
- **Rainbow deployments.**Los agentes son duraderos y de estado. El verde azul tradicional no funciona. Anthropic utiliza arco iris: el lanzamiento gradual de nuevas versiones mientras las viejas se agotan.
- **Token usage dominates.**Multi-agente es ~ 15 × los tokens de un agente único. Sólo ejecutarlo cuando el valor de la tarea justifica el costo.

### El giro nativo del gráfico

LangGraph originalmente envió un `langgraph-supervisor`biblioteca con un alto nivel `create_supervisor`En el año 2025 LangChain cambió la recomendación a implementar el patrón de supervisor a través de llamadas a herramientas directamente, porque las llamadas a herramientas dan más control sobre lo que el supervisor ve* (ingeniería de contexto).

### Los modos de falla

- **Lead hallucinates the plan.**Si el plomo genera subcuestiones que no descomponen la verdadera pregunta, los trabajadores hacen investigaciones precisas sobre el objetivo equivocado.
- **Workers over-explore.**Sin límites explícitos de alcance, los trabajadores se desplazan más allá de su subcuestión asignada y contaminan el paso de síntesis.
- **Synthesis conflicts.**Dos trabajadores devuelven hechos contradictorios. El líder debe volver a preguntar (agrega una ronda) o notar el desacuerdo explícitamente.

### Cuando el supervisor está equivocado

- **Sequential tasks.**Si el paso 2 necesita literalmente la salida del paso 1, el paralelismo no compra nada.
- **Simple queries.**El agente único los maneja más rápido y más barato.
- **Strict determinism.**El supervisor utiliza delegación seleccionada por el LLM. Los gráficos estáticos son mejores cuando la auditoría / reproducción es más importante que la adaptabilidad.

```figure
supervisor-hierarchy
```

## Construye el mismo

`code/main.py`Implementa un supervisor de tres trabajadores paralelos utilizando `threading`. El plomo descomponen una consulta en subcuestiones, los trabajadores se ejecutan simultáneamente en cada subcuestión y el plomo se sintetiza.

La estructura clave:

- `Lead.plan(query)`Se divide una consulta en 3 subpreguntas.
- `Worker.run(sub_q)`devuelve un resumen falso (podría ser cualquier agente que utilice herramientas en la producción).
- `Lead.run(query)`despide a los trabajadores en hilos, juntas y sintetizas.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La salida muestra el plan, los rastros de trabajadores paralelos con sellos de tiempo de inicio/finales y la síntesis final.

## Usalo

`outputs/skill-supervisor-designer.md`toma una consulta del usuario y produce un diseño de patrón supervisor: el prompt del sistema principal, los roles de los trabajadores, las reglas de descomposición de la subcuestión y la plantilla de síntesis.

## Envío

Lista de verificación antes de desplegar un patrón de supervisión:

- **Model pairing.**El plomo en un modelo de razonamiento (clase Opus, `o3`Los trabajadores de un modelo más rápido y más barato (Sonnet, `o4-mini`¿Qué es lo que se hace?
- **Worker timeout.**Cualquier trabajador que exceda el tiempo de ejecución medio de 2 veces es asesinado; el plomo o reaparece con un alcance más estrecho o procede sin él.
- **Token cap per worker.**El límite duro (por ejemplo, 10 veces la entrada de síntesis esperada) evita que un trabajador huye del presupuesto.
- **Observability.**Trazar el plan del líder, las llamadas de herramientas de cada trabajador y la síntesis. Esta es la base para cualquier depuración post-hoc.
- **Rainbow rollout.**Los agentes de larga duración del estado necesitan una transición gradual de versión, no un intercambio caliente.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`, luego modificar el plomo para generar 5 trabajadores en lugar de 3. Observe el efecto del reloj de la pared. ¿En qué número de trabajadores el gasto general de generar supera los ahorros paralelos en esta demostración?
2. Implementar un tiempo de espera para los trabajadores: matar a cualquier trabajador que corra más de 0,5 segundos y hacer que el plomo sintetice los resultados restantes. ¿Qué observabilidad necesita para saber que un trabajador fue cortado?
3. Si dos trabajadores devuelven respuestas contradictorias, el líder nota el desacuerdo en lugar de elegir uno. ¿Cómo detectas la contradicción sin llamar a un LLM?
4. Lea el artículo de ingeniería de sistemas de investigación de Anthropic.
5. Comparar las de LangGraph `create_supervisor`¿Qué te da un mejor control sobre lo que ve el supervisor? ¿Por qué Anthropic pasa explícitamente sólo sub-respuestas y no contexto de trabajadores en síntesis?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor | "Lead agent" | An orchestrator agent that plans, delegates, and synthesizes. Does not do the work itself. |
| Worker | "Subagent" | A focused agent invoked by the supervisor with narrow scope and its own context window. |
| Orchestrator-worker | "Supervisor pattern" | Same thing, different name. The 2026 literature uses both. |
| Fresh context | "Clean window" | A worker's context starts from its system prompt and assigned question, not the lead's history. |
| Rainbow deployment | "Gradual rollout" | Long-running stateful agents need versioned drain-and-replace, not blue-green. |
| Token dominance | "Context is the variable" | 80% of research-eval variance comes from total tokens used, not model choice, per Anthropic. |
| Scale effort | "Match agent count to complexity" | Lead estimates query difficulty, spawns 1 vs 10+ workers accordingly. |
| Synthesis conflict | "Workers disagree" | Two workers return contradictory facts; the lead must surface disagreement, not silently pick one. |

## Leer más

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) la referencia de producción para el patrón de supervisión
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) el supervisor de llamadas de herramientas es ahora el formulario recomendado
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) el auxiliar heredado, todavía utilizado en la producción de 2026
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) Variante de supervisor basada en la transferencia
