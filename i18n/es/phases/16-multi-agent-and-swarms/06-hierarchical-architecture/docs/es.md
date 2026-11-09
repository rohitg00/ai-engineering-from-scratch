# La arquitectura jerárquica y su modo de fallar

> La jerarquía es supervisor anidado, agentes gerentes sobre subgerentes sobre trabajadores.`Process.hierarchical`es la versión del libro de texto: a `manager_llm`La función de la función de evaluación de las variables de trabajo es la de la función de evaluación de las variables de trabajo.`create_supervisor(create_supervisor(...))`. Es el patrón natural cuando la tarea es un organograma real. También es el patrón más probable que se desplome en un bucle de gestión.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern)
**Time:** ~60 minutes

## El problema

Una vez que el patrón de supervisor hace clic, el siguiente paso natural es "¿qué pasa si los trabajadores son supervisores?" Los equipos tienen sub-equipajes; las empresas tienen departamentos de departamentos.

El problema es que los gerentes de LLM no son lo mismo que los gerentes humanos. Un gerente humano tiene antecedentes estables sobre lo que sus informes saben. Un gerente de LLM vuelve a razonar la organización a cada paso desde lo que está en su contexto.

## Concepto

### La forma

```
                 Manager
                 ┌─────┐
                 └──┬──┘
           ┌────────┴────────┐
           ▼                 ▼
       Sub-Mgr A         Sub-Mgr B
       ┌─────┐           ┌─────┐
       └──┬──┘           └──┬──┘
         ┌┴──┬──┐          ┌┴──┐
         ▼   ▼  ▼          ▼   ▼
       W1  W2  W3         W4  W5
```

Cada nodo interno planea, delega y sintetiza.

### Donde brilla

- **Clear org mapping.**Si la tarea real es departamental ("revisión legal del documento, revisión financiera del documento, revisión de ingeniería del documento, luego resumen para ejecutivo"), la jerarquía es explícita.
- **Local summarization.**Cada sub- gerente sintetiza la producción de su equipo antes de que el gerente superior la vea.

### Donde se rompe

Tres modos de falla que los post mortem 2026 siguen encontrando:

1. **Task assignment error.**El gerente lee la meta, alucina una descomposición y delega a un sub-gerente equivocado. Debido a que el sub-gerente obedece a lo que se le dio, el error solo aparece en la síntesis superior.
2. **Output misinterpretation.**El subdirector devuelve "no puede verificar la reclamación X". El máximo gerente resume como "la reclamación X no confirmada". El significado deriva en todos los niveles.
3. **Consensus loops.**Dos subdirectores no están de acuerdo; el gerente superior les pide que se reconcilien; se re-delegan hacia abajo; los trabajadores vuelven a correr; los subdirectores devuelven respuestas ligeramente diferentes; bucle.`Process.hierarchical`El límite de la medida es un hiperparámetro.

### La cuestión decisiva

Secuenciales (linera) vs jerárquicos: ¿tiene su tarea sub-equipajes independientes o es un flujo lineal que finge ser un árbol?

### Implementación del marco de trabajo

El equipo de la tripulación `Process.hierarchical`El gerente:

- recibe la tarea de nivel superior,
- asigna subtareas a las tripulaciones,
- evalúa las producciones de la tripulación,
- decide si se acepta, se re-delega o se repite.

Documentación: https://docs.crewai.com/en/introduction(Buscar "Proceso jerárquico" en los conceptos centrales).

### Implementación del marco gráfico

LangGraph utiliza el anidado `create_supervisor`El supervisor interno tiene su propio gráfico; el supervisor externo trata el gráfico interno como un nodo opaco. Esto es más limpio que CrewAI para el depuración (puedes pasar por cada gráfico por separado) pero es más difícil expresar la remodelación dinámica del árbol.

Referencia: https://reference.langchain.com/python/langgraph-supervisor.

```figure
swarm-hierarchy-token
```

## Construye el mismo

`code/main.py`ejecuta una jerarquía de 3 niveles:

- gerente superior: divide una tarea en ramas "ingeniería" y "legal",
- Subdirector de ingeniería: se divide en trabajadores "frontend" y "backend",
- Subdirector legal: un trabajador.

Demo contrasta camino feliz (todos están de acuerdo) con un **perturbed path**donde la descomposición del gerente superior etiqueta erróneamente "legal" como "financiamiento" y observa la cascada de errores  el subgerente obedece a los trabajos financieros, el sintetizador superior informa los hallazgos financieros, la pregunta legal original queda sin respuesta.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La salida muestra ambos caminos con un lado a lado claro de "lo que se pidió" vs "lo que se entregó".

## Usalo

`outputs/skill-hierarchy-fitness.md`evalúa si una tarea dada debe utilizar un supervisor jerárquico, secuencial o plano. Ingresos: descripción de tareas, estructura de organizaciones, presupuesto de reconciliación.

## Envío

Si envías jerárquicos:

- **Cap tree depth at 2.**Tres niveles ya ocultan la mayoría de los errores de la observabilidad.
- **Explicit reconciliation budget.**Establezca un máximo de rondas antes de que el gerente superior se comprometa.
- **Provenance on every synthesis.**El resumen de cada nodo debe indicar qué salidas de hoja lo produjeron.
- **Alert on decomposition drift.**Registre la descomposición del administrador por paso; difiere de la consulta del usuario. Si la descomposición ya no cubre la consulta, active una alerta.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Cuántos niveles de entrega del gerente se necesitan antes de que la salida superior se desvíe completamente de la pregunta del usuario?
2. Añadir un tercer nivel (top → sub → sub → trabajador). Medir la frecuencia con la que el camino perturbado se corrige a sí mismo vs. diverge completamente a medida que crece la profundidad.
3. Implemente un trabajador "canario" en cada sub-administrador que siempre se le haga la pregunta original al usuario sin cambios. Utilice la respuesta canaria para detectar la deriva de descomposición. ¿Cómo debe reaccionar el administrador cuando el canario no está de acuerdo con la respuesta sintetizada?
4. Lea el artículo de CrewAI `Process.hierarchical`Documents. Identifique una barrera de seguridad de concreto que CrewAI aplica (limite de paso, restricción manager_llm) y describa el modo de falla al que se dirige.
5. Comparar los supervisores de LangGraph anidados con los jerárquicos de CrewAI. ¿Qué hace que los bucles de reconciliación sean más baratos de detectar?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hierarchical | "Org chart pattern" | Supervisors over supervisors; only leaves do work. |
| Manager LLM | "The boss" | The LLM that decomposes, assigns, and validates at an internal node. |
| Decomposition drift | "The boss lost the plot" | Top manager's split no longer covers the original question. |
| Reconciliation loop | "Endless meetings" | Sub-managers disagree; top re-delegates; workers re-run; loop until budget exhausted. |
| Depth-2 ceiling | "Don't go deeper than 2 levels" | Empirical guardrail: 3+ levels collapses observability. |
| Canary question | "Ground truth at every level" | A worker that is always asked the original query unchanged, to detect drift. |
| Provenance chain | "Who said what" | Trace from each synthesis back to the leaf outputs that produced it. |

## Leer más

- [CrewAI introduction — Process.hierarchical](https://docs.crewai.com/en/introduction) Manual jerárquico con un gerente LLM
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) supervisor en el cuadro de trabajo`create_supervisor`
- [Anthropic engineering — Research system](https://www.anthropic.com/engineering/multi-agent-research-system)¿Por qué Anthropic eligió deliberadamente a un supervisor plano sobre una jerarquía
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomía MAST; sección sobre fallos de coordinación documentación de descomposición deriva
