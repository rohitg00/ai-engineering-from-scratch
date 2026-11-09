# Generación de texto antes de los transformadores  Modelos de lenguaje N-gram

> Si una palabra es sorprendente, el modelo es malo. La perplejidad hace que la sorpresa sea un número.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## El problema

Antes de los transformadores, antes de las RNN, antes de las incorporaciones de palabras, un modelo de lenguaje predijo la siguiente palabra contando la frecuencia con la que siguió a la anterior `n-1`Cuenta "el gato" → "sentarse" 47 veces, "el gato" → "salto" 12 veces, "el gato" → "frigerador" 0 veces. Normaliza para obtener una distribución de probabilidades.

Ese es un modelo de lenguaje n-gram. Ejecutó todos los reconocedores de voz, todos los verificadores de ortografía y todos los sistemas de traducción automática basados en frases desde 1980 hasta 2015.

El problema interesante es qué hacer con los n-gramos no vistos. Un modelo basado en el conteo crudo asigna probabilidad cero a cualquier cosa que no ha visto, lo cual es catastrófico porque las oraciones son largas y casi todas las oraciones largas contienen al menos una secuencia invisible. Cincuenta años de investigación de suavizamiento lo arreglaron.

## El concepto

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### El juego de predicción

Antes de que existiera alguna de estas máquinas, un experimento definió lo que es un modelo de lenguaje. Cubre la siguiente letra de una frase inglesa. Pídale a alguien que adivine, una adivina a la vez, hasta que lo haga bien. Anote el recuento de adivinaciones. Repita por unos cientos de letras.

Los números de adivinanzas no son triviales. Son una recodificación sin pérdidas del texto: entregue la secuencia de recuento a un segundo adivinador idéntico y pueden reconstruir cada letra, porque en cada posición saben exactamente qué adivinan primero. Un mensaje que se puede recodificar en menos símbolos lleva menos información por símbolo, por lo que las estadísticas de adivinanzas ponen un límite a la entropía del inglés.

Shannon hizo esto en 1951 y obtuvo un número que todavía gobierna el campo. Un alfabeto de 27 símbolos (26 letras más espacio) podría llevar`log2(27) ≈ 4.75`Los adivinadores humanos con 100 letras de contexto aterrizaron entre 0,6 y 1,3 bits por letra. el inglés es aproximadamente tres cuartas partes de movimientos forzados. La estructura que un modelo debe aprender se midió antes de que cualquier modelo pudiera aprenderlo.

Cada modelo de lenguaje desde entonces es un jugador mecánico de este juego, y cada número de evaluación en esta lección es el juego anotado:

- **Cross-entropy loss**El entrenamiento de un LM es literalmente minimizar su puntaje en el juego de adivinar.
- **Perplexity**¿ Es verdad ?`2^bits`(o `e^nats`): el factor de ramificación que aún enfrenta el modelo después de su adivinación.
- **Context length is the player's memory.**Un modelo de trigramas juega con dos tokens de memoria. Un transformador juega el mismo juego con 100K tokens. Las reglas nunca cambiaron; el jugador mejoró.

Un cambio de unidad a la pista: los puntajes del juego por letra en bits (`log2`), mientras que las fórmulas n-gramas de abajo ponen por símbolo de palabra en nats (log natural)  y desde la perplejidad `e^H`en nats iguales `2^H`en bits, las dos vistas son la misma medida en diferentes unidades.

```figure
prediction-game
```

