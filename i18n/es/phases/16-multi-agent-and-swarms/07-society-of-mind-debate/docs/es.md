# Sociedad de la mente y debate multi-agente

> La premisa de Minsky de 1986  inteligencia es una sociedad de especialistas  se redescubre cada década. En 2023 Du et al. la convirtieron en un algoritmo concreto: múltiples instancias de LLM proponen respuestas, leen las respuestas de cada uno, critican y actualizan. Durante N rondas convergen en un consenso que supera la CoT de tiro cero y la reflexión sobre seis tareas de razonamiento y factualidad. Dos hallazgos importan: ambos **multiple agents**y **multiple rounds**La sociedad supera el monólogo de un solo agente; el intercambio de múltiples rondas supera el voto de una sola vez.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## El problema

La autoconstancia  muestra un modelo muchas veces y toma la respuesta mayoritaria  es la mejoría de razonamiento más barata que puedes seguir. Funciona, pero se satura rápidamente. Puedes duplicar tus muestras y no ver otro salto significativo.

El debate rompe la saturación. En lugar de N muestras independientes de un modelo, N agentes leen el razonamiento y revisión de los demás. La correlación entre muestras disminuye (ya no son i.i.d.), y el punto de convergencia es a menudo correcto donde la votación i.i.d. estaba confidentemente equivocada.

## Concepto

### El algoritmo de Du et al. 2023

En el caso de las medidas de seguridad, el fabricante deberá tener en cuenta el valor de la información obtenida.

1. Cada uno de los agentes N produce una respuesta inicial a la pregunta.
2. Para la ronda r = 2..R: a cada agente se le muestran las respuestas de la ronda r-1 de los otros agentes y se le pide "considerando estas, dé su respuesta actualizada".
3. Después de las rondas R, la mayoría vota las respuestas finales.

Las pruebas en papel sobre MMLU, GSM8K, biografías, MATH y puntos de referencia de la realidad.

### Dos botones independientes

Ablaciones del mismo documento:

- **Agent count alone**En la mayoría de las tareas, el único agente es el mejor, pero en la mayoría de las tasas, el plateau.
- **Round count alone**(1 agente que ve su propio razonamiento previo) apenas ayuda a la debilidad conocida de la reflexión.
- **Both together**El intercambio de múltiples rondas entre múltiples agentes impulsa la ganancia.

### Por qué funciona

Dos mecanismos:

1. **Exposure to disagreement.**Cuando un agente ve la cadena de razonamiento de otro agente con una conclusión diferente, tiene que justificar o actualizar.
2. **Correlated error reduction.**En autoconsistencia, todas las muestras provienen del mismo modelo, por lo que los errores se correlacionan  promedio en una respuesta confidentemente incorrecta. Diferentes modelos o semillas diferentes se descorrela. Diferentes * puntos de vista debatidos * se descorrela más adelante.

### El debate es heterogéneo

El debate sobre Llama + Claude + GPT reduce el colapso de la monocultura (lección 26) porque los errores correlacionados de una familia de modelos no son compartidos por los demás.

Desventaja: un modelo débil que participa en un debate puede arrastrar el consenso hacia su respuesta equivocada (ver "¿Deberíamos estar volviéndonos locos?", arXiv:2311.17371).

### NLSOM  la extensión de 129-agente

Zhuge et al. ("Mindstorms in Natural Language-Based Societies of Mind", arXiv:2305.17066) escalaron esta idea a 129 sociedades miembros. El resultado: la especialización y la autoorganización surgen con la escala, y el sistema supera al agente único en tareas como la respuesta a preguntas visuales.

### Modo de falla

- **Sycophancy cascade.**Todos los agentes se aplazan a quien suene más seguro. El debate se derrumba con la voz más alta.
- **Topic drift.**Los debates en muchas rondas se derivan de la pregunta original.
- **Compute blowup.**N agentes × R rondas = N·R LLM llamadas, cada una con un contexto que crece. Un debate de 5 agentes, 5 rondas es de 25 llamadas en contexto creciente. El costo por pregunta puede exceder 10 veces una sola llamada CoT.

```figure
multi-agent-debate
```

## Construye el mismo

`code/main.py`La respuesta de los agentes es una respuesta diferente (posiblemente incorrecta). Los agentes se escriben  cada "actualización" mediante la media de las respuestas de los vecinos ponderadas por una confianza escrita.

La demostración muestra dos efectos clave:

- Una sola ronda de intercambio acerca a los agentes a la respuesta correcta.
- Las rondas adicionales anteriores a la segunda ronda muestran rendimientos disminuyentes (combina con la meseta de Du et al.).

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

## Usalo

`outputs/skill-debate-configurator.md`Configura un debate para una nueva tarea: número de agentes, número de rondas, heterogeneidad (modelo mismo vs mixto), asignación de roles (simétrica vs una adversarial).

## Envío

Si usted navega el debate:

- **Cap rounds at 3.**Du et al. muestran que 3 rondas capturan la mayor parte de la ganancia.
- **Cap agents at 5.**Más allá de 5, el contexto y el costo dominan.
- **Heterogeneous by default.**Al menos dos modelos de base diferentes en la piscina.
- **Adversarial slot.**Un agente le hizo discrepar sin importar.
- **Log every round.**Los sistemas de debate que ocultan rondas intermedias no pueden ser desactivados ni auditados.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`, luego fijar el recuento de las rondas a 5 y ver los retornos decrecientes. ¿En qué ronda se detiene la convergencia adicional?
2. Si se añade un cuarto agente con un papel adversario: siempre no está de acuerdo con la mayoría actual. ¿Rotará o mejorará la convergencia?
3. En el gráfico (impresión) el puntaje de acuerdo por ronda (fracción de agentes en la respuesta mayoritaria). ¿Cuándo alcanza 1,0 y es eso equivalente a "correcto"?
4. Leer las ablaciones de la sección 4. Replicar el resultado "sólo para agentes" vs "sólo para rondas" vs "ambos" usando este código.
5. Lea "¿Deberíamos estar volviéndonos locos?" (arXiv:2311.17371) y enumere dos variantes del debate más allá de la ronda de rotura  por ejemplo, dirigido por un juez, cadena de debate, adversarial.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Society of Mind | "Minsky's idea" | Intelligence as interacting specialists; 1986 framing now operationalized via LLM debate. |
| Multi-agent debate | "Agents argue" | N agents propose, critique each other, revise over R rounds, majority-vote. |
| Consensus | "They agree" | Not epistemic truth — just fraction-on-majority-answer. Can be confidently wrong. |
| Rounds | "Exchange steps" | One round = each agent reads the others and updates once. |
| Heterogeneous debate | "Mix model families" | Using different base models to decorrelate errors. |
| Sycophancy cascade | "Everyone agrees with the loud one" | Debate failure where agents defer to the most confident agent regardless of correctness. |
| NLSOM | "129-agent society" | Natural-language society of mind; Zhuge et al.'s scaled version. |
| Correlated error | "Same model, same bug" | Why self-consistency saturates; debate across different views decorrelates. |

## Leer más

- [Du et al. — Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) el documento de referencia, ICML 2024
- [Zhuge et al. — Mindstorms in Natural Language-Based Societies of Mind](https://arxiv.org/abs/2305.17066) 129-agente NLSOM
- [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/abs/2311.17371) Variancias de debate de valores de referencia
- [Debate project page](https://composable-models.github.io/llm_debate/) El código, los demos y los detalles de ablación de Du et al.
