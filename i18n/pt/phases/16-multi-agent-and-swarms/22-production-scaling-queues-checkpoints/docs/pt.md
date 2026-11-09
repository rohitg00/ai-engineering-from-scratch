# Escalada da produção  Coisas, pontos de controlo, durabilidade

> Escalada de sistemas multi-agentes para milhares de corridas simultâneas requer **durable execution** filas de trabalho mais pontos de verificação, para que qualquer trabalhador possa retomar qualquer corrida após qualquer acidente, desde que o tratamento do arrendamento, efeitos colaterais idempotentes e repetição determinista estejam em vigor.`thread_id`(Pós-grados por defeito); um trabalhador que se encontra em acidente libera um contrato de locação e outro trabalhador retoma.**MegaAgent**(arXiv:2408.09955) executou uma fila produtor-consumidor por agente com três estados (Idle / Processamento / Resposta) e coordenação de duas camadas (chat intra-grupo + chat administrador intergrupo). **Fiber/async**Bates thread-per-job para streaming LLM: os fios ficam inativos 99% do tempo à espera de tokens, fibras produzem cooperativamente em I/O.**FastAPI + Postgres + nothing else**Até que a carga provem o contrário  arquiteturas simples vão mais longe do que o esperado. Esta lição constrói um log de checkpoint durável, uma fila de trabalho por agente com transições de estado, uma demonstração de async versus thread e faz a regra pragmática "start simple".

**Type:** Learn + Build
**Languages:** Python (stdlib, `asyncio`, `sqlite3`), TypeScript
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problemas

Um protótipo de sistema multi-agente funciona em um laptop com três agentes em um ciclo de eventos em memória.

- Os agentes às vezes correm por horas (longas pesquisas, espera humana no circuito).
- Os processos de trabalho caem, a reinicialização perde estado.
- A carga máxima é 10x média; você precisa de escala horizontal.
- Os usuários pagam por agente, precisam de semântica para cobrar.

O loop de eventos em memória não faz nada disso. Você precisa de uma camada de execução durável por baixo. As opções canônicas de 2026 são:

1. Um motor de fluxo de trabalho com pontos de controlo (temporal, tempo de execução de LangGraph).
2. Uma fila de mensagens com uma loja estatal (Postgres + SQS/RabbitMQ).
3. Estruturas de modelo de atores (produtor-consumidor de MegaAgent por agente).
4. FastAPI + Postgres laminado à mão (argumento de Bedi).

Esta lição faz uma miniatura de cada uma.

## Conceptos

### Execução duradoura, padrão

Um motor de execução duradoura persiste no estado completo do programa após cada "passo" (superpasso, na linguagem de LangGraph).

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

Requisitos para que isto funcione:

- **Serializable state.**Todos os estados de agente têm de ser persistentes.
- **Deterministic resume.**Dado o mesmo estado e as mesmas entradas, o agente produz as mesmas ações (ou se afasta para um oráculo determinista externo para chamadas de LLM).
- **Idempotent side effects.**As chamadas externas (chamadas de ferramentas, pagamentos) devem ser idempotentes ou utilizar uma chave de deduplicação.

LangGraph escreve um ponto de verificação após cada super-passo; Temporal escreve após cada atividade; Restate usa periódicos de origem de eventos.

### Um ponto de controlo por passo

O tempo de execução de LangGraph é o exemplo trabalhado: cada agente tem um `thread_id`O estado é um ditado tipado; cada super-passo escreve uma linha para a tabela de pontos de controlo.`interrupt()`O tempo de execução persiste e libera o trabalhador.

Este é o projeto de produção de referência em abril de 2026.

### A fila de agentes da MegaAgent

arXiv:2408.09955 descreve uma experiência em escala: milhares de agentes simultâneos em um cluster. Arquitetura:

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

A coordenação de duas camadas permite que a conversa intragrupo aconteça densamente enquanto intergrupo permanece escassa  o padrão usado para manter os custos lineares em milhares de agentes.

### Assincronização vs. fio por trabalho

As chamadas LLM são I / O-ligadas. Um fio esperando para o próximo token é ocioso 99% do tempo. Os fios custam ~ 1 MB de RAM cada; em 10.000 chamadas simultâneas, que é 10 GB apenas para pilhas.

