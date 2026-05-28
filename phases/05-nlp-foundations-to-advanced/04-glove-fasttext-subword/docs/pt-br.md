# GloVe, FastText e Embeddings de Subpalavra

> Word2Vec treinou um embedding por palavra. GloVe fatorizou a matriz de co-ocorrência. FastText embedou os pedaços. BPE conectou com transformers.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 03 (Word2Vec do Zero)
**Tempo:** ~45 minutos

## O Problema

Word2Vec deixou duas perguntas em aberto.

Primeiro, havia uma linha paralela de pesquisa que fatorizava a matriz de co-ocorrência diretamente (LSA, HAL) em vez de fazer atualizações online de skip-gram. A abordagem iterativa do Word2Vec era fundamentalmente melhor, ou a diferença era artefato de como os dois métodos lidavam com contagens? **GloVe** respondeu: fatorização de matriz com loss cuidadosamente escolhido iguala ou supera Word2Vec, e custa menos pra treinar.

Segundo, nenhum dos dois métodos tinha uma história pra palavras que nunca viram. `Zoomer-approved`, `dogecoin`, qualquer substantivo próprio criado semana passada, toda forma flexionada de uma raiz rara. **FastText** corrigiu isso com embeddings de n-gramas de caracteres: uma palavra é a soma de suas partes, incluindo morfemas, então até palavras fora do vocabulário ganham um vetor sensato.

Terceiro, quando transformers chegaram, a pergunta mudou de novo. Vocabulários de nível de palavra ficam em torno de um milhão de entradas; a linguagem real é mais aberta que isso. **Byte-pair encoding (BPE)** e seus parentes resolveram isso aprendendo um vocabulário de unidades de subpalavra frequentes que cobre tudo. Todo tokenizer moderno pra todo LLM moderno é um tokenizer de subpalavra.

Essa lição percorre os três, depois explica qual buscar quando.

## O Conceito

**GloVe (Global Vectors).** Constrói a matriz de co-ocorrência palavra-palavra `X` onde `X[i][j]` é quantas vezes a palavra `j` aparece no contexto da palavra `i`. Treina vetores tal que `v_i · v_j + b_i + b_j ≈ log(X[i][j])`. Pondera o loss pra que pares frequentes não dominem. Pronto.

**FastText.** Uma palavra é a soma de seus n-gramas de caracteres mais a palavra em si. `where` vira `<wh, whe, her, ere, re>, <where>`. O vetor da palavra é a soma dos vetores componentes. Treina como Word2Vec. Benefício: palavras não vistas (`whereupon`) compõem de n-gramas conhecidos.

**BPE (Byte-Pair Encoding).** Começa com um vocabulário de bytes individuais (ou caracteres). Conta todos os pares adjacentes no corpus. Mescla o par mais frequente num novo token. Repete por `k` iterações. Resultado: um vocabulário de `k + 256` tokens onde sequências frequentes (`ing`, `tion`, `the`) são tokens únicos e palavras raras são quebradas em pedaços familiares. Toda frase tokeniza em alguma coisa.

## Construindo

### GloVe: fatorizar a matriz de co-ocorrência

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

Duas peças móveis que vale nomear. A função de ponderação `f(x) = (x/x_max)^alpha` reduz peso de pares muito frequentes (como `(the, and)`) pra que não dominem o loss. O embedding final é a soma das tabelas `W` (central) e `W_tilde` (contexto). Somar ambas é um truque publicado que tende a superar usar uma só.

### FastText: embeddings conscientes de subpalavra

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

Cada palavra é representada por seu conjunto de n-gramas (tipicamente 3 a 6 caracteres). O embedding da palavra é a soma dos embeddings de seus n-gramas. Pro treino de skip-gram, pluga isso onde Word2Vec usava um único vetor.

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

Pra uma palavra não vista, você ainda ganha um vetor desde que alguns de seus n-gramas sejam conhecidos. `whereupon` compartilha `<wh`, `her`, `ere`, e `<where` com `where`, então as duas caem perto uma da outra.

### BPE: vocabulário de subpalavra aprendido

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

Primeira iteração mescla o par adjacente mais comum. Depois de iterações suficientes, substrings frequentes (`low`, `est`, `tion`) viram tokens únicos e palavras raras quebram limpo.

Os tokenizers reais do GPT / BERT / T5 aprendem 30k-100k mesclagens. Resultado: qualquer texto tokeniza numa sequência de tamanho limitado de IDs conhecidos, sem OOV nunca.

## Usando

Na prática, você raramente treina qualquer um desses. Carrega checkpoints pré-treinados.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

Pra tokenização de subpalavra no estilo BPE na era transformer:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

O prefixo `Ġ` marca limites de palavra (convenção do GPT-2). Todo tokenizer moderno é uma variante BPE, WordPiece (BERT), ou SentencePiece (T5, LLaMA).

### Quando escolher qual

| Situação | Escolha |
|-----------|------|
| Vetores de palavra pré-treinados de uso geral, sem necessidade de tolerância a OOV | GloVe 300d |
| Vetores de palavra pré-treinados de uso geral, precisa lidar com erros de digitação / neologismos / idiomas ricos morfologicamente | FastText |
| Qualquer coisa entrando num transformer (treino ou inferência) | Qualquer tokenizer que o modelo trouxe. Nunca troque. |
| Treinar seu próprio modelo de linguagem do zero | Treine um tokenizer BPE ou SentencePiece no seu corpus primeiro |
| Classificação de texto de produção com modelo linear | Ainda TF-IDF. Lição 02. |

## Entregando

Salve como `outputs/skill-embeddings-picker.md`:

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

1. **Fácil.** Rode `char_ngrams("playing")` e `char_ngrams("played")`. Calcule o overlap Jaccard dos dois conjuntos de n-gramas. Você deve ver pedaços compartilhados substanciais (`pla`, `lay`, `play`), e é por isso que FastText transfere bem entre variantes morfológicas.
2. **Médio.** Estenda `learn_bpe` pra rastrear crescimento do vocabulário. Plote tokens-por-caractere-do-corpus como função do número de mesclagens. Você deve ver compressão rápida no início, assintotizando perto de ~2-3 caracteres por token.
3. **Difícil.** Treine um BPE de 1k mesclagens nas obras completas de Shakespeare. Compare tokenização de palavras comuns vs. substantivos próprios raros. Meça média de tokens por palavra antes e depois. Escreva o que te surpreendeu.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| Matriz de co-ocorrência | Tabela de frequência palavra-palavra | `X[i][j]` = quantas vezes a palavra `j` aparece numa janela ao redor da palavra `i`. |
| Subpalavra | Pedaço de palavra | Um n-grama de caracteres (FastText) ou token aprendido (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Mesclagem iterativa de pares adjacentes mais frequentes até o vocabulário atingir o tamanho alvo. |
| OOV | Fora do vocabulário | Palavra que o modelo nunca viu. Word2Vec/GloVe falham. FastText e BPE lidam. |
| BPE de nível de byte | BPE em bytes brutos | Esquema do GPT-2. Vocabulário começa com 256 bytes, então nada fica OOV. |

## Leitura Complementar

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) — o paper GloVe, sete páginas, ainda a melhor derivação do loss.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) — FastText.
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) — o paper que introduziu BPE no NLP moderno.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) — como BPE, WordPiece e SentencePiece realmente diferem na prática.
