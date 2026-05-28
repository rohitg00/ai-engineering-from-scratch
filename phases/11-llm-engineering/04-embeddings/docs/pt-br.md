# Embeddings & Representações Vetoriais

> Texto é discreto. Matemática é contínua. Cada vez que você pede a um LLM para encontrar documentos "similares", comparar significados ou buscar além de palavras-chave, você depende de uma ponte entre esses dois mundos. Essa ponte é um embedding. Se você não entende embeddings, não entende IA moderna. Você só usa.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 11, Aula 01 (Prompt Engineering)
**Tempo:** ~75 minutos
**Relacionado:** Fase 5 · 22 (Embedding Models Deep Dive) cobre denso vs sparse vs multi-vector, truncamento Matryoshka e seleção de modelo por eixo. Esta aula foca na pipeline de produção (vector DBs, HNSW, matemática de similaridade).

## Objetivos de Aprendizado

- Gerar embeddings de texto usando provedores de API e modelos open-source, e calcular similaridade cosseno entre eles
- Explicar por que embeddings resolvem o problema de mismatch de vocabulário que a busca por palavras-chave não consegue resolver
- Construir um índice de busca semântica que recupera documentos por significado em vez de correspondência exata de palavras-chave
- Avaliar qualidade de embeddings usando benchmarks de retrieval (precision@k, recall) e escolher o modelo de embedding certo para sua tarefa

## O Problema

Você tem 10.000 tickets de suporte. Um cliente escreve "meu pagamento não passou." Você precisa encontrar todos os tickets sobre problemas de pagamento. Mas outros clientes escreveram "cobrança falhou", "cartão recusado", "transação não completada". Busca por palavras-chave pega apenas os que contêm "pagamento" — perde os outros.

Esse é o problema de mismatch de vocabulário. A mesma ideia é expressa de formas completamente diferentes. Embeddings resolvem isso convertendo texto em vetores numéricos onde significados similares ficam próximos no espaço vetorial.

## O Conceito

### O que é um Embedding

Um embedding é um vetor denso que representa o significado do texto. "Como redefinir minha senha?" e "Preciso trocar minha senha" produzem vetores quase idênticos, apesar de poucas palavras em comum. "O gato sentou no tapete" produz um vetor muito diferente.

```python
# Conceito simplificado de embedding
texts = [
    "Como redefinir minha senha",
    "Preciso trocar minha senha",
    "O gato sentou no tapete",
]

# Em um embedding real, estes seriam vetores de 384-3072 dimensões
# similarity("redefinir senha", "trocar senha") ≈ 0.95
# similarity("redefinir senha", "gato tapete") ≈ 0.10
```

### Similaridade Cosseno

Dado dois vetores, como medir similaridade? A resposta padrão é similaridade cosseno:

```
cosine_sim(a, b) = dot(a, b) / (||a|| * ||b||)
```

Varia de -1 (opostos) a 1 (idênticos). Ignora magnitude, só se importa com direção. É o padrão para RAG.

### Banco de Dados Vetorial

Depois de ter embeddings, precisa de algum lugar para armazenar e buscá-los:

| Banco | Tipo | Melhor para |
|-------|------|-------------|
| FAISS | Biblioteca | Prototipagem, dados pequenos |
| Chroma | DB leve | Desenvolvimento local |
| Pinecone | Serviço gerenciado | Produção sem overhead de ops |
| Weaviate | Open source | Produção self-hosted |
| pgvector | Extensão Postgres | Já usa Postgres |
| Qdrant | Open source | Alta performance self-hosted |

### TF-IDF: Embedding Clássico

Para esta aula, construímos nosso próprio embedding usando TF-IDF. Não porque TF-IDF é o que sistemas de produção usam, mas porque torna o conceito concreto: texto entra, um vetor sai, textos similares produzem vetores similares.

TF-IDF (Term Frequency-Inverse Document Frequency) converte texto em vetores ponderando palavras pela importância. Palavras frequentes num documento recebem TF alto. Palavras raras no corpus recebem IDF alto. O produto dá um vetor onde palavras importantes e distintivas têm valores altos.

## Construa

### Passo 1: Chunking de Documentos

```python
def chunk_text(text, chunk_size=200, overlap=50):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap
    return chunks
```

### Passo 2: Embeddings TF-IDF

```python
import math
from collections import Counter

def build_vocabulary(documents):
    vocab = set()
    for doc in documents:
        vocab.update(doc.lower().split())
    return sorted(vocab)

def compute_tf(text, vocab):
    words = text.lower().split()
    count = Counter(words)
    total = len(words)
    return [count.get(word, 0) / total for word in vocab]

def compute_idf(documents, vocab):
    n = len(documents)
    idf = []
    for word in vocab:
        doc_count = sum(1 for doc in documents if word in doc.lower().split())
        idf.append(math.log((n + 1) / (doc_count + 1)) + 1)
    return idf

def tfidf_embed(text, vocab, idf):
    tf = compute_tf(text, vocab)
    return [t * i for t, i in zip(tf, idf)]
```

