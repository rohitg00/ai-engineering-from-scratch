# Escala em Produção — Filas, Checkpoints, Durabilidade

> Escalar sistemas multi-agente pra milhares de execuções concorrentes requer **execução durável**. O runtime do LangGraph escreve um checkpoint após cada super-step chaveado por `thread_id` (Postgres por default); crashes de worker liberam um lease e outro worker retoma. Agents podem dormir indefinidamente esperando input humano. **MegaAgent** (arXiv:2408.09955) rodou uma fila produtor-consumidor por agente com três estados (Idle / Processing / Response) e coordenação em duas camadas (chat intra-grupo + chat admin inter-grupo). **Fiber/async** supera thread-por-job pra streaming de LLM: threads ficam ociosas 99% do tempo esperando tokens, fibers cedem cooperativamente em I/O. Contra-ponto: o "Scaling Agentic Software" de Ashpreet Bedi defende **FastAPI + Postgres + mais nada** até que a carga prove o contrário — arquiteturas simples vão mais longe do que esperado. Esta aula constrói um log de checkpoint durável, uma fila de trabalho por agente com transições de estado, uma demo async-vs-thread e fixa a regra pragmática "comece simples".

**Tipo:** Aprender + Construir
**Idiomas:** Python (stdlib, `asyncio`, `sqlite3`)
**Pré-requisitos:** Fase 16 · 09 (Redes Swarm Paralelas), Fase 16 · 13 (Memória Compartilhada)
**Tempo:** ~75 minutos

## Problema

Um protótipo de sistema multi-agente funciona num laptop com três agentes em um loop de eventos em memória. Você vai pra produção:

- Agents às vezes rodam por horas (pesquisa longa, waits de human-in-the-loop).
- Processos de worker crasham. Reiniciar perde estado.
- Pico de carga é 10x a média; você precisa de escalabilidade horizontal.
- Usuários pagam por execução de agent; você precisa de semântica exactly-once pro cobrança.

O loop de eventos em memória não faz nenhuma disso. Você precisa de uma camada de execução durável por baixo. As opções canônicas de 2026 são:

1. Uma engine de workflow com checkpoints (Temporal, runtime LangGraph).
2. Uma message queue com armazenamento de estado (Postgres + SQS/RabbitMQ).
3. Frameworks de modelo actor (produtor-consumidor por agente do MegaAgent).
4. FastAPI + Postgres feito à mão (argumento do Bedi).

Esta aula constrói uma miniatura de cada uma.

## Conceito

### Execução durável, o padrão

Uma engine de execução durável persiste o estado completo do programa após cada "step" (super-step, na linguagem do LangGraph). Em caso de crash:

```
worker crasha no meio do step
  -> timeout do lease
  -> outro worker pega o thread_id
  -> retoma do último checkpoint
  -> sem efeitos colaterais duplicados
```

Requisitos pra isso funcionar:

- **Estado serializável.** Todo estado do agente tem que ser persistível. Closures de função com conexões ao banco de dados vivas não sobrevivem.
- **Retoma determinística.** Dados o mesmo estado e as mesmas entradas, o agente produz as mesmas ações (ou delega pra um oracle determinístico externo pra chamadas de LLM).
- **Efeitos colaterais idempotentes.** Chamadas externas (chamadas de ferramenta, pagamentos) devem ser idempotentes ou usar uma chave de desduplicação.

LangGraph escreve um checkpoint após cada super-step; Temporal escreve após cada atividade; Restate usa journals event-sourced. Todos três implementam o mesmo padrão.

### O runtime do LangGraph

Cada agente tem um `thread_id`; estado é um dict tipado; cada super-step escreve uma linha na tabela de checkpoints. Na retoma, o runtime repete a partir do último checkpoint, não do zero. Agents podem `interrupt()` esperando input humano; o runtime persiste e libera o worker. Quando input chega, qualquer worker pode retomar.

Esse é o design de referência em produção em abril de 2026.

### A fila por agente do MegaAgent

arXiv:2408.09955 descreve um experimento de escala: milhares de agentes concorrentes num cluster. Arquitetura:

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- mensagens dirigidas ao agente i
  out_queue  -> respostas + efeitos colaterais

