# Bag of Words, TF-IDF e Representação de Texto

> Conta primeiro, pensa depois. TF-IDF ainda ganha de embeddings em tarefas bem definidas em 2026.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 01 (Processamento de Texto), Fase 2 · 02 (Regressão Linear do Zero)
**Tempo:** ~75 minutos

## O Problema

O modelo precisa de números. Você tem strings.

Toda pipeline de NLP tem que responder a mesma pergunta. Como transformamos um fluxo de tokens de tamanho variável num vetor de tamanho fixo que um classificador pode consumir. A primeira resposta que o campo encontrou foi a mais burra que funciona. Conta as palavras. Faz um vetor.

Esse vetor carregou mais NLP de produção do que qualquer modelo de embedding. Filtros de spam, classificadores de tópico, detecção de anomalias em logs, ranking de busca (antes do BM25), a primeira onda de análise de sentimento, a primeira década de benchmarks acadêmicos de NLP. Praticantes de 2026 ainda reaching for it first em tarefas de classificação restritas. É rápido, interpretável, e frequentemente indistinguível de um modelo de embedding com 400M parâmetros em tarefas onde presença de palavra é o que importa.

Essa lição constrói bag of words, depois TF-IDF, do zero. Depois mostra scikit-learn fazendo o mesmo em três linhas. Depois nomeia o modo de falha que faz você buscar embeddings.

## O Conceito

**Bag of Words (BoW)** joga fora a ordem. Pra cada documento, conta quantas vezes cada palavra do vocabulário aparece. O tamanho do vetor é o tamanho do vocabulário. Posição `i` é a contagem da palavra `i`.

**TF-IDF** repondera o BoW. Uma palavra que aparece em todo documento não é informativa, então reduza seu peso. Uma palavra rara no corpus mas frequente em um documento é sinal, então aumente seu peso.

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

Onde `TF` é frequência do termo no documento, `df` é frequência de documentos (quantos docs contêm a palavra), `N` é total de documentos. O `log` mantém o peso limitado pra palavras onipresentes.

Propriedade chave: ambos produzem vetores esparsos com eixos interpretáveis. Você pode olhar os pesos de um classificador treinado e ler quais palavras empurram um documento pra cada classe. Não dá pra fazer isso com um embedding BERT de 768 dimensões.

## Construindo

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

Entrada: lista de documentos tokenizados (qualquer tokenizer de nível de palavra serve; o `code/main.py` dessa lição usa uma variante simplificada em lowercase). Saída: dict `{palavra: índice}`. Ordem de inserção estável significa que o índice 0 é a primeira palavra vista no primeiro documento. Convenção varia; scikit-learn ordena alfabeticamente.

### Passo 2: bag of words

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

Linhas são documentos. Colunas são índices do vocabulário. Entrada `[i][j]` é "quantas vezes a palavra `j` aparece no documento `i`." Doc 1 tem `cat` duas vezes porque realmente tem. Doc 0 tem `ran` zero vezes porque não tem.

### Passo 3: frequência de termo e frequência de documento

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

Dois truques de suavização que vale nomear. O `(n+1)/(d+1)` evita `log(x/0)`. O `+1` final garante que uma palavra em todo documento ainda tenha IDF 1 (não 0), igual ao padrão do scikit-learn. Outras implementações usam `log(N/df)` cru. Os dois funcionam; a versão suavizada é mais amigável.

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

Três documentos, cinco palavras do vocabulário (`the`, `cat`, `sat`, `dog`, `ran`). `the` aparece nos três, então seu IDF é baixo. `dog` aparece em um, então seu IDF é alto. Os vetores são esparsos (a maioria das entradas é pequena) e as palavras discriminativas saltam aos olhos.

### Passo 5: normalizar linhas com L2

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

Sem normalização, um documento maior ganha um vetor maior e domina os scores de similaridade. Normalização L2 coloca cada documento na hipersfera unitária. A similaridade cosseno entre linhas agora é só um produto escalar.

## Usando

scikit-learn traz a versão de produção.

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

`CountVectorizer` faz tokenização, vocabulário e BoW numa chamada. `TfidfVectorizer` adiciona ponderação IDF e normalização L2. Ambos retornam matrizes esparsas. Pra 100k documentos, a versão densa não cabe em memória; fique esparsa até o classificador exigir denso.

Parâmetros que mudam tudo:

