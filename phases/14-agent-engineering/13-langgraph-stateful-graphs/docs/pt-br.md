# LangGraph: Grafos com Estado e Execução Durável

> LangGraph é a referência de 2026 pra orquestração com estado em baixo nível. Agent é uma máquina de estados; nós são funções; arestas são transições; estado é imutável e checkpointed após cada etapa. Retome de qualquer falha exatamente onde parou.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 12 (Workflow Patterns)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Descrever o modelo central do LangGraph: máquina de estados com estado imutável, nós-função, arestas condicionais e checkpoints pós-etapa.
- Nomear as quatro capacidades que a documentação destaca: execução durável, streaming, human-in-the-loop e memória abrangente.
- Explicar as três topologias de orquestração que LangGraph suporta: supervisor, peer-to-peer (swarm), hierárquica (subgrafos aninhados).
- Implementar um grafo de estados com stdlib com estado imutável, arestas condicionais e ciclo de checkpoint/resume.

## O Problema

Agents e workflows compartilham um problema: quando uma execução de 40 etapas falha na etapa 38, você quer retomar da etapa 38, não recomeçar. Modelos de estado de segunda classe deixam operadores fuçando retries ao redor de uma biblioteca que assume execuções novas.

A resposta de design do LangGraph: estado é um objeto tipado de primeira classe, mutações são explícitas e checkpoints persistem após cada nó. Resume é uma chamada `load_state(session_id)`.

## O Conceito

### O grafo

Um grafo é definido por:

- **Tipo de estado.** Um dict tipado (ou modelo Pydantic) que todo nó lê e muta.
- **Nós.** Funções puras `(state) -> state_update`. Atualizações são mescladas no estado após retorno.
- **Arestas.** Transições condicionais ou diretas entre nós.
- **Entrada e saída.** Nós sentinelas `START` e `END` marcam a fronteira.

Exemplo: um agent com nós `classify`, `refund`, `bug`, `sales`, `done` — um workflow de roteamento como grafo.

### Execução durável

Após cada nó retornar, o runtime serializa o estado e escreve num checkpointer (SQLite, Postgres, Redis, custom). Em falha na etapa N, o runtime pode `resume(session_id)` e retomar da etapa N+1 com estado exato.

A documentação do LangGraph destaca explicitamente usuários de produção onde isso importa: Klarna, Uber, J.P. Morgan. A alegação não é a forma do grafo; é que a forma do grafo + checkpointing torna recuperação barata.

### Streaming

Todo nó pode ceder saída parcial. O grafo emite eventos de delta por nó pro chamador pra que UIs atualizem enquanto o grafo roda.

### Human-in-the-loop

Inspecione e modifique o estado entre nós. Implementações: pausa antes de um nó crítico, expõe o estado a um humano, aceita modificações, resume. O checkpointer facilita porque o estado já está serializado.

### Memória

Curto prazo (dentro de uma execução — histórico de conversa no estado) e longo prazo (entre execuções — persistente via checkpointer mais um armazenamento de longo prazo separado). LangGraph integra com sistemas de memória externos (Mem0, custom) via ferramentas.

### Três topologias

1. **Supervisor.** LLM roteador central despacha pra subagents especialistas. `create_supervisor()` em `langgraph-supervisor` (embora a equipe do LangChain em 2026 recomende fazer isso via chamadas de ferramenta diretamente pra mais controle de contexto).
2. **Swarm / peer-to-peer.** Agents passam diretamente via superfície de ferramentas compartilhada. Sem roteador central.
3. **Hierárquica.** Supervisores gerenciando sub-supervisores, implementados como subgrafos aninhados.

### Onde esse padrão dá errado

- **Checkpoints pequenos demais.** Só checkpointar turnos de conversa deixa estado de ferramenta e escritas de memória irrecuperáveis. Estado completo deve serializar.
- **Nós não determinísticos.** Resume assume que inputs de nó produzem a mesma atualização de estado. Seeds aleatórias, tempo de relógio, APIs externas devem ser capturados.
- **Uso excessivo de arestas condicionais.** Um grafo com toda aresta condicional é uma máquina de estados que não dá pra raciocinar. Prefira cadeias lineares com ramos ocasionais.

## Construa

`code/main.py` implementa um grafo de estados com stdlib:

- `State` — dict tipado com `messages`, `step`, `route`, `output`, `human_approval`.
- `Node` — callable que pega estado e retorna dict de atualização.
- `StateGraph` — nós + arestas + arestas condicionais + run + resume.
- `SQLiteCheckpointer` (fake em memória) — serializa estado após cada nó; `load(session_id)` restaura.
- Um grafo demo: classify -> branch(refund / bug / sales) -> gate humano -> send.

Rode:

```
python3 code/main.py
```

O trace mostra a primeira execução falhando no gate humano, persistência e depois resume produzindo a saída final.

## Use

- **LangGraph** — referência, pronto pra produção. Use `create_react_agent`, `create_supervisor` ou construa seu próprio grafo.
- **AutoGen v0.4** (Aula 14) — alternativa de modelo ator pra cenários de alta concorrência.
- **Claude Agent SDK** (Aula 17) — harness gerenciado com session store embutido.
- **Custom** — quando você precisa de controle exato sobre forma do estado ou backend de checkpointer.

## Entregue

`outputs/skill-state-graph.md` gera um grafo de estados formato LangGraph em qualquer runtime alvo com checkpointing e resume conectados.

## Exercícios

1. Adicione uma aresta condicional de `classify` pra `end` quando a confiança da classificação estiver abaixo de um limiar. Retome a execução depois que um humano definir `route` manualmente.
2. Troque o fake estilo SQLite por um checkpointer SQLite real. Meça overhead de serialização por etapa.
3. Implemente arestas paralelas: dois nós rodam concorrentemente, mesclam por um reducer custom. O que estado imutável compra aqui?
4. Leia a referência de `langgraph-supervisor`. Porte o exemplo pra `create_supervisor`. Compare as formas de trace.
5. Adicione streaming: cada nó cede estado parcial enquanto roda. Imprima os deltas conforme chegam.

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| State graph | "Agent como máquina de estados" | Estado tipado + nós + arestas + reducers |
| Checkpointer | "Backend de persistência" | Serializa estado após cada nó; permite resume |
| Reducer | "Mesclador de estado" | Função que combina estado atual com atualização de nó |
| Conditional edge | "Ramo" | Aresta escolhida por uma função de estado |
| Subgraph | "Grafo aninhado" | Grafo usado como nó dentro de outro grafo |
| Durable execution | "Resume de falha" | Reinicia no último nó bem-sucedido com estado exato |
| Supervisor | "LLM roteador" | Despachante central pra subagents especialistas |
| Swarm | "Agents P2P" | Agents passam via ferramentas compartilhadas; sem roteador central |

## Leitura Complementar

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — a documentação de referência
- [langgraph-supervisor reference](https://reference.langchain.com/python/langgraph/supervisor/) — API do padrão supervisor
- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — alternativa de modelo ator
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — session store e subagents
