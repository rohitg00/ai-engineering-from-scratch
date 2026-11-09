# Etiquetado de POS y análisis sintáctico

> La gramática estaba fuera de moda por un tiempo, luego cada LLM necesitaba validar la extracción estructurada, y volvió.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## El problema

La lección 01 prometió que la lemmatización necesita una etiqueta de parte del discurso.`running`Es un verbo, un lemmatizer no puede reducirlo a `run`Sin saberlo .`better`Es un adjetivo, no puede reducirse a `good`¿ Qué ?

La etiquetación de parte del discurso asigna categorías gramaticales. El análisis sintáctico recupera la estructura de árbol de la oración: qué palabra modifica cuál, qué verbo gobierna cuáles argumentos. La PNL clásica pasó veinte años refinando ambos. Luego el aprendizaje profundo los convirtió en una tarea de clasificación de tokens en la parte superior de un transformador preentrenado, y la comunidad de investigación siguió adelante.

No la comunidad aplicada. Cada tubería de extracción estructurada todavía utiliza árboles POS y de dependencia bajo el capó. JSON generado por LLM se valida contra restricciones gramaticales.

Esta lección presenta los tagets, las líneas de base y el punto en el que dejas de implementar desde cero y llamas spaCy.

## El concepto

**POS tagging**El código de identidad de los símbolos de identidad de los símbolos de identidad de los símbolos de identidad de los símbolos de identidad de identidad de los símbolos de identidad de identidad de los símbolos de identidad de identidad de los símbolos de identidad de identidad de identidad de los símbolos de identidad de identidad de identidad de identidad de identidad de los símbolos de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad de identidad.**Penn Treebank (PTB)**Tagset es el inglés predeterminado. 36 etiquetas con distinciones el lector casual encuentra inquieto: `NN`nombre singular, `NNS`nombre plural, `NNP`nombre propio singular, `VBD`Verbo pasado tiempo, `VBZ`El verbo 3rd person singular presente, y así sucesivamente.**Universal Dependencies (UD)**Tagset es más grueso (17 etiquetas) y lenguaje-agnóstico; se convirtió en el estándar para el trabajo translingual.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Syntactic parsing**produce un árbol. Dos estilos principales:

- **Constituency parsing.**Las frases de sustantivo, las frases de verbo, las frases prepositivas anidan entre sí.
- **Dependency parsing.**Cada palabra tiene una sola palabra de cabeza de la que depende, etiquetada con una relación gramatical.

La dependencia de análisis ganó en la década de 2010 porque generaliza limpiamente a través de los idiomas, especialmente los de orden de palabras libre.

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

```figure
pos-tagger
```

```figure
dependency-arcs
```

## Construye el mismo

### Paso 1: línea de base de etiquetas más frecuentes

El etiquetador más estúpido que funciona, para cada palabra, predice la etiqueta que tenía más a menudo en el entrenamiento.

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

En el corpus de Brown, esta línea de base alcanza una precisión del 85%.

### Paso 2: etiqueta de HMM de gran tamaño

Modela la probabilidad conjunta de la secuencia:

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

Dos tablas: probabilidades de transición (tag dada la etiqueta anterior), probabilidades de emisión (tag dada la palabra). Estima ambas desde los recuentos con el suavización de Laplace.

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

Bigram HMM en Brown alcanza ~93% de precisión. El salto del 85% al 93% es principalmente probabilidades de transición  el modelo aprende `DET NOUN`es común y `NOUN DET`Es raro.

### Paso 3: por qué los taggers modernos superan esto

Las probabilidades de transición + emisiones son locales.`saw`es un sustantivo en "compré una sierra" pero un verbo en "vi la película". Un CRF con características arbitrarias (sufijo, forma de palabra, palabra antes y después, palabra misma) alcanza ~97%. Un BiLSTM-CRF o transformador alcanza ~98%+.

El límite de esta tarea se establece por el desacuerdo de los anotadores.

### Paso 4: boceto de análisis de dependencias

La dependencia completa del análisis desde cero está fuera de alcance; el tratamiento de los libros de texto canónicos está en Jurafsky y Martin.

