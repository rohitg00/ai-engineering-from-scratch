# Recuperação de Informação e Busca

> BM25 é preciso mas frágil. Denso joga a rede larga mas perde keywords. Híbrido é o padrão de 2026. Todo o resto é ajuste.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 02 (BoW + TF-IDF), Fase 5 · 04 (GloVe, FastText, Subword)
**Tempo:** ~75 minutos

## O Problema

O usuário digita "what happens if someone lies to get money" e espera encontrar o estatuto que realmente cobre isso: "Section 420 IPC." Busca por keyword perde completamente (vocabulário não compartilhado). Busca semântica perde se os embeddings não foram treinados em texto jurídico. Busca real tem que lidar com ambos.

IR é a pipeline sob todo sistema RAG, toda barra de busca, toda busca fuzzy de site de documentação. A arquitetura de 2026 que funciona em produção não é um único método. É uma cadeia de métodos complementares, cada um capturando as falhas do anterior.

Essa lição constrói cada pedaço e nomeia quais falhas cada um captura.

## O Conceito

![Recuperação híbrida: BM25 + denso + RRF + rerank cross-encoder](../assets/retrieval.svg)

Quatro camadas. Escolha as que você precisa.

1. **Recuperação esparsa (BM25).** Rápido, preciso em correspondências exatas, péssimo em semântica. Roda sobre índice invertido. Sub-10ms por consulta em milhões de documentos. Pega referências de estatutos, códigos de produto, mensagens de erro, entidades nomeadas certinho.
2. **Recuperação densa.** Codifica consulta e documentos em vetores. Busca de vizinho mais próximo. Captura paráfrases e similaridade semântica. Perde correspondências de keywords exatas que diferem por um caractere. 50-200ms por consulta com FAISS ou banco vetorial.
3. **Fusão.** Mescla as listas ranqueadas de esparso e denso. Reciprocal Rank Fusion (RRF) é o padrão fácil porque ignora scores brutos (que vivem em escalas diferentes) e usa só posições de rank. Fusão ponderada é uma opção quando você sabe que um sinal domina pro seu domínio.
4. **Rerank cross-encoder.** Pega os top-30 da fusão. Roda um cross-encoder (query + documento juntos, pontuando cada par). Mantém os top-5. Cross-encoders são mais lentos por par que bi-encoders mas muito mais precisos. Você amortiza rodando só nos top-30.

Recuperação tripla (BM25 + denso + esparso-aprendido como SPLADE) supera a dupla em benchmarks de 2026 mas precisa de infraestrutura pra índices esparso-aprendidos. Pra maioria dos times, dupla mais rerank cross-encoder é o ponto ideal.

## Construindo

### Passo 1: BM25 do zero

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

Dois parâmetros que vale conhecer. `k1=1.5` controla saturação de frequência de termo; maior significa mais peso na repetição de termo. `b=0.75` controla normalização de comprimento; 0 ignora comprimento do documento, 1 normaliza totalmente. Os padrões são as recomendações de Robertson do paper original e raramente precisam de ajuste.

### Passo 2: recuperação densa com bi-encoder

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

Normaliza embeddings com L2 pra que produto escalar seja igual ao cosseno. `all-MiniLM-L6-v2` tem 384 dimensões, é rápido e forte o suficiente pra maioria da recuperação em inglês. Pra trabalho multilíngue, use `paraphrase-multilingual-MiniLM-L12-v2`. Pra precisão máxima, `bge-large-en-v1.5` ou `e5-large-v2`.

### Passo 3: Reciprocal Rank Fusion

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

A constante `k=60` vem do paper original de RRF. `k` maior achata a contribuição de diferenças de rank; `k` menor faz ranks top dominarem. 60 é o padrão publicado e raramente precisa de ajuste.

### Passo 4: busca híbrida + rerank

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

Três estágios compostos. BM25 encontra correspondências lexicais. Denso encontra correspondências semânticas. RRF mescla os dois rankings sem precisar de calibração de score. Cross-encoder repontua os top-30 usando pares query-documento juntos, o que captura relevância granular que o bi-encoder perdeu. Mantém top-5.

### Passo 5: avaliação

| Métrica | Significado |
|--------|---------|
| Recall@k | Das consultas onde o documento correto existe, quantas vezes ele está no top-k? |
| MRR (Mean Reciprocal Rank) | Média de 1/rank do primeiro documento relevante. |
| nDCG@k | Conta graduações de relevância, não só binário relevante/não. |

Pra RAG especificamente, **Recall@k** do recuperador é o número mais importante. Seu leitor não consegue responder se o trecho certo não está no conjunto recuperado.

