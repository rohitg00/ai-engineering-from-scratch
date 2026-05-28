# Modelagem de Tópico — LDA e BERTopic

> LDA: documentos são misturas de tópicos, tópicos são distribuições sobre palavras. BERTopic: documentos se agrupam no espaço de embedding, clusters são tópicos. Mesmo objetivo, decomposições diferentes.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 02 (BoW + TF-IDF), Fase 5 · 03 (Word2Vec)
**Tempo:** ~45 minutos

## O Problema

Você tem 10.000 tickets de suporte, 50.000 notícias, ou 200.000 tweets. Precisa saber do que a coleção trata sem ler. Não tem categorias rotuladas. Nem sabe quantas categorias existem.

Modelagem de tópico responde isso sem supervisão. Dê um corpus, ganhe um conjunto pequeno de tópicos coerentes e, pra cada documento, uma distribuição sobre esses tópicos.

Duas famílias algorítmicas dominam. LDA (2003) trata cada documento como mistura de tópicos latentes e cada tópico como distribuição sobre palavras. Inferência é bayesiana. Ainda é usado em produção onde você precisa de atribuições de tópico com membros mistos e distribuições de probabilidade a nível de palavra explicáveis.

BERTopic (2020) codifica documentos com BERT, reduz dimensionalidade com UMAP, agrupa com HDBSCAN, e extrai palavras de tópico via TF-IDF baseado em classe. Ganha em texto curto, redes sociais e qualquer lugar onde similaridade semântica importa mais que sobreposição de palavras. Um documento ganha um tópico, o que é uma limitação pra conteúdo de formato longo.

Essa lição constrói intuição pra ambos e nomeia qual escolher pra um corpus dado.

## O Conceito

![Modelo de mistura LDA vs. agrupamento BERTopic](../assets/topic-modeling.svg)

**História generativa do LDA.** Cada tópico é uma distribuição sobre palavras. Cada documento é uma mistura de tópicos. Pra gerar uma palavra num documento, amostra um tópico da mistura do documento, depois amostra uma palavra da distribuição desse tópico. Inferência reverte isso: dadas palavras observadas, infere a distribuição de tópico por documento e a distribuição de palavras por tópico. Gibbs sampling colapsado ou Bayes variacional faz a matemática.

Saída principal do LDA:

- `doc_topic`: matriz `(n_docs, n_topics)`, cada linha soma 1 (mistura de tópicos do documento).
- `topic_word`: matriz `(n_topics, vocab_size)`, cada linha soma 1 (distribuição de palavras do tópico).

**Pipeline do BERTopic.**

1. Codifica cada documento com um sentence transformer (ex: `all-MiniLM-L6-v2`). Vetores de 384 dimensões.
2. Reduz dimensionalidade com UMAP pra ~5 dimensões. Embeddings BERT são altos demais pra agrupamento.
3. Agrupa com HDBSCAN. Baseado em densidade, produz clusters de tamanho variável e label "outlier."
4. Pra cada cluster, calcula TF-IDF baseado em classe sobre os documentos do cluster pra extrair palavras principais.

Saída é um tópico por documento (mais label -1 de outlier). Opcionalmente, associação suave via vetor de probabilidade do HDBSCAN.

## Construindo

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

Note: stopwords removidos, min_df e max_df filtram termos raros e onipresentes, CountVectorizer (não TfidfVectorizer) porque LDA espera contagens brutas.

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

O filtro `Topic != -1` remove o balde de outlier do BERTopic (documentos que o HDBSCAN não conseguiu agrupar). `min_topic_size` controla o tamanho mínimo de cluster do HDBSCAN; o padrão da biblioteca BERTopic é 10. Este exemplo define 15 explicitamente pra escala da lição. Pra corpora acima de 10.000 documentos, aumente pra 50 ou 100.

### Passo 3: avaliação