**N-gram probability:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`- ¿ Qué ?`n`(normalmente 3 para trigramas, 4 para 4 gramos).

```math
P(w \mid \text{context}) = \frac{\mathop{\mathrm{count}}(\text{context}, w)}{\mathop{\mathrm{count}}(\text{context})}
```

**The zero-count problem.**Cualquier n-gramo no visto en el entrenamiento obtiene probabilidad cero. Un estudio de 2007 sobre el corpus de Brown encontró que incluso un modelo de 4 gramos tenía el 30% de 4 gramos no vistos en el entrenamiento.

**Smoothing approaches, in order of sophistication:**

1. **Laplace (add-one).**Añade 1 a cada cuenta.
2. **Good-Turing.**Reasignar la masa de probabilidad de eventos de mayor frecuencia a los invisibles basados en la frecuencia de las frecuencias.
3. **Interpolation.**Combine n-gram, (n-1)-gram, etc., estimaciones con pesos ajustables.
4. **Backoff.**Si n-gram tiene el conteo cero, regresa a (n-1)-gram.
5. **Absolute discounting.**Subtraer un descuento fijo `D`de todos los números, redistribuir a lo invisible.
6. **Kneser-Ney.**Desconto absoluto más una elección inteligente para el modelo de orden inferior: utilizar *probabilidad de continuación* (cuántos contextos aparece una palabra) en lugar de frecuencia bruta.

La visión de Kneser-Ney es profunda. "San Francisco" es un gran gramo común. Unigramas "Francisco" aparece principalmente después de "San. " Naive descuento absoluto da "Francisco" alta unicramas probabilidad (porque el conteo es alto). Kneser-Ney observa que "Francisco" aparece en un solo contexto y reduce en consecuencia su probabilidad de continuación. Resultado: un gran gramo que termina en "Francisco" obtiene la probabilidad adecuada.

**Evaluation: perplexity.**El exponente de la probabilidad de registro negativo promedio por palabra en un conjunto de pruebas prolongadas. Más bajo es mejor. Una perplejidad de 100 significa que el modelo es tan confuso como elegiría uniformemente entre 100 palabras.

```math
\text{perplexity} = \exp\left(-\frac{1}{N} \sum_i \log P(w_i \mid \text{context}_i)\right)
```

```figure
ngram-backoff
```

## Construye el mismo

### Paso 1: cuenta el trigrama

```python
from collections import Counter, defaultdict


def train_ngram(corpus_tokens, n=3):
    ngrams = Counter()
    contexts = Counter()
    for sentence in corpus_tokens:
        padded = ["<s>"] * (n - 1) + sentence + ["</s>"]
        for i in range(len(padded) - n + 1):
            ctx = tuple(padded[i:i + n - 1])
            word = padded[i + n - 1]
            ngrams[ctx + (word,)] += 1
            contexts[ctx] += 1
    return ngrams, contexts


def raw_probability(ngrams, contexts, context, word):
    ctx = tuple(context)
    if contexts.get(ctx, 0) == 0:
        return 0.0
    return ngrams.get(ctx + (word,), 0) / contexts[ctx]
```

La entrada es una lista de oraciones tokenizadas. La salida es n-grama y contextualización contextualizada. `<s>`y `</s>`son límites de oraciones.

### Paso 2: Limpiación de la zona

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

Añade 1 a cada cuenta, pero asigna masa a eventos invisibles, perjudicando también a eventos raros conocidos.

### Paso 3: Kneser-Ney (bigrama, interpolado)

```python
def kneser_ney_bigram_model(corpus_tokens, discount=0.75):
    unigrams = Counter()
    bigrams = Counter()
    unigram_contexts = defaultdict(set)

    for sentence in corpus_tokens:
        padded = ["<s>"] + sentence + ["</s>"]
        for i, w in enumerate(padded):
            unigrams[w] += 1
            if i > 0:
                prev = padded[i - 1]
                bigrams[(prev, w)] += 1
                unigram_contexts[w].add(prev)

    total_unique_bigrams = sum(len(ctx_set) for ctx_set in unigram_contexts.values())
    continuation_prob = {
        w: len(ctx_set) / total_unique_bigrams for w, ctx_set in unigram_contexts.items()
    }

    context_totals = Counter()
    for (prev, w), count in bigrams.items():
        context_totals[prev] += count

    unique_follow = defaultdict(set)
    for (prev, w) in bigrams:
        unique_follow[prev].add(w)

    def prob(prev, w):
        count = bigrams.get((prev, w), 0)
        denom = context_totals.get(prev, 0)
        if denom == 0:
            return continuation_prob.get(w, 1e-9)
        first_term = max(count - discount, 0) / denom
        lambda_prev = discount * len(unique_follow[prev]) / denom
        return first_term + lambda_prev * continuation_prob.get(w, 1e-9)

    return prob
```

Tres partes móviles.`continuation_prob`La innovación de Kneser-Ney es una de las principales razones de la innovación.`lambda_prev`La probabilidad final es el término principal descuento más el término de continuación ponderado.

### Paso 4: generar texto con muestreo

```python
import random


def generate(prob_fn, vocab, prefix, max_len=30, seed=0):
    rng = random.Random(seed)
    tokens = list(prefix)
    for _ in range(max_len):
        candidates = [(w, prob_fn(tokens[-1], w)) for w in vocab]
        total = sum(p for _, p in candidates)
        r = rng.random() * total
        acc = 0.0
        for w, p in candidates:
            acc += p
            if r <= acc:
                tokens.append(w)
                break
        if tokens[-1] == "</s>":
            break
    return tokens
