# Memoria híbrida: Vector + Gráfico + KV

> La memoria híbrida ejecuta tres almacenes en paralelo  vector para la similitud semántica, KV para la búsqueda rápida de hechos, gráfico para el razonamiento de relación entre entidades  con una capa de puntuación que las fusiona en la recuperación. Este es un patrón de producción ampliamente utilizado para la memoria externa; Mem0 (Chhikara et al., 2025) es una implementación de referencia.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Explica por qué una sola almacenaje (solo vector, solo gráfico, solo KV) es insuficiente para la memoria del agente.
- Nombre de Mem0 tres tiendas paralelas y para lo que cada uno optimiza.
- Describa la puntuación de fusión de Mem0  relevancia, importancia, actualidad  y por qué es una suma ponderada, no una jerarquía.
- Implementar una memoria de juguete de tres pisos en stdlib con un `add()`que escribe a los tres y a`search()`que fusiona los resultados.

## El problema

Cada tienda es adecuada para una de las tres clases de consultas:

- **Semantic similarity**¿Qué hablamos sobre la deriva de agentes la semana pasada? Vector gana, KV y grafo faltan.
- **Fact lookup** "cuál es el número de teléfono del usuario?" KV gana; vector es un desperdicio, gráfico es un exceso.
- **Relationship reasoning**¿Qué clientes comparten la misma entidad de facturación?

Los agentes de producción emiten los tres en una sola sesión. Una memoria de una sola tienda siempre es incorrecta para dos de ellos.`add`- ¿ Qué ?`search`superficie con una función de puntuación que las fusiona.

## El concepto

### Tres tiendas en paralelo

Mem0 (arXiv:2504.19413, abril 2025) en `add(text, user_id, metadata)`¿Qué es esto ?

1. Extraer datos de los candidatos del texto (un paso impulsado por el LLM).
2. Escriba cada hecho en el almacén vectorial (embedding) para la búsqueda semántica.
3. Escriba cada hecho en el almacén KV con teclado (user_id, fact_type, entity) para $O(1)$- ¿Qué?
4. Escriba cada hecho en el almacén de gráficos (Mem0g) como bordes tipografados para consultas de relación.

En el`search(query, user_id)`¿Qué es esto ?

1. La tienda vectorial devuelve el top-k incorporando cosino.
2. KV almacenaje devuelve los hits directos claves en la consulta derivada (user_id, tipo, entidad).
3. Almacenamiento de gráficos devuelve subgrafo accesible desde las entidades de consulta.
4. Una capa de puntuación fusiona los tres.

### Punto de puntuación de fusión

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **Relevance** cosino vectorial, KV coincidencia exacta, peso de la trayectoria del gráfico.
- **Importance** etiquetado en el momento de escribir o aprendido (algunos hechos son más importantes: nombres, identidades, políticas).
- **Recency** decadencia exponencial con el tiempo desde la última escritura o lectura.

Los pesos se ajustan por producto.`w_recency`para los agentes de chat; más alto `w_importance`para los agentes de cumplimiento; más alto `w_relevance`para agentes de recuperación.

### Memorandum y razonamiento temporal

Mem0g añade un detector de conflictos. Cuando un hecho nuevo contradice un borde existente, el borde existente se marca inválido pero no se elimina.

Este es el comportamiento de grado de cumplimiento que generaliza el patrón de invalidación de Letta.

### Números de referencia

El documento Mem0 presenta los siguientes informes (2025):

- **LoCoMo**(memoria de conversación de larga duración): 91.6
- **LongMemEval**(memoria episódica de largo horizonte): 93,4
- **BEAM 1M**(Metería de referencia de memoria de tokens): 64,1

Las líneas de referencia de comparación (LLM de contexto completo 128k, tienda de vectores planos, KV plano) pierden más de 10 puntos.

### Taxonomía de alcance

Mem0 divide la memoria por alcance:

