# T5, BART  Modelos de codificación y decodificación

> Los codificadores entienden. Los decodificadores generan. Ponlos de nuevo juntos y obtienes un modelo construido para las tareas de entrada → salida: traducir, resumir, reescribir, transcribir.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## El problema

Cada una de las dos funciones de GPT y BERT, sólo para decodificadores, se desprende de la arquitectura de 2017 para un objetivo diferente.

- Traducción: Inglés → Francés.
- Resumen: artículo de 5,000 tokens → resumen de 200 tokens.
- Reconocimiento de voz: tokens de audio → tokens de texto.
- Extracción estructurada: prosa → JSON.

Para estos, el codificador-decodificador hace el ajuste más limpio. El codificador produce una representación densa de la fuente. El decodificador genera la salida, atendiendo cruzada a esa representación en cada paso. El entrenamiento es de cambio por uno en el lado de salida. La misma pérdida que GPT, solo condicionada a la salida del codificador.

Dos papeles definieron el libro de juegos moderno:

1. **T5**(Raffel et al. 2019). "Transformador de transferencia de texto a texto". Cada tarea de NLP se reformula como texto-en, texto-fuera. Arquitectura única, vocabulario único, pérdida única. Pretrainado en predicción de tiempo enmascarado (espacios corruptos en la entrada, decodificarlos en la salida).
2. **BART**(Lewis et al. 2019). "Transformador bidireccional y auto-regresista". Deniando autoencoder: entrada corrupta de múltiples maneras (interferir, máscarar, eliminar, girar), pida al decodificador que reconstruya el original.

En 2026 el formato de codificador-decodificador se mantiene en donde la estructura de entrada importa:

- Susurro (habla → texto).
- La pila de traducciones de Google.
- Algunos modelos de complementación / reparación de código que tienen estructuras de contexto y edición distintas.
- Flan-T5 y variantes para tareas de razonamiento estructurado.

Sólo el decodificador ganó el foco, pero el decodificador nunca se fue.

## El concepto

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### El bucle hacia adelante

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

El decodificador se ejecuta autoregresivamente pero atende cruzando a la salida del * mismo* codificador en cada paso.

### T5 Preentrenamiento  Corrupción de la duración

Seleccione intervalos aleatorios de la entrada (lengitud promedio de 3 tokens, 15% total).`<extra_id_0>`¿ Qué ?`<extra_id_1>`, etc. El decodificador sólo saca los espacios corruptos con su prefijo sentinela:

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

Una señal más barata que predecir toda la secuencia, competitiva con el MLM (BERT) y el prefijo-LM (UniLM) en la ablación del papel T5.

### BART preentrenamiento  Denuncia de múltiples ruidos

BART prueba cinco funciones de ruido:

1. Enmascaramiento de tokens.
2. Eliminación de tokens.
3. Infiltramiento de texto (mascarar un espacio, el decodificador inserta la longitud correcta).
4. Permutación de oraciones.
5. - La rotación de documentos.

La combinación de texto de relleno + permutación de oraciones produjo los mejores números en el torrente descendente. El decodificador siempre reconstruye el original. La salida de BART es la secuencia completa, no solo los intervalos corrompidos , por lo que el cálculo pre-entrenamiento es mayor que T5.

### Inferencia

La misma generación autoregressiva que GPT. Se aplica el muestreo codicioso / viga / top-p. La búsqueda de viga (ancho 45) es estándar para la traducción y resumen porque la distribución de salida es más estrecha que el chat.

### Cuándo elegir cada variante en 2026

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | Clear source sequence; fixed output distribution; beam search works |
| Speech-to-text | Yes (Whisper) | Input modality differs from output; encoder shapes audio features |
| Chat / reasoning | No, decoder-only | No persistent "input" — the conversation is the sequence |
| Code completion | Usually no | Decoder-only with long context wins; code models like Qwen 2.5 Coder are decoder-only |
| Summarization | Either works | BART, PEGASUS beat earlier decoder-only baselines; modern decoder-only LLMs match them |
| Structured extraction | Either | T5 is clean because "text → text" absorbs any output format |