coordenadores:
  chat intra-grupo  (agents no mesmo grupo)
  chat admin inter-grupo  (routing de alto nível)
```

A coordenação em duas camadas permite que a conversa intra-grupo aconteça densamente enquanto inter-grupo fica esparso — o padrão usado pra manter o custo linear em milhares de agents.

### Async vs thread-por-job

Chamadas de LLM são I/O-bound. Uma thread esperando o próximo token está ociosa 99% do tempo. Threads custam ~1MB de RAM cada; com 10.000 chamadas concorrentes, são 10GB só pra stacks.

Fibers (`asyncio` do Python, goroutines do Go, `tokio` do Rust) cedem cooperativamente em I/O. As mesmas 10.000 chamadas cabem confortavelmente no processo. Na escala de LLM-agent, async não é uma otimização — é a arquitetura.

Exceção: pós-processamento CPU-bound (embedding, truques de tokenizer) ainda quer threads ou processos. Separe sua camada de I/O da camada de CPU.

### O contra-ponto do Bedi

"Scaling Agentic Software" (Ashpreet Bedi, 2026) argumenta que a maioria dos times super-engineera antes de medir a carga. O default pragmático:

- FastAPI + Postgres.
- Cada execução de agente é uma linha; estado atualizado in-place com concorrência otimista.
- Jobs em background via `pg_notify` ou um worker Celery simples.
- Política de retry no código da aplicação.

Pra cargas abaixo de ~100 execuções concorrentes de agente em tarefas gerenciáveis, isso geralmente é tudo que você precisa. Atualize quando medir falhando.

A regra: adote frameworks de execução durável quando atingir um problema concreto que arquiteturas simples não resolvem. Adoção prematura queima tempo com cerimônias que não compensam.

### Semântica exactly-once

Pra execuções de agente pagas, você precisa de "effective exactly-once" (entrega pelo menos uma vez + consumidor idempotente). As movimentações de engenharia:

- **Chave de desduplicação por execução.** Inclua em toda chamada de efeito colateral.
- **Padrão outbox.** Efeitos colaterais escrevem numa tabela primeiro, depois um processo separado executa. Ambos passos idempotentes.
- **Transações compensatórias.** Quando um efeito colateral succeede mas a escrita de tracking falha, agende uma compensação.

São padrões de engenharia de banco de dados, não eespecificaçãoíficos de LLM. O imposto de LLM é só que chamadas de LLM são lentas; todo o resto é sistemas distribuídos padrão.

### Deploy rainbow

O sistema de pesquisa multi-agente da Anthropic usa "rainbow deploys": múltiplas versões do runtime de agente rodam simultaneamente pra que agentes de execução longa não precisem ser mortos a cada implantação de código. Canary de novas versões em um fatia de tráfego; aposente versões antigas quando seus agentes terminarem.

Isso é padrão pra sistemas stateful de execução longa; a adaptação de 2026 é que agentes podem viver por horas, então ciclos de implantação precisam acomodar isso.

### A checklist canônica de produção

- Estado durável (checkpoints, snapshots, ou outbox + log reproduzível).
- Efeitos colaterais idempotentes.
- Camada de I/O async pra chamadas de LLM.
- Entrega pelo menos uma vez com desduplicação.
- Deploy rainbow/canary pra workloads stateful.
- Observabilidade: rastros por agent, auditoria de super-step, contador de retry.

## Construir

`code/main.py` implementa:

- `CheckpointStore` — log de checkpoints com SQLite com chaves de thread-id. Cada super-step acrescenta uma linha.
- `run_with_checkpoint(agent, thread_id)` — simula um crash no meio da execução; um segundo worker retoma do último checkpoint.
- `AgentQueue` — máquina de estados Idle / Processing / Response por agente com uma fila de trabalho pequena.
- `demo_async_vs_threads()` — roda 500 "chamadas de LLM" simuladas concorrentes via asyncio e via threads; reporta tempo de parede e memória de pico (aproximada).

Execute:

```
python3 code/main.py
```

Saída esperada: retoma de checkpoint funciona após crash simulado; versão async lida com 500 chamadas concorrentes em < 1s; versão com threads leva vários segundos e usa ordens de magnitude mais memória por unidade concorrente.

## Usar

`outputs/skill-scaling-advisor.md` aconselha sobre escolha de execução durável: FastAPI + Postgres, runtime LangGraph, Temporal ou custom. Calibrado por carga, necessidades de retenção de estado e frequência de deploy.

## Em produção

Endurecimento canônico em produção:

- **Comece simples (regra do Bedi).** FastAPI + Postgres até medir falhando.
- **Instrumente tudo antes de otimizar.** Histograma de latência por execução, tempo por step, contagem de retry, categorização de falhas.
- **Padrão outbox pra efeitos colaterais.** Eespecificaçãoialmente pagamentos e chamadas de API externas.
- **Deploys rainbow.** Nunca mate execuções de agente em andamento durante deploys.
- **Adote engines de execução durável (Temporal / LangGraph / Restate) quando** atingir problemas eespecificaçãoíficos: waits de human-in-the-loop de horas, coordenação cross-region, políticas complexas de retry/compensação.
- **Async pra camada de I/O.** Threads só pra pós-processamento CPU-bound.

## Exercícios

1. Execute `code/main.py`. Confirme que a retoma de checkpoint funciona; meça a diferença de concorrência async vs thread.
2. Implemente uma tabela **outbox**: toda chamada de ferramenta escreve na outbox primeiro, depois uma goroutine/task separada executa. Verifique idempotência rodando a chamada duas vezes.
3. Simule um **deploy rainbow**: duas versões concorrentes do runtime; route metade dos novos thread_ids pra cada; confirme que threads em andamento na versão antiga não são interrompidas.
4. Leia a documentação do runtime do LangGraph (link abaixo). Identifique quais features do runtime levariam mais tempo pra replicar num FastAPI + Postgres feito à mão. Isso é razão pra adotar, ou você pode adiar?
5. Leia o MegaAgent (arXiv:2408.09955) Seção 3. A coordenação em duas camadas (intra-grupo + chat admin inter-grupo) é explícita. Esboce como você mapearia isso pra uma message queue com duas famílias de filas.

## Termos-chave

| Termo | O que dizem | O que realmente significa |
|------|----------------|------------------------|
| Execução durável | "Persistir estado do programa" | Engine escreve estado após cada super-step; recuperação de crash é determinística. |
| Super-step | "Limite transacional" | Unidade de trabalho entre checkpoints. Termo do LangGraph. |
| thread_id | "Identificador de execução de agent" | Chave que vincula checkpoints e lógica de retoma. |
| Idempotência | "Seguro pra retry" | Repetir um efeito colateral produz o mesmo resultado de uma tentativa. |
| Padrão outbox | "Desacoplar efeitos colaterais" | Escreve intenção numa tabela; executor separado executa e marca como feito. |
| Entrega pelo menos uma vez | "Possíveis duplicatas" | Semântica de message queue; chave de desduplicação torna consumidor effective-once. |
| Deploy rainbow | "Versões sobrepostas" | Múltiplas versões de runtime concorrentes durante workloads de execução longa. |
| Fiber async | "Cedimento cooperativo" | Concorrência em modo-usuário; barato comparado a threads pra cargas I/O-bound. |
| Checkpoint | "Snapshot de estado" | Estado serializado num limite de super-step; chave pra retoma. |

## Leitura Adicional

- [LangChain — O runtime por trás de deep agentes em produção](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — design do runtime LangGraph
- [MegaAgent](https://arxiv.org/abs/2408.09955) — fila produtor-consumidor por agent; coordenação em duas camadas com milhares de agentes concorrentes
- [Matrix](https://arxiv.org/abs/2511.21686) — framework descentralizado com message queues como substrato de coordenação
- [Documentação Temporal](https://docs.temporal.io/) — engine de workflow de referência pra execução durável
- [Anthropic — Sistema de pesquisa multi-agente](https://www.anthropic.com/engineering/multi-agent-research-system) — lições de produção incluindo implantação rainbow
