# Reflexión: Aprendizaje con el refuerzo verbal

> La RL basada en gradientes necesita miles de pruebas y un grupo de GPU para arreglar un modo de falla. Reflexion (Shinn et al., NeurIPS 2023) lo hace en lenguaje natural: después de cada ensayo fallido, el agente escribe una reflexión, la almacena en la memoria episódica y condiciona el siguiente ensayo en esa memoria. Este es el patrón detrás de la computación del tiempo de sueño de Letta, los aprendizajes de Claude Code en CLAUDE.md y la regla de aprendizaje pro-flujo de trabajo.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 02 (ReWOO)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre los tres componentes de la Reflexión (Actor, Evaluador, Auto-Reflector) y el papel de la memoria episódica.
- Implemente un bucle de reflexión stdlib con evaluador binario, buffer de reflexión y nuevos intentos de repetición.
- Elija entre fuentes de retroalimentación escalares, heurísticas y autoevaluaciones para una tarea dada.
- Explica por qué el refuerzo verbal capta errores que la RL basada en gradientes necesitaría miles de ensayos para corregir.

## El problema

Un agente falla una tarea. En RL estándar se ejecutarían miles de pruebas más, calcularían gradientes, actualizarían pesas.

La reflexión (Shinn et al., arXiv:2303.11366) hace una pregunta diferente: ¿qué pasa si el agente acaba de pensar en por qué falló y intentó de nuevo con ese pensamiento en su prompt?

El resultado: en ALFWorld supera a ReAct y otras líneas de base no afinadas. En HotpotQA mejora sobre ReAct. En la generación de código (HumanEval / MBPP) establece el estado de la técnica en el momento. Todo sin un solo paso de gradiente.

## El concepto

### Los tres componentes

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

Además de una estructura de datos:

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

Un ensayo se ejecuta en el Actor. El evaluador lo califica. Si la puntuación es baja, el Auto-Reflector produce una reflexión ("Elegí la herramienta equivocada porque mal leí la pregunta como preguntando sobre X cuando estaba preguntando sobre Y").

### Tres tipos de evaluadores

1. **Scalar** una señal binaria externa. ALFWorld tiene éxito o falla. HumanEval pasa o falla.
2. **Heuristic** firmas de falla predefinidas. "Si el agente produjo la misma acción dos veces seguidas, marque como atascado". "Si la trayectoria excede de 50 pasos, marque como ineficiente".
3. **Self-evaluated** el LLM obtiene su propia trayectoria. Necesitada cuando no hay ninguna verdad básica disponible.

El 2026 por defecto es una mezcla: escalar cuando está disponible, autoeval cuando no, heurísticas como carriles de seguridad.

### ¿Por qué esto generaliza

La reflexión no es un nuevo algoritmo sino un patrón nombrado.

- Computación del tiempo de sueño de Letta (lección 08): un agente separado reflexiona sobre conversaciones pasadas y escribe a los bloques de memoria.
- El código de Claude `CLAUDE.md`/ patrón de "salvar memoria": reflejos capturados como aprendizajes, prependidos para futuras sesiones.
- Pro-flujo de trabajo `/learn-rule`comando: correcciones capturadas como reglas explícitas.
- Los nodos de reflexión de LangGraph: un nodo que califica la salida y las rutas para refinar si es necesario.

Todos derivan de la misma visión: el lenguaje natural es un medio lo suficientemente rico como para llevar "lo que aprendí del fracaso" entre carreras.

### Cuando funciona y cuando no funciona

La reflexión funciona cuando:

- Hay una señal clara de falla (fallo de prueba, error de herramienta, respuesta incorrecta).
- La clase de tareas es reproducible (el mismo tipo de pregunta puede ser repetida).
- La reflexión tiene margen para mejorar la trayectoria (presupuesto de acción suficiente).

La reflexión no ayuda cuando:

