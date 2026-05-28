---
name: skill-advanced-rag
description: Crie RAG de nível de produção com pesquisa, reclassificação e avaliação híbridas
version: 1.0.0
phase: 11
lesson: 7
tags: [rag, hybrid-search, bm25, reranking, hyde, evaluation]
---

# Padrão RAG avançado

RAG básico: consulta incorporada -> pesquisa vetorial -> top-k -> gerar.
RAG avançado: consulta incorporada + BM25 -> classificações de fusíveis -> reclassificação -> top-k -> gerar.

```
query -> [vector search (top-50)] -+-> RRF fusion -> reranker (top-5) -> prompt -> LLM
                                   |
query -> [BM25 search (top-50)]  --+
```

## Quando atualizar do RAG básico

- A qualidade da recuperação cai abaixo de 70% Recall@5
- Os usuários relatam respostas erradas ou irrelevantes
- Corpus cresce além de 100 mil pedaços
- As consultas usam vocabulário diferente dos documentos
- Perguntas multi-hop falham consistentemente

## Lista de verificação de implementação

1. Adicione o índice BM25 ao lado do índice vetorial
2. Execute ambas as pesquisas em paralelo (50 principais cada)
3. Mesclar com fusão de classificação recíproca (k = 60)
4. Reclassifique os principais candidatos com um codificador cruzado
5. Escolha os 5 primeiros para a solicitação final
6. Adicione avaliação de fidelidade em um conjunto de testes

## Guia de seleção de técnica

- **Pesquisa híbrida**: use sempre em produção. Não custa nada extra na hora da consulta.
- **Reclassificação**: use quando Recall@50 for bom, mas Recall@5 for ruim. Adiciona latência de 50-200 ms.
- **HyDE**: use quando as consultas são vagas ou usam vocabulário diferente dos documentos. Adiciona uma chamada LLM.
- **Blocos pai-filho**: use quando pedaços pequenos não têm contexto, mas pedaços grandes diluem a relevância.
- **Filtragem de metadados**: use quando o corpus tiver categorias claras (data, tipo de fonte, departamento).
- **Decomposição de consulta**: use para perguntas multi-hop que requerem informações de vários documentos.

## Erros comuns

- Executando BM25 e pesquisa vetorial com diferentes conjuntos de blocos (eles devem pesquisar no mesmo corpus)
- Usar um grupo de candidatos muito pequeno para reclassificação (os 10 primeiros são muito poucos; use os 50 primeiros)
- Adicionar HyDE para cada consulta (ajuda apenas quando a incompatibilidade de vocabulário é o gargalo)
- Não avaliar alterações (medir Recall@k antes e depois de cada técnica)
- Exagerar na engenharia do pipeline antes de medir onde ele falha

## Fluxo de trabalho de avaliação

1. Crie mais de 50 perguntas de teste com blocos de respostas conhecidos
2. Meça Recall@5 e Recall@10 para cada método de recuperação
3. Para consultas onde a recuperação é bem-sucedida, meça a fidelidade das respostas geradas
4. Acompanhe as métricas semanalmente à medida que o corpus cresce
5. Investigue falhas individuais antes de adicionar mais técnicas