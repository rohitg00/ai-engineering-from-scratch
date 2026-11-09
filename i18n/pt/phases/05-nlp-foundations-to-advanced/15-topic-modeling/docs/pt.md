# Modelagem de tópicos  LDA e BERTopic

> LDA: documentos são misturas de tópicos, tópicos são distribuições sobre palavras. BERTopic: documentos em aglomeração em espaço de inserção, aglomerações são tópicos.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## O problema

Você tem 10.000 ingressos de suporte ao cliente, 50.000 artigos de notícias ou 200.000 tweets. Você precisa saber sobre o que a coleção é sem lê-la. Você não tem categorias rotuladas. Você nem sabe quantas categorias existem.

A modelagem de tópicos responde a isso sem supervisão. Dê-lhe um corpus, retome um pequeno conjunto de tópicos coerentes e, para cada documento, uma distribuição sobre esses tópicos.

Dois famílias algorítmicas dominam. LDA (2003) trata cada documento como uma mistura de tópicos latentes e cada tópico como uma distribuição sobre palavras.

O BERTopic (2020) codifica documentos com BERT, reduz a dimensionalidade com UMAP, agrupa com HDBSCAN e extrai palavras tópicas através de TF-IDF baseado em classe. Ganha no texto curto, mídias sociais e em qualquer coisa onde a semântica semelhante importa mais do que a sobreposição de palavras. Um documento recebe um tópico, que é uma limitação para o conteúdo de formato longo.

Esta lição constrói a intuição para ambos e nomes para escolher para um determinado corpo.

## O conceito

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA generative story.**Cada tópico é uma distribuição sobre palavras. Cada documento é uma mistura de tópicos. Para gerar uma palavra em um documento, amostre um tópico da mistura do documento, em seguida, amostre uma palavra da distribuição desse tópico. Inferência inverte isso: dada palavras observadas, infer a distribuição do tópico por documento e a distribuição da palavra por tópico.

A saída de LDA chave:

- `doc_topic`: matriz `(n_docs, n_topics)`, cada linha é de 1 (mistura de tópicos do documento).
- `topic_word`: matriz `(n_topics, vocab_size)`, cada linha é de 1 (distribuição de palavras do tópico).

**BERTopic pipeline.**

1. Cada documento é codificado com um transformador de frases (por exemplo, `all-MiniLM-L6-v2`(v. 384) vectores de dimensão 384.
2. Reduzir a dimensionalidade com UMAP para ~ 5 dimensões. Embedments BERT são muito escuras para agrupamento.
3. Cluster com HDBSCAN. Baseado na densidade, produz clusters de tamanho variável e um rótulo "outlier".
4. Para cada cluster, calcular TF-IDF baseado em classe sobre os documentos do cluster para extrair as principais palavras.

A saída é um tópico por documento (mais um -1 outlier label). Opcionalmente, uma adesão suave através do vetor de probabilidade do HDBSCAN.

```figure
topic-drift
```

## Construí-lo

### Passo 1: LDA via scikit-learn

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def fit_lda(documents, n_topics=5, max_features=1000):
    cv = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        min_df=2,
        max_df=0.9,
    )
    X = cv.fit_transform(documents)
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method="online",
    )
    doc_topic = lda.fit_transform(X)
    feature_names = cv.get_feature_names_out()
    return lda, cv, doc_topic, feature_names


def print_top_words(lda, feature_names, n_top=10):
    for idx, topic in enumerate(lda.components_):
        top_idx = np.argsort(-topic)[:n_top]
        words = [feature_names[i] for i in top_idx]
        print(f"topic {idx}: {' '.join(words)}")
```

Nota: palavras de parada removidas, min_df e max_df filtros termos raros e onipresentes, CountVectorizer (não TfidfVectorizer) porque LDA espera contagens brutas.

### Passo 2: BERTopic (produção)

```python
from bertopic import BERTopic

topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15,
    verbose=True,
)

topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()
print(info.head(20))
valid_topics = info[info["Topic"] != -1]["Topic"].tolist()
for topic_id in valid_topics[:5]:
    print(f"topic {topic_id}: {topic_model.get_topic(topic_id)[:10]}")
