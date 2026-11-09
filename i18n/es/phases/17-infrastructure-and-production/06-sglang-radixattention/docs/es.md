# Prefijo-Cache Servir  RadixAttención y KV Reutilización

> Trata el caché KV como un recurso reutilizable de primera clase almacenado en un árbol de radix, y cambia la programación con él: en lugar de FCFS (primero en llegar, primero en servir) como horarios vLLM, un cronista consciente de caché prioriza las solicitudes con prefijos compartidos más largos  efectivamente un cruce de radix de primera profundidad para que las ramas calientes permanezcan residentes en HBM. SGLang es el motor que construyó en torno a esta idea. En Llama 3.1 8B con las instrucciones de 1K similares a ShareGPT, SGLang alcanza ~ 16.200 tok/s a ~ 12.500 de vLLM, un ~ 29% de ventaja. En las cargas de trabajo RAG con prefijos pesados la ventaja alcanza 6,4x. En las cargas de trabajo en forma de clonación de voz, la tasa de hits de caché se eliminó en un 86%. Se desplegará en más de 400.000 GPUs en 2026 en xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS. La cuestión es que el número 6.4x se evapora cuando el ordenado prefijo es inconsistente.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy radix-tree cache + cache-aware scheduler)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 14 (Agentic RAG)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Diagrama RadixAttención: cómo se almacenan los prefijos en un árbol radix y cómo los bloques KV se comparten entre secuencias enraizadas en la misma rama.
- Explica la programación consciente de la caché y por qué FCFS es incorrecto para el tráfico pesado de prefijos.
- Calcule la velocidad esperada para una carga de trabajo dada la velocidad de impacto del prefijo-cache y la distribución de longitud rápida.
- Nombre la disciplina de orden de inmediato que hace que el número 6.4x real vs una ventaja perdida.

## El problema

El servicio clásico trata el prompt de cada solicitud como opaco. Incluso cuando 5,000 solicitudes RAG comienzan con el mismo prompt de sistema de 2,000 tokens más el mismo preámbulo de recuperación, vLLM preempla ese prefijo de 2,000 tokens 5.000 veces.

La observación: las instrucciones en las cargas de trabajo de agente y RAG comparten prefijos largos casi siempre. Prometido de sistema, esquemas de herramientas, ejemplos de pocas tomas, encabezados de recuperación, historial de conversaciones  todo se repite a través de las solicitudes. Si guardaste la caché KV para ese prefijo una vez y lo utilizaste de nuevo, no lo volverías a preemplar.

RadixAttention hace exactamente esto. Los tokens se indexan en un árbol radix; cada nodo posee bloques KV para la secuencia de tokens en su camino desde la raíz. Una nueva solicitud camina por el árbol: cualquier nodo cuyo token coincide reutiliza los bloques KV de ese nodo. El costo de preempleo se vuelve proporcional al sufijo "nuevo", no al pedido completo.

El reto es la programación. Si dos solicitudes comparten un prefijo de 2,000 tokens y un tercero comparte solo 200 tokens del mismo prefijo, desea servir las dos solicitudes compartidas por mucho tiempo juntas para que el prefijo largo permanezca en HBM. FCFS hace lo contrario  sirve a quien llegó primero, potencialmente desalojar la rama caliente antes de que la siguiente solicitud de prefijo largo llegue.

## El concepto

### El árbol de radix como índice de KV

Un árbol radix (trie compacto) almacena secuencias de tokens. Cada nodo posee un rango de tokens y los bloques KV calculados para ese rango.

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

Una nueva solicitud viene con el sistema de respuesta + "Contexto: <doc A>" + "Preguntas: Carol". El programador camina: coincidencias de prefijos del sistema (124 bloques reutilizados), coincidencias de rama doc-A (31 bloques reutilizados), luego asigna bloques nuevos sólo para "Preguntas: Carol" (4 bloques). Costo de preempleo: 4 bloques de tokens nuevos. Sin el árbol: 160 bloques. ~40x ahorro en preempleo.

### Programación de almacenamiento en caché

La reutilización respaldada por Radix Tree no tiene sentido si el caché se descompone.

1. **Depth-first dispatch**Cuando se selecciona la siguiente solicitud de la cola, prefiere las solicitudes enraizadas en la misma rama que el conjunto de ejecución actual. Esto mantiene la rama caliente fijada.
2. **LRU at branch level, not block level**. Eliminar ramas enteras (a partir de las hojas más cortas utilizadas) en lugar de bloques individuales, para que la forma del caché coincida con la forma del radix.

Una solicitud compartiendo 2,000 tokens se sitúa detrás de una solicitud compartiendo 50, luego la rama de 2,000 tokens es desalojada para admitir la de 50 tokens.

### Números de referencia que debe memorizar

- Llama 3.1 8B, H100, ShareGPT 1K: SGLang ~ 16,200 tok/s vs vLLM ~ 12,500 (~ 29% de ventaja).
- RAG con prefijos pesados (el mismo sistema + el mismo documento, preguntas diferentes): hasta 6,4x en SGLang.
- Cargas de trabajo de clonación de voz: 86,4% de prefijos y tasas de caché.
- Las tasas de impacto de la producción en los clientes de SGLang: 50-99% dependiendo de la disciplina inmediata.
- Se desplegará en más de 400.000 GPU en 2026.

### El pedido te ha llegado .

