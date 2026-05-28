# Modelos de Embedding — A Análise Profunda de 2026

> Word2Vec deu um vetor por palavra. Modelos de embedding modernos dão um vetor por trecho, cross-lingual, com visões sparse, denso e multi-vector, dimensionados pro seu índice. Escolha errado e seu RAG recupera a coisa errada.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 03 (Word2Vec), Fase 5 · 14 (Recuperação de Informação)
**Tempo:** ~60 minutos

## O Problema

Seu sistema RAG recupera o trecho errado 40% do tempo. O culpado raramente é o banco de dados vetorial ou o prompt. É o modelo de embedding.

Escolher um embedding em 2026 significa escolher entre cinco eixos:

1. **Denso vs sparse vs multi-vector.** Um vetor por trecho, ou um por token, ou uma bolsa de palavras ponderada e esparsa.
2. **Cobertura de idiomas.** Modelos monolíngues em inglês ainda vencem em tarefas só de inglês. Modelos multilíngues vencem quando corpora são mistos.
3. **Comprimento de contexto.** 512 tokens vs 8.192 vs 32.768 — e a capacidade efetiva real é frequentemente 60-70% do máximo anunciado.
4. **Orçamento dimensional.** 3.072 floats em precisão total = 12 KB por vetor. Com 100M vetores, o armazenamento custa $1.300/mês. Truncamento Matryoshka corta 4×.
5. **Aberto vs hospedado.** Peso aberto significa que você controla a stack e os dados. Hospedado significa que troca controle pelo sempre-último-versão.

Essa lição lista os tradeoffs pra você escolher com base em evidências, não no que era popular no trimestre passado.

## O Conceito

![Embeddings denso, sparse e multi-vector](../assets/embedding-modes.svg)

**Embeddings densos.** Um vetor por trecho (geralmente 384-3.072 dimensões). Similaridade cosseno ranqueia trechos por proximidade semântica. `text-embedding-3-large` da OpenAI, modo denso do BGE-M3, Voyage-3. Escolha padrão.

**Embeddings sparse.** Estilo SPLADE. Um transformer prevê um peso pra cada token do vocabulário, depois zera a maioria. Resultado é um vetor esparsa de tamanho |vocab|. Captura correspondência lexical (como BM25) mas com pesos de termo aprendidos. Forte em consultas com muitas palavras-chave.

**Multi-vector (interação tardia).** ColBERTv2, Jina-ColBERT. Um vetor por token. Pontuação com MaxSim: pra cada token da consulta, encontre o token do documento mais similar, some as pontuações. Mais caro pra armazenar e pontuar, mas vence em consultas longas e corpora de domínio eespecificaçãoífico.

**BGE-M3: os três de uma vez.** Modelo único produz representações densa, sparse e multi-vector simultaneamente. Cada uma pode ser consultada independentemente; pontuações se fundem via soma ponderada. O padrão de 2026 quando você quer flexibilidade de um checkpoint.

**Matryoshka Representation Learning.** Treinado pra que as primeiras N dimensões do vetor formem um embedding standalone útil. Truncar um vetor de 1.536 dim pra 256 dim e pagar ~1% de acurácia por 6× de economia de armazenamento. Suportado por OpenAI text-3, Cohere v4, Voyage-4, Jina v5, Gemini Embedding 2, Nomic v1.5+.

### O ranking MTEB conta uma história parcial

Massive Text Embedding Benchmark — 56 tarefas em 8 tipos de tarefa no lançamento (2022), expandido pra 100+ tarefas no MTEB v2. No início de 2026, Gemini Embedding 2 lidera retrieval (67.71 MTEB-R). Cohere embed-v4 lidera geral (65.2 MTEB). BGE-M3 lidera multilíngue de peso aberto (63.0). O ranking é necessário mas não suficiente — sempre faça benchmark no seu domínio.

### O padrão de três camadas

| Caso de uso | Padrão |
|----------|---------|
| Primeira passagem rápida | Bi-encoder denso (BGE-M3, text-3-small) |
| Boost de recall | Sparse (SPLADE, BGE-M3 sparse) + fusão RRF |
| Precisão no top-50 | Multi-vector (ColBERTv2) ou reranker cross-encoder |

A maioria das stacks de produção usa os três.

## Construindo

### Passo 1: baseline — embeddings densos com Sentence-BERT

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")
corpus = [
    "The first iPhone launched in 2007.",
    "Apple released the iPod in 2001.",
    "Android is an operating system from Google.",
]
emb = encoder.encode(corpus, normalize_embeddings=True)

consulta = "When was the iPhone released?"
q_emb = encoder.encode([consulta], normalize_embeddings=True)[0]
scores = emb @ q_emb
print(sorted(enumerate(scores), key=lambda x: -x[1]))
```

`normalize_embeddings=True` faz o produto escalar ser igual à similaridade cosseno. Sempre defina.

### Passo 2: truncamento Matryoshka

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

Re-normalize após truncamento. Nomic v1.5, OpenAI text-3 e Voyage-4 são treinados pra que isso seja sem perdas nos primeiros níveis. Modelos não-Matryoshka (Sentence-BERT original) degradam drasticamente quando truncados.

### Passo 3: multifuncionalidade do BGE-M3

```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

