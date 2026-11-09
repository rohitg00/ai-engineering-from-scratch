# Agentes generativos y simulación emergente

> Park et al. 2023 (UIST '23, arXiv:2304.03442) poblada **Smallville**, una caja de arena de 25 agentes, con una arquitectura de tres partes: **memory stream**(registro de lenguaje natural), **reflection**(síntesis de nivel superior que el agente genera sobre su propio flujo), y **plan**(comportamiento a nivel diario, luego sub-planes). El resultado histórico fue la aparición de la fiesta del Día de San Valentín: un agente sembró con "quiere organizar una fiesta del Día de San Valentín", sin más guiones, produjo invitaciones distribuidas por la población, fechas coordinadas, y la fiesta sucedió  de 24 agentes que comenzaron sin saberlo. Las ablaciones muestran que los tres componentes son necesarios para la credibilidad. Los fallos documentados son errores de norma espacial (entrada en tiendas cerradas, compartido de baños para una sola persona). Esta es la arquitectura de referencia para las simulaciones de agentes y la evaluación social multi-agente en 2026.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## El problema

La mayoría de los sistemas multi-agentes son equipos estrictamente escritos: planes de planificadores, códigos de codificación, revisiones de revisores. Eso funciona para tareas bien definidas. No captura el comportamiento emergente y no scriptado que surge cuando los agentes tienen memoria, prioridades y un mundo abierto. La investigación, la simulación de la sociedad y la IA de juegos cada vez más necesitan este segundo tipo.

La arquitectura de Smallville es el punto de referencia para ello. Hasta Park 2023, las mejores simulaciones de agentes eran seguidores de guiones superficiales; después de eso, el patrón es el predeterminado para los agentes generativos en mundos abiertos. Si construyes una simulación de agentes en 2026, estás utilizando los tres componentes de Smallville o justificando explícitamente por qué no lo estás haciendo.

## Concepto

### Los tres componentes

**Memory stream.**Un registro de observaciones, acciones, reflexiones y planes solo en apéndice. Cada entrada tiene un sello de tiempo, un tipo, una descripción (lenguaje natural) y metadatos derivados: **recency**¿ Qué ?**importance**(auto-valorado entre 1 y 10 por el agente), y **relevance**(similaridad de cosina con la consulta actual).

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

La recuperación de memoria combina las tres puntuaciones: `score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`Las entradas de arriba-k ingresan en el aviso actual.

**Reflection.**Periódicamente (cada N recuerdos o en eventos importantes), el agente genera síntesis de orden superior de recuerdos recientes. Las entradas de reflexión vuelven al flujo y son recuperables como cualquier otra memoria. Así es como los agentes construyen "entendimientos"  el equivalente de la arquitectura de creencias a largo plazo.

**Plan.**Descomposición de arriba hacia abajo. Primero, un plan de día en grandes trazos ("ir al trabajo, cenar con Klaus"). Luego planes a nivel de hora. Luego planes a nivel de acción. Los planes son revisables: cuando una observación contradice un plan, el agente replania el segmento afectado.

### ¿Por qué importan las tres cosas (ablación)

Park et al. ejecutaron ablaciones dejando caer cada una de la observación, la reflexión y el plan.

- Sin ...**observation**El agente pierde el contexto y actúa sobre creencias obsoletas.
- Sin ...**reflection**El agente no puede formar creencias de orden superior; las interacciones permanecen superficiales.
- Sin ...**plan**El comportamiento se convierte en ruido reactivo; los objetivos se disipan.

Los puntajes de credibilidad de los evaluadores humanos son los más altos con los tres; bajar cualquiera produce una regresión medible.

### El día de San Valentín surge

Una agente, Isabella Rodríguez, es sembrada con el objetivo de "quiere organizar una fiesta de San Valentín en el Hobbs Cafe el 14 de febrero a las 5 pm".

1. El plan de Isabella incluye invitar a la gente.
2. Cada invitación se convierte en una observación en la memoria del vecino.
3. La reflexión de esa vecina genera creencias: "Isabella está dando una fiesta".
4. El plan del vecino incluye "asistir a la fiesta el 14 de febrero".
5. Los vecinos dicen a los demás vecinos.
6. A las 5 pm del 14 de febrero, varios agentes convergen en el Hobbs Cafe.

Este es el surgimiento en el sentido técnico: el comportamiento a nivel del sistema (una fiesta) surgió de las interacciones locales (invitaciones bilaterales + planificación individual) sin un orquestrador central.

### Los modos de falla documentados

Park et al. documentan explícitamente:

- **Spatial norm errors.**Los agentes entran en tiendas cerradas. Los agentes intentan usar el mismo baño individual. Los agentes comen en habitaciones no destinadas a comer. El modelo no deducen las normas sociales y físicas solo del medio ambiente.
- **Memory overflow.**Las simulaciones profundas causan un aumento en el costo de recuperación de la memoria.
- **Reflection hallucination.**Las reflexiones pueden inventar relaciones que no existen en el flujo de memoria.

Estos son modos de falla relevantes para la producción: cualquier simulación de agente 2026 los hereda.

### Reglas de ejecución de tres componentes

1. **Memory is append-only.**Nunca mute una entrada de memoria. Las correcciones son nuevas entradas.
2. **Importance scores are cheap.**Llame al LLM para que califique la importancia 1-10 al momento de escribir.
3. **Retrieval is ranked, not filtered.**Top-k por puntaje combinado; no utilice filtros duros (que pierden contexto).
4. **Reflection runs periodically.**Trigger cuando la suma de la importancia de los recuerdos sin procesar exceda un umbral (por ejemplo, 150).
5. **Plans are revisable.**Cuando una nueva observación contradice un plan, regenera sólo el segmento afectado, no todo el plan.

### Agentes generativos más allá de Smallville

La literatura de seguimiento 2024-2026 extiende la arquitectura:

- **Multi-agent social simulation for policy / market research.**Las poblaciones similares a Smallville simulan el comportamiento del usuario en respuesta a las características.
- **NPC AI for games.**Los juegos de rol con agentes de Smallville producen líneas de historia emergentes en lugar de misiones guionadas.
- **Generative-agent evaluation benchmarks.**En lugar de precisión de tarea, la métrica se convierte en credibilidad + coherencia de comportamiento en largos períodos.

La arquitectura es la referencia. las extensiones intercambian componentes (almacenamiento vectorial para la memoria, reflexión aumentada por recuperación, plan neurosímbolico) pero mantienen la estructura de tres partes.

### Por qué esto importa para la ingeniería multi-agente

Smallville es la prueba del concepto de que la aparición de múltiples agentes es barata cuando los componentes son correctos. La arquitectura se ha replicado ahora en modelos de código abierto (los LLM más pequeños pierden credibilidad con gracia, no agudamente).**emergent social behavior**Cualquier sistema que necesite**tight task execution**utiliza los patrones de supervisor / roles / primitivos de antes en esta fase.

```figure
a5-memory-reflection
```

## Construye el mismo

`code/main.py`Implementa los tres componentes en stdlib Python con políticas de agente scripted (sin LLM real).

- `MemoryStream` Registro de apéndice con recuperación de actualidad/importancia/relevancia.
- `reflect(stream)` Reflexión guionada sobre recuerdos recientes de gran importancia.
- `plan(agent_state)` Planes de día y hora basados en las creencias actuales.
- El guión: 5 agentes. El agente 1 comienza con "fiesta de lanzamiento a las 5 p.m". A través de tiques simulados, la invitación se propaga y los agentes convergen.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La producción esperada: rastreo de tick por tick. Al final, al menos 3 de los 5 agentes muestran al partido en su plan, y convergen en el lugar de la fiesta. La semilla única produjo la llegada coordinada sin ningún orquesta.

## Usalo

`outputs/skill-simulation-designer.md`diseña una simulación de agente generativo: número de agentes, esquema de memoria, cadencia de reflexión, horizonte de plan y métrica de evaluación.

## Envío

Reglas para las simulaciones de producción:

- **Memory is the database.**Elige una tienda real (vector DB, Postgres) en escala.
- **Log the retrieval trace.**Para cada acción, registra los recuerdos de la parte superior que lo impulsó.
- **Budget per-agent tokens.**El plan de cada agente para recoger + reflejar + plan por tick es $O(k)$Las llamadas de LLM. N agentes × T ticks × llamadas por tick pueden enarmar su presupuesto.
- **Compact memory periodically.**Resumen y recorte de poca importancia. La política de retención es una decisión de diseño, no un detalle.
- **Detect spatial / social norm violations**La arquitectura no las aprende.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar que 3+ agentes convergen en la fiesta. ¿Aumentar a 10 ?
2. ¿Cómo se ve el comportamiento? Mapa de la conclusión de ablación en Park 2023.
3. Introducir un objetivo semillado en competencia ("Klaus quiere dar una charla de investigación a las 5 pm"). ¿Se dividen los agentes o domina un objetivo? ¿Qué lo determina?
4. Añadir restricciones espaciales: Hobbs Cafe tiene un máximo de 4 agentes. ¿El manejo de simulación se desbordará con gracia, o se encuentra en el patrón de falla del "baño de una sola persona"?
5. Leer Park et al. (arXiv:2304.03442) Sección 6 (experimentos de comportamiento emergente). Identifique un comportamiento no reproducible en su miniatura. ¿Qué componente de la arquitectura necesitaría mejorar?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory stream | "The agent's diary" | Append-only log of observations, actions, reflections, plans. |
| Recency | "How new is the memory" | Exponential-decay score by age. |
| Importance | "How much does the agent care" | Self-rated 1-10 at write time. Cached. |
| Relevance | "How related to the current query" | Cosine similarity (embedding-based). |
| Reflection | "Higher-order belief" | Synthesis generated from recent memories, re-ingested as a new memory. |
| Plan | "Day/hour/action decomposition" | Top-down plan tree. Revisable when observations contradict. |
| Smallville | "Park 2023's sandbox" | 25-agent simulation that produced the Valentine's Day emergence. |
| Believability | "The quality metric" | Human-rater score for whether behavior seems like a plausible agent. |

## Leer más

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) la arquitectura de referencia
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763) Lugar de publicación
- [Smallville code release](https://github.com/joonspk-research/generative_agents) implementación de referencia de Python
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) Arte previo para agentes de memoria estructurada
