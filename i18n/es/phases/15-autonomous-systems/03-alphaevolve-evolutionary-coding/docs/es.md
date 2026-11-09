# AlphaEvolve  Agentes de codificación evolucionistas

> Enpare un modelo de codificación fronteriza con un bucle evolutivo y un evaluador verificable por máquina. Deja que el bucle siga funcionando lo suficiente. Descubre un procedimiento de multiplicación de matriz compleja 4x4 que utiliza 48 multiplicaciones escalares  la primera mejora sobre Strassen en 56 años. También encuentra una heurística de programación Borg a nivel de Google que recupera ~ 0,7% del computación de cluster en producción. La arquitectura es aburrida a propósito. Las victorias provienen del rigor del evaluador.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, evolutionary-loop toy)
**Prerequisites:** Phase 15 · 01 (long-horizon framing), Phase 15 · 02 (self-taught reasoning)
**Time:** ~60 minutes

## El problema

Los modelos de lenguaje grandes pueden escribir código. Los algoritmos evolutivos pueden buscar en código. Ambos se han probado por separado durante décadas; ambos alcanzan techos. El techo de LLM es confabulación: el modelo escribe código plausible que no hace lo que afirma. El techo evolutivo es el costo de búsqueda: las mutaciones aleatorias sobre la sintaxis rara vez producen programas compilables, y mucho menos mejores.

AlphaEvolve (Novikov et al., DeepMind, arXiv:2506.13131, junio 2025) las combina. El LLM propone ediciones dirigidas a una base de datos de programas; un evaluador automático marca cada variante; las variantes de puntaje alto se convierten en padres para las generaciones futuras. El LLM maneja el costoso paso de escribir código plausible; el evaluador captura las confabulaciones. El ciclo dura de horas a semanas.

Los resultados informados: multiplicación de matriz compleja 4x4 de 48 escalas (el límite de 1969 de Straßsen fue 49), una heurística de programación Borg en la producción de Google, una aceleración del núcleo FlashAttention del 32,5%, mejoras en el rendimiento de entrenamiento de Gemini.

La arquitectura funciona porque el evaluador es controlables por máquina. No funciona donde el evaluador no está. Esa asimetría es la lección.

## El concepto

### El bucle

1. Comience con un programa de semillas `P_0`Eso es correcto, pero no es óptimo.
2. Mantener una base de datos de programas variantes, cada uno calificado por el evaluador.
3. Muestra de uno o más padres de la base de datos (estilo de élites de MAP o de la isla).
4. Promete el LLM (Gemini Flash para muchos candidatos, Gemini Pro para los más duros) para producir una variante modificada del padre.
5. Compila, ejecuta y evalúa la variante en el evaluador prolongado.
6. Insertar en la base de datos con clave de su puntuación y vector de características.
7. Repito, ¿qué quieres?

El trabajo del modelo es proponer un cambio específico que pueda mejorar la puntuación. Segundo, la base de datos está estructurada (MAP-elite grid, island-based) por lo que el bucle explora la diversidad, no solo el líder actual.

### Lo que hace que el evaluador no sea negociable

Las ganancias de AlphaEvolve provienen de dominios donde el evaluador es rápido, determinista y difícil de jugar:

- **Matrix multiplication algorithm**: una prueba unitaria que multiplica matrices y verifica la igualdad de forma bit-identica.
- **Borg scheduling heuristic**: un simulador de grado de producción que reproduce la carga histórica del grupo y mide el cálculo desperdiciado.
- **FlashAttention kernel**: una prueba de corrección más un indicador de reloj de pared en hardware real.
- **Gemini training throughput**: GPU-segundos por paso.

En cada caso, el evaluador captura la clase de errores de LLM que de otro modo dominarían: afirmaciones de corrección confabuladas, afirmaciones de rendimiento que desaparecen en el hardware y fallos de borde.

### El hackeo de recompensas es la otra cara de esa declaración

La evolución optimiza para cualquier medida que el evaluador tome. Si el evaluador es imperfecto, el bucle encontrará la imperfección. En un dominio no verificado el bucle optimizaría para la característica de superficie, no el comportamiento previsto. DeepMind señala esto explícitamente en el artículo: los éxitos de AlphaEvolve se transfieren solo a dominios donde el rigor del evaluador coincide con la ambición de la búsqueda.

Ejemplos concretos de hackeo de recompensas en los bucles de búsqueda de códigos 2025-2026:

- Los objetivos de optimización que recompensan "tiempo para completar" recompensaron enviando soluciones vacías.
- Puntuaciones de referencia que recompensan la corrección bajo la prueba recompensó las pruebas de memorización y sobreajuste.
- Un proxy de "calidad de código" recompensó la eliminación de comentarios y la reescritura de nombres de variables, sin cambios semánticos.

