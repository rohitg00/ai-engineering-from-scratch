# Flamingo y Gated Cross-Attention para VLMs de pocos disparos

> DeepMind's Flamingo (2022) hizo dos cosas antes que nadie. Mostró que un solo modelo podía procesar secuencias arbitrariamente entrelazadas de imágenes, videos y texto. Y mostró que los VLM podrían aprender en contexto  dar un prompt de algunas tomas con tres pares de ejemplos (imagen, leyenda) y el modelo subtítulos una nueva imagen sin ningún paso de gradiente. El mecanismo: capas de atención cruzada cerradas, insertadas entre las capas existentes del LLM congelado, con una puerta tanh aprendida que comienza a cero para que la capacidad de texto del LLM se preserve en la inicialización. Esta lección recorre el nuevo modelo Perceptor de Flamingo y la arquitectura de atención cruzada cerrada, el ancestro de las entradas entrelazadas de Gemini y los tokens visuales de Idefics2.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, gated cross-attention + Perceiver resampler demo)
**Prerequisites:** Phase 12 · 03 (BLIP-2 Q-Former)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Explica cómo la atención cruzada cerrada preserva la capacidad de texto de un LLM congelado en la inicialización a través de tanh(gate) = 0.
- Caminar a través de un nuevo modelo de perceptor: N parches de imagen → K fijas consultas "latentes" a través de la atención cruzada.
- Describa cómo Flamingo maneja secuencias de texto-imagen entrelazadas con enmascaramiento causal que respete la colocación de la imagen.
- Reproduce una estructura de instancias multimodal de algunas tomas (3 ejemplos de captura de imagen y luego una imagen de consulta).

## El problema

BLIP-2 alimenta 32 tokens visuales en la capa de entrada de un LLM congelado. Funciona para una imagen por pedido. Pero ¿qué pasa si quieres alimentar *muchas* imágenes entrelazadas con texto, como en "aquí está la imagen A, subtítalo; aquí está la imagen B, subtítalo; ahora aquí está la imagen C, subtítalo"? La autoatención del LLM tendría que manejar tokens de imagen y tokens de texto en un solo flujo, y la pregunta de qué posiciones pueden asistir a qué imágenes se vuelve agitada.

La respuesta de Flamingo: no cambies en absoluto el flujo de entrada del LLM. Insertar capas de atención cruzada adicionales entre los bloques de LLM existentes. Los tokens de texto siguen fluyendo a través de la autoatención causal del LLM como siempre. Entre cada pocos bloques de LLM, los tokens de texto también atenden a las características de la imagen a través de una nueva capa cerrada. La puerta (iniciada a cero) significa que en el paso cero las nuevas capas no funcionan  el modelo se comporta exactamente como el LLM pre-entrenado. A medida que avanza el entrenamiento, la puerta se abre y la información visual comienza a fluir.

La segunda pregunta que Flamingo respondió: ¿cómo manejar un número variable de imágenes (0, 1 o muchas) por solicitud? Un resampler Perceptor  un pequeño módulo de atención cruzada que toma cualquier número de parches que tengas y produce un número fijo de tokens visuales latente por imagen. El total crece con el recuento de imágenes, pero cada token de texto lee solo los latences de una imagen, por lo que lo que cualquier token de texto único ve en la atención cruzada tiene la misma forma independientemente de cuántas imágenes hay en el prompt.

## El concepto

### El LLM congelado

Flamingo comienza con un LLM congelado de Chinchilla 70B. Todos los pesos de 70B no se han tocado.

### Re-muestreo del receptor