El número 6.4x se basa en un ordenamiento de plantillas de instrucciones consistentes. Si su cliente construye instrucciones como `[system, tools, context, history, question]`en algunas solicitudes y `[system, context, tools, history, question]`En otros, el árbol no puede encontrar el prefijo compartido. lo que parece un prefijo compartido para un humano son dos secuencias distintas para el árbol radix.

El levier de ingeniero: su plantilla de solicitud es una clave de caché. Fija el orden. Coloque todo lo inmutable (sistema, herramientas, esquemas) primero. Coloque el contexto de recuperación después. Coloque la pregunta del usuario último. No deje contenido dinámico en el prefijo.

Caso real de la investigación: mover contenido dinámico fuera del prefijo cachéble llevó una implementación de 7% a 74% tasa de caché en un cambio.

### Donde RadixAttention gana y pierde

Las ganancias:
- RAG (el mismo preámbulo de recuperación, preguntas diferentes).
- Agentes (similes esquemas de herramientas, diferentes consultas).
- Habla con el sistema de alarma.
- Cargas de trabajo de voz/visión con preámbulos repetidos.

Perder (retorna a la capacidad de rendimiento a nivel de vLLM):
- Generación de una sola toma con instrucciones únicas (completamiento de código, chat abierto sin instrucción del sistema).
- Las instrucciones dinámicas donde cada solicitud intercaja contenido único en el prefijo.

### Por qué este es un problema de cronograma, no sólo un problema del núcleo

Se puede implementar el reutilización de KV como un truco del núcleo. La visión de SGLang es que el reutilización sólo paga si el programador mantiene el residente de la rama caliente. Una política ingenua de "reutilización si está disponible" hará que la caché se cargue bajo carga mixta. El programador indexado por árbol radix es lo que convierte el truco del núcleo en una ventaja de producción del 29%.

### Interacción con vLLM

En 2026 se añadió el prefijo de caché (`--enable-prefix-caching`La brecha se cerró pero no desapareció por completo  La pila entera de SGLang es radix-first; vLLM la injertó. Para cargas de trabajo dominadas por el uso reutilizado de prefijos, SGLang sigue siendo el predeterminado. Para la entrega de propósito general sin patrones de prefijos fuertes, vLLM sigue siendo igual o mejor.

```figure
roofline
```

## Usalo

`code/main.py`Implementa una caché KV de juguete radix-tree más un cronista con dos políticas: FCFS y caché-consciente. ejecuta la misma carga de trabajo a través de ambos, informa la tasa de impacto de prefijo-cache y el delta de rendimiento. Luego ejecuta una carga de trabajo "ordenando desordenado" para mostrar el colapso de 6.4x.

El [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?workload=shared&shared=4096)La máquina muestra la caché de radix en una ejecución real L4. Cuatro grupos tienen cada uno su propio prompt de sistema de tokens 4.096. La primera solicitud de un grupo calcula su prompt. Mientras que ese prompt se queda en la caché, las solicitudes posteriores del grupo solo computa la pregunta de 128 tokens.

## Envío

Esta lección produce`outputs/skill-radix-scheduler-advisor.md`. Dado una descripción de la carga de trabajo (forma de plantilla de solicitud, patrón de recuperación, número de inquilinos simultáneos), produce una receta de pedido de solicitud y una opción de no-entrada para la adopción de SGLang.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Comparar FCFS y cache-consciente en la misma carga de trabajo. ¿De dónde viene el delta  ahorros de preempleo, ahorros de descifrado o retraso en la cola?
2. Modificar la carga de trabajo para que las instrucciones al azar permute `[system, tools, context]`¿Qué pasa con el ritmo de impacto?
3. Calcule el costo de HBM de mantener un sistema de 2,000 tokens de residencia rápida como una rama radix en Llama 3.1 8B. Compara con el costo de un lote de 16 secuencias sin reutilización de prefijos.
4. Lea el artículo de SGLang RadixAttention. Explique en tres frases por qué el desalojo de LRU en forma de árbol supera a LRU en forma de bloque bajo carga pesada de prefijo.
5. Un cliente informa sólo un 8% de tasa de caché. Nombre tres causas probables y el diagnóstico que se ejecutaría para cada uno.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| RadixAttention | "the SGLang thing" | KV cache indexed as a radix tree so shared prefixes reuse blocks |
| Radix tree | "compact trie" | Tree where each node owns a token range and its KV blocks |
| Cache-aware scheduler | "hot-branch-first" | Scheduler that prefers requests sharing the resident branch |
| Prefix-cache hit rate | "how much of your prompt was free" | Fraction of prompt tokens served from reused KV blocks |
| FCFS | "first-come first-served" | Default scheduling that breaks prefix locality |
| Branch-level LRU | "evict the leaf" | Eviction policy matched to radix shape |
| Prompt template ordering | "the cache key" | The prompt's component order determines what the tree can share |
| System prompt pinning | "resident prefix" | Keep the immutable system portion pinned to avoid eviction thrash |

## Leer más

- [SGLang GitHub](https://github.com/sgl-project/sglang) fuente y documentos.
- [SGLang documentation](https://sgl-project.github.io/) Radix Atención y detalles de programación.
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) la referencia del diseño.
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) Números de referencia y razón del programador.
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) La propia implementación de vLLM en forma de radix, para comparación.
