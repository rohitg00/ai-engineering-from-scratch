# CLIP y la formación previa del lenguaje de visión contrastable

> CLIP (2021) de OpenAI demostró ser una idea lo suficientemente grande como para impulsar los próximos cinco años: alinear un codificador de imágenes y un codificador de texto en el mismo espacio vectorial utilizando solo pares ruidosos de captura de imágenes web y una pérdida de contraste. Cero etiquetas supervisadas. 400 millones de pares. El espacio de incorporación resultante hace una clasificación de tiro cero, recuperación de imágenes y texto y se conecta a cada VLM 2026 como su torre de visión. SigLIP 2 (2025) sustituyó a softmax por sigmoid y se amplió más allá de CLIP a menor costo. Esta lección recorre las matemáticas de InfoNCE a sigmoid loss pairwise y construye el paso de entrenamiento en stdlib Python.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, InfoNCE + sigmoid loss implementations)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 7 (Transformers)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Derivar la pérdida de InfoNCE de la información mutua e implementar una versión vectorizada numéricamente estable.
- Explica por qué la pérdida en pares sigmoide (SigLIP) se escala a lote 32768+ sin las exigencias de la máxima baja de carga total.
- ejecutar la clasificación de ImageNet de tiro cero mediante la construcción de plantillas de texto (`a photo of a {class}`) y tomar argmax sobre similitud cosina.
- Nombre de las cuatro palancas que le da el CLIP / SigLIP pre-entrenamiento: tamaño de lote, temperatura, plantilla de solicitud, calidad de datos.

## El problema

La visión pre-CLIP fue supervisada. Recoger conjuntos de datos etiquetados (ImageNet: 1.2M imágenes, 1000 clases), entrenar una CNN, enviar. Las etiquetas son caras, las etiquetas son sesgadas con lo que los etiquetadores pueden acordar, y las etiquetas no se transfieren a nuevas tareas sin ajuste fino.

La red de captura de imágenes tiene más de mil millones de pares de etiquetados libremente. Una foto de un retriever dorado con texto alternativo "mi perro Max en el parque" lleva una señal de supervisión  el texto describe la imagen.

La respuesta de CLIP: trate los pares de imágenes-capción como una tarea de coincidencia. Dado un lote de N imágenes y N capciones, aprenda a combinar cada imagen con su propia capción contra los distractores N-1. La supervisión es "estas dos cosas pertenecen juntas; estas N-1 no lo hacen".

El espacio de incorporación resultante hace más de lo que CLIP fue entrenado para. ImageNet funciona de tiro cero porque "una foto de un gato" se incrusta cerca de imágenes de gatos que nunca fueron etiquetados explícitamente gatos. Esta es la apuesta que generó cada 2026 VLM.

## El concepto

### El doble codificador

CLIP tiene dos torres:

- Código de imagen `f`: ViT o ResNet, saca un vector D-dim por imagen.
- Código de texto`g`: transformador pequeño, que emite un vector D-dim por subtítulo.

Ambas torres normalizan sus salidas a la longitud de la unidad.`cos(f(x), g(y)) = f(x)^T g(y)`ya que ambos son la norma de unidad.

Para un lote de$N$(imagen, capción) pares, construir la matriz de similitud `S`de forma`(N, N)`¿Qué es esto ?

```math
S[i, j] = \cos(f(x_i), g(y_j)) / \tau
```

donde`tau`es una temperatura aprendida (CLIP inicializa a 0.07; aprendida en el espacio log).

### Perdida de información sobre la NCE

CLIP utiliza una entropía cruzada simétrica sobre filas y columnas:

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

Esto es InfoNCE. La máxima suave en CE obliga a cada imagen a coincidir con su título más que con cualquier otro título en el lote. Los "negativos" son todos los otros artículos del lote. Los lotes más grandes = más negativos = señal más fuerte. CLIP entrenado en lote 32k; la escala importa.

### Temperatura

