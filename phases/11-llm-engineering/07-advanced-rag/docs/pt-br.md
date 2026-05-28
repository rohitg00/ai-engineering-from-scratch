# Advanced RAG (Chunking, Reranking, Hybrid Search)

> RAG básico recupera os top-k chunks mais similares. Funciona para perguntas simples. Desmorona em raciocínio multi-hop, queries ambíguas e corpora grandes. Advanced RAG é a diferença entre um demo que funciona em 10 documentos e um sistema que funciona em 10 milhões.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 11, Aula 06 (RAG)
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Implementar estratégias avançadas de chunking (semântico, recursivo, pai-filho) que preservam estrutura e contexto dos documentos
- Construir pipeline de busca híbrida combinando BM25 com busca vetorial semântica e reranker cross-encoder
- Aplicar técnicas de transformação de consulta (HyDE, multi-consulta, step-back) para melhorar retrieval em perguntas ambíguas ou complexas
- Diagnosticar e corrigir falhas comuns de RAG: chunk errado recuperado, resposta não está no contexto, falha de raciocínio multi-hop

## O Problema

Você construiu um RAG básico na Aula 06. Funciona para perguntas diretas. Mas quando o cliente pergunta "Qual a diferença entre os planos Pro e Enterprise em termos de suporte?", o RAG recupera o documento dos planos Pro e o documento dos planos Enterprise separadamente — mas não consegue conectar os dois para comparar.

Ou quando alguém pergunta "Como configurar SSO?" e o sistema recupera um chunk que diz "SSO está disponível nos planos Enterprise" — correto, mas inútil sem o passo a passo de configuração que está em outro documento.

## O Conceito

### Busca Híbrida: BM25 + Semântica

BM25 é busca por palavras-chave. Semântica é busca por significado. Combinação é melhor que qualquer uma sozinha.

```python
def bm25_score(consulta_words, doc_words, avg_dl, k1=1.5, b=0.75):
    """Score BM25 simplificado."""
    score = 0
    dl = len(doc_words)
    for q in consulta_words:
        tf = doc_words.count(q)
        idf = math.log((1000 + 1) / (1 + 1))  # simplificado
        score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avg_dl))
    return score

def hybrid_search(consulta, documents, top_k=5, alpha=0.5):
    """Combina BM25 e busca vetorial com rank fusion."""
    consulta_words = consulta.lower().split()
    
    bm25_scores = []
    for i, doc in enumerate(documents):
        doc_words = doc.lower().split()
        score = bm25_score(consulta_words, doc_words, 100)
        bm25_scores.append((i, score))
    
    # Normalizar scores para [0, 1]
    max_bm25 = max(s for _, s in bm25_scores) if bm25_scores else 1
    bm25_normalized = [(i, s / max_bm25) for i, s in bm25_scores]
    
    # Rank fusion
    final_scores = {}
    for i, bm25_score in bm25_normalized:
        # Assumindo scores vetoriais já calculados
        vec_score = vector_scores.get(i, 0)  # placeholder
        final_scores[i] = alpha * bm25_score + (1 - alpha) * vec_score
    
    ranked = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)
    return ranked[:top_k]
```

### Reranking com Cross-Encoder

Após recuperar candidatos com busca rápida (bi-encoder), use um cross-encoder mais lento mas mais preciso para reordenar:

```python
def rerank(consulta, documents, top_k=5):
    """Reordena documentos usando scoring par consulta-documento."""
    scored = []
    for doc in documents:
        # Cross-encoder: processa consulta e doc juntos
        score = cross_encoder_score(consulta, doc)  # placeholder
        scored.append((doc, score))
    
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]
```

### Transformação de Query

**HyDE** (Hypothetical Document Embeddings): Gere uma resposta hipotética e busque documentos similares a ela:

```python
def hyde_search(consulta, generate_fn, embed_fn, vector_store):
    """Gera resposta hipotética e busca por ela."""
    hypothetical_answer = generate_fn(
        f"Gere uma resposta detalhada para: {consulta}"
    )
    hyde_embedding = embed_fn(hypothetical_answer)
    return vector_store.search(hyde_embedding, top_k=5)
```

