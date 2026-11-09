# Teoría de la mente y coordinación emergente

> Li et al. (arXiv:2310.10701) mostraron que los agentes de LLM en una exposición de juego de texto cooperativa **emergent high-order Theory of Mind**(ToM)  razonamiento sobre lo que otro agente cree sobre las creencias de un tercer agente  pero falla en la planificación de largo horizonte debido a la gestión del contexto y alucinación. Riedl (arXiv:2510.05174) midió la sinergia de mayor orden en una población y encontró que **only**La condición de ToM-prompt produce diferenciación vinculada a la identidad y complementariedad orientada a objetivos; los LLM de menor capacidad muestran sólo una aparición falsa. Es decir, la aparición de la coordinación es prematura y condicional y depende del modelo, no gratuita. Esta lección implementa un agente minimal consciente de ToM, ejecuta una tarea de cooperación con y sin Invitación de ToM, y mide el delta de coordinación en relación con el protocolo Riedl 2025.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## El problema

La coordinación multi-agente a menudo parece mágica: los agentes dividen el trabajo, se anticipan entre sí, evitan la redundancia. Por lo general, esta "emergencia" es un artefacto de la ingeniería de la rapidez  alguien dijo a los agentes que "coordenaran".

El hallazgo de Riedl para 2025 es más estricto: en condiciones controladas, la coordinación sólo surge cuando se invita a los agentes a razonar sobre **other agents' minds**(ToM). Sin el comando de mando, incluso los modelos fuertes muestran patrones de coordinación que no sobreviven a los controles estadísticos.

Esta lección trata a ToM como una capacidad específica (razonar sobre creencias sobre creencias), construye un agente consciente de ToM mínimo, y mide cómo se ve la coordinación real frente a cómo se ve el vestir rápido.

## Concepto

### Qué significa ToM

Psicología del desarrollo: un niño de 3 años piensa que el mundo interior de cualquier persona coincide con el suyo. Un niño de 5 años entiende que los demás tienen creencias diferentes. Un niño de 7 años explica las creencias sobre creencias ("cree que creo que la pelota está bajo la copa").

Para los agentes de LLM, ToM ordena un mapa a:

- **Zeroth-order:**El agente actúa sólo por sus propias observaciones.
- **First-order:**"Alice cree en X".
- **Second-order:**"Alice cree que Bob cree en X".

Li et al. 2023 encontraron que los ToM de primer y segundo orden emergen en los agentes de LLM en juegos cooperativos, pero se degradan con un horizonte largo y una comunicación poco confiable.

### La prueba Sally-Anne, en resumen

Una prueba de creencia falsa de 1985: Sally pone un mármol en la cesta A, se va. Anne lo mueve a la cesta B. ¿Dónde mirará Sally cuando regrese?

Los LLM de la era GPT-4 pasan pruebas de estilo Sally-Anne cuando se presentan claramente. Fallan cuando la narrativa es larga, la escena cambia varias veces o la pregunta se expresa indirectamente. Ese es el estado práctico de ToM en 2026 en los LLM de producción.

### La medición de coordinación de Riedl

Riedl (arXiv:2510.05174) construyó una prueba a escala de población: N agentes, un objetivo cooperativo, condiciones de prontitud variables.

1. **Identity-linked differentiation.**¿Los agentes desarrollan distinciones estables de roles con el tiempo?
2. **Goal-directed complementarity.**¿Las acciones de los agentes se complementan entre sí (subtareas diferentes) en lugar de duplicarse?
3. **Higher-order synergy.**Una medida estadística de si el grupo logra lo que ningún subconjunto podría.

Resultado: sólo bajo la condición de la llamada de ToM las tres métricas producen una señal por encima del nivel de referencia. Sin la llamada de ToM, las métricas se desplazan cerca de la posibilidad para los modelos de capacidad moderada. Los modelos grandes muestran cierta coordinación sin la llamada de ToM explícita pero el efecto es menor que con la llamada explícita.

### La ilusión de coordinación

Sin controles estadísticos, la "coordinación de emergencia" en las demostraciones a menudo refleja:

- Ingeniería rápida que se colabora en coordinación (compulsaciones del sistema que dicen "trabajar juntos").
- Prejuicio observador (vemos patrones que esperamos).
- Selección post hoc de carreras exitosas.

Los sistemas de producción que comercializan "coordinación emergente" sin señal medible deben ser tratados como comercializados.

### Un agente minimalista consciente de TOM

Estructura:

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agent will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

El `other_models`El atributo es el estado ToM. El primer orden ToM mantiene sólo un nivel.`other_models[i][other_models_of_j]`¿Qué creo que cree el agente J?

### Por qué lastimaría el largo horizonte

Li et al. documento: los límites de contexto hacen que los agentes olviden cuál creencia pertenece a quién. La alucinación agrega creencias falsas a los modelos de otros agentes. Ambos producen errores "Pensé que pensó X" que se componen con el tiempo.

Las medidas de mitigación documentadas en el documento y en los seguimientos de 2024-2026:

