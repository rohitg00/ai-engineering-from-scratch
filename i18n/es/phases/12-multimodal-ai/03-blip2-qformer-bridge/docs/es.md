# Desde CLIP a BLIP-2  Q-Former como puente de modalidad

> CLIP alinea imágenes y texto, pero no puede generar captulos, responder preguntas o mantener una conversación. BLIP-2 (Salesforce, 2023) resolvió que con un pequeño puente entrenable: 32 vectores de consulta aprendizables asisten a las características de un ViT congelado a través de la atención cruzada, luego se inserten directamente en el flujo de entrada de un LLM congelado. 188 millones de parámetros de puente conectaron un ViT-g/14 a LLMs congeladas de tamaño igual al 11B Flan-T5-XXL. Cada VLM basado en un adaptador hasta 2026  MiniGPT-4, InstructBLIP, primos de LLaVA  es un descendiente. Esta lección lee la arquitectura del Q-Former, explica su entrenamiento en dos etapas y construye una versión de juguete que alimenta tokens visuales en un decodificador de texto congelado.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, cross-attention + learnable-query demo)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 7 (Transformers)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Explica por qué un cuello de botella manejable entre un codificador de visión congelado y un LLM congelado supera el ajuste de costos y estabilidad de extremo a extremo.
- Implementar un bloque de atención cruzada donde un conjunto fijo de consultas de aprendizaje atienden las características de la imagen externa.
- Caminar a través de la preparación de dos etapas de BLIP-2: representación (ITC + ITM + ITG) y luego generativa (perdida de LM con decodificador congelado).
- Compara Q-Former con el proyector MLP más simple utilizado en LLaVA y discuta cuándo gana cada elección.

## El problema

Tiene un ViT congelado que produce 256 tokens de parches de dim 1408 por imagen. Tiene un LLM congelado 7B que espera embeddings de tokens de dim 4096. El puente obvio  una capa lineal de 1408 a 4096  funciona, pero alimentar a todos los 256 tokens de parches en el contexto del LLM cuesta 256 tokens adicionales por imagen.

La pregunta del BLIP-2: ¿puedes comprimir la representación de la imagen de 256 tokens en mucho menos tokens (digamos 32) mientras conservas suficiente información para que el LLM pueda escribir, responder preguntas y razonar sobre la imagen? ¿Puedes entrenar este puente sin tocar las espinas congeladas, manteniendo el costo de entrenamiento en los parámetros del puente?

La respuesta: un Q-Former. 32 vectores "queri" aprendibles que atenden cruzados a los tokens de parches de ViT, produciendo un resumen visual de 32 tokens que el LLM consume. 188M parámetros totales.

## El concepto

### Las preguntas que se pueden aprender

El truco principal del Q-Former: en lugar de dejar que los tokens de texto del LLM atiendan a los parches de imagen, introduzca un nuevo conjunto de 32 vectores de consulta aprendizables `Q`Las consultas son parámetros del modelo  se aprenden durante el entrenamiento y se utilizan las mismas 32 consultas para cada imagen.

Después de la atención cruzada, cada consulta contiene un resumen comprimido de la imagen  "describir el objeto principal", "describir el fondo", "contar los objetos", etc. Las consultas no se especializan literalmente en etiquetas semánticas; aprenden lo que sea la codificación que hace caer las pérdidas en el torrente descendente.

### Arquitectura

El Q-Former es un pequeño transformador (12 capas, ~ 100M parámetros) con dos caminos:

1. Camino de consulta: 32 vectores de consulta fluyen a través de la autoatención (entre sí), luego la atención cruzada sobre las fichas de parche de ViT congeladas, luego FFN.
2. Ruta de texto: un codificador de texto similar a BERT comparte la autoatención y los pesos FFN con la ruta de consulta.

En el tiempo de entrenamiento, ambas vías se ejecutan. Las consultas y el texto interactúan a través de la autoatención compartida, lo que significa que las consultas pueden condicionar el texto para tareas que lo necesitan (ITM, ITG).

### Formación en dos etapas

El BLIP-2 se prepara en dos etapas:

