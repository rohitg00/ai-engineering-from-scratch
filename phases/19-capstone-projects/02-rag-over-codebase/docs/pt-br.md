# Capstone 02 — RAG sobre Codebase (Busca Semântica Cross-Repo)

> Toda organização de engenharia séria em 2026 roda uma busca interna de código que entende significado, não apenas strings. Sourcegraph Amp, as respostas de codebase do Cursor, o grafo empresarial do Augment, o repomap do Aider, o MCP interno do Pinterest — mesma forma. Ingerem muitos repos, parseiam com tree-sitter, fazem embedding de chunks no nível de função e classe, buscam híbrido, re-rankeiam, e respondem com citações. Este capstone te pede pra construir um que lida com 2 milhões de linhas de código em 10 repos e sobrevive a re-indexação incremental a cada push no git.

**Tipo:** Capstone
**Linguagens:** Python (ingestão), TypeScript (API + UI)
**Pré-requisitos:** Fase 5 (fundamentos de NLP), Fase 7 (transformers), Fase 11 (engenharia de LLM), Fase 13 (ferramentas), Fase 17 (infraestrutura)
**Fases exercitadas:** P5 · P7 · P11 · P13 · P17
**Tempo:** 30 horas

## Problema

Em 2026, todo agente de programação de fronteira vem com uma camada de recuperação de codebase porque janelas de contexto sozinhas não resolvem questões cross-repo. O contexto de 1M de tokens do Claude ajuda; mas não elimina a necessidade de recuperação ranqueada. Busca cosseno ingênua sobre chunks brutos envenena resultados em código gerado, duplicação de monorepo e na cauda longa de símbolos raramente importados. A resposta de produção é uma busca híbrida (densa + BM25) sobre chunks aware de AST com um re-ranqueador, apoiada por um grafo de referências de símbolos.

Você aprende isso indexando uma frota real — não um tutorial repo — e medindo MRR@10, fidelidade de citações e frescor incremental. Os modos de falha são infraestruturais: um monorepo de 100k arquivos, um push que retoca metade dos arquivos, uma consulta que precisa cruzar quatro repos pra responder corretamente.

## Conceito

Uma pipeline de ingestão aware de AST parseia cada arquivo com tree-sitter, extrai nós de função e classe e cria chunks nas bordas dos nós em vez de janelas fixas de tokens. Cada chunk ganha três representações: um embedding denso (Voyage-code-3 ou nomic-embed-code), termos sparse BM25 e um resumo curto em linguagem natural. O resumo adiciona uma terceira modalidade recuperável — os usuários perguntam "como X é autorizado" e o resumo menciona "authz", mesmo se o código só tenha `check_permission`.

A recuperação é híbrida. Uma consulta dispara buscas densas e BM25 ao mesmo tempo, faz merge do top-k e passa a união para um re-ranqueador cross-encoder (Cohere rerank-3 ou bge-reranker-v2-gemma-2b). A lista re-rankeada vai para um sintetizador de longo contexto (Claude Sonnet 4.7 com prompt caching, ou Llama 3.3 70B auto-hospedado) com instruções de citar cada afirmação por arquivo e faixa de linhas. Respostas sem citações são rejeitadas por um pós-filtro.

Frescor incremental é o problema de infraestrutura. Um git push dispara um diff: quais arquivos mudaram, quais símbolos mudaram. Apenas os chunks afetados são re-embedados. As arestas de símbolos cross-arquivo afetadas (imports, chamadas de método) são recalculadas. O índice se mantém consistente sem reprocesar 2M de linhas a cada commit.

## Arquitetura

```
git push --> webhook --> worker de ingestão (LlamaIndex Workflow)
                           |
                           v
             parse tree-sitter + chunk AST
                           |
            +--------------+----------------+
            v              v                v
          dense        índice BM25       resumo (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      grafo de símbolos (Neo4j / kuzu)
                            |
  consulta --> agente LangGraph (recuperar -> re-rankear -> sintetizar)
                            |
                            v
                 Claude Sonnet 4.7 1M contexto
                            |
                            v
                 resposta + citações arquivo:linha
```

