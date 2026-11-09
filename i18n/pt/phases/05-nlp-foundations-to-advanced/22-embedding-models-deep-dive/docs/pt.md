# Modelos de inserção  O mergulho profundo de 2026

> Word2Vec deu-lhe um vetor por palavra. Modelos modernos de incorporação dão-lhe um vetor por passagem, translingual, com vistas raras, densas e multi-vetor, dimensionadas para se adequarem ao seu índice. Escolha errado e o seu RAG recupera a coisa errada.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## O problema

O sistema RAG recupera a passagem errada 40% do tempo. O culpado é raramente o banco de dados vetorial ou o prompt. É o modelo de incorporação.

A escolha de um incorporador em 2026 significa escolher através de cinco eixos:

1. **Dense vs sparse vs multi-vector.**Um vetor por passagem, ou um por token, ou um saco de palavras.
2. **Language coverage.**Os modelos monolingues ingleses ainda ganham em tarefas exclusivas de inglês.
3. **Context length.**512 tokens vs 8.192 vs 32.768  e a capacidade efetiva real é muitas vezes 60-70% do máximo anunciado.
4. **Dimension budget.**A temperatura de um vector é de 3072 Kb, mas a temperatura de um vector é de 100 M e a temperatura de um vector é de 1.300 Kb.
5. **Open vs hosted.**O peso aberto significa que você controla a pilha e os dados.

Esta lição chama as trocas para que possam pegar em evidências, não em qualquer coisa que foi popular no último trimestre.

## O conceito

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.**Um vetor por passagem (geralmente 384-3,072 dimensões).`text-embedding-3-large`, modo BGE-M3 denso, Voyage-3.

**Sparse embeddings.**Um transformador prevê um peso para cada token de vocabulário, então zeros fora a maioria deles. O resultado é um vetor de tamanho escasso, o que significa que o vocabulário não é muito grande.

**Multi-vector (late interaction).**ColBERTv2, Jina-ColBERT. Um vetor por token. Scoring com MaxSim: para cada token de consulta, encontrar o token de documento mais similar, somar as pontuações. Mais caro para armazenar e marcar, mas ganha em consultas longas e corpora específicas de domínio.

**BGE-M3: all three at once.**O modelo único produz representações densas, esparsas e multi-vectórias simultaneamente. Cada uma pode ser consultada de forma independente; as pontuações se fundem através de soma ponderada. O padrão 2026 quando você quer flexibilidade de um ponto de verificação.

**Matryoshka Representation Learning.**Formada para formar uma incorporação independente útil. Truncate um vector de 1.536 dim para 256 dim e pagar ~1% de precisão para economia de armazenamento 6x. Apoiado por OpenAI text-3, Cohere v4, Voyage-4, Jina v5, Gemini Embedding 2, Nomic v1.5+.

### O quadro de classificação da MTEB conta uma história parcial

Massive Text Embedding Benchmark  56 tarefas em 8 tipos de tarefas no lançamento (2022), expandido para 100+ tarefas no MTEB v2. No início de 2026, Gemini Embedding 2 supera a recuperação (67,71 MTEB-R). Cohere embed-v4 leva geral (65,2 MTEB). BGE-M3 leva multilingual de peso aberto (63,0).

### O padrão de três camadas

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

A maioria das pilhas de produção usa as três.

```figure
gx-matryoshka
```

## Construí-lo

### Passo 1: linha de base  embutidos densos com Sentence-BERT

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

query = "When was the iPhone released?"
q_emb = encoder.encode([query], normalize_embeddings=True)[0]
scores = emb @ q_emb
print(sorted(enumerate(scores), key=lambda x: -x[1]))
```

`normalize_embeddings=True`faz o produto de pontos igual a similaridade cosínica.

### Passo 2: Truncamento de matrioshka

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

Normalise novamente após o truncamento. Nomic v1.5, OpenAI text-3, e Voyage-4 são treinados para que isso seja sem perdas para os primeiros níveis.

### Passo 3: Multifunkção do BGE-M3

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

Três índices, uma chamada de inferência.

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

Ajuste os pesos no seu domínio.

### Passo 4: Avaliação MTEB em uma tarefa personalizada

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

Execute os seus modelos candidatos num subconjunto *representativo* Não confie apenas no ranking do ranking  o seu domínio importa.

### Passo 5: cosino laminado a mão a partir do zero

Veja .`code/main.py`. Embedings de Hashing Trick médios (solo stdlib). Não competitivos com embebimentos de transformadores, mas mostra a forma: tokenize → vector → normalize → product dot.

## Encurralagens

- **Same model for query and doc.**Alguns modelos (Voyage, Jina-ColBERT) usam codificação assimétrica  consulta e documento passar por diferentes caminhos.
- **Missing prefix.** `bge-*`Modelos necessários`"Represent this sentence for searching relevant passages: "`- 3-5 pontos de recall gap se esquecer.
- **Over-trimming Matryoshka.**1.536 → 256 é geralmente seguro. 1.536 → 64 não é. Valida no seu conjunto de avaliação.
- **Context truncation.**A maioria dos modelos reduz silenciosamente as entradas ao longo do seu comprimento máximo.
- **Ignoring latency tail.**Os resultados do MTEB escondem a latência p99. Um modelo de 600M pode superar um modelo de 335M em 2 pontos, mas custa 3x mais por consulta.

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

Padrão 2026: comece com BGE-M3 ou texto-3-largo, avalia no seu domínio com MTEB, troca se um modelo específico de domínio ganha por mais de 3 pontos.

## Envia-o

Salva como`outputs/skill-embedding-picker.md`- Não .

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

1. **Easy.**Encode 100 frases com `bge-small-en-v1.5`Em total dim (384), em seguida, em Matryoshka 128.
2. **Medium.**Comparar BGE-M3 denso, escasso e colbert em 500 passagens do seu domínio. Qual vence em recall@10?
3. **Hard.**Execute MTEB em três modelos candidatos em suas tarefas de domínio superior 2. Relata pontuação MTEB, p99 latência em um lote de 100 consultas, e $ 1 milhão consultas. Escolha o Pareto-óptima.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## Mais leitura

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) o papel bi-encodor.
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) o papel do quadro de resultados.
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) o modelo unificado de três modos.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) o objectivo de formação em escala de dimensões.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) Interação tardia na produção.
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) classificações ao vivo.
