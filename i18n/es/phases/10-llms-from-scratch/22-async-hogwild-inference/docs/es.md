# Async y Hogwild!

> La descifrado especulativo (fase 10 · 15) paralela a los tokens dentro de una secuencia. Los marcos multi-agentes se paralelalizan a través de secuencias enteras pero forzan una coordinación explícita (voting, subtask splitting). ¡Hogwild! Inference (Rodionov et al., arXiv:2504.06261) hace algo más: ejecuta N instancias del mismo LLM en paralelo contra una cache de valor clave SHARED. Cada trabajador ve instantáneamente los tokens generados por cada otro trabajador. Los modelos de razonamiento modernos  QwQ, DeepSeek-R1  pueden auto-coordinarse a través de ese caché compartido sin ningún ajuste fino. El enfoque es experimental pero abre un eje completamente nuevo de paralelismo de inferencia que se encuentra ortogonal a la especificación de decodificación. ¡Esta lección implementa a un Hogwild de dos trabajadores! simulador en stdlib Python y explica por qué la colaboración de caché compartido surge de las habilidades de razonamiento del modelo existente.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 12 (inference optimization), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Describa las tres topologías comunes paralelas de LLM (voting, subtask, Hogwild!) y nombre los problemas que cada uno de ellos tiene como objetivo.
- En el caso de Hogwild! se puede establecer una configuración de base: múltiples trabajadores, una caché compartida de KV, coordinación emergente a través de auto-promulgación.
- Calcule la velocidad de tiempo de Hogwild! en función del recuento de trabajadores`N`, paralelo a nivel de tareas `p`, y los gastos generales de coordinación `c`¿ Qué ?
- Implemente un simulador Hogwild! de dos trabajadores en un problema de juguete y observa la división de tareas emergente.

## El problema

Los LLM modernos resuelven problemas difíciles mediante la producción de largas cadenas de razonamiento  5000 tokens de lógica paso a paso es común, decenas de miles de tokens ocurren en problemas matemáticos profundos.

La descifrado especulativo (fase 10 · 15) te da una velocidad de 3-5 veces paralela dentro de una secuencia.

La pregunta obvia es: ¿podemos paralelar a través de secuencias? ejecutar múltiples copias del mismo modelo en el mismo problema, dejar que cooperen, que dividan el trabajo?

Trabajo anterior: conjuntos de votación (exercer N modelos, elegir la respuesta de mayoría), árbol de pensamiento (caminos de razonamiento de rama y recombinar), y marcos multi-agentes (asignar a cada agente una subtarefa, usar un coordinador). Todos estos ayudan en dominios de tareas específicos. Todos también introducen una maquinaria de coordinación explícita  reglas de votación, lógica de rama y prune, protocolos de mensajería de agente a agente.

¡Hogwild! La inferencia adopta un enfoque diferente. Los trabajadores N comparten una sola caché KV. Cada trabajador ve inmediatamente los tokens generados por cada otro trabajador, como si fueran su propio contexto. Los trabajadores  sin formación ni ajuste preciso  se ocupan de cómo dividir el trabajo. Los modelos modernos de razonamiento (QwQ, DeepSeek-R1, modo de razonamiento de la familia Claude) pueden leer la caché compartida y decir cosas como "Veo que el trabajador 2 ya manejó el caso base, así que trabajaré en el paso inductivo".

La aceleración es dependiente de la carga de trabajo y experimental a partir de abril de 2026. Pero la idea vale la pena conocer porque abre un nuevo eje de paralelismo de inferencia.

## El concepto

### El diseño

Iniciar N procesos de trabajadores, todos ejecutando el mismo LLM. En lugar de caché KV por trabajador, mantener una caché compartido.`i`genera símbolo`t_j`, el token se escribe en la caché compartida en la posición siguiente.`k`El sistema de almacenamiento de datos de N, que incluye todo lo que todos los trabajadores N han generado hasta ahora, lee el estado actual de la caché.

En el tiempo de paso, los trabajadores compiten para escribir tokens. No hay índice de posición por trabajador.

### Por qué surge la coordinación

