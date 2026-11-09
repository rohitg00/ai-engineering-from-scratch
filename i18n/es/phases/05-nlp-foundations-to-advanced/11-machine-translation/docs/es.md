# Traducción automática

> La traducción es la tarea que pagó la investigación de PNL durante treinta años y sigue pagando ahora.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## El problema

Un modelo lee una oración en un idioma y produce una oración en otro. La longitud varía. El orden de las palabras varía. Algunas palabras fuente se cartografian a múltiples palabras objetivo y viceversa. Los idiomas rechazan el mapeo uno a uno. "Te extraño" en francés es "tu me manques"  literalmente "me estás faltando".

La traducción automática es la tarea que obligó a la PNL a inventar codificadores-decodificadores, atención, transformadores y, finalmente, todo el paradigma de LLM. Cada paso adelante llegó porque la calidad de la traducción era medible y la brecha entre humanos y máquinas era terca.

Esta lección se salta la lección de historia y enseña la línea de trabajo de 2026: codificador-decodificador multilingüe preentrenado (NLLB-200 o mBART), tokenización de palabras, búsqueda de rayos, evaluación BLEU y chrF, y el puñado de modos de falla que aún se envían a la producción sin capturar.

## El concepto

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

El decodificador genera el objetivo, una subpalabra a la vez, utilizando la salida del codificador a través de la atención cruzada (lección 10). El decodificación utiliza la búsqueda de haz para evitar la trampa de decodificación codiciosa. La salida se destokeniza, detruca y se califica en relación con una referencia.

Tres opciones operativas impulsan la calidad de MT en el mundo real.

- **Tokenizer.**SentencePiece BPE se ha formado en un corpus de idiomas mixtos.
- **Model size.**NLLB-200 600M destilado se ajusta a una computadora portátil. NLLB-200 3.3B es el estándar de producción publicado. 54.5B es el límite máximo de investigación.
- **Decoding.**Ancho del haz de luz 4-5 para el contenido general. Penal de longitud para evitar una salida demasiado corta. Descifrado restringido cuando se necesita consistencia terminológica.

```figure
seq2seq-alignment
```

## Construye el mismo

### Paso 1: una llamada de MT pre-entrenada

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(model_id)

src = "The cats are running."
inputs = tok(src, return_tensors="pt")

out = model.generate(
    **inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),
    num_beams=5,
    length_penalty=1.0,
    max_new_tokens=64,
)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
```

```text
Les chats courent.
```

Tres cosas importan aquí.`src_lang`Indica al tokenizer qué guión y segmentación aplicar. `forced_bos_token_id`El programa de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código de código

### Paso 2: BLEU y chrF

BLEU mide superposición de n-gramos entre la salida y la referencia. Cuatro tamaños de n-gramos de referencia (1-4), media geométrica de precisiones, penalidad de brevedad para la salida demasiado corta. La puntuación es en [0, 100].

chrF mide la puntuación F de nivel de caracteres. Más sensible a los idiomas morfológicamente ricos donde el subconto BLEU coincide.

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

Siempre usar`sacrebleu`Normalisa la tokenización para que las puntuaciones sean comparables en todos los papeles.

### La jerarquía de evaluación de tres niveles (2026)

La evaluación moderna de MT utiliza tres familias métricas complementarias.

- **Heuristic**(BLEU, chrF) Rápido, basado en referencias, interpretable, insensible a la paráfrase.
- **Learned**(COMET, BLEURT, BERTScore). Modelos neuronales formados en el juicio humano; comparación de similitud semántica de traducción con la fuente y la referencia. COMET tiene la mayor asociación con la investigación de MT desde 2023 y es el modelo de producción por defecto de 2026 cuando la calidad importa.
- **LLM-as-judge**(sin referencias). Promover un modelo grande para calificar las traducciones en fluidez, adecuación, tono, adecuación cultural. GPT-4 como juez coincide con el acuerdo humano en ~80% del tiempo cuando la rúbrica está bien diseñada.

Estampilla práctica para 2026: `sacrebleu`para BLEU y chrF, `unbabel-comet`Calibrar cada métrica con 50-100 ejemplos etiquetados por humanos antes de confiar en los datos de producción.

Las métricas sin referencia (COMET-QE, BLEURT-QE, LLM-as-judge) le permiten evaluar las traducciones sin referencia, lo que es importante para los pares de idiomas de cola larga donde no existen traducciones de referencia.

### Paso 3: qué se rompe en la producción

El tubo de trabajo anterior traducirá fluidamente el 80% del tiempo y fallará silenciosamente el 20% restante.

- **Hallucination.**El modelo inventa contenido que no estaba en la fuente. Común en el vocabulario de dominio desconocido. Síntoma: la salida es fluida pero afirma hechos que la fuente no declaró. Mitigation: decodificación restringida en términos de dominio, revisión humana de contenido regulado, monitoreo de salida mucho más tiempo que la entrada.
- **Off-target generation.**El modelo se traduce al idioma equivocado.`forced_bos_token_id`y siempre descifrar con un modelo de ID de idioma de verificación de salida.
- **Terminology drift.**"Registrar" se convierte en "s'inscrire" en el documento 1 y "creer un compte" en el documento 2. Para el texto de la interfaz de usuario y las cadenas orientadas al usuario, la consistencia es más importante que la calidad bruta.
- **Formality mismatch.**El modelo elige la forma que era más común en el entrenamiento. Para el contenido orientado al cliente esto suele ser incorrecto. Mitigation: prefijo rápido con un token de formalidad si el modelo lo soporta, o ajustar a un modelo pequeño en corpora formal-solo.
- **Length explosion on short input.**Las oraciones de entrada muy cortas a menudo producen traducciones demasiado largas porque la penalidad de longitud cae de un acantilado por debajo de ~ 5 tokens de origen.

### Paso 4: ajuste fino para un dominio

Los modelos pre-entrenados son generalistas. La traducción legal, médica o del diálogo de juego se beneficia de manera medible de la ajuste fino en datos paralelos de dominio.

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L'accusé a plaidé coupable."},
]

ds = Dataset.from_list(pairs)


def preprocess(ex):
    return tok(
        ex["src"],
        text_target=ex["tgt"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )


ds = ds.map(preprocess, remove_columns=["src", "tgt"])

args = TrainingArguments(output_dir="out", per_device_train_batch_size=4, num_train_epochs=3, learning_rate=3e-5)
Trainer(model=model, args=args, train_dataset=ds).train()
```

