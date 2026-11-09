# Estrategias de descomposición, comparadas

> El choque decide lo que su retriever puede salir a la superficie.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 lessons 04 (embeddings), 06 (RAG), 07 (advanced RAG); Phase 19 Track B foundations (lessons 20-29)
**Time:** ~90 minutes

## Objetivos de aprendizaje
- Implemente cinco estrategias de fragmentación desde cero: ventana fija, oración, división recursiva, agrupamiento semántico y encabezados de marcado estructural.
- Medir el recall@k en un corpus de fijación con intervalos de respuesta etiquetados con oro y explicar por qué una estrategia gana en prosa y una estrategia diferente gana en documentos técnicos.
- Lea una distribución de longitud de piezas y reconozca los modos de fracaso que inyecta cada estrategia: oraciones huérfanas, cortes de símbolo medio, piezas de encabezado solo, deriva semántica.
- Seleccione un estándar para un nuevo corpus sin ejecutar el índice de referencia inspeccionando tres propiedades: tipo de documento, longitud media del párrafo y si el formato tiene una estructura explícita.

## El problema

Cada tubería RAG comienza cortando documentos de origen en piezas lo suficientemente pequeñas como para que un modelo de incorporación se adapte a ellas y lo suficientemente grandes como para que cada pieza lleve una idea independiente.

Una consulta que pregunte "cómo se ve el umbral de abortos presupuestarios" sólo puede tener éxito si el elemento que mantiene el umbral de abortos es alcanzable. Si el divisor de ventanas fijas corta el valor de umbral del contexto circundante, la incorporación se mueve a un grupo diferente, la puntuación BM25 disminuye, los re-ranqueadores ven ruido y la respuesta que genera el LLM es incorrecta. El documento de 2024 "LongRAG: Mejorando la generación de recuperación aumentada con LLM de contexto largo" midió un 35 por ciento de cambio absoluto en la recuperación de recuerdos puramente por la elección de fragmentos. El trabajo de seguimiento en 2025 sobre los encabezados contextuales de los fragmentos redujo la brecha, pero no la cerró.

Esta lección construye cinco estrategias lado a lado, las ejecuta contra un corpus fijo con intervalos de respuesta etiquetados con oro, y te permite leer los números de recuerdo por ti mismo.

## El concepto

```mermaid
flowchart LR
  Doc[Source Document] --> S1[Fixed Window]
  Doc --> S2[Sentence]
  Doc --> S3[Recursive Split]
  Doc --> S4[Semantic Cluster]
  Doc --> S5[Structural Markdown]
  S1 --> Chunks1[Chunks]
  S2 --> Chunks2[Chunks]
  S3 --> Chunks3[Chunks]
  S4 --> Chunks4[Chunks]
  S5 --> Chunks5[Chunks]
  Chunks1 --> Index[Embedding Index]
  Chunks2 --> Index
  Chunks3 --> Index
  Chunks4 --> Index
  Chunks5 --> Index
  Index --> Eval[Recall@k vs Gold Spans]
```

### Ventana fija

La línea de base de fuerza bruta. Cortar todos los caracteres N. Opcionalmente superponerse para que una oración cortada en posición N aparezca entera dentro del pedazo que comienza en posición N - superposición. Rápido, determinista, terrible en límites.

### Sentencia

Se divide en límites de oraciones con un regex o una máquina de estado simple. empaque una o más oraciones en un pedazo hasta un presupuesto de caracteres objetivo. Deje de cortar la mitad de la palabra. Aún corta la mitad del párrafo y la mitad de la sección. El defecto en muchas primeras tuberías de RAG y una elección razonable para la prosa sin otra estructura.

### División recurrente

La estrategia de jerarquía popularizada por las bibliotecas de la era de 2023. Trate de dividir en el separador más fuerte primero (doble nueva línea, párrafo), regresar al siguiente (una nueva línea), luego a las oraciones, luego a los caracteres. La recursión termina cuando el trozo se ajusta al presupuesto.

### Clustering semántico

Embed cada oración. Cluster oraciones contiguas que comparten un tema centroid. Cortar siempre que la similitud de ejecución con el centroideo cae por debajo de un umbral. Los límites reflejan el significado, no los caracteres. Más lento de construir y dependiente del modelo de embebedimiento, pero resistente contra documentos que cambian de tema dentro de un párrafo.

### Título de marcado estructural

Para documentos que lleven una estructura explícita (marcado, texto reestructurado, secciones numeradas al estilo RFC), cortar en los límites de la cabeza. Cada pieza se convierte en la cabeza más todo lo que está debajo de ella hasta la siguiente cabeza en el mismo nivel o más alto. Piezas más pequeñas por tema, pero sólo disponibles cuando el corpus está bien formado.

### Cómo recall@k mide la elección de límites

Una consulta con etiqueta de oro contiene los caracteres exactos de la intervalo de respuesta dentro del documento fuente. Después de la fragmentación, usted pregunta: ¿alguno de los trozos de arriba-k que el retriever devolvió se superponen a la franja de oro? Si es así, recall@k para esa consulta es 1. Si no, es 0. Promedio en el conjunto de consultas. Ejecutar la misma evaluación para cada estrategia y el spread le muestra qué política de límites sobrevive al corpus que tiene.

```figure
ci-chunk-boundaries
```

## Construye el mismo

`code/main.py`los instrumentos:

- `fixed_window(text, size, overlap)`- la línea de base.
- `sentence_chunks(text, target)`- Un simple paquete de oraciones.
- `recursive_split(text, separators, target)`- la recursión jerárquica.
- `semantic_chunks(text, similarity_threshold)`- agrupamiento basado en centróides sobre una simulación determinista de inserción.
- `structural_markdown(text)`- El separador de cabezas.
- `mock_embed(text, dim)`- una incorporación basada en hash para que el bucle se ejecute fuera de línea.
- `DenseIndex`- la misma forma utilizada en la lección de recuperación híbrida de la pista B de la fase 19.
- `eval_recall(strategy, corpus, queries, k)`- el bucle de comparación.
- ¿ Qué es esto ?`main()`que ejecuta todas las estrategias en el corpus de fijación e imprime una tabla de recall@k.

- ¿Qué quieres decir ?

```bash
python3 code/main.py
npx tsx code/main.ts
```

La salida es una pequeña tabla con una fila por estrategia y una columna por k. La oración pierde en la fijación estructurada. La marcación estructural gana en la fijación de marcación. El recursivo mantiene su propio en la fijación mixta porque la recursión se adapta. La agrupación semántica gana en la fijación de prosa donde no hay señales estructurales útiles.

## Modo de falla la tabla no se ocultará

**Orphan sentences.**El empaquetado de oraciones produce trozos que pierden la oración del tema. La incorporación luego apunta al grupo equivocado.

**Mid-symbol cuts.**El código interno de ventana fija o YAML dividirá un identificador en la mitad.

**Header-only chunks.**La marcada estructural emite un pedazo que no contiene nada más que `## Title`Filtralas o adjunta el primer párrafo del siguiente trozo.

**Semantic drift.**Los grupos semánticos se reducen cuando el corpus está uniformemente en el tema. Un fragmento de 5000 caracteres empaqueta muchas respuestas específicas en una incrustación difusa. Combine la semántica con una tapa de caracteres duros.

**Stale embeddings.**El clustering semántico utiliza un modelo de incorporación. Si cambia el modelo, también cambia los trozos. Enfilar el modelo de trozo por separado del modelo de recuperación o reconstruir el índice juntos.

## Elegir un valor predeterminado sin ejecutar el índice de referencia

Tres propiedades deciden el fragmento predeterminado para un nuevo corpus.

| Property | Value | Default |
|----------|-------|---------|
| Document type | Prose with no structure | Recursive split, target 800 |
| Document type | Markdown / RFC / API docs | Structural markdown |
| Document type | Code | AST-aware (out of scope; see Phase 19 lesson 02) |
| Paragraph length | Long, single topic | Sentence, target 500 |
| Paragraph length | Short, mixed topics | Semantic, threshold 0.6 |

Cuando tenga dudas, elija la división recursiva. Es la base de estrategia única más fuerte.

## Usalo

Modelos de producción:

- Ejecutar la evaluación antes de enviar un nuevo pipeline; no confíe en la estrategia de su biblioteca por defecto.
- Re- ejecuta la evaluación cada vez que cambie el modelo de incorporación o la mezcla de corpus; el ganador es corpus-dependiente.
- Persiste el nombre de la estrategia en los metadatos de cada pieza para que puedas atribuir regresiones más tarde.

## Envío

El sistema RAG de pista F de extremo a extremo en la lección 69 utiliza el chunker seleccionado aquí como su primera etapa.`eval_recall`Elige la estrategia que gane en tu cuerpo y promueve.

## Los ejercicios

1. Añadir una sexta estrategia: token-window usando `tiktoken`Comparar con la ventana fija en el mismo dispositivo.
2. Inyecta una fracción del 30% de bloques de código en el elemento de prosa, vuelve a ejecutar la tabla, explica por qué todas las estrategias excepto la marcación estructural pierden memoria.
3. Reemplazar la incorporación determinista por la del proveedor real de su proyecto. Medir el delta de recall de agrupamiento semántico. Informar si la diferencia entre estrategias se amplía o se reduce.
4. Añadir un`summary`campo por pieza: una descripción de centróide de una frase. Reexercer la evaluación con el resumen adjunto al cuerpo de la pieza. Medir el levantamiento de recuerdo.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Recall@k | "Did we get the right chunk?" | Fraction of queries where any of the top-k chunks overlaps the gold answer span |
| Chunk overlap | "Sliding window" | Re-include the last N characters of the previous chunk in the next chunk |
| Structural splitter | "Header-aware chunks" | Cut at H1/H2/H3 boundaries; the heading text is part of the chunk |
| Semantic chunker | "Topic-aware chunks" | Embed sentences, cluster by centroid similarity, cut on drift |
| Centroid drift | "Topic shift" | Cosine similarity between the running mean and the next sentence drops past a threshold |

## Leer más

- [LongRAG: Enhancing Retrieval-Augmented Generation with Long-context LLMs (arXiv 2406.15319)](https://arxiv.org/abs/2406.15319)
- [Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [LlamaIndex, Chunking strategies for production RAG](https://docs.llamaindex.ai/en/stable/optimizing/production_rag/)
- Fase 11 Lección 06 - Fundamentos del RAG
- Fase 11 lección 07 - RAG avanzada
- Fase 19 lección 65 - Recuperación híbrida que clasifica los trozos producidos aquí
- Fase 19 lección 68 - el valor de evaluación que califica la elección de estrategia en la producción