- El agente ya tiene éxito en el primer intento.
- El fallo es externo (red baja, herramienta rota)  la reflexión sobre "la red estaba baja" no ayuda a futuras ejecuciones.
- La reflexión se convierte en superstición  almacenando una narrativa sobre una carrera escamosa única.

2026 trampa: rotura de la memoria. Las reflexiones se acumulan; algunas son obsoletas o incorrectas; las re-runs se vuelven más lentas a medida que crece el amortiguador episódico. Mitigation: compactación periódica (lección 06), TTL en las reflexiones, o un agente de limpieza separado del tiempo de sueño (Letta).

```figure
react-trace
```

## Construye el mismo

`code/main.py`El actor emite listas de candidatos; el evaluador verifica la suma; el autorreflector escribe una línea sobre lo que salió mal. La reflexión entra en la memoria episódica para el próximo ensayo.

Componentes:

- `Actor` una política guionada que mejora cuando ve reflejos.
- `Evaluator.binary()` Pasar/fallar en la suma objetivo.
- `SelfReflector` genera un diagnóstico de falla de línea única.
- `EpisodicMemory` una lista limitada con semántica TTL.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra tres ensayos. El ensayo 1 falla, se almacena un reflejo, el ensayo 2 ve el reflejo y mejora pero aún falla, el ensayo 3 tiene éxito. Compare con una carrera de base (sin reflejo)  se queda atascado en la respuesta del ensayo 1.

## Usalo

LangGraph envía la reflexión como un patrón de nodos.`/memory`de comando y de flujo de trabajo pro `/learn-rule`El equipo de cálculo de tiempo de sueño de Letta ejecuta el autorreflector en tiempo de inactividad para que el agente principal permanezca limitado a la latencia. OpenAI Agents SDK no envía Reflexion directamente; lo construye con un Guardrail personalizado que rechaza las trayectorias por puntaje y memoria.`Session`que sobrevive a través de las corrientes.

## Envío

`outputs/skill-reflexion-buffer.md`crea y mantiene un amortiguador episódico con captura de reflejos, TTL y deduplicación. Dada una clase de tareas y un fracaso, emite un reflejo que realmente ayuda al siguiente ensayo (no un genérico "ten más cuidado").

## Los ejercicios

1. Cambiar de evaluador binario a evaluador escalar que devuelve una métrica de distancia (qué tan lejos de la meta). ¿Converge más rápido?
2. Añadir un TTL de 10 pruebas a las reflexiones. ¿Las reflexiones más viejas hacen daño o ayudan después de ese punto?
3. Implementar evaluador heurístico: marque el ensayo como atascado si se repite la misma acción. ¿Cómo interactúa esto con el autorreflector?
4. ¿Cuál es la ingeniería mínima de la reflexión que obliga al actor a notarlas?
5. Leer la sección 4 del artículo Reflexion sobre AlfWorld. Reproduce el aumento del 130% de la tasa de éxito conceptualmente: ¿cuál es la clave delta vs. vanilla ReAct?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Reflexion | "Self-correction" | Shinn et al. 2023 — Actor, Evaluator, Self-Reflector plus episodic memory |
| Verbal reinforcement | "Learning without gradients" | Natural-language reflection prepended to the next trial's prompt |
| Episodic memory | "Per-task reflections" | Bounded buffer of prior reflections for one task class |
| Scalar evaluator | "Binary success signal" | Pass/fail or numeric score from ground truth |
| Heuristic evaluator | "Pattern-based detector" | Predefined failure signatures (e.g. stuck-loop, too-many-steps) |
| Self-evaluator | "LLM-as-judge on own trace" | Lower-signal fallback when no ground truth — pair with tool-grounded verification |
| Memory rot | "Stale reflections" | Episodic buffer fills with obsolete entries; fix with compaction/TTL |
| Sleep-time reflection | "Async self-reflection" | Run Self-Reflector off the hot path so primary agent stays fast |

## Leer más

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) el papel canónico
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) reflejo de asíncrono en la producción
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) Gestión del amortiguador episódico como parte del contexto
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) patrón de nodo de reflexión