Ambos os métodos produzem palavras de tópico. A pergunta é se essas palavras coadem.

- **Coerência de tópico (c_v).** Combina NPMI (informação mútua pontual normalizada) de pares de palavras top sobre contextos de janela deslizante, agrega os scores em vetores de tópico, e compara esses vetores via similaridade cosseno. Maior é melhor. Use `gensim.models.CoherenceModel` com `coherence="c_v"`.
- **Diversidade de tópico.** Fração de palavras únicas entre todas as palavras top dos tópicos. Maior é melhor (tópicos não se sobrepõem).
- **Inspeção qualitativa.** Leia as palavras top de cada tópico. Nomeiam algo real? Julgamento humano ainda é a última linha de defesa.

## Quando escolher qual

| Situação | Escolha |
|-----------|------|
| Texto curto (tweets, resenhas, manchetes) | BERTopic |
| Documentos longos com mistura de tópicos | LDA |
| Sem GPU / compute limitado | LDA ou NMF |
| Precisa de distribuições multi-tópico a nível de documento | LDA |
| Integração com LLM pra rotulamento de tópicos | BERTopic (suporte direto) |
| Deploy em borda com recursos limitados | LDA |
| Máxima coerência semântica | BERTopic |

A maior consideração prática é comprimento do documento. Embeddings BERT truncam; contagens LDA funcionam em qualquer comprimento. Pra documentos mais longos que o contexto do modelo de embedding, ou chunk + aglomere ou use LDA.

## Usando

Stack de 2026:

- **BERTopic.** Padrão pra texto curto e qualquer lugar onde semântica importa.
- **`gensim.models.LdaModel`.** LDA clássico pra produção, maduro, testado em batalha.
- **`sklearn.decomposition.LatentDirichletAllocation`.** LDA fácil pra experimentos.
- **NMF.** Fatoração de matriz não-negativa. Alternativa rápida ao LDA, qualidade comparável em texto curto.
- **Top2Vec.** Design similar ao BERTopic. Comunidade menor mas bom em alguns benchmarks.
- **FASTopic.** Mais novo, mais rápido que BERTopic em corpora muito grandes.
- **Rotulamento baseado em LLM.** Rode qualquer agrupamento, depois prompta um modelo pra nomear cada cluster.

## Entregando

Salve como `outputs/skill-topic-picker.md`:

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

1. **Fácil.** Ajuste LDA com 5 tópicos no dataset 20 Newsgroups. Imprima 10 palavras top por tópico. Rotule cada tópico manualmente. O algoritmo encontrou as categorias reais?
2. **Médio.** Ajuste BERTopic no mesmo subconjunto 20 Newsgroups. Compare número de tópicos encontrados, palavras top e coerência qualitativa com LDA. Qual revela as categorias reais mais limpo?
3. **Difícil.** Calcule coerência c_v pra ambos LDA e BERTopic no seu corpus. Rode cada com 5, 10, 20, 50 tópicos. Plote coerência vs. contagem de tópicos. Relate qual método é mais estável entre contagens de tópicos.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| Tópico | Uma coisa que o corpus trata | Distribuição de probabilidade sobre palavras (LDA) ou cluster de documentos similares (BERTopic). |
| Membro misto | Doc é múltiplos tópicos | LDA atribui a cada documento uma distribuição sobre todos os tópicos. |
| UMAP | Redução de dimensionalidade | Aprendizado de variedade que preserva estrutura local; usado no BERTopic. |
| HDBSCAN | Agrupamento por densidade | Encontra clusters de tamanho variável; produz label "ruído" (-1) pra outliers. |
| Coerência c_v | Métrica de qualidade de tópico | Informação mútua pontual média das palavras top do tópico dentro de janelas deslizantes. |

## Leitura Complementar

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) — o paper LDA.
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) — o paper BERTopic.
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) — o paper que introduziu c_v e afins.
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) — a referência de produção. Excelentes exemplos.