`tau`controlando la nitidez de la suavidad máxima.$\tau$→ Distribución aguda, efecto minero negativo duro.$\tau$→ suave, todas las muestras contribuyen. CLIP aprende $\log(1/\tau)$SigLIP 2 corrige la inicial$\tau$y utiliza un sesgo aprendido en su lugar.

### ¿Por qué la sigmoide se mide mejor (SigLIP)

Softmax necesita toda la matriz de similitud en sincronización. En el entrenamiento distribuido debes reunir todas las incorporaciones a cada réplica, luego hacer el softmax. Esto es cuadrático en tamaño mundial para la comunicación.

SigLIP sustituye softmax por sigmoide con base en elementos: para cada par `(i, j)`, la pérdida es una clasificación binaria de "es que estos son el par de coincidencia?" las etiquetas de clase positiva son la diagonal, todo lo demás es negativo.

```math
L = -\frac{1}{N} \sum_{(i, j)} \Big[ y_{ij} \log \mathop{\mathrm{sigmoid}}(S[i,j]) + (1-y_{ij}) \log \mathop{\mathrm{sigmoid}}(-S[i,j]) \Big]
```

`y_ij = 1`si`i == j`Cada GPU calcula su bloque local y sumas. SigLIP 2 escala para lotes de 32k-512k a bajo costo donde CLIP necesitaría proporcionalmente más comunicación.

### Clasificación de tiro cero

Dados N nombres de clases, para cada clase crear una plantilla de texto:

```
"a photo of a {class}"
```

Embed cada plantilla con el codificador de texto. Embed su imagen con el codificador de imagen. Argmax cosino similaridad = clase prevista. No se ha entrenado en las clases objetivo.

Las plantillas rápidas son importantes. El papel original de CLIP utilizaba 80 plantillas por clase (planas, artísticas, fotos, pinturas, etc.) y promedió los embebidos. +3 puntos de ImageNet. El uso moderno típicamente elige una o dos plantillas.

### Las sondas lineales y la regulación de la finalidad

Una sonda lineal (traen una capa lineal sobre las características CLIP congeladas para sus clases objetivo) supera la sonda lineal en tareas dentro del dominio.

### SigLIP 2: NaFlex y características densas

SigLIP 2 (2025) añade:
- NaFlex: un modelo único maneja proporciones de aspecto y resoluciones variables.
- Mejor características densas para la segmentación y la estimación de profundidad, dirigidas al uso como columna vertebral congelada en VLM.
- Multilingüe: formado en más de 100 idiomas donde CLIP era sólo en inglés.
- 1B escala paramétrica donde CLIP alcanzó el máximo de 400M.

En 2026 VLM abiertos, SigLIP 2 SO400m/14 es la torre de visión predeterminada. CLIP sigue siendo la opción predeterminada para la recuperación de texto de imagen pura donde la distribución específica de entrenamiento LAION-2B coincide con el patrón de consulta.

### El objetivo de la presente Decisión es garantizar que los Estados miembros puedan adoptar medidas de seguridad en el marco de la aplicación de la presente Directiva.

ALIGN (Google, 2021): la misma idea que CLIP, escala de pares 1.8B, 90% ruidoso. Escales de datos ruidosas probadas. OpenCLIP (LAION): reproducción abierta de CLIP en LAION-400M / 2B, escalas múltiples, el punto de control de acceso a la apertura. EVA-CLIP: inicializa desde el modelado de imágenes enmascaradas; fuerte columna vertebral para VLMs. Básico: CLIP+ALIGN híbrido de Google. Todas las mismas familias, datos diferentes y sintonización.

### El techo de tiro cero

Los modelos de clase CLIP tienen una cobertura de 76% de imagen de imagen de cero-shot (CLIP-G, OpenCLIP-G). Más allá requiere datos mucho más grandes (SigLIP 2 obtiene 80% +) o cambios de arquitectura ( cabezas supervisadas, más parámetros).

