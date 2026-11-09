# Planificación con HTN y búsqueda evolutiva

> La planificación simbólica se ocupa de los casos en los que el plan es probada correcta. La búsqueda de código evolutivo se ocupa de los casos en los que la función de aptitud es verificable por máquina. ChatHTN (2025) y AlphaEvolve (2025) muestran lo que cada uno desbloquea cuando se empareja con un LLM.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 02 (ReWOO and Plan-and-Execute)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Explicar las redes jerárquicas de tareas: tareas, métodos, operadores, condiciones previas, efectos.
- Describa la búsqueda simbólica de circuito híbrido de ChatHTN con la descomposición de fallback de LLM.
- Explica el ciclo evolutivo de AlphaEvolve y por qué solo funciona con un evaluador programático.
- Implemente un planificador de juguete HTN más una búsqueda evolutiva de juguete en Stdlib.

## El problema

ReWOO (lección 02), Plan-and-Ejecute y ReAct cubren la mayoría de la planificación de agentes.

1. **Plans with provable correctness.**El programa, la ruta de vuelo, los flujos de trabajo de cumplimiento  el plan debe ser sólido por construcción.
2. **Optimizations with a machine-checkable fitness function.**La multiplicación de matrices, la planificación de heurísticas, los pasos del compilador  el objetivo no es "un plan correcto" sino "el mejor plan".

El plan de HTN y AlphaEvolve resuelven los dos problemas diferentes. Ambos usan LLM como amplificadores, no como reemplazos.

## El concepto

### Las redes jerárquicas de tareas

Una HTN es:

- **Tasks** Compuesto (para descomponerse) y primitivo (executable directamente).
- **Methods** formas de descomponer una tarea compuesta en subtareas, con condiciones previas.
- **Operators** acciones primitivas con condiciones previas y efectos.
- **State** un conjunto de hechos.

Planificación: dada una tarea objetivo y un estado inicial, encontrar una descomposición en operadores primitivos cuyas condiciones previas se cumplen en secuencia.

El HTN es más antiguo que los LLM y sigue siendo la referencia para los planes probadamente correctos.

### El objetivo de la investigación es mejorar la calidad de la información y la calidad de la información.

ChatHTN (arXiv:2505.11814) interlea HTN simbólico con las consultas de LLM:

1. Trate de descomponer la tarea compuesta actual con métodos existentes.
2. Si no se aplica ningún método, pregúntale al LLM: "cómo se descomponería `task`en el estado `s`¿Qué es eso?
3. Traducir la respuesta del LLM en subtareas candidatas.
4. Validación con respecto al esquema del operador; rechaza descomposiciones inválidas.
5. Recurso.

El documento afirma que cada plan producido es probada como válido porque las sugerencias de LLM sólo entran como descomposiciones candidatas, nunca como ediciones directas de planes.

Aprendizaje en línea de métodos (OpenReview `gwYEDY9j2x`, 2025 seguimiento) añade un alumno que generaliza las descomposiciones producidas por el LLM por regresión  recortando la frecuencia de consultas del LLM hasta el 75%.

### AlphaEvolve (Novikov y otros, 2025)

AlphaEvolve (arXiv:2506.13131, DeepMind, junio 2025) es una bestia diferente: búsqueda de código evolutivo orquestada por un conjunto Gemini 2.0 Flash / Pro.

- ¿Qué es eso ?

1. Comience con un programa de semillas + un evaluador programático (retorna una puntuación de aptitud).
2. El conjunto de LLM propone mutaciones.
3. Ejecutar las mutaciones a través del evaluador.
4. Mantenga lo mejor, mutar de nuevo.

Las ganancias publicadas:

- Primera mejora respecto a Strassen para la multiplicación de matrices complejas 4x4 en 56 años (48 multiplicaciones escalares).
- El 0,7% recuperó la computación de Google a través de una heurística de programación Borg.
- El 32% de la atención flash se acelera en una carga de trabajo fronteriza.

La difícil restricción: la función de aptitud debe ser controlada por máquina.

