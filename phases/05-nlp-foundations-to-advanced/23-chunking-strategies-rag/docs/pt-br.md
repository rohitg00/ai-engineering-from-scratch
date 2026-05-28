# Estratégias de Chunking pra RAG

> Configuração de chunking influencia a qualidade de retrieval tanto quanto a escolha do modelo de embedding (Vectara NAACL 2025). Erre no chunking e nenhuma quantidade de reranking salva você.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 14 (Recuperação de Informação), Fase 5 · 22 (Modelos de Embedding)
**Tempo:** ~60 minutos

## O Problema

Você colocou um contrato de 50 páginas num sistema RAG. O usuário pergunta: "What is the termination clause?" O recuperador retorna a capa. Por quê? Porque o modelo foi treinado em chunks de 512 tokens e a cláusula de rescisão fica na página 20, dividida por uma quebra de página, sem palavras-chave locais que a liguem à consulta.

A solução não é "compre um modelo de embedding melhor." A solução é chunking. Quanto grande? Overlap? Onde dividir? Com contexto ao redor?

Benchmarks de fev/2026 mostram resultados surpreendentes:

- Estudo da Vectara de 2026: chunking recursivo de 512 tokens superou chunking semântico 69% → 54% de acurácia.
- SPLADE + Mistral-8B no Natural Questions: overlap não ofereceu nenhum benefício mensurável.
- Cliff de contexto: qualidade de resposta cai drasticamente em torno de 2.500 tokens de contexto.

A resposta "óbvia" (chunking semântico, 20% overlap, 1000 tokens) frequentemente está errada. Essa lição constrói intuição pra seis estratégias e diz quando usar qual.

## O Conceito

![Seis estratégias de chunking visualizadas num trecho](../assets/chunking.svg)

**Chunking fixo.** Divide a cada N caracteres ou tokens. Baseline mais simples. Quebra no meio da frase. Boa compressão, má coerência.

**Recursivo.** `RecursiveCharacterTextSplitter` do LangChain. Tenta dividir em `\\n\\n` primeiro, depois `\\n`, depois `.`, depois espaço. Fallback limpo. O padrão de 2026.

**Semântico.** Embed cada frase. Calcule similaridade cosseno entre frases adjacentes. Divida onde a similaridade cai abaixo de um limite. Preserva coerência de tópico. Mais lento; às vezes produz fragmentos pequenos de 40 tokens que prejudicam retrieval.

**Por frase.** Divide em limites de frase. Uma frase por chunk ou uma janela de N frases. Equivale ao chunking semântico até ~5k tokens numa fração do custo.

**Documento-pai.** Armazene chunks filhos pequenos pra retrieval *e* o chunk pai maior pra contexto. Recupere pelo filho; retorne o pai. Degrada graciosamente: chunks filhos ruins ainda retornam pais razoáveis.

**Chunking tardio (2024).** Embed o documento inteiro no nível de token primeiro, depois agrupe embeddings de token em embeddings de chunk. Preserva contexto cross-chunk. Funciona com embedders de contexto longo (BGE-M3, Jina v3). Custo computacional maior.

**Retrieval contextual (Anthropic, 2024).** Antepõe a cada chunk um resumo gerado por LLM da sua posição no documento ("This chunk is section 3.2 of the termination clauses..."). 35-50% de melhoria de retrieval no benchmark da própria Anthropic. Caro pra indexar.

### A regra que supera qualquer padrão

Combine o tamanho do chunk com o tipo de consulta:

| Tipo de consulta | Tamanho do chunk |
|------------|-----------|
| Factual ("what is the CEO's name?") | 256-512 tokens |
| Analítica / multi-hop | 512-1024 tokens |
| Compreensão de seção inteira | 1024-2048 tokens |

Benchmark da NVIDIA de 2026. O chunk deve ser grande o suficiente pra conter a resposta mais contexto local, pequeno o suficiente pra que o top-K do recuperador foque na resposta em vez de ruído de contexto.

## Construindo

### Passo 1: chunking fixo e recursivo