Dica de debug: pra consultas que falham, compare os rankings esparso e denso. Se um encontra o documento certo e o outro não, você tem um mismatch de vocabulário (correção: adicione a metade faltante) ou ambiguidade semântica (correção: embeddings melhores ou reranker).

## Usando

Stack de 2026:

| Escala | Stack |
|-------|-------|
| 1k-100k docs | BM25 em memória + embeddings `all-MiniLM-L6-v2` + RRF. Sem DB separado. |
| 100k-10M docs | FAISS ou pgvector pro denso + Elasticsearch / OpenSearch pro BM25. Roda em paralelo. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus com suporte híbrido. Rerank cross-encoder nos top-30. |
| Fronteira de melhor qualidade | Tripla (BM25 + denso + SPLADE) + reranking interação tardia ColBERT |

O que você escolher, orçamenta avaliação. Benchmark recall de recuperação antes de benchmark acurácia end-to-end de RAG. Um leitor não conserta o que o recuperador perdeu.

### As lições duramente conquistas da RAG de produção em 2026

- **80% das falhas de RAG rastreiam até ingestão e chunking, não o modelo.** Times gastam semanas trocando LLMs e ajustando prompts enquanto a recuperação silenciosamente retorna o contexto errado a cada terceira consulta. Conserte chunking primeiro.
- **Estratégia de chunking importa mais que tamanho do chunk.** Divisões de tamanho fixo quebram tabelas, código e cabeçalhos aninhados. Consciente de frases é o padrão; chunking semântico ou baseado em LLM compensa pra docs técnicos e manuais de produto.
- **Padrão de documento-pai.** Recupera chunks pequenos "filhos" pra precisão. Quando múltiplos filhos da mesma seção-pai aparecem, troca pro bloco-pai pra preservar contexto. Isso consistentemente melhora qualidade da resposta sem retreinar.
- **k_rerank=3 geralmente é ótimo.** Cada chunk extra além disso adiciona custo de token e latência de geração sem melhorar qualidade da resposta. Se k=8 ainda é melhor que k=3 pra você, o reranker está subperformando.
- **HyDE / expansão de consulta.** Gera uma resposta hipotética a partir da query, embedda, recupera. Prega a lacuna de formulação entre perguntas curtas e documentos longos. Ganho de precisão grátis sem treino.
- **Orçamento de contexto abaixo de 8K tokens.** Acertos consistentes nesse limite significam que o limiar do reranker está solto demais.
- **Versione tudo.** Prompts, regras de chunking, modelo de embedding, reranker. Qualquer deriva quebra silenciosamente qualidade da resposta. Gates de CI em fidelidade, precisão de contexto e taxa de perguntas sem resposta bloqueiam regressões antes de os usuários verem.
- **Recuperação tripla (BM25 + denso + esparso-aprendido como SPLADE) supera a dupla** em benchmarks de 2026, especialmente pra consultas que misturam substantivos próprios com semântica. Envie quando infraestrutura suportar índices SPLADE.

Recuperação adequada reduz alucinações em 70-90% segundo medições industriais de 2026. A maioria dos ganhos de performance de RAG vem de recuperação melhor, não fine-tuning de modelo.

## Entregando

Salve como `outputs/skill-retrieval-picker.md`:

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

1. **Fácil.** Implemente `hybrid_search` acima num corpus de 500 documentos. Teste 20 consultas. Compare recall em 5 entre BM25-sozinho, denso-sozinho e híbrido.
2. **Médio.** Adicione cálculo de MRR. Pra cada consulta de teste com documento correto conhecido, encontre o rank do doc correto nos rankings BM25, denso e híbrido. Reporte o MRR de cada.
3. **Difícil.** Fine-tune um encoder denso no seu domínio usando MultipleNegativesRankingLoss (Sentence Transformers). Construa um conjunto de treino de 500 pares query-documento. Compare recall pré e pós-fine-tuning.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| BM25 | Busca por keyword | Okapi BM25. Pontua documentos por frequência de termo, IDF e comprimento. |
| Recuperação densa | Busca vetorial | Codifica query + doc em vetores, encontra vizinhos mais próximos. |
| Bi-encoder | Modelo de embedding | Codifica query e doc independentemente. Rápido em tempo de consulta. |
| Cross-encoder | Modelo de reranker | Codifica query + doc juntos. Lento mas preciso. |
| RRF | Fusão de rank | Combina dois rankings somando `1/(k + rank)`. |
| Recall@k | Métrica de recuperação | Fração de consultas onde um doc relevante está no top-k. |

## Leitura Complementar

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) — o tratamento definitivo de BM25.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) — DPR, o bi-encoder canônico.
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) — o recuperador esparso-aprendido que fecha a lacuna com o denso.
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) — paper de RRF.
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) — recuperação de interação tardia.