La tendencia desde ~2022: sólo el decodificador se hace cargo de las tareas que el decodificador-encodificador solía poseer porque (a) los LLM solo con decodificador sintonizados con instrucciones se generalizan a cualquier cosa a través de la solicitud, (b) una arquitectura se escala más fácilmente que dos, (c) RLHF asume un decodificador.

```figure
encoder-decoder
```

## Construye el mismo

¿ Qué ?`code/main.py`Implementamos la corrupción de la extensión de estilo T5 para un corpus de juguetes la pieza más útil de esta lección porque aparece en cada receta de preentrenamiento de codificador-decodificador desde entonces.

### Paso 1: Corrupción de la extensión

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

El formato objetivo es la convención T5: `<sent0> span0 <sent1> span1 ...`La entrada corrompida intercaja tokens sin cambios con los tokens sentinel en ubicaciones de span.

### Paso 2: verifique el viaje de ida y vuelta

Dado el dato corrupto y el objetivo, reconstruye la oración original. Si su corrupción es reversible, el pase hacia adelante está bien definido. Esta es una verificación de la cordura  el entrenamiento real nunca hace esto, pero la prueba es barata y detecta errores individuales en su contabilidad de tiempo.

### Paso 3: ruido BART

Cinco funciones: `token_mask`¿ Qué ?`token_delete`¿ Qué ?`text_infill`¿ Qué ?`sentence_permute`¿ Qué ?`document_rotate`Componen dos de ellos y muestren el resultado.

## Usalo

Enlace de abrazo:

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

El truco T5: el nombre de la tarea entra en el texto de entrada. El mismo modelo maneja docenas de tareas porque cada tarea es de texto en, texto fuera. En 2026 este patrón ha sido generalizado por modelos de decodificación solo con instrucciones, pero T5 lo codificó primero.

## Envío

¿ Qué ?`outputs/skill-seq2seq-picker.md`. La habilidad escoge entre codificador-decodificador y decodificador-solo para una nueva tarea dada la estructura de entrada-salida, la latencia y los objetivos de calidad.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`, aplicar la corrupción de la franja de tiempo a una oración de 30 tokens, verificar que la concatenado de los tokens fuente no sentinel con los espacios de destino decodificados reproduce el original.
2. **Medium.**Implementar el BART `text_infill`ruido: sustituir los espacios aleatorios por un solo `<mask>`El decodificador debe inferir la longitud correcta de la franja más el contenido. Muestre un ejemplo.
3. **Hard.**- No . - ¿ Qué ?`flan-t5-small`En un pequeño corpus inglés → cerdo-latino (200 pares).`Llama-3.2-1B`en los mismos datos con el mismo cálculo.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | Two stacks: bidirectional encoder for input, causal decoder with cross-attention for output. |
| Cross-attention | "Where source talks to target" | Decoder's Q × encoder's K/V. The only place encoder information enters the decoder. |
| Span corruption | "T5's pretraining trick" | Replace random spans with sentinel tokens; decoder outputs the spans. |
| Denoising objective | "BART's game" | Apply a noise function to the input, train the decoder to reconstruct the clean sequence. |
| Sentinel token | "The `<extra_id_N>` placeholder" | Special tokens that tag corrupted spans in the source and re-tag them in the target. |
| Flan | "Instruction-tuned T5" | T5 fine-tuned on >1,800 tasks; made encoder-decoder competitive at instruction-following. |
| Beam search | "Decoding strategy" | Keep top-k partial sequences at each step; standard for translation/summarization. |
| Teacher forcing | "Training-time input" | During training, feed the true previous output token to the decoder, not the sampled one. |

## Leer más

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) T5.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461)- ¿Qué es eso?
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) Flan-T5.
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) Whisper, el codificador-decodificador canónico de 2026.
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) aplicación de referencia.
