# Procesamiento de textos  Tokenization, Stemming, Lemmatization

> El lenguaje es continuo, los modelos son discretos, el preprocesamiento es el puente.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## El problema

Un modelo no puede leer "Los gatos corrían".

Cada sistema de PNL se abre con las mismas tres preguntas. ¿Dónde comienza una palabra? ¿Cuál es la raíz de la palabra? ¿Cómo tratamos "correr", "correr", "correr" como lo mismo cuando ayuda, y como cosas diferentes cuando no lo hace?

Si se equivoca en la tokenización, el modelo aprende de la basura.`don't`Como una señal , pero`do n't`Si el voto se derrumba, el equipo de entrenamiento se divide.`organization`y `organ`Si su lemmatizer necesita un contexto de parte del habla pero no lo pasa, los verbos se tratan como sustantivos.

Esta lección construye los tres pasos de preprocesamiento desde cero, luego muestra cómo NLTK y spaCy hacen el mismo trabajo para que pueda ver las compensaciones.

## El concepto

Tres operaciones, cada una tiene un trabajo y un modo de falla.

**Tokenization**"Token" es deliberadamente vago porque la granularidad correcta depende de la tarea. nivel de palabra para la PNL clásica. Subpalabra para transformadores. carácter para idiomas sin espacio en blanco.

**Stemming**Las cortes son sufijos con reglas, rápidas, agresivas, estúpidas.`running -> run`- ¿ Qué ?`organization -> organ`El segundo es el modo de falla.

**Lemmatization**La definición de un término es más rápida y precisa, pero necesita una tabla de búsqueda o un analizador morfológico.`ran -> run`(necesita saber que "run" es pasado de tiempo de "run").`better -> good`(necesita conocer formas comparativas).

Regla de pulgar. Semeja cuando la velocidad es importante y puedes tolerar el ruido (indexación de búsqueda, clasificación aproximada). Lemmatiza cuando el significado es importante (respuesta a preguntas, búsqueda semántica, cualquier cosa que el usuario lea).

```figure
edit-distance
```

## Construye el mismo

### Paso 1: un tokenizer de palabras regex

El tokenizer más simple y útil se divide en caracteres no alfanuméricos, manteniendo la puntuación como sus propios tokens.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

Tres patrones en orden de precedencia.`don't`¿ Qué ?`it's`Cualquier carácter no alfanumérico que no sea blanco como símbolo independiente (puntuación).

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

Modo de falla para detectar. `3pm`Se divide en `['3', 'pm']`porque alteramos entre las cartas y las cifras. Lo suficiente para la mayoría de las tareas. URL, correos electrónicos, hashtags se rompen. Para la producción, añadir patrones antes de los generales.

### Paso 2: un Porter stemmer (solo el paso 1a)

El algoritmo completo de Porter tiene cinco fases de reglas. El paso 1a solo cubre los sufijos ingleses más frecuentes y enseña el patrón.

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

Lea las reglas de arriba hacia abajo.`ies -> i`La regla es por qué .`ponies -> poni`No , no .`pony`El verdadero Porter tiene el paso 1B que lo arreglaría las reglas compiten las reglas anteriores ganan el orden importa más que cualquier regla

### Paso 3: un lemmatizer basado en búsqueda

La limmatización adecuada necesita morfología. Una versión de enseñanza manejable utiliza una pequeña tabla de lemma y un fallback.

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

El último caso es el momento clave de enseñanza.`watched`No está en nuestra mesa y nuestra caída sólo maneja .`ing`La lematización real cubre`ed`, verbos irregulares, adjetivos comparativos, plurales con cambios de sonido (`children -> child`Es por ello que los sistemas de producción utilizan WordNet, el morfologizador de spaCy, o un analizador morfológico completo.

### Paso 4: enchufarlos juntos

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

La pieza que falta es un etiquetador de POS. Fase 5 · 07 (POS Tagging) construye uno. Por ahora, por defecto todo a `NOUN`y reconocer la limitación.

## Usalo

NLTK y spaCy envían las versiones de producción.

### NLTK

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize`maneja contracciones, Unicode, casos de borde que su regex pierde.`PorterStemmer`Se ejecuta en las cinco fases.`WordNetLemmatizer`Necesita la etiqueta POS traducida del esquema Penn Treebank de NLTK al conjunto de abreviaturas de WordNet.

### el espacio

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

spaCy esconde toda la tubería detrás.`nlp(text)`La tokenización, etiquetado de POS y lematización funcionan todos. Más rápido que NLTK en escala. Más preciso fuera de la caja. La compensación es que no se puede cambiar fácilmente componentes individuales.

### ¿Cuándo elegir cuál

| Situation | Pick |
|-----------|------|
| Teaching, research, swapping components | NLTK |
| Production, multi-language, speed matters | spaCy |
| Transformer pipeline (you'll tokenize with the model's tokenizer anyway) | Use `tokenizers` / `transformers` and skip classical preprocessing |

### Los dos modos de fracaso nadie te advierte

La mayoría de los tutoriales enseñan los algoritmos y se detienen. Dos cosas mordrán una verdadera tubería de preprocesamiento, y casi nunca se cubren.

**Reproducibility drift.**NLTK y spaCy cambian el comportamiento de tokenización y lemmatizer entre versiones.`['do', "n't"]`en spaCy 2.x puede producir `["don't"]`En 3.x, tu modelo fue entrenado en una distribución. la inferencia ahora se ejecuta en otra. la precisión se degrada silenciosamente y nadie sabe por qué.`requirements.txt`Escriba una prueba de regresión de preprocesamiento que congele la tokenización esperada de 20 frases de muestra.

**Training / inference mismatch.**Entrenamiento con preprocesamiento agresivo (minúsculas, eliminación de palabras de parada, stemming), desplegar en la entrada del usuario bruto, cráter de rendimiento de la vigilancia. Esta es la falla de producción NLP más común. Si preprocesas durante el entrenamiento, debes ejecutar la misma función durante la inferencia.

## Envío

Una solicitud reutilizable que ayuda a los ingenieros a elegir una estrategia de preprocesamiento sin leer tres libros de texto.

Salvo como`outputs/prompt-preprocessing-advisor.md`¿Qué es esto ?

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## Los ejercicios

1. **Easy.**Extenderse`tokenize`Para mantener las URLs como tokens únicos.`tokenize("Visit https://example.com today.")`debe producir un token de URL.
2. **Medium.**Implemente el paso Porter 1b. Si una palabra contiene una vocal y termina en `ed`o `ing`, quitarlo. Manejar la regla de doble consonante (`hopping -> hop`No , no .`hopp`¿Qué es lo que se hace?
3. **Hard.**Construye un lemmatizer que utiliza WordNet como una tabla de búsqueda pero cae de nuevo a su Porter votes cuando WordNet no tiene entrada. Medir la precisión en un corpus etiquetado contra el simple WordNet y el simple Porter.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Token | A word | Whatever unit the model consumes. Can be word, subword, character, or byte. |
| Stem | Root of a word | Result of rule-based suffix stripping. Not always a real word. |
| Lemma | Dictionary form | The form you'd look up. Requires grammatical context to compute correctly. |
| POS tag | Part of speech | Category like NOUN, VERB, ADJ. Needed to lemmatize accurately. |
| Morphology | Word shape rules | How a word changes form based on tense, number, case. Lemmatization depends on it. |

## Leer más

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) el papel original, cinco páginas, todavía la explicación más clara.
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) cómo se conecta una tubería real.
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) casos de margen de tokenización que aún no has pensado.
