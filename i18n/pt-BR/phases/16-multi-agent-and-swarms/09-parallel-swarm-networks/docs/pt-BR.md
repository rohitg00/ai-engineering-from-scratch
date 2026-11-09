# Arquiteturas paralelas / conjuntas / em rede

> Contraste com o supervisor: não há decisores centrais. Os agentes lêem um ônibus de eventos compartilhados, começam o trabalho de forma assíncrona, e escrevem os resultados. LangGraph suporta explícitamente "Arquitetura de Enxurro" para ambientes descentralizados e dinâmicos. Matrix (arXiv:2511.21686) representa tanto o controle quanto o fluxo de dados como mensagens serializadas passadas por filas distribuídas para eliminar o gargalho de engarrafamento do orquestador. A compensação é explícita: determinismo e rastreabilidade para escalabilidade. O conjunto de tarefas combina com muitos subproblemas independentes; não se encaixa em tarefas que necessitam de um único plano coerente.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`, `queue`), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern), Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Problemas

O supervisor passa a ser um número limitado de trabalhadores. E se forem centenas? O próprio supervisor torna-se o gargalo de engarrafamento: cada decisão sobre quem faz o que canaliza através de um agente. Um passo lento do plano impede todo o sistema.

Arquiteturas de enxames inverter o design. Em vez de um planejador central despachando o trabalho, os trabalhadores escolhem o trabalho de uma fila compartilhada. A "coordenação" é cozida na semântica do ônibus de eventos.

## Conceptos

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

Não há orquestra. Cada trabalhador repete: puxar uma tarefa, processar, escrever o resultado (e opcionalmente fazer a sequência).

### Quando o enxame se encaixa

- **Many independent tasks.**Descarregamento, transformação, classificação.
- **Variable-duration work.**Se algumas tarefas demoram 100ms e outras 10s, um enxame balança carga automaticamente  trabalhadores rápidos puxar os próximos trabalhos.
- **Throughput over determinism.**Tu queres o tempo total de conclusão, não a ordem rigorosa.

### Quando o enxame falha

- **Ordered workflows.**Se o passo 3 precisar da saída do passo 2, um enxame corre o risco de disparar o passo 3 antes do passo 2 ser feito.
- **Global-plan tasks.**As questões de pesquisa complexas beneficiam de um planejador.
- **Debugging.**Sem registro central e trabalho assíncrono, a reprodução de um bug é cara.

### Matrix (arXiv:2511.21686)

Matrix é o documento de 2025 que leva o enxame à sua conclusão natural: tanto o fluxo de controle quanto o fluxo de dados são mensagens serializadas em fileiras distribuídas. Não há coordenador central. Tolerança de falha vem da durabilidade da mensagem. Escalabilidade é o problema do corretor de mensagens, não do sistema.

Contribuição: um modelo de programação em que a coordenação entre vários agentes é "a que assunto de mensagem este agente se inscreve?" em vez de "qual agente o supervisor escolhe a seguir?" Isso faz com que o sistema pareça uma malha de evento pub/sub.

### Enxames em quadros gráficos

Os documentos de LangGraph 2025 descrevem explicitamente "Arquitetura de Enxurro" como um dos padrões multi-agentes: os agentes são nós, mas as bordas formam um gráfico direcionado com ciclos e qualquer nó pode ser ativado a partir do pool.

### Modo de falha: fome e manchas quentes

Se todos os trabalhadores fizerem a tarefa mais rápida disponível, as tarefas de longa duração nunca serão escolhidas até que sejam as únicas que restam.

Mitigações:
- Coisas de prioridade com envelhecimento explícito (aumentar a prioridade com o tempo de espera).
- Especialização dos trabalhadores: alguns trabalhadores só assumem tarefas "longas".
- Pressão de retorno: limite o número de tarefas rápidas que entram na fila.

### O link de roteamento baseado em conteúdo

Os pares de conjuntos são naturalmente com roteamento baseado em conteúdo (Lessão 22). Em vez de uma fila genérica, tem uma fila por tipo de mensagem.

```figure
sw-work-stealing
```

## Construí-lo

`code/main.py`Implementa um enxame de 4 fios de trabalhadores puxando de um compartilhado `queue.Queue`As tarefas têm durações variáveis (alguns rápidos, outros lentos).

- **Sequential baseline:**Um trabalhador processa todas as tarefas em série.
- **Fixed assignment:**Cada tarefa pré-assignada a um trabalhador específico (estilo de supervisor).
- **Swarm:**Os trabalhadores se retiram de uma fila compartilhada.

As balanças de massa carregam-se automaticamente; a atribuição fixa deixa os trabalhadores rápidos ociosos quando a tarefa atribuída é lenta.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

A saída mostra o número de tarefas por trabalhador (a distribuição do enxame é desigual mas ótima) e os tempos do relógio de parede.

## Usá-lo

`outputs/skill-swarm-fit.md`Avalia se uma tarefa deve utilizar swarm vs supervisor. Input: independência da tarefa, variação de duração, requisitos de encomenda, necessidades de depuração.

## Envia-o

Lista de verificação:

- **Priority queue with aging.**Prevenção da fome de longas tarefas.
- **Worker idempotency.**A tarefa pode ser realizada mais de uma vez se um trabalhador acidentar no meio da corrida.
- **Durable queue.**Use Kafka, Redis Streams ou uma fila de produção com base em banco de dados. `queue.Queue`É apenas na memória.
- **Observability per task.**Cada tarefa tem um identificador de rastreamento; todos os trabalhadores registam o início/fim com ele.
- **Back-pressure.**Se a fila crescer mais rápido do que os trabalhadores a drenarem, retarda o produtor.

## Exercícios

1. Corra .`code/main.py`Quanto mais rápido é o enjambre do que o sequencial na carga de trabalho de duração variável?
2. Adicionar uma variante da fila de prioridade (utilização `queue.PriorityQueue`Acompanhe a prioridade por tarefa no campo "importância". Observe se as tarefas de baixa prioridade já passam por fome sob carga contínua.
3. Implementar um detector de pontos de calor: registar quando um trabalhador processa 3x mais tarefas do que o trabalhador mais lento.
4. Leia o resumo do artigo da Matrix (arXiv:2511.21686) e a Seção 3. Identifique um tradeoff específico que a Matrix aceita (ganho de escalabilidade) e um que ele desiste (traçabilidade, determinismo).
5. Converte a demo do enxame para usar um `queue.Queue`As regras de roteamento são sensíveis quando as tarefas são heterogêneas.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Swarm architecture | "Decentralized agents" | Workers pull from shared queue; no central orchestrator. |
| Event bus | "Agents subscribe to topics" | Message broker that routes tasks to workers by type or content. |
| Starvation | "Task never runs" | Low-priority task never gets picked because higher-priority work arrives continuously. |
| Hot-spotting | "One worker drowns" | Load imbalance where one worker gets most tasks. |
| Back-pressure | "Slow down the producer" | Mechanism that signals upstream to stop producing when the queue fills up. |
| Idempotent worker | "Safe to re-run" | A task processed twice produces the same result. Required because workers may crash mid-run. |
| Durable queue | "Survives crashes" | Queue backed by disk or replicated storage; tasks are not lost when a worker crashes. |
| Matrix framework | "Full message-passing swarm" | Both data and control flow are serialized messages on distributed queues. |

## Mais leitura

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Apoio explícito do enxame
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) Enxame completo de mensagens
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) por que um sistema de produção específico escolheu explicitamente o supervisor em vez do enxame
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) o ator de eventos-driven reescrever, mais perto do enjambre do que o GroupChat de v0.2