```figure
multimodal-fusion
```

## Usalo

`code/main.py`los instrumentos:

1. Un codificador dual de juguete (carácter de imagen basado en hash, características de gráfico de texto) para que pueda ver la forma de InfoNCE sin numpy.
2. Perdida de InfoNCE en Python puro (estabilidad numérica a través de log-sum-exp).
3. Perdida sigmóide en pareja para comparación.
4. Una rutina de clasificación de tiro cero: computa la similitud cosina contra un conjunto de instrucciones de texto, argmax para predicción.

Los números absolutos son juguetes, la forma coincide con lo que emite un entrenador de CLIP real.

## Envío

Esta lección produce`outputs/skill-clip-zero-shot.md`. Dado un conjunto de imágenes (a través de la ruta) y una lista de clases objetivo, se construyen instrucciones de texto con la plantilla CLIP, se incorporan ambos lados con un punto de control indicado (por ejemplo, `openai/clip-vit-large-patch14`), y devuelve las predicciones top-1 / top-5 con puntuaciones de similitud. La habilidad se niega a hacer afirmaciones sobre clases que no están en la lista de instrucciones.

## Los ejercicios

1. Implemente InfoNCE para un lote de 4 pares a mano. Construye la matriz de similitud 4x4, ejecute softmax, seleccione la diagonal, computa entropía cruzada. Verifique su implementación de Python con este cálculo manual.

2. SigLIP utiliza un parámetro de sesgo `b`Además de la temperatura: `S'[i,j] = S[i,j]/tau + b`¿ Qué papel tiene ?`b`¿Cuándo se puede jugar cuando el lote tiene un gran desequilibrio de clases (mucho más negativos que positivos por fila)?

3. Construye un clasificador de disparos cero para gatos vs perros. Prueba dos plantillas rápidas: `a photo of a {class}`y `a picture of a {class}`¿El conjunto de plantillas bate solo?

4. Calcule el costo de comunicación de softmax InfoNCE vs sigmoid en pareja para una carrera de 512 GPU en lote 32k.$O(N)$, que como $O(N^2)$Cita la sección 4 de Siglip.

5. Leer el documento de OpenCLIP sobre las leyes de escala (arXiv:2212.07143, Cherti et al.). Reproduce su conclusión para la escala de datos a partir de las cifras: en el tamaño fijo del modelo, ¿cuál es la relación log-lineal entre la precisión de captura cero de ImageNet y el tamaño de los datos de entrenamiento?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| InfoNCE | "Contrastive loss" | Cross-entropy over a batch's similarity matrix; each item's positive is its paired item, negatives are everything else |
| Sigmoid loss | "SigLIP loss" | Per-pair binary cross-entropy; no softmax, no all-gather, scales cheaply in distributed training |
| Temperature | "tau" | Scalar that scales logits before softmax/sigmoid; controls sharpness of the distribution |
| Zero-shot | "no-finetune classification" | Use text prompts to construct class embeddings and classify by cosine similarity; no training on target classes |
| Prompt template | "a photo of a ..." | Text scaffold around a class name; affects zero-shot accuracy by 1-5 points |
| Dual encoder | "Two-tower" | One image encoder + one text encoder, outputs in shared D-dim space |
| Hard negative | "Tough distractor" | A negative similar enough to the positive that the model has to work to separate them |
| Linear probe | "Frozen + one layer" | Train only a linear classifier on top of frozen features; measures feature quality |
| NaFlex | "Native flexible resolution" | SigLIP 2 capability to ingest images at any aspect ratio and resolution without resizing |
| Temperature scaling | "log-parametrized tau" | CLIP parametrizes `log(1/tau)` so gradients behave; clips to prevent collapse to near-zero tau |

## Leer más

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) el documento CLIP.
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) Siglip.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) multilingüe + NaFlex.
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) escalar con datos ruidosos de la web.
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) Ley de escalación de OpenCLIP.
