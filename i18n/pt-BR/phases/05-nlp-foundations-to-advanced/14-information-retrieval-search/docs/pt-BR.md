# Recuperação e Pesquisa de Informações

> BM25 é preciso, mas frágil. Dense lança uma rede larga, mas falta palavras-chave. Hybrid é o padrão de 2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## O problema

O usuário digita "o que acontece se alguém mentiu para obter dinheiro" e espera encontrar o estatuto que realmente cobre isso: "Seção 420 IPC". Uma pesquisa de palavras-chave perde completamente (sem vocabulário compartilhado). Uma pesquisa semântica perde se os incorporados não foram treinados em texto legal.

A IR é o pipeline sob cada sistema RAG, cada barra de pesquisa, cada busca confusa do site do doc. A arquitetura de 2026 que funciona na produção não é um único método. É uma cadeia de métodos complementares, cada um capturando as falhas do anterior.

Esta lição constrói cada peça e nome que falha em cada captura.

## O conceito

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

Quatro camadas, escolha as que precisarem.

1. **Sparse retrieval (BM25).**Rapido, preciso em correspondências exatas, terrível em semântica, corre um índice invertido, sub-10ms por consulta em milhões de documentos, dá-lhe referências estatutárias, códigos de produto, mensagens de erro, entidades nomeadas corretas.
2. **Dense retrieval.**Encode query e documentos em vetores. Pesquisa vizinha mais próxima. Capta parafrases e semântica semelhança. Não há correspondências exatas de palavras-chave que diferem por um caracter. 50-200ms por consulta com FAISS ou um vector DB.
3. **Fusion.**Combine as listas classificadas de escassas e densas. A fusão de classificação recíproca (RRF) é a padrão fácil porque ignora as pontuações brutas (que vivem em diferentes escalas) e só usa posições de classificação. A fusão ponderada é uma opção quando você sabe que um sinal domina para seu domínio.
4. **Cross-encoder rerank.**Tome o top-30 da fusão. Execute um cross-encoder (query + document juntos, pontuação de cada par). Mantenha o top-5. Cross-encoders são mais lentos por par do que bi-encoders, mas muito mais precisos.

A recuperação em três vias (BM25 + densa + espaçamento aprendido como SPLADE) supera os dois caminhos em 2026 mas precisa de infraestrutura para índices de espaçamento aprendido.

```figure
gx-hybrid-retrieval
```

## Construí-lo

### Passo 1: BM25 a partir do zero

```python
import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


class BM25:
    def __init__(self, corpus, k1=1.5, b=0.75):
        if not corpus:
            raise ValueError("corpus must not be empty")
        self.corpus = [tokenize(d) for d in corpus]
        self.k1 = k1
        self.b = b
        self.n_docs = len(self.corpus)
        self.avg_dl = sum(len(d) for d in self.corpus) / self.n_docs
        self.df = Counter()
        for doc in self.corpus:
            for term in set(doc):
                self.df[term] += 1

    def idf(self, term):
        n = self.df.get(term, 0)
        return math.log(1 + (self.n_docs - n + 0.5) / (n + 0.5))

    def score(self, query, doc_idx):
        q_tokens = tokenize(query)
        doc = self.corpus[doc_idx]
        dl = len(doc)
        freq = Counter(doc)
        score = 0.0
        for term in q_tokens:
            f = freq.get(term, 0)
            if f == 0:
                continue
            numerator = f * (self.k1 + 1)
            denominator = f + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
            score += self.idf(term) * numerator / denominator
        return score

    def rank(self, query, top_k=10):
        scored = [(self.score(query, i), i) for i in range(self.n_docs)]
        scored.sort(reverse=True)
        return scored[:top_k]
```

Dois parâmetros que vale a pena conhecer.`k1=1.5`O sistema de regulação de frequência de termo, que é mais elevado, significa mais peso na repetição do termo. `b=0.75`Os padrões padrão são as recomendações de Robertson do papel original e raramente precisam de sintonização.

### Passo 2: recuperação densa com um bi-encodador

