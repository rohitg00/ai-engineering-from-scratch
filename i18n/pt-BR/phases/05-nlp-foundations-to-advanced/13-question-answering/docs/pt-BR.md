# Sistemas de Resposta a Questões

> Três sistemas formaram a moderna QA. Extractiva encontrou intervalos. A recuperação aumentou-los em documentos. Gerativo produziu respostas. Cada assistente de IA moderno é uma mistura dos três.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## O problema

Um usuário digita "Quando foi lançado o primeiro iPhone?" e espera "29 de junho de 2007". Não "A história da Apple é longa e variada". Não "2007" sentado isolado sem frase. Uma resposta direta, fundamentada e correta.

Três arquiteturas dominaram a QA na última década.

- **Extractive QA.**Dado uma pergunta e uma passagem que contém a resposta, encontre os índices de início e fim do intervalo de respostas na passagem.
- **Open-domain QA.**A passagem não é dada. Retira a passagem relevante primeiro, depois extrai ou gera uma resposta. Esta é a base de cada oleoduto RAG hoje.
- **Generative / Closed-book QA.**Um modelo de linguagem grande responde a partir de sua memória paramétrica, sem recuperação, mais rápido na inferência, menos confiável nos fatos.

A tendência em 2026 é híbrida: recuperar as melhores passagens, em seguida, pedir um modelo gerativo para responder baseado nessas passagens.

## O conceito

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**Extractive.**Encode a pergunta e a passagem juntamente com um transformador (família BERT). Treine duas cabeças que preveem índices de token de início e fim da resposta. A perda é entropia cruzada sobre posições válidas. A saída é um espaço de tempo da passagem. Nunca alucina (por construção), nunca lida com perguntas que a passagem não pode responder (por construção).

**Retrieval-augmented (RAG).**Primeiro, um retriever encontra o topo...`k`O sistema de retriever-reader permite que cada um seja treinado e avaliado de forma independente.

**Generative.**Um LLM apenas para decodificadores (GPT, Claude, Llama) responde a partir de pesos aprendidos. Não há etapa de recuperação. Excelente em conhecimento comum, catastrófico em fatos raros ou recentes. A taxa de alucinação está inversamente correlacionada com a frequência de fatos nos dados pré-treino.

```figure
qa-span
```

## Construí-lo