## Stack

- Parse: tree-sitter com 17 gramáticas de linguagem (Python, TS, Rust, Go, Java, C++, etc.)
- Embeddings densos: Voyage-code-3 (hospedado) ou nomic-embed-code-v1.5 (auto-hospedado), reserva bge-code-v1
- Índice sparse: Tantivy (Rust) com BM25F, peso por campo no nome do símbolo vs corpo
- Vector DB: Qdrant 1.12 com busca híbrida, ou pgvector + pgvectorscale para times com menos de 50M vetores
- Modelo de resumo de chunk: Claude Haiku 4.5 ou Gemini 2.5 Flash, com prompt caching
- Re-ranqueador: Cohere rerank-3 ou bge-reranker-v2-gemma-2b auto-hospedado
- Orquestração: LlamaIndex Workflows para ingestão, LangGraph para agente de consulta
- Sintetizador: Claude Sonnet 4.7 (1M contexto) com prompt caching
- Grafo de símbolos: Neo4j (gerenciado) ou kuzu (embarcado) para arestas de import e chamada
- Observabilidade: Langfuse spans por etapa de recuperação + síntese

## Construa

1. **Walker de ingestão.** Itere o histórico do git em cada hook de push. Colete arquivos alterados. Para cada arquivo, parse com tree-sitter, extraia nós de função e classe com sua faixa de código fonte completa. Emita registros de chunk `{repo, path, start_line, end_line, symbol, body}`.

2. **Sumarizador de chunks.** Agrupe chunks em chamadas ao Haiku 4.5 com prompt caching na introdução do sistema. Prompt: "Resuma esta função em uma frase, nomeando seu contrato público e efeitos colaterais." Armazene o resumo ao lado do chunk.

3. **Pool de embeddings.** Duas filas paralelas: densa (Voyage-code-3 batch 128) e resumo (mesmo modelo, mas na string de resumo). Escreva vetores no Qdrant com payload `{repo, path, start_line, end_line, symbol, kind}`.

4. **Índice BM25.** Índice Tantivy com peso por campo: peso 4 no nome do símbolo, peso 1 no corpo do símbolo, peso 2 no resumo. Permite queries "encontre a função chamada X" junto com "encontre a função que faz X".

5. **Grafo de símbolos.** Para cada chunk, registre arestas: imports (este arquivo usa o símbolo Y do repo Z), chamadas (esta função chama o método M na classe C), herança. Armazene no kuzu. Usado no momento da consulta para expandir a recuperação além das fronteiras de repo.

6. **Agent de consulta.** LangGraph com três nós. `retrieve` dispara densa + BM25 em paralelo, deduplica por (repo, path, símbolo). `rerank` roda o cross-encoder no top-50 e mantém top-10. `synth` chama Claude Sonnet 4.7 com os chunks re-rankeados em contexto, faz cache do prompt do sistema, exige citações arquivo:linha.

7. **Aplicação de citações.** Parse a saída do modelo; qualquer afirmação sem âncora `(repo/path:start-end)` é marcada para re-perguntar ou descartada. Retorne apenas respostas com citações para o usuário.

8. **Re-indexação incremental.** Em cada webhook, compute o diff no nível de símbolo. Re-embed apenas chunks cujo texto mudou. Recalcule arestas de símbolos para chunks cujos imports mudaram. Meça: um push de 50 arquivos re-indexado em menos de 60 segundos para uma frota de 2M LoC.

9. **Avaliação.** Rotule 100 questões cross-repo com respostas ouro arquivo:linha. Meça MRR@10, nDCG@10, fidelidade de citações (fração de afirmações com âncoras verificáveis) e latência p50/p99.

## Use