- **User memory** persiste durante las sesiones, con teclado en `user_id`¿ Qué ?
- **Session memory** persiste dentro de un hilo.
- **Agent memory** Estado de instancia por agente.

Cada escrito elige un alcance. La recuperación puede hacer consultas a través de ámbitos con pesos por alcance. Mezclar ámbitos sin pensar es como obtener "el asistente le dijo a Alice sobre el proyecto de Bob" incidentes.

### Cuando este patrón va mal

- **Embedding drift.**Los resultados vectoriales que se ven bien en las primeras cien consultas se degradan a medida que el corpus crece.
- **KV schema creep.** `(user_id, type, entity)`Parece simple hasta que cada equipo añade su propio .`type`Auditará el tipo establecido trimestralmente.
- **Graph explosion.**Un extractor ruidoso añade 50 bordes por mensaje.`add`Llamamos; dejamos de lado los bordes de baja confianza.

```figure
ae-memory-fusion
```

## Construye el mismo

`code/main.py`Implementa el patrón de tres pisos en stdlib:

- `VectorStore` similitud ingenuo de token-overlap como un sustituto de incorporación.
- `KVStore` dictado con teclas `(user_id, fact_type, entity)`¿ Qué ?
- `GraphStore` bordes tipografados (sujeto, relación, objeto, válido).
- `Mem0` fachada de nivel superior con `add()`¿ Qué ?`search()`, la puntuación de fusión, y la recuperación consciente del alcance.
- Un rastro de trabajo en una conversación multi-usuario, multi-sesión.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La salida muestra tres vías de recuperación separadas más el top-k fusionado.`main()`y ver el cambio de clasificación.

## Usalo

- **Mem0 (Apache 2.0)** listo para producción. Auto-host con Postgres + Qdrant + Neo4j, o use la nube gestionada.
- **Letta** núcleo/recall/archivo de tres niveles; trae sus propios retroespectos vectoriales y gráficos.
- **Zep** alternativa comercial con KG temporal y extracción de hechos.
- **Custom builds** cuando se necesita un control exacto sobre el extractor (conformidad) o sobre los pesos de fusión (agentes de voz donde la recencia domina).

## Envío

`outputs/skill-hybrid-memory.md`genera un andamio de memoria de tres pisos con un marcador de fusión, taxonomía de alcance y invalidación temporal conectado.

## Los ejercicios

1. Replace la similitud de vector de juguete con un modelo de incorporación real (transformadores de oración, Ollama, incorporaciones OpenAI).
2. Añadir una consulta temporal: `search(query, as_of=timestamp)`¿Qué tienda necesita más trabajo?
3. Implementar un detector de conflictos: si un hecho entrante contradice un borde de gráfico, inválique el borde antiguo y registre ambos.
4. Portar el marcador de fusión para incluir un `user_feedback`dimensiones (pues arriba en los registros recuperados). ¿Cómo evitar juegos (el agente sólo devuelve registros que ya le gustaron)?
5. Lea los documentos de Mem0 (`docs.mem0.ai`¿ Por qué no lo haces ?`mem0`Comparar la calidad de recuperación en las mismas 20 consultas de prueba.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hybrid memory | "Vector plus graph plus KV" | Three stores written in parallel, fused on retrieval |
| Fact extraction | "Memory ingestion" | LLM step that breaks text into (entity, relation, fact) tuples |
| Fusion scoring | "Relevance ranking" | Weighted sum of relevance, importance, recency |
| Scope | "Memory namespace" | user / session / agent — determines who sees what |
| Mem0g | "Memory graph" | Typed edges with temporal validity for relationship queries |
| Temporal invalidation | "Soft delete" | Mark contradicted edges invalid; never delete |
| Embedding drift | "Retrieval rot" | Vector quality degrades as corpus grows; re-embed periodically |

## Leer más

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) el papel original
- [Mem0 docs](https://docs.mem0.ai/platform/overview) API de producción, SDK, nube gestionada
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) el predecesor de contexto virtual
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) el diseño de los hermanos de tres niveles
