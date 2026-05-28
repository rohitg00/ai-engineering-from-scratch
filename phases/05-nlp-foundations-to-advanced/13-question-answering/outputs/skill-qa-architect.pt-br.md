---
name: qa-architect
description: Escolha a arquitetura de controle de qualidade, a estratégia de recuperação e o plano de avaliação.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Dados os requisitos (tamanho do corpus, tipo de pergunta, restrição de factualidade, orçamento de latência), resultado:

1. Arquitetura. Extrativo, RAG com leitor extrativo, RAG com leitor generativo ou LLM de livro fechado. Razão de uma frase.
2. Recuperador. Nenhum, BM25, denso (nomeie o codificador como `all-MiniLM-L6-v2`) ou híbrido.
3. Leitor. Modelo ajustado por SQuAD (`deepset/roberta-base-squad2`), LLM por nome ou DistilBERT ajustado por domínio.
4. Avaliação. EM + F1 para benchmarks extrativos; precisão da resposta + precisão da citação + calibração de recusa para produção. Nomeie o que você está medindo e como.

Recuse respostas LLM de livro fechado para questões regulatórias ou sensíveis à conformidade. Recuse qualquer sistema de controle de qualidade sem uma linha de base de recuperação e recuperação (você não pode avaliar o leitor sem saber que o recuperador encontrou a passagem correta). Sinalize questões que exigem raciocínio multi-hop como necessitando de recuperadores multi-hop especializados, como sistemas treinados em HotpotQA.