```python
from sentence_transformers import SentenceTransformer
import numpy as np


def build_dense_index(corpus, model_id="sentence-transformers/all-MiniLM-L6-v2"):
    encoder = SentenceTransformer(model_id)
    embeddings = encoder.encode(corpus, normalize_embeddings=True)
    return encoder, embeddings


def dense_search(encoder, embeddings, query, top_k=10):
    q_emb = encoder.encode([query], normalize_embeddings=True)
    sims = (embeddings @ q_emb.T).flatten()
    order = np.argsort(-sims)[:top_k]
    return [(float(sims[i]), int(i)) for i in order]
```

L2-normalizar embebimentos para que o produto ponto é igual a cosino. `all-MiniLM-L6-v2`É 384 dim, rápido e forte o suficiente para a maioria da recuperação em inglês.`paraphrase-multilingual-MiniLM-L12-v2`Para a máxima precisão,`bge-large-en-v1.5`ou `e5-large-v2`- Não .

### Passo 3: Fusão de Câncreas Reciprocas

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

O `k=60`A constante vem do papel original RRF.`k`A redução da contribuição das diferenças de grau;`k`60 é o padrão publicado e raramente precisa de sintonização.

### Passo 4: Busca híbrida + re-ranqueamento

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def hybrid_search(query, bm25, encoder, dense_embeddings, corpus, top_k=5, pool_size=30, reranker=reranker):
    sparse_ranking = bm25.rank(query, top_k=pool_size)
    dense_ranking = dense_search(encoder, dense_embeddings, query, top_k=pool_size)
    fused = reciprocal_rank_fusion([sparse_ranking, dense_ranking])[:pool_size]

    pairs = [(query, corpus[doc_idx]) for _, doc_idx in fused]
    scores = reranker.predict(pairs)
    reranked = sorted(zip(scores, [doc_idx for _, doc_idx in fused]), reverse=True)
    return reranked[:top_k]
```

BM25 encontra correspondências léxicas. Denso encontra correspondências semânticas. RRF combina as duas classificações sem precisar de calibração de pontuação. Cross-encoder recorre ao top-30 usando pares de documentos de consulta juntos, o que capta a relevância de grãos finos que o bi-encoder perdeu. Mantenha o top-5.

### Passo 5: Avaliação

| Metric | Meaning |
|--------|---------|
| Recall@k | Of queries where the correct document exists, how often is it in the top-k? |
| MRR (Mean Reciprocal Rank) | Average of 1/rank of first relevant document. |
| nDCG@k | Accounts for relevance gradations, not just binary relevant/not. |

Para o RAG especificamente, **Recall@k**O seu leitor não pode responder se a passagem correta não estiver no conjunto recuperado.

Dica de defeito: para consultas falhadas, diferencie as classificações escassas e densas. Se um encontra o documento certo e o outro não, você tem um desajuste de vocabulário (fixado: adicionar a metade faltante) ou uma ambigüidade semântica (fixado: melhores inserções ou um re-ranqueador).

## Usá-lo

A pilha de 2026:

| Scale | Stack |
|-------|-------|
| 1k-100k docs | In-memory BM25 + `all-MiniLM-L6-v2` embeddings + RRF. No separate DB. |
| 100k-10M docs | FAISS or pgvector for dense + Elasticsearch / OpenSearch for BM25. Run in parallel. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus with hybrid support. Cross-encoder rerank on top-30. |
| Best-quality frontier | Three-way (BM25 + dense + SPLADE) + ColBERT late-interaction reranking |

Qualquer que seja o seu orçamento para avaliação. Recall de recuperação de benchmark antes de comparar a precisão de RAG de ponta a ponta. Um leitor não pode corrigir o que o retriever perdeu.

### As lições duramente obtidas da produção RAG de 2026

- **80% of RAG failures trace to ingestion and chunking, not the model.**As equipes passam semanas trocando LLM e sintonizando as instruções enquanto a recuperação retorna silenciosamente o contexto errado a cada terceira consulta.
- **Chunking strategy matters more than chunk size.**As divisões de tamanho fixo quebram tabelas, código e cabeçalhos aninhados. Sentence-aware é o padrão; o chunking semântico ou baseado em LLM compensa os documentos técnicos e manuais de produtos.
- **Parent-doc pattern.**Retire pequenos pedaços de "criança" para precisão. Quando vários filhos da mesma seção dos pais aparecem, troque no bloco dos pais para preservar o contexto. Isso aumenta consistentemente a qualidade da resposta sem reformulação.
- **k_rerank=3 is usually optimal.**Cada pedaço extra passado que adiciona custo de token e latência de geração sem aumentar a qualidade da resposta.
- **HyDE / query expansion.**Gerenciar uma resposta hipotética da consulta, incorporar, recuperar. Prepara a lacuna de frase entre perguntas curtas e documentos longos.
- **Context budget under 8K tokens.**Os ataques consistentes nesse limite significam que o limiar de re-ranqueamento é muito solto.
- **Version everything.**Instruções, regras de fragmentação, modelo de inserção, re-ranqueador. Qualquer deriva quebra silenciosamente a qualidade da resposta. Portas de CI sobre fidelidade, precisão de contexto e taxa de perguntas sem resposta bloqueiam regressões antes que os usuários as vejam.
- **Three-way retrieval (BM25 + dense + learned-sparse like SPLADE) outperforms two-way**Em 2026 as referências são utilizadas, especialmente para consultas que misturam substantivos adequados com semântica.

O design adequado de recuperação reduz as alucinações em 70-90% de acordo com medições da indústria de 2026.

## Envia-o

Salva como`outputs/skill-retrieval-picker.md`- Não .

```markdown
---
name: retrieval-picker
description: Pick a retrieval stack for a given corpus and query pattern.
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