### Cuándo utilizar cuál

| Problem class | Use | Why |
|---------------|-----|-----|
| Scheduling with hard constraints | HTN + ChatHTN | Provable soundness |
| Compiler optimization | AlphaEvolve | Machine-checkable fitness |
| Multi-step task execution | ReAct / ReWOO | LLM in the loop, no formal guarantees |
| Code improvement with tests | AlphaEvolve | Tests are the evaluator |
| Policy-bound automation | HTN | Preconditions encode policy |

### Cuando este patrón va mal

- **HTN without operators.**Sin esquemas de precondisión/efecto, la afirmación de solidez se desmorona.
- **AlphaEvolve without a real evaluator.**"Pregúntele al LLM si el código es mejor" no es una función de aptitud.
- **Over-engineering.**La mayoría de las tareas de los agentes no necesitan ni una ni otra.

```figure
htn-tree-expand
```

## Construye el mismo

`code/main.py`Implementa dos juguetes:

- Un planificador de HTN de la serie con operadores, métodos, condiciones previas, efectos y una`LLMFallback`El LLM es un descomposición scripted para que el planificador se ejecute fuera de línea.
- Una búsqueda evolutiva de programas aritméticos: crecer expresiones cuya producción se minimiza `|f(x) - target|`El evaluador es determinista.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra al planificador HTN descomponer una tarea compuesta (con una caída de LLM en el plano medio) y el bucle evolutivo convergiendo en una expresión objetivo.

## Usalo

- **HTN planners**¿ Qué es esto ?`pyhop`¿ Qué ?`SHOP3`, o construir su propio para la aplicación de políticas específicas de dominio.
- **ChatHTN** código de investigación; el patrón (símbolo + LLM fallback) se porta limpio a cualquier planificador de HTN.
- **AlphaEvolve** Papel de DeepMind; el patrón (ensemble + evaluator) es reproducible. OpenEvolve y forks de código abierto similares están surgiendo.
- **Agent frameworks** no se envíe todavía HTN de primera clase o AlphaEvolve.

## Envío

`outputs/skill-hybrid-planner.md`genera un andamio de planificadores híbridos (HTN o evolutivo) con el rol de MLL explícitamente definido.

## Los ejercicios

1. Extensión del planificador de HTN con retroceso: cuando el postcondimiento del operador falla en el tiempo de ejecución, vuelva hacia atrás y pruebe el siguiente método.
2. Añadir un caché del método LLM a ChatHTN: cuando el LLM descompone la tarea `T`en el patrón del estado `P`Reverifique la biblioteca de métodos primero en la próxima llamada.
3. Cambiar el evaluador de búsqueda evolutiva a una suite de pruebas real. Desarrollar una función de clasificación que pasa 20 casos de prueba; reportar generaciones a convergencia.
4. Lea las notas de diseño de evaluadores de AlphaEvolve. Diseñe un evaluador para un dominio que le importe (optimización de consultas SQL, minimizado de la suite de pruebas, implementación YAML).
5. Combina: utiliza HTN para descomponer una tarea compuesta en subtareas, luego utiliza búsqueda evolutiva en el operador primitivo de cada subtarea. ¿Dónde brilla, dónde se sobreingeniera?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| HTN | "Hierarchical planner" | Task decomposition with operators, preconditions, effects |
| Method | "Decomposition rule" | Way to break a compound task into subtasks |
| Operator | "Primitive action" | Concrete step with precondition and effect |
| ChatHTN | "LLM + HTN" | Symbolic planner asks LLM when no method matches |
| AlphaEvolve | "Evolutionary code search" | Ensemble LLMs mutate code; deterministic evaluator selects |
| Fitness function | "Evaluator" | Deterministic, machine-checkable score over outputs |
| Online method learning | "Cached LLM decomposition" | Store + generalize LLM plans to cut query cost |

## Leer más

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814) Planificador híbrido de LLM
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) búsqueda de código evolutivo con mutaciones de LLM
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) cuándo alcanzar un planificador vs un simple bucle