```python
def chunk_fixed(text, size=512, overlap=0):
    step = size - overlap
    return [text[i:i + size] for i in range(0, len(text), step)]


def chunk_recursive(text, size=512, seps=("\\n\\n", "\\n", ". ", " ")):
    if len(text) <= size:
        return [text]
    for sep in seps:
        if sep not in text:
            continue
        parts = text.split(sep)
        chunks = []
        buf = ""
        for p in parts:
            if len(p) > size:
                if buf:
                    chunks.append(buf)
                    buf = ""
                chunks.extend(chunk_recursive(p, size=size, seps=seps[1:] or (" ",)))
                continue
            candidate = buf + sep + p if buf else p
            if len(candidate) <= size:
                buf = candidate
            else:
                if buf:
                    chunks.append(buf)
                buf = p
        if buf:
            chunks.append(buf)
        return [c for c in chunks if c.strip()]
    return chunk_fixed(text, size)
```

### Passo 2: chunking semântico

```python
def chunk_semantic(text, encoder, threshold=0.6, min_chars=200, max_chars=2048):
    sentences = split_sentences(text)
    if not sentences:
        return []
    embs = encoder.encode(sentences, normalize_embeddings=True)
    chunks = [[sentences[0]]]
    for i in range(1, len(sentences)):
        sim = float(embs[i] @ embs[i - 1])
        current_len = sum(len(s) for s in chunks[-1])
        if sim < threshold and current_len >= min_chars:
            chunks.append([sentences[i]])
        else:
            chunks[-1].append(sentences[i])

    result = []
    for group in chunks:
        text_group = " ".join(group)
        if len(text_group) > max_chars:
            result.extend(chunk_recursive(text_group, size=max_chars))
        else:
            result.append(text_group)
    return result
```

Ajuste `threshold` no seu domínio. Muito alto → fragmentos. Muito baixo → um chunk gigante.

### Passo 3: documento-pai

```python
def chunk_parent_child(text, parent_size=2048, child_size=256):
    parents = chunk_recursive(text, size=parent_size)
    mapping = []
    for p_idx, parent in enumerate(parents):
        children = chunk_recursive(parent, size=child_size)
        for child in children:
            mapping.append({"child": child, "parent_idx": p_idx, "parent": parent})
    return mapping


def retrieve_parent(child_consulta, mapping, encoder, top_k=3):
    child_embs = encoder.encode([m["child"] for m in mapping], normalize_embeddings=True)
    q_emb = encoder.encode([child_consulta], normalize_embeddings=True)[0]
    scores = child_embs @ q_emb
    top = np.argsort(-scores)[:top_k]
    seen, parents = set(), []
    for i in top:
        if mapping[i]["parent_idx"] not in seen:
            parents.append(mapping[i]["parent"])
            seen.add(mapping[i]["parent_idx"])
    return parents
```

Insight chave: deduplique pais. Múltiplos filhos podem mapear pro mesmo pai; retornar todos desperdiçaria contexto.

### Passo 4: retrieval contextual (padrão Anthropic)

```python
def contextualize_chunks(document, chunks, llm):
    context_prompts = [
        f"""<document>{document}</document>
Here is the chunk to situate: <chunk>{c}</chunk>
Write 50-100 words placing this chunk in the document's context."""
        for c in chunks
    ]
    contexts = llm.batch(context_prompts)
    return [f"{ctx}\n\n{c}" for ctx, c in zip(contexts, chunks)]
```

Indexe os chunks contextualizados. Na hora da consulta, o retrieval se beneficia do sinal extra ao redor.

### Passo 5: avaliar

```python
def recall_at_k(queries, corpus_chunks, encoder, k=5):
    chunk_embs = encoder.encode(corpus_chunks, normalize_embeddings=True)
    hits = 0
    for q_text, gold_idxs in queries:
        q_emb = encoder.encode([q_text], normalize_embeddings=True)[0]
        top = np.argsort(-(chunk_embs @ q_emb))[:k]
        if any(i in gold_idxs for i in top):
            hits += 1
    return hits / len(queries)
```

Sempre faça benchmark. A estratégia "melhor" pro seu corpus pode não coincidir com nenhum blog post.

## Armadilhas

- **Chunking avaliado só em consultas factuais.** Consultas multi-hop revelam vencedores muito diferentes. Use um conjunto de avaliação stratificado por tipo de consulta.
- **Chunking semântico sem tamanho mínimo.** Produz fragmentos de 40 tokens que prejudicam retrieval. Sempre imponha `min_tokens`.
- **Overlap como culto de cargo.** Estudos de 2026 encontram que overlap frequentemente não oferece benefício e dobra o custo de indexação. Meça, não assuma.
- **Sem imposição de min/max.** Chunks de 5 tokens ou 5.000 tokens ambos quebram retrieval. Limite.
- **Chunking cross-doc.** Nunca deixe um chunk abranger dois documentos. Sempre chunk por documento, depois una.

