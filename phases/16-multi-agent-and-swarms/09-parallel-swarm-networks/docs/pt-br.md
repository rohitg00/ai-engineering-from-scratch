# Arquiteturas Paralelas / Swarm / Em Rede

> Contraste com supervisor: sem decisor central. Agents leem um event bus compartilhado, pegam trabalho de forma assíncrona, escrevem resultados de volta. LangGraph suporta explicitamente "Swarm Architecture" pra ambientes descentralizados e dinâmicos. Matrix (arXiv:2511.21686) representa tanto fluxo de controle quanto fluxo de dados como mensagens serializadas passadas por filas distribuídas pra eliminar o gargalo do orquestrador. O tradeoff é explícito: determinismo e rastreabilidade por escalabilidade. Swarm encaixa em tarefas com muitos sub-problemas independentes; não encaixa em tarefas que precisam de um plano coeso único.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib, `threading`, `queue`)
**Pré-requisitos:** Fase 16 · 05 (Padrão Supervisor), Fase 16 · 04 (Modelo Primitivo)
**Tempo:** ~75 minutos

## Problema

Supervisor escala pra poucos trabalhadores. E pra centenas? O próprio supervisor vira o gargalo: cada decisão sobre quem faz o quê passa por um agent. Um passo de plano lento trava o sistema inteiro.

Arquiteturas swarm invertem o design. Em vez de um planejador central despachando trabalho, trabalhadores pegam trabalho de uma fila compartilhada. A "coordenação" está nas semânticas do event bus. Sem orquestrador; o sistema escala até a fila não aguentar.

## Conceito

### A forma

```
                ┌──── shared queue ────┐
                │                      │
       ┌────────┼────────┐  ◄──────┬───┘
       ▼        ▼        ▼         │
     Worker  Worker  Worker   Worker
      A       B       C        D
       │        │        │         │
       └────────┴────────┴─────────┘
                 │
                 ▼
            results pool
```

Sem orquestrador. Cada trabalhador repete: puxa uma tarefa, processa, escreve resultado (e opcionalmente enfileira follow-ups).

### Quando swarm encaixa

- **Muitas tarefas independentes.** Scraping, transformação, classificação. Tarefas não dependem umas das outras.
- **Trabalho de duração variável.** Se algumas tarefas levam 100ms e outras 10s, um swarm balanceia carga automaticamente — trabalhadores rápidos puxam próximos jobs. Um supervisor precisa antecipar duração.
- **Throughput sobre determinismo.** Você se importa com tempo total de conclusão, não ordem estrita.

### Quando swarm falha

- **Workflows ordenados.** Se o passo 3 precisa da saída do passo 2, um swarm arrisca o passo 3 disparar antes do passo 2 terminar.
- **Tarefas de plano global.** Perguntas de pesquisa complexas se beneficiam de um planejador. Um swarm de pesquisadores produz fatos independentes, não um relatório coerente.
- **Debug.** Sem log central e trabalho assíncrono, reproduzir um bug é caro.

### Matrix (arXiv:2511.21686)

Matrix é o paper de 2025 que leva swarm à sua conclusão natural: tanto fluxo de controle quanto fluxo de dados são mensagens serializadas em filas distribuídas. Sem coordenador central. Tolerância a falhas vem da durabilidade das mensagens. Escalabilidade é problema do broker de mensagens, não do sistema.

Contribuição: um modelo de programação onde coordenação multi-agent é "qual tópico de mensagem esse agent assina?" em vez de "qual agent o supervisor escolhe a seguir?" Isso torna o sistema parecido com uma malha de eventos pub/sub.

### A Swarm Architecture do LangGraph

As docs de 2025 do LangGraph descrevem explicitamente "Swarm Architecture" como um dos padrões multi-agent: agents são nós, mas arestas formam um grafo direcionado com ciclos e qualquer nó pode ser ativado a partir do pool. Um trabalhador escolhe do trabalho disponível por condição, não por atribuição de supervisor.

### Modo de falha: starvation e hot-spotting

Se todos os trabalhadores puxam a tarefa disponível mais rápido, tarefas de longa duração nunca são escolhidas até serem as únicas restantes. Starvation clássica de fila.

Mitigações:
- Filas de prioridade com envelhecimento explícito (aumenta prioridade com tempo de espera).
- Especialização de trabalhadores: alguns trabalhadores só pegam tarefas "longas."
- Back-pressure: limite quantas tarefas rápidas entram na fila.

### O link de roteamento baseado em conteúdo