Los trabajadores comparten una invitación. Normalmente algo así como "Usted es una de las N instancias trabajando juntos en este problema. Cada instancia lee la memoria compartida y puede ver lo que han escrito otras instâncias. Evite el trabajo redundante". El prompt más el caché compartido es suficiente. Los modelos de razonamiento leen el caché, notan qué partes del problema ya se han intentado y (a menudo, pero no siempre) se vuelven a partes no exploradas.

El artículo Hogwild! (Rodionov et al., 2025) informa observaciones como:

- Los trabajadores formularán planes y los comunicarán a otros trabajadores a través del caché.
- Los trabajadores notan errores en el razonamiento de otros trabajadores y los denuncian.
- Los trabajadores se adaptan cuando un plan falla y proponen alternativas.
- Cuando se les pide que comprueben si hay un despido, los trabajadores lo detectan y se vuelven.

El comportamiento emergente proviene de las capacidades de razonamiento que ya tiene el modelo.

### El nombre

El nombre del documento deriva de Hogwild! SGD (Recht et al., 2011), un optimizador de actualizaciones asincronas. La analogía: los trabajadores asincronos de SGD escriben todos a un vector de parámetros compartido; Hogwild! los trabajadores de Inference escriben todos a un caché KV compartido. Ambos dependen de la convergencia empírica en lugar de las garantías de sincronización.

### RoPE hace que esto sea tratable

Embedados de posición rotativa (RoPE, Su et al. 2021) codificar la información de posición a través de la rotación en los vectores Q y K. Debido a que la puntuación de atención entre una consulta rotada y una clave rotada depende solo de su distancia relativa, todo un bloque de entradas almacenadas en caché puede moverse a un nuevo desplazamiento sin recomputo: rota la consulta en lugar de volver a rotacionar cada clave almacenada en caché. ¡Hogwild! Inference hace esto una vez por bloque de caché: para una consulta en posición `i_q`y un bloque que comienza en`i_k`En la opinión de ese trabajador, la consulta se rota por la distancia relativa `i_q - i_k`Es así como cada trabajador ve los bloques de caché compartidos en su propio orden. El truco funciona para un cambio uniforme de un bloque contiguo.

En un modelo de posición aprendida o posición absoluta, Hogwild! necesitaría la invalidación de caché en cada escritura simultánea.

### Matemáticas de tiempo de pared

- ¿ Qué ?`T_serial`El problema de la seguridad social se debe a que el trabajador pueda resolver el problema solo.`p`sea la fracción paralelable de nivel de tarea.`c`ser el coste general de coordinación por paso (lectura de la caché extendida, decisión de lo que escribir).

Tiempo de trabajo solo: `T_serial`¿ Qué ?
N-trabajador Hogwild! tiempo, si la coordinación es libre: `T_serial * ((1 - p) + p / N)`- El clásico Amdahl.
Con gastos generales de coordinación: `T_serial * ((1 - p) + p / N) + c * steps_per_worker`¿ Qué ?

Para que un trabajador sea productivo,`c`En los modelos de razonamiento que producen 5k+ tokens, los trabajadores pueden permitirse cientos de tokens de coordinación y aún así salir adelante. En tareas de chat cortas, la coordinación domina y Hogwild! es peor que la serie.

### Ejemplo concreto

Problemas de razonamiento: 10 mil tokens de cadena de pensamiento.`p = 0.7`Los resultados de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de cuciaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaronaron (en)`c = 200`Los gastos generales de coordinación por trabajador.`N = 4`Trabajadores:

- Tiempo en serie: 10000 pasos de decodificación.
- Hogwild! tiempo: 10000 * (0.3 + 0.7 / 4) + 200 * 4 = 10000 * 0.475 + 800 = 5550 pasos de decodificación.
- Aceleración: 10000 / 5550 = 1,8x.

Pero en problemas de razonamiento más largos (50k tokens), la coordinación se amortiza y la aceleración se empuja 2,5-3x. Hogwild! es el equivalente de inferencia del paralelismo a nivel de hilo en un lenguaje que te permite escribir código de múltiples hilos naturalmente.