- **Explicit ToM state in the prompt.**Formatos estructurados: `{agent_id: belief_list}`- Forza la recuperación para preservar la vinculación entre la identidad y la creencia.
- **Shorter reasoning chains.**Menos actualizaciones de ToM por turno reducen las alucinaciones compuestas.
- **External ToM store.**Mantenga el modelo fuera del contexto del MLL; inyecta solo partes relevantes por turno.

### Cuando el ToM falla en la producción

- **Adversarial settings.**Los agentes con buena ToM son más fáciles de manipular (puedes modelar lo que ellos modelaran de ti, luego explotarlo).
- **Heterogeneous teams.**Cuando los modelos son diferentes, el modelo ToM que funciona para un oponente no generaliza.
- **Ground-truth-dependent tasks.**El TOM se trata de creencias; si la corrección depende de los hechos, el TOM puede ser una distracción.

### La coordinación que realmente se puede medir

Tres señales prácticas de que la coordinación de un equipo es real en lugar de vestida de inmediato:

1. **Complementarity over time.**¿En una tarea de varios turnos, las acciones de los agentes cubren subtareas disjoint?
2. **Anticipation.**¿La acción del agente A en la vuelta T+1 depende de una predicción sobre la acción de B en T+2 que resultó correcta?
3. **Correction.**Cuando A interpreta mal la creencia de B en la curva T, ¿corrige A con la curva T + 2?

Estos son medibles en un sistema de múltiples agentes registrados. Son la versión sustancial de la narrativa de "coordinación".

```figure
sw-theory-of-mind
```

## Construye el mismo

`code/main.py`los instrumentos:

- `ToMAgent` rastrea sus propias creencias y modelos de creencias por otro agente.
- Una tarea cooperativa: tres agentes deben recoger tres tokens de tres cajas; cada caja puede contener un token.
- Dos configuraciones: `zeroth_order`(no ToM) y `first_order`(TOM con modelo de creencias de un nivel).
- Medición de más de 200 ensayos aleatorios: tasa de finalización, tasa de duplicación (dos agentes dirigidos a la misma caja), promedio de vueltas hasta la finalización.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado esperado: los agentes de orden cero duplican el esfuerzo a una tasa de ~ 35% y completan ~ 60% de los ensayos en 10 vueltas.

## Usalo

`outputs/skill-tom-auditor.md`Es una habilidad que audita la afirmación de un sistema multiagente de "coordinación emergente".

## Envío

Lista de verificación de las reclamaciones de coordinación:

- **Control condition.**Una versión de tu sistema sin la llamada de coordinación.
- **Statistical test.**¿Es significativa la diferencia entre el sistema y el control en `p < 0.05`¿En su métrica?
- **Complementarity measure.**Desajuste de acción con el tiempo, no sólo el éxito final.
- **Failure-case log.**Cuando los agentes se coordinan mal, ¿cómo se ve el estado de ToM?
- **Model-capacity disclosure.**Si el efecto desaparece en modelos más pequeños, dígale.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar el primer orden de ToM reduce la tasa de duplicación en ~7x. ¿Persiste la brecha cuando escalas a 5 agentes y 5 cajas?
2. Implementar el ToM de segundo orden (el agente A modela lo que B piensa de C). ¿Mejora en relación con el primer orden?
3. Inyectar una**hallucination**en el estado de ToM: al azar invertir una creencia por turno. ¿Cuánto degrada este rendimiento de primer orden?
4. Lee Li et al. (arXiv:2310.10701). Reproduce el hallazgo de "degradación de horizonte largo": a medida que los turnos crecen de 10 a 30, ¿cómo cambia su rendimiento de primer orden ToM?
5. Leer Riedl 2025 (arXiv:2510.05174). Implemente las estadísticas de sinergia de orden superior en sus registros de simulación. ¿El efecto está presente sin la condición de ToM prompt?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Theory of Mind | "Understanding others' minds" | The capacity to model another agent's beliefs. Graded by order (0, 1, 2+). |
| Sally-Anne test | "The false-belief test" | 1985 developmental psychology; LLMs pass plain versions, fail complex ones. |
| First-order ToM | "A believes X" | Modeling one other's beliefs about facts. |
| Second-order ToM | "A believes B believes X" | Recursive modeling one level deeper. |
| Identity-linked differentiation | "Stable roles over time" | Riedl's metric: roles persist, not random. |
| Goal-directed complementarity | "Disjoint actions" | Agents target different subtasks, not the same one. |
| Higher-order synergy | "Group exceeds any subset" | Riedl's statistical measure for real coordination. |
| Coordination illusion | "It looks coordinated" | Prompt-dressed appearance of coordination without measurable signal. |

## Leer más

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) ToM emergente en juegos cooperativos; modos de fracaso de largo horizonte
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) medición a escala de población; la incidencia de ToM es la condición de carga
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://doi.org/10.1017/S0140525X00076512) el origen del concepto de TOM en 1978
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://doi.org/10.1016/0010-0277(85)90022-8)  el artículo Sally-Anne (1985)
