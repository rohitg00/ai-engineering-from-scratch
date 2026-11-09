# Reconocimiento de la entidad denominada

> Suena fácil hasta que se trata de límites ambigüos, entidades anidadas y jerga de dominio.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## El problema

"Apple demandó a Google por su acuerdo de búsqueda de iPhone en los EE.UU". Cinco entidades: Apple (ORG), Google (ORG), iPhone (PRODUCT), acuerdo de búsqueda (tal vez), US (GPE). Un buen sistema NER extrae a todos ellos con tipos correctos.

NER es el caballo de trabajo debajo de cada red de extracción estructurada. Resumen de análisis, registro de cumplimiento, anónimo de registros médicos, comprensión de búsqueda de consultas, la base para las respuestas de chatbot, extracción de contratos legales. Nunca lo ves, siempre dependes de él.

Esta lección recorre el camino clásico (basado en reglas, HMM, CRF) hacia el moderno (BiLSTM-CRF, luego transformadores).

## El concepto

**BIO tagging**(o BILOU) convierte la extracción de entidades en un problema de etiquetado de secuencias.`B-TYPE`(inicio de la entidad), `I-TYPE`(entidad interna), o `O`(fuera de cualquier entidad).

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

Cadena de entidades multi-tokens: `New B-GPE`¿ Qué ?`York I-GPE`¿ Qué ?`City I-GPE`Un modelo que entiende la biología puede extraer espacios arbitrarios.

La evolución de la arquitectura:

- **Rule-based.**Regex + búsquedas de boletines. Alta precisión en entidades conocidas, cero cobertura en las nuevas.
- **HMM.**Modelo de Markov oculto, probabilidad de emisión de un token dado, probabilidad de transición de un tag a otro, decodificación Viterbi, entrenado en datos etiquetados.
- **CRF.**Campo aleatorio condicional. Como HMM pero discriminativo, para que pueda mezclar características arbitrarias (forma de palabra, mayúsculas, palabras vecinas). Aún el caballo de trabajo de producción clásico en 2026 para implementaciones de bajos recursos.
- **BiLSTM-CRF.**Las características neuronales en lugar de hechas a mano. LSTM lee la oración en ambas direcciones, la capa CRF en la parte superior impone secuencias de etiquetas consistentes.
- **Transformer-based.**Tonea la BERT con una cabeza de clasificación de tokens, mejor precisión, más computación.

```figure
ner-bio-tagging
```

## Construye el mismo

### Paso 1: Asignar a los asistentes de etiquetado de la Biotecnología

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### Paso 2: Características hechas a mano

Para el NER clásico (no neuronal), las características son el juego.

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")`retorno `xXxxxx`- ¿ Qué ?`word_shape("USA-2024")`retorno `XXX-dddd`Los patrones de capitalización son de alta señal para los sustantivos apropiados.

### Paso 3: una línea de base simple basada en reglas + diccionario

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

Los periódicos de producción tienen millones de entradas extraídas de Wikipedia y DBpedia.`Apple`La empresa vs la fruta) es terrible.

### Paso 4: el paso CRF (bozo, no implantes completos)

El CRF completo desde cero en 50 líneas no es esclarecedor sin los fundamentos de la teoría de probabilidades.`sklearn-crfsuite`en su lugar:

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1`y `c2`Las regulaciones L1 y L2 son:`all_possible_transitions=True`permite que el modelo aprenda secuencias ilegales (por ejemplo, `I-ORG`después de`O`) son poco probables, es decir, cómo un CRF hace cumplir la coherencia de la BIO sin que usted escriba la restricción.

### Paso 5: lo que añade un BiLSTM-CRF

Las características se aprenden. Ingresos: embeddings de tokens (GloVe o fastText). LSTM lee de izquierda a derecha y de derecha a izquierda. Los estados ocultos conectados pasan a través de una capa de salida CRF. El CRF todavía impone la consistencia de secuencia de etiquetas; el LSTM reemplaza las características hechas a mano con las aprendidas.

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

Para la capa CRF, utilizar `torchcrf.CRF`La ganancia sobre el CRF hecho a mano es medible pero menor de lo que se espera a menos que tengas decenas de miles de frases etiquetadas.

## Usalo

spaCy emite NER de producción fuera de la caja.

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

Notice `iPhone`etiquetado`ORG`en lugar de`PRODUCT` El modelo pequeño de spaCy tiene una cobertura débil de las entidades de producto.`en_core_web_lg`El modelo de transformador (`en_core_web_trf`) hace aún mejor.

Cara de abrazo para NER basado en BERT:

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"`Si no se combinan los tokens B-X, I-X en un espacio, se obtienen etiquetas de nivel de token y se deben fusionar por sí mismos.

### NER basado en el MLL (opción 2026)

El LLM NER de tiro cero y de pocos tiros ahora es competitivo con modelos ajustados en muchos dominios, y es dramáticamente mejor cuando los datos etiquetados son escasos.