### ¿Cuándo alcanzar a Hogwild?

- Problemas de razonamiento largo (miles de tokens) donde la tarea puede ser paralela a través de sub-objetivos independientes.
- Los modelos razonantes que han sido entrenados para pensar paso a paso.
- Despliegues de nodo único con suficiente VRAM para mantener la caché compartida más N procesos de trabajadores. La caché se comparte, pero cada trabajador tiene su propia memoria de activación.

### Cuando no

- Un chat interactivo corto, y la coordinación en la cabeza.
- Las tareas que no se paralelalizan (probas lineares únicas, compilación única). N = 1 es el máximo.
- Modelos no razonables, no surge coordinación.
- El caché compartido necesita sincronización de trabajadores cruzados muy rápida.

### El estado experimental

A partir de abril de 2026, Hogwild! es un método de investigación con una implementación PyTorch de código abierto.

1. La gestión compartida de la caché KV en procesos simultáneos es ingeniería no trivial.
2. La coordinación emergente depende de la tarea; todavía se están construyendo puntos de referencia.
3. Los speedups son modestos en comparación con lo que ya ofrece la descodificación especulativa, y los dos pueden combinarse pero la ingeniería combinada es otra capa.

Vale la pena experimentar, no vale la pena apostar por un producto.

```figure
continuous-batching
```

## Construye el mismo

`code/main.py`Implementa un simulador de juguete Hogwild!

- Dos procesos de trabajadores, cada uno un "LLM" determinista que produce una de varias categorías de tokens (tokens de trabajo, tokens de observación, tokens de coordinación) con probabilidades conocidas.
- Una caché compartida (solo una lista de fichas) que ambos trabajadores leen y escriben.
- Una lógica de coordinación simple: cuando un trabajador ve que el otro ya ha producido suficientes tokens de trabajo en una categoría, elige una categoría diferente.

El simulador se ejecuta con un presupuesto de paso fijo y informa:

- Total de tokens de trabajo producidos.
- Tiempo total de pared (número de pasos del trabajador).
- Aceleración efectiva sobre un solo trabajador.
- Un rastro de qué trabajador escribió qué símbolo.

### Paso 1: la caché compartida

Una lista a la que ambos trabajadores se suman.`threading.Lock`En el caso de las empresas, el número de empresas que se encuentran en el mercado de la información se reduce a un 50% en el caso de las empresas.

### Paso 2: el bucle de trabajo

Cada trabajador, en cada paso:

- Leer la caché compartida actual.
- Decide qué categoría de token escribir en función de lo que ya está ahí.
- Escribe una ficha.

### Paso 3: la heurística de coordinación

Si la categoría X ya tiene tokens K en la caché y la categoría prevista del trabajador es X, el trabajador cambia a la categoría Y. Este es un juguete substituyente para el comportamiento del modelo de razonamiento de "observe que esto ya está cubierto, haz algo más en su lugar".

### Paso 4: aceleración medida

El simulador se ejecuta con N=1 trabajador y con N=2 trabajadores, el mismo presupuesto total de pasos. Cuenta los tokens de trabajo producidos. N=2 debe producir aproximadamente 1,5-1,8 veces más tokens de trabajo debido a la división de tareas orientada a la coordinación.

### Paso 5: enfatizar la coordinación

Reducir la sensibilidad de la heurística de coordinación. Repite. Observe que sin una buena coordinación, N=2 produce redundantemente los mismos tokens y la aceleración cae por debajo de 1. Esto coincide con la observación del papel: el truco solo funciona si los trabajadores tienen la capacidad de razonamiento para auto-coordinarse.

## Usalo

Hogwild! integración en la producción a partir de abril de 2026 es de grado de investigación. La implementación de referencia de Yandex/HSE/IST es basada en PyTorch y se dirige a configuraciones de múltiples procesos de un solo nodo en modelos DeepSeek-R1 y QwQ.

Caminos de adopción pragmáticos:

1. Profilar su carga de trabajo de tarea de razonamiento. Medir la fracción de tokens que son exploratorios (múltiples estrategias, análisis de casos, búsqueda) vs lineal.
2. Si la exploración domina, ejecuta un experimento Hogwild! con dos trabajadores.
3. Si la mejora es inferior a 1.3x, estás en el régimen dominado por la coordinación.
4. Si la mejora es superior a 1,5x, empuje a N=4 y mísera de nuevo.

Combina con la descodificación especulativa: cada trabajador de Hogwild! puede usar de forma independiente el decodificación de especificaciones. Los dos aceleradores se multiplican (aproximadamente), lo que lleva a un decodificación de especificaciones de 3x y Hogwild! de 1,8x a un decodificación efectiva de 5,4x sobre la de un trabajador ingenuo.

## Envío

Esta lección produce`outputs/skill-parallel-inference-router.md`. Dado un perfil de carga de trabajo de razonamiento (presupuesto de tokens, perfil de paralelismo de tareas, familia de modelos, objetivo de implementación), se desplaza entre las estrategias de votación, árbol de pensamiento, multi-agente, Hogwild! y descifrado especulativo.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar que la configuración N=2 Hogwild! produce más tokens de trabajo que la línea de base N=1 en el mismo tiempo de pared.

2. Reducir la fuerza de la heurística de coordinación (conjunto `coordination_weight=0.1`Re-run. Muestre que el acelerador se derrumba. Explique por qué: los trabajadores duplican el esfuerzo cuando no pueden coordinarse.

3. Calcule la velocidad esperada Hogwild! para una tarea de razonamiento de 50k tokens con `p=0.8, c=500`Haga lo mismo para una tarea de chat de 1k-token con `p=0.3, c=200`¿Por qué uno es una victoria y el otro una pérdida?

4. Lea la sección 4 (evaluación preliminar) del artículo Hogwild. Identifique los dos modos de falla que informan los autores.

5. Combine Hogwild! con la descifrado especulativo en el juguete: cada trabajador utiliza un 2-token especificación-decodificación internamente. Informar el multiplicativo de aceleración. ¿Qué problema de contabilidad surge cuando dos trabajadores ambos quieren extender el mismo prefijo de caché compartido?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hogwild! | "Parallel workers, shared cache" | N instances of the same LLM running concurrently with one shared KV cache; emergent coordination via self-prompting |
| Shared KV cache | "The coordination medium" | A single growing KV buffer that all workers read and write; enables instant token visibility across workers |
| Emergent coordination | "No training needed" | Reasoning-capable LLMs can read the shared cache and divide work without any fine-tuning or explicit protocol |
| Coordination overhead (c) | "Tokens spent orienting" | The per-worker cost of reading the extended cache and deciding what to do; must stay small vs total decode time |
| Parallelizable fraction (p) | "What can run in parallel" | Task-level parallelism: the fraction of the total work that is not intrinsically sequential |
| RoPE enables Hogwild! | "Rotary positions are shift-invariant" | Because positions are rotations, writing into a shared cache does not require recomputing prior tokens |
| Voting ensemble | "Run N, pick the majority" | The simplest parallel inference topology; useful for classification, less for long-form reasoning |
| Tree of thought | "Branch and prune" | Reasoning strategy that explores multiple branches and prunes; explicit coordination logic |
| Multi-agent framework | "Assign sub-tasks" | Each agent gets a role; a coordinator orchestrates; heavy protocol overhead |

## Leer más

- [Rodionov et al. — Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) el documento Hogwild!, evaluación preliminar sobre QwQ y DeepSeek-R1
- [Recht, Re, Wright, Niu — Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) el Hogwild original!, el origen del nombre
- [Su et al. — RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) RoPE, la propiedad que hace que la inferencia compartida de caché sea tratable
- [Yao et al. — Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) la estrategia de razonamiento de árbol de pensamiento Hogwild! se encuentra ortogonal a
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) Descodación especulativa, el paralelismo dentro de la secuencia Hogwild! compone con
- [Hogwild! reference PyTorch implementation](https://github.com/eqimp/hogwild_llm) la única fuente de verdad para los experimentos del periódico