**Multi-Query**: Gere múltiplas variações da consulta e combine resultados:

```python
def multi_consulta_search(consulta, generate_fn, vector_store, n_queries=3):
    """Gera N variações da consulta e faz busca com cada uma."""
    variations = generate_fn(
        f"Gere {n_queries} variações da pergunta: {consulta}"
    )
    
    all_results = {}
    for var in variations:
        results = vector_store.search(var, top_k=5)
        for doc_id, score in results:
            all_results[doc_id] = max(all_results.get(doc_id, 0), score)
    
    return sorted(all_results.items(), key=lambda x: x[1], reverse=True)[:5]
```

## Use

### Hybrid Search com BM25 e ChromaDB

```python
# import chromadb
# from rank_bm25 import BM25Okapi
#
# # BM25 para busca por palavras-chave
# tokenized_docs = [doc.lower().split() for doc in documents]
# bm25 = BM25Okapi(tokenized_docs)
#
# # ChromaDB para busca semântica
# collection = chromadb.Collection("docs")
#
# def hybrid_search(consulta, top_k=5, alpha=0.5):
#     # BM25 scores
#     bm25_scores = bm25.get_scores(consulta.lower().split())
#     
#     # Semantic scores
#     semantic_results = collection.consulta(consulta_texts=[consulta], n_results=top_k)
#     
#     # Fusion
#     # ... combinar e reordenar
```

## Entregue

Esta aula produz uma pipeline de RAG avançada com busca híbrida, reranking e transformação de consulta.

## Exercícios

1. Implemente chunking recursivo e compare com chunking de tamanho fixo em 10 perguntas.

2. Adicione metadata filtering (por data, fonte, categoria) antes da busca vetorial.

3. Implemente um pipeline HyDE completo. Compare com busca direta em 5 queries.

4. Implemente chunking pai-filho: indexe chunks filhos pequeños, retorne chunks pais grandes.

5. Crie dataset de avaliação: 10 perguntas com chunks de resposta conhecidos. Meça Recall@3, @5 e @10 para busca vetorial, BM25, híbrida e híbrida + reranking.

## Termos-Chave

| Termo | O que o pessoal diz | O que wirklich significa |
|-------|--------------------|-----------------------|
| BM25 | "Busca por palavras-chave" | Algoritmo de ranking probabilístico que pontua documentos por frequência do termo |
| Hybrid search | "O melhor dos dois mundos" | Rodar busca semântica e por palavras-chave em paralelo e mesclar com rank fusion |
| Reciprocal Rank Fusion | "Mesclar listas ranqueadas" | Combinar múltiplas listas ranqueadas somando 1/(k + rank) para cada documento |
| Reranking | "Segunda passada de scoring" | Usar modelo cross-encoder mais caro para re-pontuar candidatos |
| Cross-encoder | "Modelo consulta-documento conjunta" | Modelo que recebe consulta e documento como entrada única |
| Bi-encoder | "Modelo de embedding independente" | Modelo que embedde consulta e documento independentemente |
| HyDE | "Buscar com resposta falsa" | Gerar resposta hipotética, embeddê-la e buscar docs similares |
| Faithfulness | "Manteve fundamentação?" | Se a resposta gerada é suportada pelos documentos recuperados |

## Leitura Adicional

- [Robertson & Zaragoza, "BM25 and Beyond" (2009)](https://arxiv.org/abs/0911.0898) — referência definitiva para BM25
- [Gao et al., "Precise Zero-Shot Dense Retrieval" (2022)](https://arxiv.org/abs/2112.01488) — paper HyDE
- [Nogueira & Cho, "Passage Re-ranking with BERT" (2019)](https://arxiv.org/abs/1904.08375) — reranking com cross-encoder
- [Edge et al., "From Local to Global: A Graph RAG Approach" (2024)](https://arxiv.org/abs/2404.16130) — paper GraphRAG
- [Asai et al., "Self-RAG" (ICLR 2024)](https://arxiv.org/abs/2310.11511) — RAG auto-avaliativo