En el caso de los modelos de formación, el nivel de calidad de los datos es el más alto en la producción.

## Usalo

La pila de producción 2026 para MT:

| Use case | Recommended starting point |
|---------|---------------------------|
| Any-to-any, 200 languages | `facebook/nllb-200-distilled-600M` (laptop) or `nllb-200-3.3B` (production) |
| English-centric, high quality, 50 languages | `facebook/mbart-large-50-many-to-many-mmt` |
| Short runs, cheap inference, English-French/German/Spanish | Helsinki-NLP / Marian models |
| Latency-critical browser-side | ONNX-quantized Marian (~50 MB) |
| Maximum quality, willing to pay | GPT-4 / Claude / Gemini with translation prompts |

Los LLM ahora superan a los modelos especializados de MT en varios pares de idiomas a partir de 2026, particularmente en contenido idiomático y contexto largo. La compensación es el costo por token y la latencia.

## Envío

Salvo como`outputs/skill-mt-evaluator.md`¿Qué es esto ?

```markdown
---
name: mt-evaluator
description: Evaluate a machine translation output for shipping.
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

Given a source text and a candidate translation, output:

1. Automatic score estimate. BLEU and chrF ranges you would expect. State whether a reference is available.
2. Five-point human-verifiable check list: (a) content preservation (no hallucinations), (b) correct language, (c) register / formality match, (d) terminology consistency with glossary if provided, (e) no truncation or length explosion.
3. One domain-specific issue to probe. E.g., for legal: named entities and statute citations. For medical: drug names and dosages. For UI: placeholder variables `{name}`.
4. Confidence flag. "Ship" / "Ship with review" / "Do not ship". Tie to the severity of issues found in step 2.

Refuse to ship a translation without a language-ID check on output. Refuse to evaluate without a reference unless the user explicitly opts in to reference-free scoring (COMET-QE, BLEURT-QE). Flag any content over 1000 tokens as likely needing chunked translation.
```

## Los ejercicios

1. **Easy.**Traducir un párrafo inglés de 5 frases al francés y volver al inglés usando `nllb-200-distilled-600M`Mejorar la proximidad del viaje de ida y vuelta al original.
2. **Medium.**Implementar una verificación de identificación de idioma en las salidas de traducción utilizando `fasttext lid.176`o `langdetect`.Integrarse en la llamada MT para que las generaciones fuera del objetivo sean capturadas antes de regresar.
3. **Hard.**- No . - ¿ Qué ?`nllb-200-distilled-600M`En el caso de las oraciones de la primera línea, el valor de la letra B es el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra B, y el valor de la letra C, y el valor de la letra C, y el valor de la letra C, y el valor de la letra C, y el valor de la letra C, y del punto de la letra C, y del punto de la letra C, del punto de la letra C, del punto de la letra C, del punto de la letra C, del punto de la letra c) del punto de la letra c) del punto de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra de la letra

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | Translation score | N-gram precision with brevity penalty. [0, 100]. |
| chrF | Character F-score | Character-level F-score. More sensitive for morphologically rich languages. |
| NMT | Neural MT | Transformer encoder-decoder trained on parallel text. The 2017+ default. |
| NLLB | No Language Left Behind | Meta's 200-language MT model family. |
| Constrained decoding | Controlled output | Force specific tokens or n-grams to appear / not appear in the output. |
| Hallucination | Invented content | Model output that is not supported by the source. |

## Leer más

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) el documento de la NLLB.
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/)¿ Por qué ?`sacrebleu`es la única forma correcta de informar BLEU.
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) el papel de la crf.
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) práctica de ajuste fino a través del paso.
