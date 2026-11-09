# GloVe, FastText y Subwords

> Word2Vec entrenó una incorporación por palabra. GloVe factorizó la matriz de cooccurrencia. FastText incorporó las piezas. BPE se conectó a transformadores.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## El problema

Word2Vec dejó dos preguntas abiertas.

Primero, hubo una línea paralela de investigación que factorizó la matriz de cooccurrencia directamente (LSA, HAL) en lugar de hacer actualizaciones de skip-gram en línea. ¿Fue el enfoque iterativo de Word2Vec fundamentalmente mejor, o fue la diferencia un artefacto de cómo los dos métodos se manejan cuenta? **GloVe**La respuesta es que: factorization de matriz con una pérdida elegida cuidadosamente coincide o supera Word2Vec, y cuesta menos entrenar.

En segundo lugar, ninguno de los métodos tenía una historia para las palabras que nunca había visto.`Zoomer-approved`¿ Qué ?`dogecoin`, cualquier sustantivo propio acuñado la semana pasada, cada forma inflecta de una raíz rara.**FastText**Esto se arregla incorporando caracteres n-gramas: una palabra es la suma de sus partes, incluyendo morfemas, así que incluso las palabras fuera del vocabulario obtienen un vector sensible.

En tercer lugar, una vez que llegaron los transformadores, la pregunta cambió de nuevo.**Byte-pair encoding (BPE)**Y sus parientes resolvieron esto aprendiendo un vocabulario de unidades de subpalabra frecuentes que cubre todo.

Esta lección recorre a los tres, y luego explica cuál alcanzar para cuándo.

## El concepto

**GloVe (Global Vectors).**Construye la matriz de coocurrencia palabra-palabras `X`donde`X[i][j]`es la frecuencia de la palabra `j`aparece en el contexto de la palabra `i`. Traen vectores tales que`v_i · v_j + b_i + b_j ≈ log(X[i][j])`- Peso la pérdida de parejas tan frecuentes no dominan.

**FastText.**Una palabra es la suma de sus caracteres n-gramos más la palabra misma. `where`Se convierte en`<wh, whe, her, ere, re>, <where>`. El vector de palabras es la suma de esos vectores componentes.`whereupon`) se componen de n-gramos conocidos.