- **Zero-shot prompting.**Dar al LLM una lista de tipos de entidades y un esquema de ejemplo. Pida una salida JSON. Funciona fuera de la caja; la precisión es moderada en dominios nuevos.
- **ZeroTuneBio-style prompting.**Descompone la tarea en extracción de candidato → significado explicación → juicio → re-verificación. Un prompt de múltiples etapas (no de un solo disparo) aumenta la precisión sustancialmente en el NER biomédico. El mismo patrón funciona para los dominios jurídicos, financieros y científicos.
- **Dynamic prompting with RAG.**Recupere los ejemplos etiquetados más similares de un conjunto de semillas anotadas para cada llamada de inferencia; construya el prompt de pocos disparos en vuelo. En los puntos de referencia 2026, esto eleva el GPT-4 biomédico NER F1 en un 11-12% sobre el prompt estático.
- **Per-entity-type decomposition.**Para documentos largos, una sola llamada que extrae todos los tipos de entidades a la vez pierde la memoria a medida que crece la longitud. ejecuta un pase de extracción por tipo de entidad. Costo de inferencia más alto, precisión sustancialmente mayor. Este es el patrón estándar para notas clínicas y contratos legales.

Recomendación de producción a partir de 2026: comience con una línea de base de tiro cero LLM antes de recopilar datos de entrenamiento.

### Cuando el NER clásico sigue ganando

Incluso con LLM disponibles, el NER clásico gana cuando:

- El presupuesto de latencia es inferior a 50 ms.
- Tienes miles de ejemplos etiquetados y necesitas 98% + F1.
- El dominio tiene una ontología estable donde un CRF o BiLSTM preentrenado transfiere bien.
- Las limitaciones reglamentarias requieren un modelo no generativo en el lugar.

### Donde se desmorona

- **Domain shift.**El NER entrenado en contratos legales tiene un peor rendimiento que un periodista.
- **Nested entities.**"Bank of America Tower" es al mismo tiempo un ORG y una FACILITAD. El BIO estándar no puede representar espacios superpuestos.
- **Long entities.**Los modelos de nivel de tokens a veces dividen esto.`aggregation_strategy`o después del proceso.
- **Sparse types.**Los modelos de uso general no tienen idea de que Scispacy y BioBERT son los puntos de partida.

## Envío

Salvo como`outputs/skill-ner-picker.md`¿Qué es esto ?

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## Los ejercicios

1. **Easy.**Implementación `bio_to_spans`(la inversa de `spans_to_bio`) y verificar la coherencia de ida y vuelta en 10 frases.
2. **Medium.**Entrenamiento del CRF sklearn-crfsuite anterior en el conjunto de datos del NER inglés CoNLL-2003.`seqeval`Resultado típico: ~ 84 F1.
3. **Hard.**- No . - ¿ Qué ?`distilbert-base-cased`En el caso de los datos de la red de datos, el número de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de la red de datos de datos de la red de datos de datos de la red de datos de datos de la red de datos de datos de la red de datos de datos de la red de datos de datos de datos de la red de datos de datos de datos de la red de datos de datos de datos de la red de datos de datos de datos de la red de datos de datos de datos de datos de la red de datos de datos de datos de datos de la red de datos de datos de datos de la red de datos de datos de datos de datos de la red de datos de datos de datos de datos de datos de la red de datos de datos de datos de datos de datos de la red de datos de datos de datos de datos de la red de datos de datos de datos de la red de datos de datos de datos de datos de datos de la red de datos de datos de datos de datos de datos de datos de datos de datos de la red de datos de datos de datos de datos de datos de la red de datos de datos de la red de datos de datos de datos de datos de la red de datos de datos de datos de datos de datos de la red de datos de datos de datos de datos de datos de datos de la red de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de la red de datos de datos de datos de datos de datos de datos de la red de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | Extract names | Label token spans with types (PERSON, ORG, GPE, DATE, ...). |
| BIO | Tagging scheme | `B-X` begins, `I-X` continues, `O` outside. |
| BILOU | Better BIO | Adds `L-X` (last), `U-X` (unit) for cleaner boundaries. |
| CRF | Structured classifier | Models transitions between labels, not just emissions. Enforces valid sequences. |
| Nested NER | Overlapping entities | One span is a different entity than a sub-span of it. BIO cannot express this. |
| Entity-level F1 | Proper NER metric | Predicted span must match true span exactly. Token-level F1 overstates accuracy. |

## Leer más

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) el papel BiLSTM-CRF. Canonical.
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) introduce el patrón de clasificación de tokens que se convirtió en estándar.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) referencia práctica para cada atributo de la`Doc.ents`y `Span`¿ Qué ?
- [seqeval](https://github.com/chakki-works/seqeval) la biblioteca métrica correcta.