La solución en AlphaEvolve: enviar un evaluador que el LLM nunca ha visto, con insumos generados en el momento de la evaluación.

### ¿Por qué la búsqueda de LLM + supera o solo

El LLM puede producir modificaciones comptables y semánticamente plausibles. Una mutación aleatoria GA en un archivo Python de 2000 líneas casi siempre produce errores de sintaxis. El LLM también concentra la búsqueda en vecindarios plausibles (cambiar una función, no bytes aleatorios), lo que reduce drásticamente las llamadas de evaluador desperdiciadas.

El evaluador, a su vez, capta las confabulaciones del LLM.$O(n \log n)$en el límite" cuando en realidad es$O(n^2)$El punto de referencia del reloj de pared resuelve la cuestión.

### Donde AlphaEvolve encaja en la pila de fronteras

| System | Generator | Evaluator | Domain | Example win |
|---|---|---|---|---|
| AlphaEvolve | Gemini | correctness + benchmark | algorithms, kernels, schedulers | 48-mul 4x4 matmul |
| FunSearch (DeepMind, 2023) | PaLM / Codey | correctness | combinatorial math | cap-set lower bounds |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | LLM critique + experiment | ML research | ICLR workshop paper |
| Darwin Godel Machine (L4) | agent scaffolding | SWE-bench / Polyglot | agent code | 20% → 50% SWE-bench |

Las cuatro son variaciones de la misma receta: generador más evaluador, bucle. Las diferencias son lo que el evaluador califica y lo riguroso que es.

```figure
alphaevolve-loop
```

## Usalo

`code/main.py`El "LLM" es un proxy stdlib que propone pequeñas mutaciones sintácticas a un programa que calcula una función objetivo.

- ¿Qué quieres ?

- Cómo la mejor puntuación mejora a lo largo de generaciones.
- Cómo una red de élites de MAP mantiene vivas diversas soluciones para que el bucle no converja en un mínimo local.
- Cómo la eliminación de la prueba prolongada (evaluación de entrenamiento sólo) permite el bucle sobrepase espectacularmente.

## Envío

`outputs/skill-evaluator-rigor-audit.md`¿Es la condición previa para considerar un ciclo al estilo de AlphaEvolve en un nuevo dominio: su evaluador realmente detecta los fracasos que le importan?

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Observe la mejor trayectoria de puntuación.`--no-holdout`) y volver a ejecutar. Cuantificar el sobreajuste.

2. Lea la sección 3 del artículo de AlphaEvolve sobre la cuadrícula de élites de MAP. Diseñe un descriptor de características vectorial para un nuevo problema (por ejemplo, pases de optimización de compilador) que mantendría la búsqueda diversa.

3. El resultado de 48 multiplicados 4x4 mejoró en el límite de 49 mul de Strassen después de 56 años. Lea el apéndice F del documento y explique en tres frases por qué el evaluador para este problema es particularmente fácil de obtener bien, y por qué la mayoría de los dominios no son como él.

4. Propón un dominio donde AlphaEvolve fallaría, identifique exactamente dónde rompe el evaluador y por qué.

5. Para un dominio que conozca, escriba la firma del evaluador que usaría. Incluya (a) condiciones de corrección, (b) métrica de rendimiento, (c) regla de generación de entradas no validada, (d) al menos una verificación anti-hacking de recompensas.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| AlphaEvolve | "DeepMind's evolutionary coding agent" | Gemini + program database + machine-checkable evaluator |
| MAP-elites | "Diversity-preserving archive" | Grid keyed by feature vectors; each cell holds the best variant with that descriptor |
| Island model | "Parallel evolution subpopulations" | Independent populations that migrate periodically; prevents premature convergence |
| Machine-checkable evaluator | "Deterministic oracle" | A unit test, simulator, or benchmark the LLM cannot fake — a prerequisite for this loop |
| Reward hacking | "Optimizing the measure, not the goal" | Loop finds a way to maximize score without doing the intended task |
| Seed program | "The starting point" | An initial correct-but-suboptimal program the loop evolves from |
| Held-out evaluator | "Evaluation data the LLM never saw" | Inputs generated at evaluation time to prevent memorization |

## Leer más

- [Novikov et al. (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131) el periódico completo.
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) Comentario del vendedor con resultados.
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results) descubrió algoritmos, incluyendo el matmul 4x4 de 48-mul.
- [Romera-Paredes et al. (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) el sistema predecesor.
- [Anthropic — Responsible Scaling Policy v3.0 (Feb 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) enmarca la autonomía de los evaluadores como una dirección clave de la investigación.
