# Agentes de longa duração: execução duradoura

> Produtos de longo horizonte não são utilizados `while True`. Cada chamada de LLM se torna uma atividade com checkpoint, retry e replay. A integração do OpenAI Agents SDK do Temporal foi GA Março 2026. Claude Code Routines (Anthropic) executa invocações programadas de Claude Code sem um processo local persistente. As sessões pausam na entrada humana, sobrevivem às implantações e retomam a partir do último checkpoint teclado por`thread_id`. Por trás da nova ergonomia se encontra um antigo padrão  orquestração de fluxos de trabalho  com uma nova entrada: LLM chama-se a atividades não deterministas que devem ser reproduzidas deterministicamente na recuperação.

**Type:** Learn
**Languages:** Python (stdlib, minimal durable-execution state machine), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~60 minutes

## O problema

Considere um agente que corre por quatro horas, chama três ferramentas, pede ao usuário duas vezes e faz quarenta chamadas de LLM.

- Em um ingênuo .`while True`loop: tudo está perdido. A execução reinicia do zero. As três chamadas de ferramenta (com efeitos colaterais reais) são executadas novamente. O usuário é solicitado novamente para coisas que já aprovaram. Quarenta chamadas LLM são re-facturadas.
- Com execução durável: a execução retoma-se a partir do ponto de controle mais recente. As atividades já concluídas não são re-executadas; seus resultados são reproduzidos a partir do registro durável. O usuário não reaprova coisas que já aprovou. As chamadas de LLM já feitas não são re-facturadas.

Este é o mesmo padrão que os motores de fluxo de trabalho têm enviado há uma década (Temporal, Cadence, Cherami do Uber). O que é novo é que as chamadas de LLM são agora uma espécie de atividade  não determinista, cara, com efeitos colaterais  e se encaixam neste padrão limpo.

O tema da lição: a fiabilidade de longo horizonte declina (METR observa uma "degradação de 35 minutos"  taxa de sucesso cai aproximadamente quadraticamente com o horizonte).

## O conceito

### Actividades, fluxos de trabalho e repetição

- **Workflow**O código de orquestração determinista define a sequência de atividades, os ramos, as expectativas.
- **Activity**A atividade é registrada com suas entradas e (uma vez concluída) suas saídas.
- **Event log**Todas as atividades iniciadas, concluídas, falhas, retestadas e todas as decisões do fluxo de trabalho são gravadas.
- **Replay**A recuperação é realizada através de um processo de recuperação: ao recuperar, o código do fluxo de trabalho é executado novamente desde o início; cada atividade já concluída retorna o resultado registrado sem re-executar.

Esta é a mesma forma que React re-renderizando contra um DOM virtual, ou Git reconstruindo uma árvore de trabalho a partir de commits.

### Por que as chamadas de LLM se encaixam no padrão

As chamadas de LLM são:
- Não determinista (temperatura > 0; até mesmo temperatura 0 varia entre as versões do modelo).
- Precioso (dinheiro e latencia).
- Potencialmente falha (limites de taxas, temporadas).
- Efeitos colaterais (se invocarem ferramentas).

Esta é exatamente a atividade perfil. Envolvendo cada chamada LLM como uma atividade dá-lhe uma nova tentativa com backkoff exponencial, checkpointing através de restarts, e um rastro replayable para depuração.

### Pontos de controlo indicados por `thread_id`

LangGraph, Microsoft Agent Framework, Cloudflare Durable Objects e Claude Code Routines convergem na mesma forma de API: um `thread_id`(ou equivalente) identifica a sessão; cada transição de estado persiste para um backend (postgreSQL padrão, SQLite para dev, Redis para cache); resume lê o último ponto de verificação.

A escolha do backend importa:

- **PostgreSQL**A LangGraph é padrão.
- **SQLite**: apenas local-dev; perde dados em todos os hosts.
- **Redis**: rápido, mas efêmero, a menos que seja configurado AOF/snapshot.
- **Cloudflare Durable Objects**: distribuído de forma transparente; escopo por uma chave única; sobrevive durante horas a semanas.

