---
name: hybrid-memory
description: Gere um sistema de memória de três armazenamentos em formato Mem0 (vetor + KV + gráfico) com um marcador de fusão, taxonomia de escopo e invalidação temporal.
version: 1.0.0
phase: 14
lesson: 09
tags: [memory, mem0, vector, graph, kv, fusion, scope]
---

Dado um tempo de execução alvo, um back-end de vetor (Qdrant, pgvector, Chroma, sqlite-vec), um back-end KV (Postgres, Redis, dict) e um back-end de gráfico (Neo4j, bordas na memória), produzem um sistema de memória fundida.

Produzir:

1. Três classes de lojas atrás de uma fachada `add(text, user_id, session_id, scope, importance, tags)`. Na gravação, o extrator decompõe `text` em registros, triplos KV e triplos gráficos. Nenhuma loja é opcional.
2. Um marcador de fusão `score = w_rel * relevance + w_imp * importance + w_rec * recency`. Exponha todos os três pesos como configuração. Sintonize por produto, não por ligação.
3. Taxonomia de escopo: `user`, `session`, `agent`. A recuperação DEVE respeitar o escopo. Uma consulta de usuário nunca deve vazar os registros de outro usuário.
4. Invalidação temporal. As contradições tornam inválidas arestas/registros antigos; nunca exclua. Exponha `search(query, as_of=timestamp)` para consultas históricas.
5. Uma interface extratora. O padrão pode ser orientado por LLM; permitir um substituto de regex determinístico para testes. Limite as bordas do gráfico por `add()` para evitar explosão.

Rejeições difíceis:

- Memória de armazenamento único descrita como "em formato de Mem0". Produtos somente vetoriais, somente KV e somente gráficos são bons, mas não são memória híbrida. Não os nomeie incorretamente.
- Recuperação entre escopos sem pesos por escopo ou um filtro `scope=` explícito. O vazamento de escopo é um incidente de conformidade e privacidade.
- Exclusão por contradição. Invalidar e carimbo de data/hora. A exclusão oculta bugs e interrompe auditorias.

Regras de recusa:

- Se o usuário solicitar “sem ponderação de importância”, recuse. A classificação de relevância plana acima de um milhão de registros é uma falha de recuperação esperando para acontecer.
- Se o backend do gráfico não tiver detector de conflitos, recuse-se a chamar o sistema resultante de "em forma de Mem0". Faça downgrade do nome.
- Se o produto envolver PII (médico, jurídico, RH), recuse o envio com um extrator que não tenha sido auditado pelo proprietário do produto.

Saída: um arquivo por armazenamento mais `memory.py` (fachada), `config.py` (pesos), `README.md` explicando os pesos de fusão, política de escopo, contrato de extração e semântica de invalidação. Termine com "o que ler a seguir", apontando para a Lição 10 se o agente precisar aprender novas habilidades, a Lição 23 se os spans OTel forem necessários em operações de memória ou a Lição 27 para manipulação de entradas não confiáveis ​​na recuperação.