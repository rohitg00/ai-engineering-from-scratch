# GloVe, FastText e Subword Embeddings

> O Word2Vec treinou um incorporado por palavra. O GloVe factorizou a matriz de co-ocorrência. O FastText incorporou as peças. O BPE puenteou para transformadores.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## O problema

A Word2Vec deixou duas perguntas abertas.

Primeiro, havia uma linha paralela de pesquisa que factualizou a matriz de co-ocorrência diretamente (LSA, HAL) em vez de fazer atualizações de skip-gram online. A abordagem iterativa do Word2Vec era fundamentalmente melhor, ou a diferença era um artefato de como os dois métodos são manuseados conta? **GloVe**A resposta foi: factorization de matriz com uma perda cuidadosamente escolhida, que corresponde ou supera o Word2Vec, e custa menos treinar.

Em segundo lugar, nenhum dos métodos tinha uma história para palavras que nunca tinha visto.`Zoomer-approved`- Não .`dogecoin`, qualquer substantivo próprio cunhado na semana passada, cada forma inflexível de uma raiz rara.**FastText**Fixou isto incorporando caracteres n-gramas: uma palavra é a soma de suas partes, incluindo morfemas, então mesmo palavras fora do vocabulário obtêm um vetor sensível.

Em terceiro lugar, quando chegaram os transformadores, a questão mudou novamente.**Byte-pair encoding (BPE)**E os seus parentes resolveram isto aprendendo um vocabulário de unidades freqüentes de subpalavras que abrange tudo.

Esta lição vai caminhar para os três, e depois explica qual alcançar para quando.

## O conceito

**GloVe (Global Vectors).**Construir a matriz de co-ocorrência palavra-palavra `X`onde`X[i][j]`É a frequência da palavra.`j`aparece no contexto da palavra `i`- Vêctores de trem tais que`v_i · v_j + b_i + b_j ≈ log(X[i][j])`O peso é tão baixo que os pares não dominam.

**FastText.**Uma palavra é a soma de seus caracteres n-gramas mais a própria palavra. `where`torna-se`<wh, whe, her, ere, re>, <where>`O vector de palavra é a soma dos vectores componentes.`whereupon`) são compostas por n-gramas conhecidos.

**BPE (Byte-Pair Encoding).**Comece com um vocabulário de bytes individuais (ou caracteres). Conte cada par adjacente no corpus. Combine o par mais frequente em um novo token. Repita para `k`Iterações. Resultado: um vocabulário dos símbolos base mais `k`fusões (`k + 256`Tokens quando você começa a partir de bytes) onde sequências frequentes (`ing`- Não .`tion`- Não .`the`As palavras raras são divididas em pedaços familiares.

```figure
n5-subword-merge
```

## Construí-lo

### GloVe: factorizar a matriz de co-ocorrência

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

Duas peças móveis que valham a pena nomear.`f(x) = (x/x_max)^alpha`- de peso inferior em pares muito frequentes (como `(the, and)`O valor final da integração é a soma de`W`(centro) e `W_tilde`(contexto) tabelas. Somando ambas é um truque publicado que tende a superar usando apenas um.

### FastText: embutidos conscientes de subpalavras

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

Cada palavra é representada por seu conjunto de n-gramas (normalmente de 3 a 6 caracteres).

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

Para uma palavra invisível, você ainda obtém um vetor desde que alguns de seus n-gramas são conhecidos. `whereupon`Ações `<wh`- Não .`her`- Não .`ere`, e `<where`com`where`, então os dois aterrissam perto um do outro.

### BPE: vocabulário de subpalavras aprendido

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

A primeira iteração mistura o par adjacente mais comum.`low`- Não .`est`- Não .`tion`O que é que se passa com o "comércio de produtos" e o "comércio de produtos" ?

Os tokenizadores GPT / BERT / T5 reais aprendem fusões de 30k-100k. Resultado: qualquer texto tokeniza em uma sequência de comprimento limitado de IDs conhecidas, sem OOV nunca.

## Usá-lo

Na prática, raramente treinas isto sozinho.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

Para a tokenização de subpalavras no estilo BPE na era dos transformadores:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

O `Ġ`O prefixo marca os limites das palavras (uma convenção GPT-2).

### Quando escolher qual

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## Envia-o

Salva como`outputs/skill-embeddings-picker.md`- Não .

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

## Exercícios

1. **Easy.**Corra .`char_ngrams("playing")`E ...`char_ngrams("played")`- Calcule a sobreposição Jaccard dos dois conjuntos de n-gram.`pla`- Não .`lay`- Não .`play`), razão pela qual o FastText transfere bem entre as variantes morfológicas.
2. **Medium.**Extensão`learn_bpe`Para rastrear o crescimento do vocabulário. Plot tokens-per-corpus-caracter como função do número de fusões. Você deve ver compressão rápida no início, assimptando cerca de ~2-3 caras por token.
3. **Hard.**Treinar um BPE de 1k de fusão sobre as obras completas de Shakespeare. Comparar a tokenização de palavras comuns com nomes próprios raros. Medir tokens médios por palavra antes e depois. Escrever o que surpreendeu.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## Mais leitura

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf)O Glove, sete páginas, ainda é a melhor derivação da perda.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) FastText.
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) o artigo que introduziu a BPE na PNL moderna.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) como BPE, WordPiece e SentencePiece diferem na prática.