### Introdução humana como um estado de primeira classe

Proporcionar-depois-comprometer (Lessão 15) requer um estado duradouro de "espera em humanos". O fluxo de trabalho faz pausas, a fila externa mantém a solicitação pendente e a aprovação retoma exatamente a partir desse ponto. Sem durabilidade, este é o melhor esforço; com ele, uma aprovação durante a noite chega e o fluxo de trabalho retoma na manhã.

### A degradação de 35 minutos

A METR observou que cada classe de agentes medida demonstra decadência de fiabilidade além de ~ 35 minutos de operação contínua. O duplo da duração da tarefa quadrupla aproximadamente a taxa de falhas. A execução duradoura não corrige isso; permite que você execute mais tempo do que o perfil de confiabilidade suporta. O padrão seguro é combinar a durabilidade com os pontos de controlo que exigem HITL fresco na reentrada, e com interruptores de eliminação de orçamento (Lessão 13) que limitam o cálculo total independentemente do tempo do relógio de parede.

### Quando a execução duradoura é a resposta errada

- Corridas de menos de alguns minutos sem entrada humana.
- Recuperação de informações estritamente de leitura.
- Funções em que a correcção exige end-to-end dentro de uma janela de contexto (algumas tarefas de raciocínio; algumas gerações de um só tiro).

```figure
memory-consolidation
```

## Usá-lo

`code/main.py`Implementa um motor de execução durável mínimo no stdlib Python.

- `@activity`Decorador que registra entradas e saídas para um registro de eventos JSON.
- Uma função de fluxo de trabalho que sequencia as atividades.
- A.`run_or_replay(workflow, event_log)`Função que reproduza as atividades concluídas sem re-executá-las.

O motorista simula um fluxo de trabalho de três atividades, cai no meio, e mostra (a) uma nova tentativa ingênua re-executando tudo versus (b) uma repetição executando apenas a atividade faltante.

## Envia-o

`outputs/skill-durable-execution-review.md`Revisar a implantação de agentes de longa duração proposta para a forma correta de execução duradoura: atividades, determinismo, backend de checkpoint, estado de entrada humana e política de HITL-on-resume.

## Exercícios

1. Corra .`code/main.py`Observe a diferença na contagem de execução de atividades entre a retentação ingênua e a repetição. Altere o ponto de queda e mostre a mudança na contagem de repetição em conformidade.

2. Converte o motor de brinquedo para usar `thread_id`Simula duas sessões simultâneas compartilhando o motor e confirma que os registos de eventos não chocam.

3. Tome uma atividade no motor de brinquedo. Introduza um não-determinismo (um timestamp de relógio de parede dentro de uma decisão de fluxo de trabalho). Demonstre a divergência na repetição. Explique como os motores reais lidam com isso (registro de efeitos colaterais, `Workflow.now()`- AIPs).

4. Leia o post "Runtime behind production deep agents" da LangChain, lista todos os estados em que o tempo de execução persiste e nome o modo de falha que cada um cobre.

5. Desenhar uma política de checkpoint para uma tarefa de codificação autônoma de 6 horas. Onde você checkpoint? Como é resumir-on-crash?

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Workflow | "Agent's script" | Deterministic orchestration code; replayable from event log |
| Activity | "A step" | Non-deterministic unit (LLM call, tool call); logged before and after |
| Event log | "The backing store" | Durable record of every state transition |
| Replay | "Resume" | Re-run workflow; completed activities return logged results without re-execution |
| Checkpoint | "Save point" | Persisted state keyed by thread_id; latest-wins on resume |
| thread_id | "Session key" | Identifier that scopes durable state |
| 35-minute degradation | "Reliability decay" | METR: success rate drops ~quadratically with horizon |
| Non-determinism | "Drift on replay" | Wall clock, random, LLM output; must be registered as side effect |

## Mais leitura

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) orçamento, viradas e retomada da semântica.
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) Forma de RequestInfoEvent.
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) requisitos concretos de tempo de execução.
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) Forma de actividade para chamadas de LLM.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) a referência de degradação de 35 minutos.
