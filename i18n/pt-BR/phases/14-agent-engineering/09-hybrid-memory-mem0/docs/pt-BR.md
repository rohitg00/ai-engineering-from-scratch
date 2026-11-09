# Memória híbrida: Vector + Graphic + KV

> A memória híbrida executa três lojas em paralelo  vetor para semântica semelhança, KV para rápida pesquisa de fatos, gráfico para raciocínio de relação entre entidades  com uma camada de pontuação que as funde na recuperação. Este é um padrão de produção amplamente usado para memória externa; Mem0 (Chhikara et al., 2025) é uma implementação de referência.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique por que uma única armazenagem (apenas vetorial, apenas gráfico, apenas KV) é insuficiente para a memória do agente.
- Nomear as três lojas paralelas do Mem0 e para o que cada uma optimiza.
- Descreva a pontuação de fusão do Mem0  relevância, importância, recência  e por que é uma soma ponderada, não uma hierarquia.
- Implementar uma memória de brinquedo de três andares em stdlib com um `add()`que escreve para os três e um`search()`que combina os resultados.

## O problema

Cada loja é adequada para apenas uma das três classes de consulta:

- **Semantic similarity**"O que discutimos sobre o agente drift na semana passada?" Vence o Vector, KV e grafico.
- **Fact lookup** "Qual é o número de telefone do usuário?" KV ganha; vetor é desperdício, gráfico é exagerado.
- **Relationship reasoning** "Quais clientes compartilham a mesma entidade de faturamento?" Grafico vence; vector e KV não podem responder.

Os agentes de produção emitem os três em uma sessão. Uma memória de loja única é sempre errada para dois deles.`add`- Não .`search`A superfície com uma função de pontuação que as funde.

## O conceito

### Três lojas em paralelo

Mem0 (arXiv:2504.19413, Abril 2025) em `add(text, user_id, metadata)`- Não .

1. Extrair os factos candidatos do texto (um passo orientado pelo Mestrado em Direito Jurídico).
2. Escreva cada fato no armazenamento vetorial (embedding) para pesquisa semântica.
3. Escrever cada fato para o armazém KV com teclado (user_id, fact_type, entity) para $O(1)$- Não.
4. Escreva cada fato no gráfico de armazenamento (Mem0g) como bordas digitalizadas para consultas de relacionamento.

- Sim .`search(query, user_id)`- Não .

1. O vector store retorna o top-k incorporando cosino.
2. O armazém KV retorna hits diretos teclados em query-derived (user_id, tipo, entidade).
3. Graph store retorna subgraph acessível a partir de entidades de consulta.
4. Uma camada de pontuação funde os três.

### Ponto de pontuação de fusão

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **Relevance** cosino vetorial, KV correspondência exata, peso do caminho do gráfico.
- **Importance** etiquetado no momento da escrita ou aprendido (alguns fatos importam mais: nomes, identidades, políticas).
- **Recency** decadência exponencial ao longo do tempo desde a última escrita ou leitura.

Os pesos são ajustados por produto.`w_recency`para agentes de chat; superior `w_importance`para agentes de conformidade; superior `w_relevance`para agentes de recuperação.

### Memorandos e raciocínio temporal

Mem0g adiciona um detector de conflito. Quando um novo fato contradiz uma borda existente, a borda existente é marcada como inválida, mas não excluída.

Este é o comportamento de conformidade do grau de Letta padrão de invalidação generaliza.

### Números de referência

Relatórios do Mem0 (2025):

- **LoCoMo**(memória de conversação de longa duração): 91,6
- **LongMemEval**(memória episódica de longo horizonte): 93,4
- **BEAM 1M**(M-token memory benchmark): 64,1

As linhas de base de comparação (LLC de contexto completo 128k, loja de vetores plana, KV plana) perdem mais de 10 pontos.

### Taxonomia de âmbito

Mem0 divide a memória por escopo:

- **User memory** persiste durante as sessões, teclado em `user_id`- Não .
- **Session memory** persiste dentro de um fio.
- **Agent memory** Estado de instância por agente.

Cada escrita escolhe um escopo. A recuperação pode fazer consultas em escopo com pesos por escopo. Misturar escopo sem pensar é como você obtém "o assistente disse à Alice sobre o projeto de Bob" incidentes.

### Onde este padrão vai mal

- **Embedding drift.**Os resultados vectoriais que se apresentam bem nas primeiras cem consultas degradam-se à medida que o corpo cresce. Adicione re-embedamento periódico dos registros mais utilizados.
- **KV schema creep.** `(user_id, type, entity)`Parece simples até que cada equipa adicione a sua .`type`- Auditar o tipo definido trimestralmente.
- **Graph explosion.**Um extrator barulhento adiciona 50 bordas por mensagem.`add`- Não. - Não.

```figure
ae-memory-fusion
```

## Construí-lo

`code/main.py`Implementa o padrão de três andares em stdlib:

- `VectorStore` semelhança ingênua entre tokens como um substitutos de incorporação.
- `KVStore`- O que é que é ?`(user_id, fact_type, entity)`- Não .
- `GraphStore` bordas digitais (subjeto, relação, objeto, válido).
- `Mem0` fachada de nível superior com `add()`- Não .`search()`, pontuação de fusão, e recuperação consciente de alcance.
- Um rastro de trabalho numa conversa multi-usuário, multi-sessão.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

A saída mostra três caminhos de recall separados mais o top-k fundido.`main()`e ver a mudança de classificação.

## Usá-lo

- **Mem0 (Apache 2.0)** Pronto para produção. Auto-host com Postgres + Qdrant + Neo4j, ou use a nuvem gerenciada.
- **Letta** Núcleo/recall/arquivo de três níveis; traga os seus próprios retrospectivos vetoriais e gráficos.
- **Zep** alternativa comercial com KG temporal e extracção de fatos.
- **Custom builds** quando é necessário controlar exatamente o extrator (conformidade) ou os pesos de fusão (agentes de voz onde a recência é dominante).

## Envia-o

`outputs/skill-hybrid-memory.md`gera um andamio de memória de três andares com um marcador de fusão, taxonomia de alcance e invalidação temporal conectado.

## Exercícios

1. Substitua a semelhança do vetor de brinquedo por um modelo de incorporação real (transformadores de frases, Ollama, incorporações OpenAI).
2. Adicionar uma consulta temporal: `search(query, as_of=timestamp)`Retorna apenas registos válidos antes desse tempo.
3. Implementar um detector de conflitos: se um fato recebido contradiz uma borda do gráfico, inválide a borda antiga e registre ambos.
4. Portar o marcador de fusão para incluir um `user_feedback`dimensão (ponto adiante dos registos recuperados). Como evitar jogos (o agente só retorna registros que já gostou)?
5. Leia os documentos do Mem0 (`docs.mem0.ai`Portar o brinquedo para o`mem0`Comparar a qualidade da recuperação nas mesmas 20 consultas de teste.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hybrid memory | "Vector plus graph plus KV" | Three stores written in parallel, fused on retrieval |
| Fact extraction | "Memory ingestion" | LLM step that breaks text into (entity, relation, fact) tuples |
| Fusion scoring | "Relevance ranking" | Weighted sum of relevance, importance, recency |
| Scope | "Memory namespace" | user / session / agent — determines who sees what |
| Mem0g | "Memory graph" | Typed edges with temporal validity for relationship queries |
| Temporal invalidation | "Soft delete" | Mark contradicted edges invalid; never delete |
| Embedding drift | "Retrieval rot" | Vector quality degrades as corpus grows; re-embed periodically |

## Mais leitura

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) O papel original
- [Mem0 docs](https://docs.mem0.ai/platform/overview) API de produção, SDKs, nuvem gerenciada
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) o antecessor de contexto virtual
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) o projeto de três camadas