## Usar

A stack de 2026:

| Situação | Estratégia |
|-----------|----------|
| Primeira build, corpus desconhecido | Recursivo, 512 tokens, sem overlap |
| QA factual | Recursivo, 256-512 tokens |
| Analítica / multi-hop | Recursivo, 512-1024 tokens + documento-pai |
| Cross-referência pesada (contratos, papers) | Chunking tardio ou retrieval contextual |
| Corpus conversacional / diálogo | Chunks por turno + metadados de falante |
| Enunciados curtos (tweets, reviews) | Um documento = um chunk |

Comece com recursivo 512. Meça recall@5 num conjunto de avaliação de 50 consultas. Ajuste a partir daí.

## Entregar

Salve como `outputs/skill-chunker.md`:

```markdown
---
name: chunker
description: Pick a chunking strategy, size, and overlap for a given corpus and consulta distribution.
version: 1.0.0
phase: 5
lesson: 23
tags: [nlp, rag, chunking]
---

Given a corpus (document types, avg length, domain) and consulta distribution (factoid / analytical / multi-hop), output:

1. Strategy. Recursive / sentence / semantic / parent-document / late / contextual. Reason.
2. Chunk size. Token count. Reason tied to consulta type.
3. Overlap. Default 0; justify if >0.
4. Min/max enforcement. `min_tokens`, `max_tokens` guards.
5. Evaluation plan. Recall@5 on 50-consulta stratified eval set (factoid, analytical, multi-hop).

Refuse any chunking strategy without min/max chunk size enforcement. Refuse overlap above 20% without an ablation showing it helps. Flag semantic chunking recommendations without a min-token floor.
```

## Exercícios

1. **Fácil.** Chunk um documento de 20 páginas com fixo(512, 0), recursivo(512, 0) e recursivo(512, 100). Compare contagem de chunks e qualidade das bordas.
2. **Médio.** Construa um conjunto de avaliação de 30 consultas sobre 5 documentos. Meça recall@5 pra recursivo, semântico e documento-pai. Qual vence? Coincide com os blog posts?
3. **Difícil.** Implemente retrieval contextual. Meça melhoria de MRR sobre recursivo baseline. Reporte custo de indexação (chamadas de LLM) vs ganho de acurácia.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|-----------------|-----------------------|
| Chunk | Um pedaço do doc | Unidade sub-documento que é embeddada, indexada e recuperada. |
| Overlap | Margem de segurança | N tokens compartilhados entre chunks adjacentes; frequentemente inútil em benchmarks de 2026. |
| Chunking semântico | Chunking inteligente | Divide onde a similaridade de embedding entre frases adjacentes cai. |
| Documento-pai | Retrieval de dois níveis | Recupere filhos pequenos, retorne pais maiores. |
| Chunking tardio | Chunk após embedding | Embed doc inteiro no nível de token, agrupe em vetores de chunk. |
| Retrieval contextual | Truque da Anthropic | Resumo gerado por LLM anteposto a cada chunk antes de indexar. |
| Cliff de contexto | Muro de 2.500 tokens | Queda de qualidade observada em torno de 2.5k tokens de contexto em RAG (jan/2026). |

## Leitura Complementar

- [Yepes et al. / LangChain — Recursive Character Splitting docs](https://python.langchain.com/docs/how_to/recursive_text_splitter/) — o padrão em produção.
- [Vectara (2024, NAACL 2025). Chunking configurations analysis](https://arxiv.org/abs/2410.13070) — chunking importa tanto quanto a escolha de embedding.
- [Jina AI — Late Chunking in Long-Context Embedding Models (2024)](https://jina.ai/news/late-chunking-in-long-context-embedding-models/) — o paper de chunking tardio.
- [Anthropic — Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — 35-50% de melhoria de retrieval com prefixos de contexto gerados por LLM.
- [NVIDIA 2026 chunk-size benchmark — Premai summary](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/) — tamanho de chunk por tipo de consulta.