Fase 1: aprendizaje representativo (sin LLM). Tres pérdidas:
- ITC (contraste de imagen-texto): contraste de estilo CLIP entre los tokens de consulta combinados y el token CLS de texto.
- ITM (imagen-texto coincidiendo): clasificador binario  ¿Es este par de imagen-texto coincidente?
- ITG (generación de texto basado en imágenes): LM causal en texto, condicionado a las consultas.

Sólo los trenes de Q-Former, el ViT está congelado, no hay LLM involucrado.

Etapa 2: aprendizaje generativo. adjunta un LLM congelado (OPT-2.7B o Flan-T5-XL, etc.). proyecta los 32 resultados de la consulta a la inclusión de la LLM a través de una pequeña capa lineal. prepárelos para el texto de la solicitud. Entrena sólo la proyección lineal y el Q-Former en la pérdida de LM sobre la secuencia de solicitud + imagen + título concatenada.

Después de la etapa 2, la proyección Q-Former + es el adaptador visual completo. En la inferencia: imagen → ViT → Q-Former → proyecto lineal → prependido a texto → congelado LLM emite salida.

### Economía de parámetros

BLIP-2 con ViT-g/14 (1.1B, congelado) + OPT-6.7B (6.7B, congelado) + Q-Former (188M, entrenado) = 8B total, 188M entrenado. El Q-Former solo es ~2.4% de los parámetros de la pila completa. El costo de entrenamiento refleja esto: días en un puñado de A100s vs semanas para el final a final.

Calidad: BLIP-2 coincide o supera al Flamingo-80B en VQA de tiro cero mientras es 50 veces más pequeño.

### InstructBLIP y el Q-Former que tiene conocimiento de las instrucciones

InstructBLIP (2023) extiende el Q-Former con una entrada adicional: el texto de instrucción en sí. En el tiempo de atención cruzada, las consultas ahora tienen acceso tanto a los parches de imagen como a la instrucción. Las consultas pueden especializarse por instrucción ("contar los coches", "describir el estado de ánimo") en lugar de aprender un solo resumen fijo.

### MiniGPT-4 y el enfoque solo con proyector

MiniGPT-4 mantuvo el Q-Former pero entrenó sólo la proyección lineal de salida mientras congelaba todo lo demás. Barato, pero el costo es calidad  las consultas eran de BLIP-2, no las tuyas. Buenas para la iteración rápida, no la mejor arquitectura.

### ¿Por qué LLaVA fue más simple?

LLaVA (2023, Lección 12.05) reemplazó al Q-Former con un MLP de 2 capas que proyecta cada token de parche ViT en espacio LLM  576 tokens por imagen para una cuadrícula 24x24, todos alimentados al LLM. Peor compresión pero deja que el LLM asista sobre parches crudos. En ese momento esto era controvertido; a finales de 2023 era dominante porque los datos de instrucción visual (LLaVA-Instruct-150k) demostraron que el MLP podía ser entrenado para preservar suficiente señal. El compromiso: El contexto de LLaVA se llena más rápido, pero se escala naturalmente a imágenes y videos múltiples.

Para 2026, el campo se divide: Q-Former sobrevive donde el presupuesto de los tokens importa (vídeo largo, muchas imágenes); el proyector MLP domina donde la calidad bruta por token es la prioridad.

### La atención cruzada por la puerta: Flamingo, el antepasado

Flamingo (Ley 12.04) precedió a BLIP-2 y utilizó la misma idea de atención cruzada pero en cada capa de LLM congelada, no como un solo puente. BLIP-2 mostró que se puede comprimir a la capa de entrada solo y aún funcionar. Gemini e Idefics combinan ambos: tokens de entrada entrelazados más atención cruzada cerrada opcional para pocos disparos en contexto.

### Los descendientes de 2026

- Previo: BLIP-2, InstructBLIP, MiniGPT-4, y la mayoría de los modelos de lenguaje de vídeo por razones de presupuesto token.
- Re-sampler de percepción: variante de Flamingo (lección 12.04); familia Idefics, Eagle, OmniMAE.
- Proyector MLP: LLaVA, LLaVA-NeXT, LLaVA-OneVision, Cambrian-1.
- La piscina de atención: VILA, PaliGemma.