Para cada imagen en el prompt, el ViT produce $N$El nuevo modelo del perceptor tiene$K$Las aplicaciones de la aplicación de la tecnología de aprendizaje de la información de base (Flamingo utiliza $K=64$Cada bloque de repetición de muestras tiene dos subpasos:

1. La atención cruzada: el $K$Los latentes asisten a la$N$Los parches de parches (Q de parches latente, K/V de parches).
2. Autoatención + FFN dentro de los latences.

Después de 6 bloques de repetición, la salida es $K=64$Las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las imágenes de las de las de las imágenes de las de las de las de las de las de las de las de las de las de las de las de las de las de las imágenes de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de las de

Para el vídeo, el resampler se aplica temporalmente: los parches de cada marco producen 64 latencias, y una codificación posicional temporal permite que el modelo distinga $t=0$de la$t=N$El video completo se convierte en$T \cdot 64$los tokens visuales.

### La atención cruzada

Entre cada uno .$M$las capas de la LLM congelada (Flamingo utiliza $M=4$), se inserta un nuevo bloque de atención cruzada cerrado:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha`es un escalar aprendible iniciado a cero.
- `tanh(0) = 0`, por lo que en init la rama cerrada contribuye cero.
- Como`alpha`Si se aleja de cero, la contribución de atención cruzada crece sin problemas.
- La conexión residual significa que incluso una puerta completamente abierta no sobrescribe la representación de texto del LLM; solo añade información visual en la parte superior.

Esta es la elección de diseño más importante en Flamingo: el acondicionamiento visual es aditivo, cerrado y cero al iniciar.

### Atención cruzada enmascarada para entradas entrelazadas

En un mensaje de respuesta como "<imagen A> subtítulo A <imagen B> subtítulo B <imagen C> ?", cada token de texto solo debe ver imágenes que se presentaron antes que él en la secuencia. La máscara de atención cruzada aplica: token de texto en posición `t`sólo atiende a los tokens de resampler de imagen `i_t`, donde `i_t`es la imagen más reciente antes de la posición `t`Las señales de cada otra imagen están enmascaradas. "Vea sólo la última imagen anterior" o "ve todas las imágenes anteriores" son ambas opciones válidas; Flamingo eligió la primera.

### Aprendizaje en pocos disparos en contexto

Un mensaje de Flamingo parece:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

El modelo ve el patrón de finalización y las salidas "pájaro" (o lo que sea que la imagen3 muestra). No hay pasos de gradiente. La capacidad de aprendizaje en el contexto congelado del LLM lleva a través de la atención cruzada cerrada.

### Datos de formación

Flamingo entrenado en tres conjuntos de datos:

1. MultiModal MassiveWeb (M3W): 43 millones de páginas web con imágenes y texto entrelazados, reconstruyendo el orden de lectura.
2. Parejas de imagen y texto: ALIGN (1.8B parejas) más LTIP (312M parejas), aproximadamente 2.1B parejas en total.
3. Parejas de vídeo-texto (VTP): 27 millones de cortos clips de vídeo.

OBELICS (2023) es una reproducción abierta del corpus web entrelazado, en el que entrenan Idefics, Idefics2 y los modelos más abiertos "como Flamingo".

### OpenFlamingo y Otter

OpenFlamingo (2023) es la reproducción abierta. La arquitectura es idéntica (re-sampler del receptor + atención cruzada cerrada en LLaMA congelada o MPT).

Otter (2023) se basa en OpenFlamingo con la sintonización de instrucciones en MIMIC-IT (un conjunto de datos de instrucciones multimodal), mostrando trabajos de atención cruzada cerrada para instrucciones que siguen también.

### Los descendientes

- Idefics / Idefics2 / Idefics3: El linaje de atención cruzada cerrado de Hugging Face, progresivamente más simple (Idefics2 dejó caer el resampler a favor de tokens de parches directos con pooling adaptativo).
- Transición de Flamingo a Camelio: para 2024 muchos equipos se trasladaron a la fusión temprana (lección 12.11); la atención cruzada cerrada al estilo Flamingo sigue en producción donde se requiere congelamiento de la columna vertebral.
- La entrada entrelazada de Géminis: conceptualmente hereda la flexibilidad de formato entrelazado de Flamingo, aunque el mecanismo exacto es propietario.

### Comparación con BLIP-2

| | BLIP-2 | Flamingo |
|---|---|---|
| Visual bridge | Q-Former once at input | Gated cross-attention at every M layers |
| Visual tokens | 32 per image | 64 per image per cross-attn layer |
| Frozen LLM | Yes | Yes |
| Few-shot in-context | Weak | Strong — the paper's centerpiece |
| Interleaved inputs | No native support | Yes, the design target |
| Training data | 130M pairs | ~2.1B pairs + 27M video clips + 43M interleaved pages |
| Parameter count | 188M trained | ~10B trained (cross-attn layers) |
| Compute | Days on 8 A100s | Weeks on thousands of TPUv4 |

Elija BLIP-2 para una imagen única VQA en un presupuesto. Elija Flamingo/Idefics2 para el razonamiento intercalados, pocos disparos o múltiples imágenes.

```figure
cross-attention-fusion
```

## Usalo

`code/main.py`demuestra:

1. Un nuevo modelo de Perceptor en 36 tokens de parches falsos con 8 latencias aprendizables (pura atención cruzada de Python).
2. Un paso de atención cruzada cerrado con `alpha = 0`→ salida es igual a entrada (LLM sin cambios), entonces `alpha = 2.0`→ contribución visual mezclado.
3. Un constructor de máscaras entrelazadas que produce la máscara de atención 2D para una secuencia "(imagen 1) (texto 1) (imagen 2) (texto 2)".

## Envío

Esta lección produce`outputs/skill-gated-bridge-diagnostic.md`. Dado la configuración de un VLM abierto (resampler Y/N, frecuencia de acceso cruzado, esquema de puertas), identifica los elementos del linaje Flamingo y explica la estrategia de congelación.

## Los ejercicios

1. Computa el número de parámetros visuales de Flamingo-9B: 9B LLM + 1.4B capas de atención cruzada cerradas + 64M resampler. ¿Qué fracción de los parámetros totales se entrenan?

2. Implementar el residuo cerrado `y = tanh(alpha) * cross + x`En PyTorch. Muestre experimentalmente que con`alpha=0`¿ Qué ?`y==x`exactamente en el inicio.

3. Lea la sección 3.2 de OpenFlamingo (arXiv:2308.01390) sobre cómo manejan múltiples imágenes en un lote cuando cada mensaje tiene un conteo de imágenes diferente.

4. ¿Por qué la máscara de atención cruzada de Flamingo permite que un token de texto atenda a *sólo a la imagen anterior más reciente* en lugar de todas las imágenes anteriores?

5. En el contexto de pocas fotos: construye un prompt con 4 ejemplos de "imagen → color del objeto principal" para una nueva variante de Flamingo. Describa el patrón de precisión esperado a medida que varía el número de ejemplos de 0 a 8.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Perceiver resampler | "Fixed-latent cross-attention" | Module that produces K fixed tokens from a variable number of input patches |
| Gated cross-attention | "Tanh-gated bridge" | Residual layer `y = tanh(alpha)*cross + x`, learnable alpha, init 0 |
| Interleaved input | "Mixed sequence" | Prompt format with images and text mixed freely in reading order |
| Frozen LLM | "No LLM gradients" | The text LLM's weights do not update; only resampler + cross-attn layers train |
| Few-shot | "In-context examples" | Give a few (image, answer) pairs in the prompt; model generalizes without finetuning |
| OBELICS | "Interleaved web corpus" | Open dataset of 141M web pages with images and text in reading order |
| Chinchilla | "70B frozen base" | Flamingo's frozen text LLM, from DeepMind's Chinchilla paper |
| Gate schedule | "How alpha moves" | The rate at which the cross-attention gate opens during training |
| Cross-attn frequency | "Every M layers" | How often a gated cross-attention block is inserted; Flamingo uses $M=4$ |
| OpenFlamingo | "Open reproduction" | MosaicML/LAION open checkpoint at 3-9B; architecture-identical to Flamingo |

## Leer más

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) el papel original.
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) reproducción abierta.
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) corpus de la red entrelazado.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) la arquitectura general del Perceptor.
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726)Descendiente flamingo con instrucciones.
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) simplificación moderna del enfoque Flamingo.