| Parâmetro | Efeito |
|-----|--------|
| `ngram_range=(1, 2)` | Inclui bigramas. Geralmente melhora classificação. |
| `min_df=2` | Remove palavras em menos de 2 docs. Podas vocabulário em dados ruidosos. |
| `max_df=0.95` | Remove palavras em mais de 95% dos docs. Aproxima remoção de stopwords sem lista hardcoded. |
| `stop_words="english"` | Lista de stopwords embutida do scikit-learn. Depende da tarefa — análise de sentimento *não* deve remover negações. |
| `sublinear_tf=True` | Usa `1 + log(tf)` em vez de `tf` bruto. Ajuda quando um termo repete muitas vezes num doc. |

### Quando TF-IDF ainda ganha (em 2026)

- Detecção de spam, rotulamento de tópicos, sinalização de anomalias em logs. Presença de palavra é o que importa; nuances semânticas não.
- Registros com poucos dados (centenas de exemplos rotulados). TF-IDF com regressão logística não tem custo de pre-treinamento.
- Qualquer lugar onde latência importa. TF-IDF com modelo linear responde em microssegundos. Embedding de documento via transformer leva 10-100ms.
- Sistemas que precisam explicar suas previsões. Inspecione os coeficientes do classificador. As palavras positivas no topo são a razão.

### Quando TF-IDF falha

O fracasso de cegueira semântica. Considere estes dois documentos:

- "The movie was not good at all."
- "The movie was excellent."

Um é uma resenha negativa. Um é positiva. O overlap TF-IDF deles é exatamente `{the, movie, was}`. Um classificador bag-of-words tem que memorizar que a palavra `not` perto de `good` inverte o label. Aprende com dados suficientes, mas nunca com a elegância de um modelo que entende sintaxe.

Outra falha: palavras fora do vocabulário em inferência. Um modelo BoW treinado em reviews do IMDb não sabe o que fazer com `Zoomer-approved` se esse token nunca apareceu no treino. Embeddings de subpalavra (lição 04) lidam com isso. TF-IDF não.

### Híbrido: embeddings ponderados por TF-IDF

O padrão pragmático de 2026 pra classificação com médio volume de dados: usar pesos TF-IDF como attention sobre embeddings de palavras.

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

Você ganha capacidade semântica dos embeddings, e ênfase em palavras raras do TF-IDF. O classificador treina no vetor agrupado. Isso supera qualquer um dos dois sozinho pra sentimento, tópico e classificação de intenção com menos de cerca de 50k exemplos rotulados.

## Entregando

Salve como `outputs/prompt-vectorization-picker.md`:

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

1. **Fácil.** Implemente `cosine_similarity(doc_vec_a, doc_vec_b)` na saída TF-IDF normalizada com L2. Verifique que documentos idênticos dão 1.0 e documentos com vocabulário disjunto dão 0.0.
2. **Médio.** Adicione suporte a `n-gram` em `bag_of_words`. Parâmetro `n` produz contagens sobre `n`-gramas. Teste que `n=2` em `["the", "cat", "sat"]` produz contagens de bigrama pra `["the cat", "cat sat"]`.
3. **Difícil.** Construa o híbrido TF-IDF-ponderado-embedding acima usando vetores GloVe 100d (baixe uma vez, cache). Compare precisão de classificação com TF-IDF puro e embeddings médios agrupados no dataset 20 Newsgroups. Relate onde cada um ganha.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| BoW | Vetor de frequência de palavras | Contagens de palavras do vocabulário num documento. Joga fora a ordem. |
| TF | Frequência de termo | Contagem de uma palavra num documento, opcionalmente normalizada pelo tamanho do documento. |
| DF | Frequência de documento | Contagem de documentos que contêm a palavra pelo menos uma vez. |
| IDF | Frequência inversa de documento | `log(N / df)` suavizado. Reduz peso de palavras que aparecem em todo lugar. |
| Vetor esparso | Maioria zeros | Vocabulário tipicamente tem 10k-100k palavras; a maioria está ausente de qualquer documento dado. |
| Similaridade cosseno | Ângulo entre vetores | Produto escalar de vetores normalizados com L2. 1 é idêntico, 0 é ortogonal. |

## Leitura Complementar

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — referência canônica da API, mais notas sobre cada parâmetro.
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) — o paper que fez TF-IDF ser o padrão por uma década.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) — visão de 2026 de quando o método antigo ganha e por quê.