```
$ code-rag ask "como o abort de multipart S3 está conectado ao nosso orçamento de retry?"
[recuperar]  12 chunks densos + 7 chunks bm25, 16 únicos após dedup
[re-rankear] top-5 mantidos (cohere rerank-3)
[sintetizar] claude-sonnet-4.7, taxa de hit do cache 68%, 2.1s
resposta:
  Aborts de multipart são disparados por `AbortMultipartOnFail` em
  services/uploader/retry.go:122-148, que decrementa o orçamento de retry
  por bucket definido em config/budgets.yaml:34-51 ...
  citações: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## Entregue

A skill entregável é `outputs/skill-codebase-rag.md`. Dado um corpus de repos, ela monta a pipeline de ingestão, o índice híbrido e o agente de consulta, e retorna uma resposta citada para qualquer questão cross-repo. Rubrica:

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Qualidade da recuperação | MRR@10 e nDCG@10 em um conjunto de 100 questões retidas |
| 20 | Fidelidade de citações | Fração de afirmações da resposta com âncoras arquivo:linha verificáveis |
| 20 | Latência e escala | p95 da latência de consulta em 10k QPS no corpus indexado |
| 20 | Corretude da indexação incremental | Tempo de push git até busca em um commit de 50 arquivos |
| 15 | UX e formatação da resposta | Clique nas citações, previews de trechos, possibilidade de follow-up |
| **100** | | |

## Exercícios

1. Troque Voyage-code-3 por nomic-embed-code auto-hospedado. Meça o delta de MRR@10. Relate se o gap fecha com re-ranking habilitado.

2. Injete 20% de código gerado (boilerplate produzido por LLM) no corpus e reavalie. Observe o envenenamento da recuperação. Adicione uma flag "gerado" ao payload e reduza o peso desses resultados.

3. Teste a busca híbrida do Qdrant vs pgvector + pgvectorscale no tamanho do seu corpus. Relate o p99 com batch size 1.

4. Adicione uma verificação de deriva baseada em amostragem: semanalmente, reexecute a avaliação de 100 questões. Alerta em queda de MRR@10 > 5%.

5. Estenda para resolução de símbolos cross-linguagem: uma função Python que chama um serviço Go via gRPC. Use o grafo de símbolos para linká-los.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Chunking aware de AST | "Divisões no nível de função" | Cortar código nas bordas dos nós do tree-sitter em vez de janelas fixas de tokens |
| Busca híbrida | "Densa + sparse" | Rodar BM25 e busca vetorial em paralelo, merge do top-k, re-ranquear |
| Re-ranqueamento cross-encoder | "Ranqueamento de segunda etapa" | Modelo que pontua cada par (consulta, candidato) junto, mais preciso que cosseno |
| Prompt caching | "Prompt do sistema em cache" | Recurso de 2026 do Claude / OpenAI que desconta tokens de prefixo repetido em até 90% |
| Grafo de símbolos | "Grafo de código" | Arestas para imports, chamadas, herança entre arquivos e repos |
| Fidelidade de citações | "Taxa de resposta fundamentada" | Fração de afirmações que o usuário pode verificar clicando na âncora e lendo o trecho referenciado |
| Re-indexação incremental | "Tempo de push até busca" | Tempo de relógio do push git até os símbolos alterados ficarem pesquisáveis |

## Leitura Complementar

- [Sourcegraph Amp](https://ampcode.com) — inteligência de código cross-repo em produção
- [Arquitetura RAG do Sourcegraph Cody](https://sourcegraph.com/blog/how-cody-understands-your-codebase) — referência profunda para este capstone
- [repo-map do Aider](https://aider.chat/docs/repomap.html) — visão ranqueada de repo com tree-sitter
- [Grafo empresarial da Augment Code](https://www.augmentcode.com) — RAG de grafo de símbolos comercial
- [Documentação de busca híbrida do Qdrant](https://qdrant.tech/documentation/concepts/hybrid-queries/) — implementação de referência
- [Embeddings de código Voyage AI](https://docs.voyageai.com/docs/embeddings) — detalhes do Voyage-code-3
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) — referência de cross-encoder
- [Busca interna MCP do Pinterest](https://medium.com/pinterest-engineering) — referência de plataforma interna