- **Transition-based**Los parser (arc-eager, arc-standard) actúan como un parser de reducción de cambios: leen tokens, los desplazan a una pila y aplican acciones de reducción que crean arcos. La codificación codificada es rápida. La implementación clásica es MaltParser.
- **Graph-based**Los parseres (algorithmo de Eisner, Dozat-Manning biafina) anotan todos los bordes posibles dependientes de la cabeza y eligen el árbol de mayor extensión.

Para la mayoría de los trabajos aplicados, llame a espaCy:

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

Lea el `dep`columna de abajo a arriba y la estructura gramatical de la oración cae.

## Usalo

Cada biblioteca de producción de PNL envía los puntos de venta y los parseres de dependencia como parte de una tubería estándar.

- **spaCy**(El artículo`en_core_web_sm`- ¿ Qué ?`md`- ¿ Qué ?`lg`- ¿ Qué ?`trf` Rapido, preciso, integrado con tokenization + NER + lemmatization. `token.tag_`¿ Qué es esto ?`token.pos_`(UD), `token.dep_`(relación de dependencia).
- **Stanford NLP (stanza)**. el sucesor de Stanford a CoreNLP. Estado de la técnica en más de 60 idiomas.
- **trankit**- Basado en transformador, buena precisión UD.
- **NLTK**- ¿ Qué ?`pos_tag`- Útil, lento, más viejo, bueno para enseñar.

### Cuando esto todavía importa en 2026

- **Lemmatization.**La lección 01 necesita que el POS se lematice correctamente.
- **Structured extraction from LLM outputs.**Validar que una oración generada respete restricciones gramaticales (por ejemplo, acuerdo entre objeto y verbo, modificadores requeridos).
- **Aspect-based sentiment.**Los pares de dependencia te dicen qué adjetivo modifica qué sustantivo.
- **Query understanding.**"Las películas dirigidas por Wes Anderson con Bill Murray" se descomponen en restricciones estructuradas a través del análisis.
- **Cross-lingual transfer.**Las etiquetas UD y las relaciones de dependencia son agnósticas del lenguaje, lo que permite un análisis estructurado de cero disparos de nuevos idiomas.
- **Low-compute pipelines.**Si no puedes enviar un transformador, POS + dependencia parse + gazetteer te lleva sorprendentemente lejos.

## Envío

Salvo como`outputs/skill-grammar-pipeline.md`¿Qué es esto ?

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the specific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## Los ejercicios

1. **Easy.**Usando la línea de base de etiquetas más frecuentes en un corpus pequeño etiquetado (por ejemplo, el subconjunto Brown de NLTK), mide la precisión en las oraciones retrasadas. Verifique el resultado de ~ 85%.
2. **Medium.**Entrenar el HMM de gran tamaño arriba y informar la precisión / recuperación por etiqueta. ¿Qué etiquetas confunden más el HMM?
3. **Hard.**Utilice el análisis de dependencias de spaCy para extraer triples de sujeto-verbo-objeto de una muestra de 1000 frases. Evalúe en 50 triples etiquetados manualmente. Documento donde la extracción falla (a menudo pasivos, coordenadas y sujetos eliminados).

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | Word's type | Grammatical category. PTB has 36; UD has 17. |
| Penn Treebank | Standard tagset | English-specific. Fine-grained verb tenses and noun number. |
| Universal Dependencies | Multilingual tagset | Coarser than PTB; language-neutral; defaults for cross-lingual work. |
| Dependency parse | Sentence tree | Each word has one head, each edge has a grammatical relation. |
| Viterbi | Dynamic programming | Finds the highest-probability tag sequence given emissions and transitions. |

## Leer más

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) el tratamiento canónico de los libros de texto de POS y de análisis.
- [Universal Dependencies project](https://universaldependencies.org/) el conjunto de etiquetas y la colección de árboles interlinguísticos utilizados por cada parser multilingüe.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) referencia práctica para cada atributo expuesto en `Token`¿ Qué ?
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) el periódico que trajo los parseros neuronales a la corriente principal.