output = model.encode(
    corpus,
    return_dense=True,
    return_sparse=True,
    return_colbert_vecs=True,
)
# output["dense_vecs"]:    (n_docs, 1024)
# output["lexical_weights"]: list of dict {token_id: weight}
# output["colbert_vecs"]:  list of (n_tokens, 1024) arrays
```

Três índices, uma chamada de inferência. Fusão de pontuação:

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

Ajuste os pesos no seu domínio.

### Passo 4: avaliação MTEB em tarefa customizada

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

Rode seus modelos candidatos num subconjunto *representativo*. Não confie só no ranking do ranking — seu domínio importa.

### Passo 5: similaridade cosseno do zero

Veja `code/main.py`. Embeddings de Averaged Hashing Trick (stdlib apenas). Não competitivo com embeddings de transformer, mas mostra a forma: tokenize → vetor → normalize → produto escalar.

## Armadilhas

- **Mesmo modelo pra consulta e doc.** Alguns modelos (Voyage, Jina-ColBERT) usam codificação assimétrica — consulta e documento passam por caminhos diferentes. Sempre verifique o card do modelo.
- **Prefixo faltando.** Modelos `bge-*` precisam de `"Represent this sentence for searching relevant passages: "` anteposto às consultas. Lacuna de recall de 3-5 pontos se você esquecer.
- **Matryoshka excessivo.** 1.536 → 256 geralmente é seguro. 1.536 → 64 não é. Valide no seu conjunto de avaliação.
- **Truncamento de contexto.** A maioria dos modelos silenciosamente truncam inputs que excedem o comprimento máximo. Documentos longos precisam de chunking (ver lição 23).
- **Ignorar cauda de latência.** Pontuações MTEB escondem latência p99. Um modelo de 600M pode superar um de 335M por 2 pontos mas custar 3× mais por consulta.

## Usar

A stack de 2026:

| Situação | Escolha |
|-----------|------|
| Só inglês, rápido, API | `text-embedding-3-large` ou `voyage-3-large` |
| Peso aberto, inglês | `BAAI/bge-large-en-v1.5` |
| Peso aberto, multilíngue | `BAAI/bge-m3` ou `Qwen3-Embedding-8B` |
| Contexto longo (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| Deploy só CPU | Nomic Embed v2 (137M params, MoE) |
| Armazenamento restrito | Matryoshka truncado + quantização int8 |
| Consultas com muitas palavras-chave | Adicione SPLADE sparse, fusão RRF com denso |

Padrão de 2026: comece com BGE-M3 ou text-3-large, avalie no seu domínio com MTEB, troque se um modelo de domínio eespecificaçãoífico superar por mais de 3 pontos.

## Entregar

Salve como `outputs/skill-embedding-picker.md`:

```markdown
---
name: embedding-picker
description: Pick embedding model, dimension, and retrieval mode for a given corpus and deployment.
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

Given a corpus (size, languages, domain, avg length), deployment target (cloud / edge / on-prem), latency budget, and storage budget, output:

1. Model. Named checkpoint or API. One-sentence reason.
2. Dimension. Full / Matryoshka-truncated / int8-quantized. Reason tied to storage budget.
3. Mode. Dense / sparse / multi-vector / hybrid. Reason.
4. Query prefix / template if required by the model card.
5. Evaluation plan. MTEB tasks relevant to domain + held-out domain eval with nDCG@10.

Refuse recommendations that truncate Matryoshka to <64 dims without domain validation. Refuse ColBERTv2 for corpora under 10k passages (overhead not justified). Flag long-document corpora (>8k tokens) routed to models with 512-token windows.
```

## Exercícios

1. **Fácil.** Codifique 100 frases com `bge-small-en-v1.5` na dimensão total (384), depois com Matryoshka 128. Meça a queda de MRR em 10 consultas.
2. **Médio.** Compare BGE-M3 denso, sparse e colbert em 500 trechos do seu domínio. Qual vence em recall@10? Fusão RRF supera o melhor modo individual?
3. **Difícil.** Rode MTEB em três modelos candidatos em suas top-2 tarefas de domínio. Reporte pontuação MTEB, latência p99 num batch de 100 consultas e $/1M consultas. Escolha o Pareto-ótimo.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|-----------------|-----------------------|
| Embedding denso | O vetor | Um vetor de tamanho fixo por texto. Similaridade cosseno pra ranqueamento. |
| Embedding sparse | BM25 aprendido | Um peso por token do vocabulário; majoritariamente zeros; treinado de ponta a ponta. |
| Multi-vector | Estilo ColBERT | Um vetor por token; pontuação MaxSim; índice maior, melhor recall. |
| Matryoshka | Truque da boneca russa | As primeiras N dimensões são um embedding menor válido por si só. |
| MTEB | O benchmark | Massive Text Embedding Benchmark — 56 tarefas no lançamento, 100+ no v2. |
| BEIR | O benchmark de retrieval | 18 tarefas de retrieval zero-shot; frequentemente citado pra robustez cross-domain. |
| Codificação assimétrica | Caminho de consulta ≠ doc | Modelo usa projeções diferentes pra consultas e documentos. |

## Leitura Complementar

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) — o paper do bi-encoder.
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) — o paper do leaderboard.
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) — o modelo unificado de três modos.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) — o objetivo de treino de escada dimensional.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) — interação tardia em produção.
- [MTEB ranking on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) — rankings ao vivo.