**BPE (Byte-Pair Encoding).**Comience con un vocabulario de bytes individuales (o caracteres). Cuente cada par adyacente en el corpus. Combine el par más frecuente en un nuevo token. Repita para `k`Iteraciones. Resultado: un vocabulario de los símbolos base más `k`fusiones (`k + 256`tokens cuando se comienza desde bytes) donde secuencias frecuentes (`ing`¿ Qué ?`tion`¿ Qué ?`the`Las palabras raras se rompen en piezas familiares.

```figure
n5-subword-merge
```

## Construye el mismo

### GloVe: factorizar la matriz de coocurrencia

```python
import numpy as np
from collections import Counter


def build_cooccurrence(docs, window=5):
    pair_counts = Counter()
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    for doc in docs:
        indexed = [vocab[t] for t in doc]
        for i, center in enumerate(indexed):
            for j in range(max(0, i - window), min(len(indexed), i + window + 1)):
                if i != j:
                    distance = abs(i - j)
                    pair_counts[(center, indexed[j])] += 1.0 / distance
    return vocab, pair_counts


def glove_train(vocab, pair_counts, dim=16, epochs=100, lr=0.05, x_max=100, alpha=0.75, seed=0):
    n = len(vocab)
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(n, dim))
    W_tilde = rng.normal(0, 0.1, size=(n, dim))
    b = np.zeros(n)
    b_tilde = np.zeros(n)

    for epoch in range(epochs):
        for (i, j), x_ij in pair_counts.items():
            weight = (x_ij / x_max) ** alpha if x_ij < x_max else 1.0
            diff = W[i] @ W_tilde[j] + b[i] + b_tilde[j] - np.log(x_ij)
            coef = weight * diff

            grad_W_i = coef * W_tilde[j]
            grad_W_tilde_j = coef * W[i]
            W[i] -= lr * grad_W_i
            W_tilde[j] -= lr * grad_W_tilde_j
            b[i] -= lr * coef
            b_tilde[j] -= lr * coef

    return W + W_tilde
```

Dos piezas móviles que vale la pena nombrar.`f(x) = (x/x_max)^alpha`Peso inferior en pares muy frecuentes (como `(the, and)`La integración final es la suma de `W`(centro) y `W_tilde`Sumar ambas es un truco publicado que tiende a superar con sólo uno.

### FastText: incorporaciones conocedoras de las palabras

```python
def char_ngrams(word, n_min=3, n_max=6):
    wrapped = f"<{word}>"
    grams = {wrapped}
    for n in range(n_min, n_max + 1):
        for i in range(len(wrapped) - n + 1):
            grams.add(wrapped[i:i + n])
    return grams
```

```python
>>> char_ngrams("where")
{'<where>', '<wh', 'whe', 'her', 'ere', 're>', '<whe', 'wher', 'here', 'ere>', '<wher', 'where', 'here>'}
```

Cada palabra está representada por su conjunto de n-gramas (normalmente de 3 a 6 caracteres).

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

Para una palabra invisible, todavía se obtiene un vector siempre y cuando algunos de sus n-gramos son conocidos. `whereupon`acciones `<wh`¿ Qué ?`her`¿ Qué ?`ere`, y `<where`con`where`, así que los dos aterrizan cerca de uno al otro.

### BPE: vocabulario de palabras subpartidas aprendidas

```python
def learn_bpe(corpus, k_merges):
    vocab = Counter()
    for word, freq in corpus.items():
        tokens = tuple(word) + ("</w>",)
        vocab[tokens] = freq

    merges = []
    for _ in range(k_merges):
        pair_freq = Counter()
        for tokens, freq in vocab.items():
            for a, b in zip(tokens, tokens[1:]):
                pair_freq[(a, b)] += freq
        if not pair_freq:
            break
        best = pair_freq.most_common(1)[0][0]
        merges.append(best)

        new_vocab = Counter()
        for tokens, freq in vocab.items():
            new_tokens = []
            i = 0
            while i < len(tokens):
                if i + 1 < len(tokens) and (tokens[i], tokens[i + 1]) == best:
                    new_tokens.append(tokens[i] + tokens[i + 1])
                    i += 2
                else:
                    new_tokens.append(tokens[i])
                    i += 1
            new_vocab[tuple(new_tokens)] = freq
        vocab = new_vocab
    return merges


def apply_bpe(word, merges):
    tokens = list(word) + ["</w>"]
    for a, b in merges:
        new_tokens = []
        i = 0
        while i < len(tokens):
            if i + 1 < len(tokens) and tokens[i] == a and tokens[i + 1] == b:
                new_tokens.append(a + b)
                i += 2
            else:
                new_tokens.append(tokens[i])
                i += 1
        tokens = new_tokens
    return tokens
```

```python
>>> corpus = Counter({"low": 5, "lower": 2, "newest": 6, "widest": 3})
>>> merges = learn_bpe(corpus, k_merges=10)
>>> apply_bpe("lowest", merges)
['low', 'est</w>']
```

La primera iteración fusiona el par adyacente más común.`low`¿ Qué ?`est`¿ Qué ?`tion`Las palabras raras se rompen de forma clara.

Los tokenizadores reales de GPT / BERT / T5 aprenden fusiones de 30k-100k. Resultado: cualquier texto se tokeniza en una secuencia de longitud limitada de IDs conocidas, sin OOV nunca.

## Usalo

En la práctica, rara vez entrenas uno de estos tú mismo.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

Para la tokenización de subpalabra de estilo BPE en la era de los transformadores:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

El `Ġ`El prefijo marca los límites de palabras (una convención GPT-2).

### ¿Cuándo elegir cuál

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## Envío

Salvo como`outputs/skill-embeddings-picker.md`¿Qué es esto ?

```markdown
---
name: tokenizer-picker
description: Pick a tokenization approach for a new language model or text pipeline.
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

Given a task and dataset description, you output:

1. Tokenization strategy (word-level, BPE, WordPiece, SentencePiece, byte-level). One-sentence reason.
2. Vocabulary size target (e.g., 32k for an English-only LM, 64k-100k for multilingual).
3. Library call with the exact training command. Name the library. Quote the arguments.
4. One reproducibility pitfall. Tokenizer-model mismatch is the single most common silent production bug; call out which pair must be used together.

Refuse to recommend training a custom tokenizer when the user is fine-tuning a pretrained LLM. Refuse to recommend word-level tokenization for any model targeting production inference. Flag non-English / multi-script corpora as needing SentencePiece with byte fallback.
```

## Los ejercicios

1. **Easy.**- ¿ Qué ?`char_ngrams("playing")`y `char_ngrams("played")`. Calcule la superposición de Jaccard de los dos conjuntos de n-gram.`pla`¿ Qué ?`lay`¿ Qué ?`play`), por lo que FastText transfiere bien entre variantes morfológicas.
2. **Medium.**Extenderse`learn_bpe`Para rastrear el crecimiento del vocabulario. Plot tokens-per corpus-character como función del número de fusiones. Usted debe ver una compresión rápida en un primer momento, asymptoting cerca de ~2-3 caracteres por token.
3. **Hard.**Entrenar un BPE de 1k de fusión en las obras completas de Shakespeare. Comparar la tokenización de palabras comunes con nombres propios raros. Medir los tokens promedio por palabra antes y después. Escribir lo que te sorprendió.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## Leer más

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) el papel GloVe, siete páginas, todavía la mejor derivación de la pérdida.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) FastText.
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) el documento que introdujo el BPE en la PNL moderna.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) cómo BPE, WordPiece y SentencePiece difieren en la práctica.