Fibras (Python `asyncio`, Go goroutines, Rust `tokio`A sincronização não é uma otimização, é a arquitetura.

Exceção: pós-processamento ligado à CPU (embedding, truques de tokenizer) ainda quer fios ou processos. Separar a sua camada de I/O da sua camada de CPU.

### O contraponto de Bedi

"Scaling Agentic Software" (Ashpreet Bedi, 2026) argumenta que a maioria das equipes sobreengenharia antes de terem medido carga.

- FastAPI + Postgres.
- Cada execução de agente é uma fila; estado atualizado no local com simultâneo otimista.
- Trabalhos de antecedência através de `pg_notify`Ou um simples trabalhador de Celery.
- Reprova a política no código de aplicação.

Para cargas com menos de ~ 100 executas simultâneas de agentes em tarefas gerenciáveis, muitas vezes é tudo o que você precisa.

A regra é: adotar estruturas duradouras de execução quando se encontra um problema concreto que as arquiteturas simples não podem resolver.

### Semântica de uma vez

Para operações de agente pago, é necessário "exatamente uma vez eficaz" (pelo menos uma entrega + consumidor idempotente).

- **Dedup key per run.**Inclui-o em todas as chamadas de efeitos colaterais.
- **Outbox pattern.**Os efeitos colaterais são escritos em uma tabela primeiro, depois executados por um processo separado.
- **Compensating transactions.**Quando um efeito colateral tiver sucesso, mas a sua escrita de rastreamento falhar, agende uma compensação.

Estes são padrões de engenharia de base de dados, não específicos do LLM. O imposto do LLM é apenas que as chamadas de LLM são lentas; tudo o resto são sistemas distribuídos padrão.

### Desdobramento do arco-íris

O sistema de pesquisa multi-agente da Anthropic usa "implementações de arco-íris": várias versões do agente runtime executam simultaneamente para que os agentes de longa duração não precisem ser mortos em cada implantação de código.

Isto é padrão para sistemas de estado de longa duração; a adaptação de 2026 é que os agentes podem viver por horas, por isso os ciclos de implantação devem acomodar.

### Lista de verificação da produção canónica

- Estado duradouro (checkpoints, snapshots, ou outbox + log reprodutivo).
- Efeitos secundários impotentes.
- Equipamento de controlo de dados
- Pelo menos uma entrega com dedup.
- Desdobramento de arco-íris/canários para cargas de trabalho de estado.
- Observabilidade: rastreamento por agente, auditoria super-passo, contador de retest.

```figure
sw-checkpoint-replay
```

## Construí-lo

`code/main.py`Implementos:

- `CheckpointStore` Registo de checkpoint com o SQLite com teclas de thread-id. Cada super-passo adiciona uma linha.
- `run_with_checkpoint(agent, thread_id)` simula um acidente no meio da corrida; um segundo trabalhador retoma a sua atividade no último ponto de controlo.
- `AgentQueue` por agente Máquina de estado de inatividade / processamento / resposta com uma pequena fila de trabalho.
- `demo_async_vs_threads()` executa 500 simultaneas "chamadas LLM" simuladas através de asyncio e através de fios; relata o relógio de parede e a memória de pico (aproximada).

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

A saída esperada: o ponto de verificação resume-se com sucesso após o crash simulado; versão async lida com 500 chamadas simultâneas em < 1s; versão de thread leva vários segundos e usa ordens de magnitude mais memória por unidade simultânea.

## Usá-lo

`outputs/skill-scaling-advisor.md`Aconselha sobre a escolha de execução durável: FastAPI + Postgres, LangGraph runtime, Temporal ou personalizado. Calibrado por carga, necessidades de retenção de estado e frequência de implantação.

## Envia-o

Endurecimento da produção canónica:

- **Start simple (Bedi's rule).**FastAPI + Postgres até que a medida falhe.
- **Instrument everything before optimizing.**Histograma de latência por execução, tempo por passo, contagem de retest, categorização de falhas.
- **Outbox pattern for side effects.**Especialmente pagamentos e chamadas externas de API.
- **Rainbow deploys.**Nunca mate agentes em voo durante as operações.
- **Adopt durable-execution engines (Temporal / LangGraph / Restate) when**Se você encontrar problemas específicos: horas de espera humana no circuito, coordenação interregional, políticas complexas de retomada/compensação.
- **Async for the I/O layer.**Fios apenas para pós-processamento ligado à CPU.

## Exercícios

1. Corra .`code/main.py`- Confirmar o trabalho do currículo do ponto de controlo; medir a diferença de sincronia entre os filos.
2. Implementar um **outbox**Tabela: cada chamada de ferramenta escreve para a caixa de saída primeiro, em seguida, uma rotina/tarefa separada é executada. Verifique a idempotencia executando a chamada de ferramenta duas vezes.
3. Simulação de um**rainbow deploy**: duas versões simultâneas de execução; encaminhar metade das novas thread_ids para cada uma; confirmar que os threads de voo na versão antiga não são interrompidos.
4. Leia o documento de tempo de execução do LangGraph (linkado abaixo). Identifique quais características do tempo de execução levaria mais tempo para ser replicadas em uma versão FastAPI + Postgres rolada à mão. É uma razão para adotar, ou você pode adiar?
5. Leia MegaAgent (arXiv:2408.09955) Seção 3. A coordenação de duas camadas (intra-grupo + intergrupo chat de administrador) é explícita. Esboce como você mapearia isso para uma fila de mensagens com duas famílias de fila.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Durable execution | "Persist the program state" | Engine writes state after each super-step; crash recovery is deterministic. |
| Super-step | "Transactional boundary" | Unit of work between checkpoints. LangGraph term. |
| thread_id | "Agent run identifier" | Key that binds checkpoints and resume logic. |
| Idempotency | "Safe to retry" | Repeating a side effect produces the same result as one attempt. |
| Outbox pattern | "Decouple side effects" | Write intent to a table; a separate executor performs and marks done. |
| At-least-once delivery | "Possible duplicates" | Message queue semantics; dedup key makes consumer effective-once. |
| Rainbow deploy | "Overlapping versions" | Multiple runtime versions concurrent during long-running workloads. |
| Async fiber | "Cooperative yielding" | User-mode concurrency; cheap compared to threads for I/O-bound loads. |
| Checkpoint | "State snapshot" | Serialized state at a super-step boundary; key for resume. |

## Mais leitura

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) Design de tempo de execução de LangGraph
- [MegaAgent](https://arxiv.org/abs/2408.09955) Coordenação de duas camadas em milhares de agentes simultâneos
- [Matrix](https://arxiv.org/abs/2511.21686) estrutura descentralizada com filas de mensagens como substrato de coordenação
- [Temporal docs](https://docs.temporal.io/) motor de fluxo de trabalho de referência para execução duradoura
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Lições de produção, incluindo o desdobramento do arco-íris