Las cuatro son válidas. La pregunta decisiva es si usted está limitado en el presupuesto de token o en la calidad por token.

```figure
modality-projection
```

## Usalo

`code/main.py`construye una atención cruzada al estilo de Q-Former:

1. Simula 256 fichas de parche de imagen (dim 128).
2. Instantánea 32 consultas de aprendizaje (dim 128).
3. Ejecutar la atención cruzada de producto de punto a punto (Q de consultas, K/V de parches).
4. Proyecto a LLM-dim (512) a través de una capa lineal.
5. Saque los 32 tokens visuales listos para LLM.

Todo matemática en Python puro (bucles anidados sobre vectores). juguete pero forma correcta. La matriz de peso de atención se imprime para que pueda ver de qué parches se extrae cada consulta.

## Envío

Esta lección produce`outputs/skill-modality-bridge-picker.md`. Dado una configuración VLM objetivo (conto de tokens del codificador de visión, presupuesto de contexto de LLM, restricciones de implementación, objetivo de calidad), recomienda el nuevo muestreo Q-Former vs MLP vs Perceiver con una justificación corta y una estimación del número de parámetros para cada puente.

## Los ejercicios

1. Implemente el bloque de atención cruzada en PyTorch. Verifique que con 32 consultas y 256 claves/valores, la matriz de peso de atención es de 32 x 256 y cada fila suma a 1 después de softmax.

2. En la etapa 1 de BLIP-2, el Q-Former ejecuta tres pérdidas simultáneamente: ITC, ITM, ITG. Escriba la firma hacia adelante para cada uno en pseudo-código. ¿Cuál de ellas requiere que la ruta del codificador de texto esté activa?

3. Comparar los recuentos de parámetros: Q-Former (12 capas, 768 ocultas) vs un proyector MLP de 2 capas (1408 → 4096, dos capas).

4. Lea la sección 3.2 del documento BLIP-2 (arXiv:2301.12597) sobre cómo se inicializa el Q-Former.

5. Para un video de 10 minutos a 1 FPS muestrado a 60 cuadros, calcular el costo de los tokens por cuadro en (Q-Former → 32 tokens/frame) vs (proyector MLP → 576 tokens/frame). ¿Cuántos cuadros puede caber cada puente en una ventana de contexto de LLM de 128k-token antes de que el texto de solicitud obtenga espacio?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Q-Former | "Querying transformer" | Small transformer with 32 learnable query vectors that cross-attend to frozen ViT features |
| Learnable queries | "Soft prompt for vision" | A fixed set of parameters that serve as the query side of cross-attention; learned per model, shared across all inputs |
| Cross-attention | "Q from here, K/V from there" | Attention where query, key, and value come from different sources; how the queries pull from ViT patches |
| ITC | "Image-text contrastive" | CLIP-style loss applied to Q-Former pooled queries vs text CLS |
| ITM | "Image-text matching" | Binary classifier on hard-negative-mined pairs; forces the queries to discriminate fine-grained mismatches |
| ITG | "Image-grounded text generation" | Causal LM loss where text is generated conditioned on queries; forces queries to encode text-decodable content |
| Two-stage pretraining | "Representation then generative" | Stage 1 trains Q-Former alone (ITC/ITM/ITG); Stage 2 attaches frozen LLM and trains only the projection + Q-Former |
| Frozen backbone | "Do not finetune" | The vision encoder and LLM weights are fixed; only the bridge trains |
| Projection head | "Linear to LLM dim" | Final linear layer mapping Q-Former output to the LLM's embedding dimension |
| Perceiver resampler | "Flamingo's version" | Similar learnable-query cross-attention; Flamingo runs it once per image to make fixed latents, then reads them through gated cross-attention at every LLM layer |

## Leer más

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) el papel central.
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) el predecesor con el trío ITC/ITM/ITG.
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) "align antes de fusión"  el ancestro conceptual del entrenamiento de la etapa 1.
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) Q-Former, consciente de las instrucciones.
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) enfoque solo con proyector.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) arquitectura general para la atención cruzada entre las preguntas y las enseñanzas.
