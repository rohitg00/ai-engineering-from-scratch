# Memória Híbrida: Vector + Graph + KV (Mem0)

> Mem0 (Chhikara et al., 2025) trata memória como três armazenamentos em paralelo — vector pra similaridade semântica, KV pra busca rápida de fatos, graph pra raciocínio de entidade-relação. Uma camada de pontuação funde os três na recuperação. Esse é o padrão de produção de 2026 pra memória externa.

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 07 (MemGPT), Fase 14 · 08 (Letta Blocks)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar por que um único armazenamento (só vector, só graph, só KV) é insuficiente pra memória de agent.
- Nomear os três armazenamentos paralelos do Mem0 e o que cada um otimiza.
- Descrever a pontuação de fusão do Mem0 — relevância, importância, recenticidade — e por que é uma soma ponderada, não uma hierarquia.
- Implementar uma memória de três armazenamentos em stdlib com um `add()` que escreve nos três e um `search()` que funde resultados.

## O Problemo

Um armazenamento só erra em uma de três classes de consulta:

- **Similaridade semântica** — "o que a gente discutiu sobre deriva de agente semana passada?" Vector ganha; KV e graph perdem.
- **Busca de fato** — "qual é o telefone do usuário?" KV ganha; vector é desperdício, graph é excesso.
- **Raciocínio de relação** — "quais clientes compartilham a mesma entidade de cobrança?" Graph ganha; vector e KV não respondem.

Agents de produção emitem os três numa sessão. Um armazenamento único tá sempre errado pra dois deles. A contribuição do Mem0 é conectar os três atrás de uma superfície única `add`/`search` com uma função de pontuação que os funde.

## O Conceito

### Três armazenamentos em paralelo

Mem0 (arXiv:2504.19413, Abril 2025) no `add(text, user_id, metadata)`:

1. Extrai fatos candidatos do texto (passo conduzido por LLM).
2. Escreve cada fato no armazenamento vector (embedding) pra busca semântica.
3. Escreve cada fato no armazenamento KV com chave em (user_id, fact_type, entity) pra lookup O(1).
4. Escreve cada fato no armazenamento graph (Mem0g) como arestas tipadas pra consultas de relação.

No `search(consulta, user_id)`:

1. Armazenamento vector retorna top-k por cosseno de embedding.
2. Armazenamento KV retorna hits diretos com chave em (user_id, type, entity) derivados da consulta.
3. Armazenamento graph retorna subgrafo acessível a partir de entidades da consulta.
4. Uma camada de pontuação funde os três.

### Pontuação de fusão

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **Relevância** — cosseno vector, match exato KV, peso de caminho no graph.
- **Importância** — marcada na escrita ou aprendida (alguns fatos importam mais: nomes, IDs, políticas).
- **Recenticidade** — decaimento exponencial desde última escrita ou leitura.

Pesos são ajustados por produto. `w_recency` mais alto pra agentes de chat; `w_importance` mais alto pra agentes de conformidade; `w_relevance` mais alto pra agentes de recuperação.

### Mem0g e raciocínio temporal

Mem0g adiciona um detector de conflito. Quando um novo fato contradiz uma aresta existente, a aresta existente é marcada inválida mas não deletada. Consultas temporais ("qual era a cidade do usuário em março?") percorrem o subgrafo válido-na-temporal.

Esse é o comportamento de nível de conformidade que o padrão de invalidação da Letta generaliza.

### Números de benchmark

O paper do Mem0 reporta (2025):

- **LoCoMo** (memória de conversa longa): 91.6
- **LongMemEval** (memória episódica de longo horizonte): 93.4
- **BEAM 1M** (benchmark de memória de 1M tokens): 64.1

Baselines de comparação (LLM full-context 128k, armazenamento vector plano, KV plano) perdem todos por 10+ pontos. Benchmarks sozinhos não justificam escolha — forma operacional sim — mas os números mostram que o design de fusão não é erro de arredondamento.

### Taxonomia de escopo

Mem0 divide memória por escopo:

- **Memória de usuário** — persiste entre sessões, chaveada em `user_id`.
- **Memória de sessão** — persiste dentro de uma thread.
- **Memória de agent** — estado por instância de agent.

