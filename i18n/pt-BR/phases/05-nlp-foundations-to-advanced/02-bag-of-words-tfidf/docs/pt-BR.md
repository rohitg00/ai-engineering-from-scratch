# Saco de Palavras, TF-IDF e Representação de Texto

> A TF-IDF ainda supera as embarcações em tarefas bem definidas em 2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## O problema

O modelo precisa de números.

Cada pipeline de PNL tem que responder à mesma pergunta. Como transformar um fluxo de tokens de comprimento variável em um vetor de tamanho fixo que um classificador pode consumir. A primeira resposta que o campo aterrou foi a mais estúpida que funciona. Conte as palavras. Faça um vetor.

Esse vetor tem levado mais produção de PNL do que qualquer modelo de incorporação. Filtros de spam, classificadores de tópicos, detecção de anomalias de registro, classificação de pesquisa (antes do BM25), a primeira onda de análise de sentimentos, a primeira década de benchmarks acadêmicos de PNL. 2026 os profissionais ainda alcançam primeiro em tarefas de classificação estreita. É rápido, interpretável e muitas vezes indistinguível de um modelo de inserção de parâmetros de 400M em tarefas onde a presença da palavra é o que importa.

Esta lição constrói uma bolsa de palavras, depois TF-IDF, a partir do zero, mostra o scikit-learn fazendo o mesmo em três linhas, e depois nomeia o modo de falha que faz você alcançar as incorporações.

## O conceito

**Bag of Words (BoW)**Para cada documento, conte quantas vezes cada palavra vocabulário aparece.`i`É a contagem de palavras.`i`- Não .

**TF-IDF**Uma palavra que aparece em todos os documentos é pouco informativa, por isso diminui-a. Uma palavra rara em todo o corpo, mas frequente em um único documento é sinal, por isso diminui-a.

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

Onde ?`TF`é a frequência do termo no documento, `df`é a frequência do documento (quantos documentos contêm a palavra), `N`O documento é total.`log`Mantém o peso limitado para palavras onipresentes.

Propriedade chave: ambos produzem vetores escassos com eixos interpretáveis. Você pode olhar para os pesos de um classificador treinado e ler quais palavras empurram um documento em direção a cada classe.

```figure
bow-tfidf
```

## Construí-lo

### Passo 1: construir o vocabulário

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

Entrada: lista de documentos tokenizados (qualquer tokenizer de nível de palavra o fará; o `code/main.py`Esta lição utiliza uma variante simplificada em minúsculas).`{word: index}`O índice de palavras 0 é a primeira palavra vista no primeiro documento.

### Passo 2: Saco de palavras

```python
def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix
```

```python
>>> docs = [["cat", "sat", "on", "mat"], ["cat", "cat", "ran"]]
>>> vocab = build_vocab(docs)
>>> bag_of_words(docs, vocab)
[[1, 1, 1, 1, 0], [2, 0, 0, 0, 1]]
```

As linhas são documentos, as colunas são índices de vocabulário.`[i][j]`É "quantas vezes palavra `j`aparece no documento `i`. " Doc 1 tem `cat`- Doutor 0 fez.`ran`zero vezes porque não o fez.

### Passo 3: frequência dos termos e frequência dos documentos

```python
import math


def term_frequency(doc_bow, doc_length):
    return [c / doc_length if doc_length else 0 for c in doc_bow]


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]
```

Dois truques de suavizamento que valham a pena nomear.`(n+1)/(d+1)`Evita-se .`log(x/0)`- A trailha .`+1`As aplicações de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de como para para para para para para para para para para para para para para para para para para para para para para para os de software de software de software de software de software de software de de software de software`log(N/df)`Ambas funcionam, a versão suave é mais amigável.

### Passo 4: TF-IDF

```python
def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = term_frequency(row, length)
        out.append([tf_j * idf_j for tf_j, idf_j in zip(tf, idf)])
    return out
```

```python
>>> docs = [
...     ["the", "cat", "sat"],
...     ["the", "dog", "sat"],
...     ["the", "cat", "ran"],
... ]
>>> vocab = build_vocab(docs)
>>> bow = bag_of_words(docs, vocab)
>>> tfidf(bow)
```

Três documentos, cinco palavras vocabulares (`the`- Não .`cat`- Não .`sat`- Não .`dog`- Não .`ran` ).`the`Aparece em todos os três, por isso, as forças armadas são baixas.`dog`Com um vocabulário real de milhares de palavras, estes vetores são escassos (a maioria das entradas são zero).

### Passo 5: Normalização de linhas L2

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

Sem normalização, um documento mais longo obtém um vetor maior e domina as pontuações de semelhança. Normalização L2 coloca cada documento na hiperesfera unidade.

## Usá-lo

O Scikit-Learn vai enviar a versão de produção.

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

docs = ["the cat sat on the mat", "the dog sat on the mat", "the cat ran"]

bow_vectorizer = CountVectorizer()
bow = bow_vectorizer.fit_transform(docs)
print(bow_vectorizer.get_feature_names_out())
print(bow.toarray())