Given requirements (corpus size, query pattern, latency budget, quality bar, infra constraints), output:

1. Stack. BM25 only, dense only, hybrid (BM25 + dense + RRF), hybrid + cross-encoder rerank, or three-way (BM25 + dense + learned-sparse).
2. Dense encoder. Name the specific model. Match to language(s), domain, and context length.
3. Reranker. Name the specific cross-encoder model if used. Flag that rerank adds 30-100ms latency on top-30.
4. Evaluation plan. Recall@10 is the primary retriever metric. MRR for multi-answer. Baseline first, incremental improvements measured against it.

Refuse to recommend dense-only for corpora with named entities, error codes, or product SKUs unless the user has evidence dense handles exact matches. Refuse to skip reranking for high-stakes retrieval (legal, medical) where the final top-5 decides the user's answer.
```

## Exercícios

1. **Easy.**Implementação `hybrid_search`Comparar recall em 5 entre BM25-somente, denso-somente e híbrido.
2. **Medium.**Adicione o cálculo do MRR. Para cada consulta de teste com um documento correto conhecido, encontre a classificação do documento correto em BM25, classificados denso e híbrido.
3. **Hard.**Fecha uma sintonia de um codificador denso no seu domínio usando MultipleNegativesRankingLoss (Sentence Transformers). Construa um conjunto de treinamento a partir de 500 pares de documentos de consulta. Comparar a recall de pré e pós-fine-tune.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | Keyword search | Okapi BM25. Scores documents by term frequency, IDF, and length. |
| Dense retrieval | Vector search | Encode query + doc into vectors, find nearest neighbors. |
| Bi-encoder | Embedding model | Encodes query and doc independently. Fast at query time. |
| Cross-encoder | Reranker model | Encodes query + doc together. Slow but accurate. |
| RRF | Rank fusion | Combine two rankings by summing `1/(k + rank)`. |
| Recall@k | Retrieval metric | Fraction of queries where a relevant doc is in the top-k. |

## Mais leitura

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) o tratamento definitivo do BM25.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906)DPR, o bi-encodador canônico.
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720)O retriever de espaços aprendidos que fecha a lacuna com denso.
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)Papel RRF.
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) Retorno de interação tardia.