### Passo 1: AQ extractiva com um modelo pré-treinado

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2`O programa de formação é formado no SQuAD 2.0, que inclui perguntas sem resposta.`question-answering`O pipeline retorna o período de pontuação mais alto mesmo quando o resultado zero do modelo ganha.`handle_impossible_answer=True`para a chamada de pipeline: a pipeline retorna uma resposta vazia apenas quando a pontuação nula excede todas as pontuações de tempo.`score`campo de qualquer maneira.

### Passo 2: um gasoduto aumentado de recuperação (esquema)

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

Duas etapas de pipeline. O Density Retriever (Sentence-BERT) encontra passagens relevantes por semântica semelhança. O leitor extractivo (RoBERTa-SQuAD) tira o intervalo de resposta das passagens superiores combinadas. Trabalha em pequenos corpos. Para um corpus de um milhão de documentos, use FAISS ou um banco de dados vetorial.

### Passo 3: gerador com RAG

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

O padrão de prompt importa. Dizer explicitamente ao modelo que ele esteja no contexto e retornar "não sei" quando o contexto é insuficiente reduz as taxas de alucinação em 40-60% em comparação com o prompting ingênuo. Padrões mais elaborados adicionam citações, pontuações de confiança e extração estruturada.

### Passo 4: Avaliação que reflita o mundo real

Utilizações do SQuAD **Exact Match (EM)**E ...**token-level F1**- Não . EM é uma correspondência rigorosa após a normalização (minuscript, puntuação de tira, remover artigos)  ou a previsão coincide exatamente ou marca 0. A F1 é calculada sobre a sobreposição de tokens entre previsão e referência e dá crédito parcial. Ambas as paráfrases de baixo crédito: "29 de junho de 2007" vs "29 de junho de 2007" normalmente obtém 0 EM (a normalização das interrupções ordinárias), mas ainda ganha uma F1 substancial a partir de tokens sobrepostos.

Para a produção QA:

- **Answer accuracy**(Judicado pela MLL ou por humanos, uma vez que as métricas não capturam equivalência semântica).
- **Citation accuracy.**É trivial verificar automaticamente com a correspondência de cordas entre citações geradas e passagens recuperadas.
- **Refusal calibration.**Quando a resposta não está nas passagens recuperadas, o sistema diz corretamente "Não sei"?
- **Retrieval recall.**Antes de avaliar o leitor, medir se o retriever consegue a passagem certa para o topo...`k`Um leitor não pode consertar uma passagem faltante.

### RAGAS: o quadro de avaliação da produção de 2026

`RAGAS`É especialmente construído para sistemas RAG e é o padrão de transporte em 2026.

- **Faithfulness.**Cada afirmação da resposta vem do contexto recuperado? Medido por implicação baseada em NLI.
- **Answer relevance.**A resposta responde à pergunta? Medida gerando perguntas hipotéticas da resposta e comparando com a pergunta real.
- **Context precision.**Dos pedaços recuperados, qual fração era realmente relevante?
- **Context recall.**O conjunto recuperado continha todas as informações necessárias?

A pontuação sem referências permite que você avalia o tráfego de produção ao vivo sem respostas de ouro.

`pip install ragas`Conecte o retriever + leitor, obtém quatro escalares por consulta, alerta de regressões.

## Usá-lo

A pilha de 2026.

| Use case | Recommended |
|---------|-------------|
| Given passage, find answer span | `deepset/roberta-base-squad2` |
| Over a fixed corpus, closed-book not acceptable | RAG: dense retriever + LLM reader |
| Real-time over a document store | RAG with hybrid (BM25 + dense) retriever + reranker (lesson 14) |
| Conversational QA (follow-up questions) | LLM with conversation history + RAG on each turn |
| Highly factual, regulated domains | Extractive over an authoritative corpus; never generative alone |

A AQ extractiva é des moda em 2026 porque a RAG com LLM lida com mais casos.

## Envia-o

Salva como`outputs/skill-qa-architect.md`- Não .

```markdown
---
name: qa-architect
description: Choose QA architecture, retrieval strategy, and evaluation plan.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Given requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder), or hybrid.
3. Reader. SQuAD-tuned model, LLM by name, or "domain-fine-tuned DistilBERT."
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how you are measuring it.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
```

## Exercícios

1. **Easy.**Configure o pipeline extractivo SQuAD acima em 10 passagens da Wikipédia. 10 perguntas artesanas. Messa com que frequência a resposta é correta. Você deve ver 7-9 correta se passagens e perguntas são limpas.
2. **Medium.**Adicione um classificador de recusa. Quando a pontuação de recuperação superior estiver abaixo de um limiar (digamos 0,3 cosinos), retorne "Não sei" em vez de ligar ao leitor.
3. **Hard.**Construir um pipeline RAG sobre um corpus de 10.000 documentos de sua escolha. Implementar a recuperação híbrida (BM25 + densa) com fusão RRF (ver lição 14).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive QA | Find the answer span | Predict start and end indices of the answer within a given passage. |
| Open-domain QA | QA over a corpus | No given passage; must retrieve then answer. |
| RAG | Retrieve then generate | Retrieval-augmented generation. Retriever + reader pipeline. |
| SQuAD | Canonical benchmark | Stanford Question Answering Dataset. EM + F1 metrics. |
| Hallucination | Made-up answer | Reader output not supported by retrieved context. |
| Refusal calibration | Know when to shut up | System correctly says "I don't know" when unable to answer. |

## Mais leitura

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) o documento de referência.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906)DPR, o retriever canônico denso para QA.
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)O jornal que chamava RAG.
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) Pesquisa abrangente do RAG.