Toda escrita escolhe um escopo. Recuperação pode consultar entre escopos com pesos por escopo. Misturar escopos sem pensar é como você causa incidentes de "o assistente contou pra Alice sobre o projeto do Bob."

### Onde esse padrão dá errado

- **Deriva de embedding.** Resultados vector que parecem certos nas primeiras cem queries degradam conforme o corpus cresce. Adicione re-embedding periódico dos top-N registros mais usados.
- **Creep de schema KV.** `(user_id, type, entity)` parece simples até cada time adicionar seu próprio `type`. Audite o conjunto de tipos trimestralmente.
- **Explosão do graph.** Um extractor barulhento adiciona 50 arestas por mensagem. Limite escritas de graph por chamada `add`; descarte arestas de baixa confiança.

## Construa

`code/main.py` implementa o padrão de três armazenamentos com stdlib:

- `VectorStore` — similaridade por sobreposição de tokens simples como placeholder de embedding.
- `KVStore` — dict chaveada em `(user_id, fact_type, entity)`.
- `GraphStore` — arestas tipadas (sujeito, relação, objeto, válido).
- `Mem0` — fachada de nível superior com `add()`, `search()`, pontuação de fusão e recuperação consciente de escopo.
- Um trace detalhado numa conversa multi-usuário, multi-sessão.

Rode:

```
python3 code/main.py
```

A saída mostra três caminhos de recuperação separados mais o top-k fundido. Inverta os pesos de pontuação no topo do `main()` e veja a classificação mudar.

## Use

- **Mem0 (Apache 2.0)** — pronto pra produção. Self-host com Postgres + Qdrant + Neo4j ou use o cloud gerenciado.
- **Letta** — três níveis core/recall/archival; traga seus próprios backends vector e graph.
- **Zep** — alternativa comercial com KG temporal e extração de fatos.
- **Construções customizadas** — quando você precisa controle exato sobre o extractor (conformidade) ou pesos de fusão (agents de voz onde recenticidade domina).

## Entregue

`outputs/skill-hybrid-memory.md` gera um scaffold de memória de três armazenamentos com pontuador de fusão, taxonomia de escopo e invalidação temporal conectados.

## Exercícios

1. Substitua a similaridade vector de exemplo por um modelo de embedding real (sentence-transformers, Ollama, embeddings OpenAI). Meça recall@10 numa conversa longa sintética. A classificação deriva ao longo de 1000 escritas?
2. Adicione uma consulta temporal: `search(consulta, as_of=timestamp)`. Retorne só registros válidos naquele momento ou antes. Qual armazenamento precisa de mais trabalho?
3. Implemente um detector de conflito: se um fato que chega contradiz uma aresta de graph, invalide a aresta antiga e registre ambas. Teste em "usuário mora em Berlim" -> "usuário mora em Lisboa."
4. Porte o pontuador de fusão pra incluir uma dimensão `user_feedback` (curtida em registros recuperados). Como você evita gaming (agent só retorna registros que ele já gostou)?
5. Leia a documentação do Mem0 (`docs.mem0.ai`). Porte o exemplo pra chamadas de cliente `mem0`. Compare qualidade de recuperação nas mesmas 20 queries de teste.

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Hybrid memory | "Vector mais graph mais KV" | Três armazenamentos escritos em paralelo, fundidos na recuperação |
| Fact extraction | "Ingestão de memória" | Passo de LLM que quebra texto em tuplas (entidade, relação, fato) |
| Fusion scoring | "Ranking de relevância" | Soma ponderada de relevância, importância, recenticidade |
| Scope | "Namespace de memória" | user / session / agente — determina quem vê o quê |
| Mem0g | "Grafo de memória" | Arestas tipadas com validade temporal pra consultas de relação |
| Temporal invalidation | "Soft delete" | Marca arestas contraditórias como inválidas; nunca deleta |
| Embedding deriva | "Decomposição de recuperação" | Qualidade vector degrada conforme corpus cresça; re-embenda periodicamente |

## Leitura Complementar

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) — o paper original
- [Mem0 docs](https://docs.mem0.ai/platform/overview) — API de produção, SDKs, cloud gerenciado
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — o predecessor de contexto virtual
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) — o design irmão de três níveis