```

Muestreo proporcional a la probabilidad. Siempre da una salida diferente por semilla. Para la salida similar a la búsqueda de haces, seleccione el argmax en cada paso (compulsivo) y agregue un pequeño botón de aleatoriedad (temperatura).

### Paso 5: perplejidad

```python
import math


def perplexity(prob_fn, sentences):
    total_log_prob = 0.0
    total_tokens = 0
    for sentence in sentences:
        padded = ["<s>"] + sentence + ["</s>"]
        for i in range(1, len(padded)):
            p = prob_fn(padded[i - 1], padded[i])
            total_log_prob += math.log(max(p, 1e-12))
            total_tokens += 1
    return math.exp(-total_log_prob / total_tokens)
```

Para el cuerpo de Brown, un modelo KN de 4 gramos bien ajustado alcanza la perplejidad alrededor de 140. Un transformador LM alcanza 15-30 en el mismo conjunto de prueba. La brecha es de aproximadamente 10 veces. Esa brecha es por lo que el campo se movió.

## Usalo

- **Classical NLP teaching.**La exposición más clara a la suavidad, MLE, y la perplejidad que puedes tener.
- **KenLM.**Producción n-gram biblioteca. Se utiliza como un rescensor en el habla y sistemas MT donde baja latencia importa.
- **On-device autocomplete.**Modelos de trigramas en teclados.
- **Baselines.**Siempre calcular una perplejidad de LM de n gramos antes de declarar que su LM neuronal es bueno.

## Envío

Salvo como`outputs/prompt-lm-baseline.md`¿Qué es esto ?

```markdown
---
name: lm-baseline
description: Build a reproducible n-gram language model baseline before training a neural LM.
phase: 5
lesson: 16
---

Given a corpus and target use (next-word prediction, rescoring, perplexity baseline), output:

1. N-gram order. Trigram for general English, 4-gram if corpus is large, 5-gram for speech rescoring.
2. Smoothing. Modified Kneser-Ney is the default; Laplace only for teaching.
3. Library. `kenlm` for production, `nltk.lm` for teaching, roll your own only to learn.
4. Evaluation. Held-out perplexity with consistent tokenization between train and test sets.

Refuse to report perplexity computed with different tokenization between systems being compared — perplexity numbers are comparable only under identical tokenization. Flag OOV rate in test set; KN handles OOV poorly unless you reserve a special <UNK> token during training.
```

## Los ejercicios

1. **Easy.**Entrenar un trigramas LM en un corpus de Shakespeare de 1.000 frases. Generar 20 frases. Serán plausibles localmente pero globalmente incoherentes. Esta es la demostración canónica.
2. **Medium.**Implemente la perplejidad para su modelo KN en una división de Shakespeare prolongada. Comparar con Laplace. Usted debería ver la perplejidad KN menor en 30-50%.
3. **Hard.**Construir un corrector de ortografía de trigramas: dada una palabra mal escrita y su contexto, generar correcciones y clasificar por probabilidad de contexto bajo el LM. Evalúa en el corpus de ortografía de Birkbeck (público).

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| N-gram | Word sequence | Sequence of `n` consecutive tokens. |
| Smoothing | Avoiding zeros | Reallocating probability mass so unseen events get non-zero probability. |
| Perplexity | LM quality metric | `exp(-average log-prob)` on held-out data. Lower is better. |
| Backoff | Fallback to shorter context | If trigram count is zero, use bigram. Katz backoff formalizes this. |
| Kneser-Ney | Best smoothing for n-grams | Absolute discounting + continuation probability for the lower-order model. |
| Continuation probability | KN-specific | `P(w)` weighted by number of contexts `w` appears in, not by raw count. |
| Entropy of text | Information per symbol | Average bits needed to encode the next symbol given the context. Shannon's 1951 estimate for printed English with up to 100 letters of context: 0.6-1.3 bits/letter, measured before any model existed. |

## Leer más

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf) el experimento de juego de adivinación que definió el objetivo que cada modelo de lenguaje todavía optimiza.
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) el tratamiento canónico de las LM de n gramos y el suavización.
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739) el papel que estableció Kneser-Ney como el mejor n-gramo más suave.
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) el papel KN original.
- [KenLM](https://kheafield.com/code/kenlm/) LM de producción rápida n-gramos, todavía utilizado en 2026 para aplicaciones sensibles a la latencia.