```

O filtro ligado .`Topic != -1`elimina o bucket de outlier do BERTopic (documentos que o HDBSCAN não pôde agrupar). `min_topic_size`O sistema de controle de dados HDBSCAN controla o tamanho mínimo do cluster; a biblioteca padrão do BERTopic é 10. Este exemplo define-o explicitamente em 15 para a escala da lição. Para corpora acima de 10.000 documentos, aumentar para 50 ou 100.

### Passo 3: Avaliação

Os dois métodos produzem palavras temáticas.

- **Topic coherence (c_v).**Combina NPMI (informação mútua pontual normalizada) de pares de palavras principais em contextos de janela deslizante, agrega as pontuações em vetores de tópicos e compara esses vetores através de semelhança cosínica.`gensim.models.CoherenceModel`com`coherence="c_v"`- Não .
- **Topic diversity.**Fração de palavras únicas em todas as principais palavras de todos os tópicos.
- **Qualitative inspection.**Leia as palavras principais de cada tópico.

## Quando escolher qual

| Situation | Pick |
|-----------|------|
| Short text (tweets, reviews, headlines) | BERTopic |
| Long documents with topic mixtures | LDA |
| No GPU / limited compute | LDA or NMF |
| Need document-level multi-topic distributions | LDA |
| LLM integration for topic labeling | BERTopic (direct support) |
| Resource-constrained edge deployment | LDA |
| Max semantic coherence | BERTopic |

A maior consideração prática é o comprimento do documento. Embedings BERT truncate; LDA conta trabalho em qualquer comprimento. Para documentos mais longos do que o contexto do modelo de embebimento, seja chunk + agregado ou use LDA.

## Usá-lo

A pilha de 2026:

- **BERTopic.**Default para texto curto e qualquer coisa que seja semântica.
- **`gensim.models.LdaModel`.**LDA clássico para produção, maduro, testado em batalha.
- **`sklearn.decomposition.LatentDirichletAllocation`.**LDA fácil para experimentos.
- **NMF.**Factorization de matriz não negativa, alternativa rápida à LDA, qualidade comparável em texto curto.
- **Top2Vec.**Design semelhante ao BERTopic, comunidade menor, mas boa em alguns pontos de referência.
- **FASTopic.**Mais novo, mais rápido do que o BERTopic em corpora muito grandes.
- **LLM-based labeling.**Execute qualquer agrupamento, e depois peça a um modelo para nomear cada agrupamento.

## Envia-o

Salva como`outputs/skill-topic-picker.md`- Não .

```markdown
---
name: topic-picker
description: Pick LDA or BERTopic for a corpus. Specify library, knobs, evaluation.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Given a corpus description (document count, avg length, domain, language, compute budget), output:

1. Algorithm. LDA / NMF / BERTopic / Top2Vec / FASTopic. One-sentence reason.
2. Configuration. Number of topics: `recommended = max(5, round(sqrt(n_docs)))`, clamped to 200 for corpora under 40,000 docs; permit >200 only when the corpus is genuinely large (>40k) and note the increased compute cost. `min_df` / `max_df` filters and embedding model for neural approaches also belong here.
3. Evaluation. Topic coherence (c_v) via `gensim.models.CoherenceModel`, topic diversity, and a 20-sample human read.
4. Failure mode to probe. For LDA, "junk topics" absorbing stopwords and frequent terms. For BERTopic, the -1 outlier cluster swallowing ambiguous documents.

Refuse BERTopic on documents longer than the embedding model's context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## Exercícios

1. **Easy.**Aplique LDA com 5 tópicos no conjunto de dados de 20 Newsgroups. Imprima as 10 principais palavras por tópico. Etiquete cada tópico à mão. O algoritmo encontrou as categorias reais?
2. **Medium.**Compare o número de tópicos encontrados, palavras principais e coerência qualitativa com a LDA. Qual superficia as categorias reais de forma mais limpa?
3. **Hard.**Calcule a coerência c_v para tanto LDA quanto BERTopic no seu corpus. Execute cada um com 5, 10, 20, 50 tópicos. Conserva a coerência versus a contagem de tópicos. Relate qual método é mais estável em todas as contagens de tópicos.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Topic | A thing the corpus is about | A probability distribution over words (LDA) or a cluster of similar documents (BERTopic). |
| Mixed membership | Doc is multiple topics | LDA assigns each document a distribution over all topics. |
| UMAP | Dimensionality reduction | Manifold learning that preserves local structure; used in BERTopic. |
| HDBSCAN | Density clustering | Finds variable-size clusters; produces "noise" label (-1) for outliers. |
| c_v coherence | Topic quality metric | NPMI of top topic words over sliding windows, turned into context vectors and compared with cosine similarity. |

## Mais leitura

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf)- O artigo LDA.
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) o artigo BERTopic.
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf)O jornal que introduziu o C_V e os amigos.
- [BERTopic documentation](https://maartengr.github.io/BERTopic/)- a referência da produção.