### Passo 3: Busca por Similaridade Cosseno

```python
def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

def search(query_embedding, stored_embeddings, top_k=5):
    scores = []
    for i, emb in enumerate(stored_embeddings):
        sim = cosine_similarity(query_embedding, emb)
        scores.append((i, sim))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]
```

### Passo 4: Pipeline Completa

```python
class EmbeddingSearchEngine:
    def __init__(self):
        self.documents = []
        self.chunks = []
        self.embeddings = []
        self.vocab = []
        self.idf = []

    def index(self, documents):
        self.documents = documents
        all_chunks = []
        for doc in documents:
            all_chunks.extend(chunk_text(doc))
        self.chunks = all_chunks
        self.vocab = build_vocabulary(all_chunks)
        self.idf = compute_idf(all_chunks, self.vocab)
        self.embeddings = [
            tfidf_embed(chunk, self.vocab, self.idf)
            for chunk in all_chunks
        ]

    def query(self, question, top_k=5):
        query_emb = tfidf_embed(question, self.vocab, self.idf)
        results = search(query_emb, self.embeddings, top_k)
        return [(self.chunks[i], score) for i, score in results]
```

## Use

### OpenAI Embeddings

```python
# from openai import OpenAI
#
# client = OpenAI()
#
# response = client.embeddings.create(
#     model="text-embedding-3-small",
#     input="Como redefinir minha senha"
# )
# embedding = response.data[0].embedding
# print(f"Dimensões: {len(embedding)}")  # 1536
```

### ChromaDB para Busca Vetorial

```python
# import chromadb
#
# client = chromadb.Client()
# collection = client.create_collection("meus_docs")
#
# collection.add(
#     documents=chunks,
#     ids=[f"chunk_{i}" for i in range(len(chunks))]
# )
#
# results = collection.query(
#     query_texts=["Política de reembolso"],
#     n_results=5
# )
```

## Entregue

Esta aula produz um mecanismo de busca semântica completo que pode ser integrado a qualquer pipeline de RAG.

## Exercícios

1. Substitua os embeddings TF-IDF por uma abordagem bag-of-words simples (binário: 1 se a palavra está presente, 0 se não). Compare a qualidade de retrieval nos documentos de exemplo. TF-IDF deve superar porque pondera palavras raras mais.

2. Experimente com tamanhos de chunk: tente 50, 100, 200 e 500 palavras no mesmo conjunto de documentos. Para cada tamanho, rode as mesmas 5 queries e conte quantas retornam um chunk relevante no top-3.

3. Adicione metadados a cada chunk (nome do documento, posição do chunk). Modifique o template do prompt para incluir atribuição de fonte.

4. Implemente uma avaliação simples: dadas 10 pares de questão-resposta, rode cada questão pela pipeline de RAG e meça qual porcentagem dos chunks recuperados contém a resposta.

5. Construa uma pipeline de RAG consciente de conversa: mantenha um histórico das últimas 3 trocas e inclua no prompt junto com os chunks recuperados.

## Termos-Chave

| Termo | O que o pessoal diz | O que realmente significa |
|-------|--------------------|-----------------------|
| Embedding | "Converter texto em números" | Representação vetorial densa do texto onde significados similares produzem vetores similares |
| Vector database | "Mecanismo de busca para IA" | Store de dados otimizado para armazenar vetores e encontrar vizinhos mais próximos por similaridade |
| Cosine similarity | "Quão similares são dois vetores" | Cosseno do ângulo entre dois vetores; 1 = direção idêntica, 0 = ortogonal, -1 = oposto |
| Top-k retrieval | "Pegar os k melhores matches" | Retornar os k chunks mais similares à query do store vetorial |
| Context window | "Quanto texto o LLM enxerga" | Número máximo de tokens que o LLM pode processar em uma única requisição |
| TF-IDF | "Pontuação de importância de palavras" | Frequência do Termo vezes Inverso da Frequência do Documento; pondera palavras pela distintividade no corpus |

## Leitura Adicional

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings) — referência prática para text-embedding-3
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) — benchmark comparando todos os modelos de embedding
- [Sentence Transformers documentation](https://www.sbert.net/) — referência para bi-encoder vs cross-encoder
- [Mikolov et al., "Efficient Estimation of Word Representations" (2013)](https://arxiv.org/abs/1301.3781) — paper Word2Vec
- [Reimers & Gurevych, "Sentence-BERT" (2019)](https://arxiv.org/abs/1908.10084) — como treinar bi-encoders para similaridade