tfidf_vectorizer = TfidfVectorizer()
tfidf = tfidf_vectorizer.fit_transform(docs)
print(tfidf.toarray().round(3))
```

`CountVectorizer`faz tokenization, vocabulário e BoW em uma chamada. `TfidfVectorizer`Para 100k documentos, a versão densa não cabe na memória; permaneça densa até que o classificador exija densa.

Os botões que mudam tudo:

| Arg | Effect |
|-----|--------|
| `ngram_range=(1, 2)` | Include bigrams. Usually boosts classification. |
| `min_df=2` | Drop words in fewer than 2 docs. Trims vocabulary on noisy data. |
| `max_df=0.95` | Drop words in more than 95% of docs. Approximates stopword removal without a hardcoded list. |
| `stop_words="english"` | scikit-learn's builtin stopword list. Task-dependent — sentiment analysis should *not* drop negations. |
| `sublinear_tf=True` | Use `1 + log(tf)` instead of raw `tf`. Helps when a term repeats many times in one doc. |

### Quando o TF-IDF ainda vencer (a partir de 2026)

- Detecção de spam, rotulagem de tópicos, sinalização de anomalias de registro.
- Regimes de baixo nível de dados (centenas de exemplos rotulados).
- Qualquer lugar que tenha latência, TF-IDF mais um modelo linear responde em microsecondas.
- Sistemas que precisam explicar as suas previsões, inspecionar os coeficientes do classificador, as palavras mais positivas são a razão.

### Quando o TF-IDF falhar

Considerem estes dois documentos:

- "O filme não foi bom".
- "O filme foi excelente".

Uma é uma revisão negativa, outra é positiva, a sua sobreposição entre os TF e os IDF é exatamente o mesmo.`{the, movie, was}`Um classificador de sacos de palavras tem que memorizar essa palavra .`not`Próximo`good`Pode aprender isto com dados suficientes, mas nunca tão graciosamente como um modelo que entende a sintaxe.

O outro fracasso: palavras fora do vocabulário na inferência.`Zoomer-approved`Se o token não apareceu no treinamento, as palavras-chave (leção 04) lidam com isso.

### Embedings híbridos: TF-IDF ponderados

O padrão pragmático de 2026 para classificação de dados médios: utilizar pesos TF-IDF como atenção sobre as incorporações de palavras.

```python
def tfidf_weighted_embedding(doc, tfidf_scores, embedding_table, dim):
    vec = [0.0] * dim
    total_weight = 0.0
    for token in doc:
        if token not in embedding_table or token not in tfidf_scores:
            continue
        weight = tfidf_scores[token]
        emb = embedding_table[token]
        for i in range(dim):
            vec[i] += weight * emb[i]
        total_weight += weight
    if total_weight == 0:
        return vec
    return [v / total_weight for v in vec]
```

Você obtém capacidade semântica a partir de embebimentos e ênfase em palavras raras a partir de TF-IDF. Classificador treina no vetor em conjunto. Isso supera por si só para classificação de sentimento, tópico e intenção abaixo de cerca de 50 mil exemplos rotulados.

## Envia-o

Salva como`outputs/prompt-vectorization-picker.md`- Não .

```markdown
---
name: vectorization-picker
description: Given a text-classification task, recommend BoW, TF-IDF, embeddings, or a hybrid.
phase: 5
lesson: 02
---

You recommend a text-vectorization strategy. Given a task description, output:

1. Representation (BoW, TF-IDF, transformer embeddings, or a hybrid). Explain why in one sentence.
2. Specific vectorizer configuration. Name the library. Quote the arguments (`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`).
3. One failure mode to test before shipping.

Refuse to recommend embeddings when the user has under 500 labeled examples unless they show evidence of semantic failure in a TF-IDF baseline. Refuse to remove stopwords for sentiment analysis (negations carry signal). Flag class imbalance as needing more than a vectorizer change.

Example input: "Classifying 30k customer support tickets into 12 categories. Most tickets are 2-3 sentences. English only. Need explainability for audit logs."

Example output:

- Representation: TF-IDF. 30k examples is not small; explainability requirement rules out dense embeddings.
- Config: `TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`. Keep stopwords because category keywords sometimes are stopwords ("not working" vs "working").
- Failure to test: verify `min_df=3` does not drop rare category keywords. Run `get_feature_names_out` filtered by class and eyeball.
```

## Exercícios

1. **Easy.**Implementação `cosine_similarity(doc_vec_a, doc_vec_b)`Verificar que os documentos idênticos têm uma pontuação de 1,0 e os documentos de vocabulário disjunto 0,0.
2. **Medium.**Adicionar`n-gram`apoio a`bag_of_words`Parâmetro .`n`Produz contagens sobre `n`-Testa isso.`n=2`- Não .`["the", "cat", "sat"]`produz conteúdos de bigram para `["the cat", "cat sat"]`- Não .
3. **Hard.**Construa o híbrido de incorporação ponderada TF-IDF acima usando vetores GloVe 100d (descarregar uma vez, cache). Compare a precisão da classificação com a simples TF-IDF e as simples incorporações medias em conjunto no conjunto de dados 20 Newsgroups. Relatório que ganha onde.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BoW | Word frequency vector | Counts of vocabulary words in one document. Throws away order. |
| TF | Term frequency | Count of a word in a document, optionally normalized by document length. |
| DF | Document frequency | Count of documents containing the word at least once. |
| IDF | Inverse document frequency | `log(N / df)` smoothed. Downweights words that appear everywhere. |
| Sparse vector | Mostly zeros | Vocabulary is typically 10k-100k words; most are absent from any given document. |
| Cosine similarity | Vector angle | Dot product of L2-normalized vectors. 1 is identical, 0 is orthogonal. |

## Mais leitura

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) a referência canónica da API, mais notas em cada botão.
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) o papel que fez do TF-IDF o padrão durante uma década.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) 2026 assumir quando o método antigo vence e porquê.
