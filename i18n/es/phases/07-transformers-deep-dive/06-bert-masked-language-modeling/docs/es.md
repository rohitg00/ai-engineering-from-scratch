# BERT  Modelado de lenguaje enmascarado

> GPT predice la siguiente palabra. BERT predice una palabra que falta. Una frase de diferencia  y media década de todo en forma de incrustación.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## El problema

En 2018, cada tarea de NLP  sentimiento, NER, QA, entailment  entrenó su propio modelo desde cero en sus propios datos etiquetados. No había un punto de control "entender inglés" pre-entrenado que pudiera ajustar. ELMo (2018) mostró que se podía entrenar pre-embeddings contextuales con un LSTM bidireccional; ayudó pero no generalizó.

BERT (Devlin et al. 2018) preguntó: ¿qué pasa si tomamos un codificador transformador, lo entrenamos en cada frase en Internet, y lo obligamos a predecir palabras faltantes del contexto en ambos lados?

El resultado: en 18 meses BERT y sus variantes (RoBERTa, ALBERT, ELECTRA) dominaron todos los listados de clasificación de la PNL que existían.

En 2026 los modelos de codificación solo son todavía la herramienta adecuada para la clasificación, recuperación y extracción estructurada.

## El concepto

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### La señal de entrenamiento

Toma una frase:`the quick brown fox jumps over the lazy dog`¿ Qué ?

Máscarar el 15% de los tokens al azar:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

Entrenar al modelo para predecir los tokens originales en posiciones enmascaradas.`[MASK]`en la posición 1 puede utilizar `brown fox jumps`En las posiciones 2+ eso es lo que el GPT no puede hacer.

### Las reglas de la máscara BERT

De los 15% de tokens seleccionados para la predicción:

- El 80% se sustituye por `[MASK]`¿ Qué ?
- El 10% se sustituye por un token aleatorio.
- El 10% se mantiene sin cambios.

¿ Por qué no siempre ?`[MASK]`¿ Por qué ?`[MASK]`El modelo de la formación para esperar`[MASK]`El 10% aleatorio + 10% inalterado mantiene el modelo honesto.

### Siguiente Previsión de Sentencia (NSP)  y por qué se dejó caer

BERT original también entrenó en NSP: dado dos oraciones A y B, predecir si B sigue A. RoBERTa (2019) lo ablacionó y mostró que NSP le duele, no ayuda.

### Lo que cambió en 2026: ModernBERT

El papel ModernBERT de 2024 reconstruyó el bloque con primitivos de 2026:

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

Y a diferencia de la pila de 2018, es nativo de atención flash. La inferencia es 23x más rápida a la longitud de secuencia 8K que DeBERTa-v3 con mejores puntajes GLUE.

### Casos de uso que todavía escogen un codificador en 2026

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

```figure
transformer-residual
```

## Construye el mismo

### Paso 1: Enmascarar la lógica

¿ Qué ?`code/main.py`La función`create_mlm_batch`Toma una lista de IDs de token, un tamaño de vocabulario y una probabilidad de máscara. devuelve IDs de entrada (con máscaras aplicadas) y etiquetas (solo en posiciones enmascaradas, -100 en otros lugares  Ignorar la convención de índice de PyTorch).

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### Paso 2: ejecutar predicción de MLM en un corpus pequeño

Entrenamos un codificador de 2 capas + cabeza MLM en un vocabulario de 20 palabras, 200 frases.

### Paso 3: comparación de tipos de máscaras

Muestre cómo la regla de tres vías mantiene el modelo utilizable sin `[MASK]`Las dos deben producir distribuciones simbólicas razonables porque el modelo vio ambos patrones en el entrenamiento.

### Paso 4: Tenga en cuenta la cabeza

Reemplazar la cabeza de MLM con una cabeza de clasificación en un conjunto de datos de sentimiento de juguete. Sólo las cabezas se mueven; el codificador está congelado. Este es el patrón que sigue cada aplicación BERT.

## Usalo

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers`modelos como `all-MiniLM-L6-v2`El codificador es el mismo, la pérdida cambió.

**Cross-encoder rerankers are also fine-tuned BERT.**Clasificación en pareja en `[CLS] query [SEP] doc [SEP]`La atención bidireccional entre la consulta y el documento es exactamente lo que da a los codificadores cruzados su ventaja de calidad sobre los codificadores bien.

**When not to pick BERT in 2026.**Cualquier cosa generativa. El codificador no tiene manera sensata de producir tokens autoregresivamente. También: cualquier cosa bajo los parámetros 1B donde un pequeño decodificador puede igualar la calidad con más flexibilidad (Phi-3-Mini, Qwen2-1.5B).

## Envío

¿ Qué ?`outputs/skill-bert-finetuner.md`. El alcance de las habilidades se ajusta a la finalidad de BERT (elección de la columna vertebral, especificación de la cabeza, datos, evaluación, detención) para una nueva tarea de clasificación o extracción.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Confirmar ~15% se seleccionan, y de esos ~80% se convierten en `[MASK]`¿ Qué ?
2. **Medium.**Implementar el enmascaramiento de palabras enteras: si una palabra es tokenizada en subpalabras, enmascarar todas las subpalabras juntas o ninguna. Medir si esto mejora la precisión de MLM en un corpus de 500 frases.
3. **Hard.**Entrenar un pequeño BERT de 2 capas, d=64, en 10.000 frases de un conjunto de datos público.`[CLS]`Comparar con una línea de base sólo para decodificadores en parámetros iguales ¿cuál gana?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## Leer más

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) papel original.
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692)¿Cómo entrenar bien a BERT? Mata a los NSP.
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) la detección de tokens sustituidos supera a MLM en computación coincidente.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) Papel de la revista ModernBERT.
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) referencia canónica del codificador.