Swarm se combina naturalmente com roteamento baseado em conteúdo (Lição 22). Em vez de uma fila genérica, tenha uma fila por tipo de mensagem. Trabalhadores especializados assinam só seu tipo. Isso é a base pra arquiteturas de message-bus que escalam pra milhares de agents.

## Construa

`code/main.py` implementa um swarm de 4 threads de trabalhador puxando de uma `queue.Queue` compartilhada. Tarefas têm durações variáveis (algumas rápidas, algumas lentas). A demo contrasta:

- **Baseline sequencial:** um trabalhador processa todas as tarefas em série.
- **Atribuição fixa:** cada tarefa pré-atribuída a um trabalhador específico (estilo supervisor).
- **Swarm:** trabalhadores puxam de uma fila compartilhada.

Swarm balanceia carga automaticamente; atribuição fixa deixa trabalhadores rápidos ociosos quando sua tarefa atribuída é lenta.

Execute:

```
python3 code/main.py
```

Saída mostra contagem de tarefas por trabalhador (swarm distribui desigualmente mas de forma ótima) e tempos de relógio.

## Use

`outputs/skill-swarm-fit.md` avalia se uma tarefa deve usar swarm vs supervisor. Entradas: independência de tarefas, variância de duração, requisitos de ordenação, necessidades de debugabilidade.

## Entregue

Checklist:

- **Fila de prioridade com envelhecimento.** Previne starvation de tarefas longas.
- **Idempotência de trabalhador.** Uma tarefa pode ser puxada mais de uma vez se um trabalhador cair no meio da execução. Trabalhadores devem ser idempotentes.
- **Fila durável.** Use Kafka, Redis Streams ou fila backed por banco pra produção. `queue.Queue` é só em memória.
- **Observabilidade por tarefa.** Cada tarefa tem um trace ID; cada trabalhador loga início/fim com ele.
- **Back-pressure.** Se a fila cresce mais rápido que os trabalhadores drenam, freie o produtor.

## Exercícios

1. Execute `code/main.py`. Quão mais rápido é swarm que sequencial no workload de duração variável? Quão mais rápido que atribuição fixa?
2. Adicione uma variante de fila de prioridade (use `queue.PriorityQueue`). Atribua prioridade pelo campo "importância" da tarefa. Observe se tarefas de baixa prioridade alguma vez sofrem starvation sob carga contínua.
3. Implemente um detector de hot-spot: logue quando qualquer trabalhador processa 3× mais tarefas que o trabalhador mais lento. O que isso indica sobre a distribuição de duração das tarefas?
4. Leia o resumo do paper Matrix (arXiv:2511.21686) e a Seção 3. Identifique um tradeoff específico que o Matrix aceita (ganho de escalabilidade) e um que abandona (rastreabilidade, determinismo).
5. Converta a demo de swarm pra usar uma `queue.Queue` de tuplas (task_type, payload), com trabalhadores assinando só tipos específicos. Quais regras de roteamento fazem sentido quando tarefas são heterogêneas?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Arquitetura swarm | "Agents descentralizados" | Trabalhadores puxam de fila compartilhada; sem orquestrador central. |
| Event bus | "Agents assinam tópicos" | Broker de mensagens que roteia tarefas pra trabalhadores por tipo ou conteúdo. |
| Starvation | "Tarefa nunca roda" | Tarefa de baixa prioridade nunca é escolhida porque trabalho de prioridade maior chega continuamente. |
| Hot-spotting | "Um trabalhador afoga" | Desequilibrio de carga onde um trabalhador recebe a maioria das tarefas. |
| Back-pressure | "Freie o produtor" | Mecanismo que sinaliza pro upstream parar de produzir quando a fila enche. |
| Trabalhador idempotente | "Seguro pra re-rodar" | Uma tarefa processada duas vezes produz o mesmo resultado. Necessário porque trabalhadores podem cair no meio da execução. |
| Fila durável | "Sobrevive a crashes" | Fila backed por disco ou armazenamento replicado; tarefas não são perdidas quando um trabalhador cai. |
| Framework Matrix | "Swarm full de passagem de mensagens" | Tanto dados quanto fluxo de controle são mensagens serializadas em filas distribuídas. |

## Leitura Complementar

- [Workflows e agents LangGraph — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — suporte explícito a swarm
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) — swarm full de passagem de mensagens
- [Engenharia Anthropic — por que supervisor e não swarm em Research](https://www.anthropic.com/engineering/multi-agent-request-system) — por que um sistema de produção específico escolheu deliberadamente supervisor sobre swarm
- [Docs do modelo actor AutoGen v0.4](https://microsoft.github.io/autogen/stable/) — a reescrita event-driven actor, mais perto de swarm que o GroupChat do v0.2
