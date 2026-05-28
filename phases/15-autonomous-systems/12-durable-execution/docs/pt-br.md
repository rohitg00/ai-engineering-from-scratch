# Agents de Fundo de Longa Duração: Execução Durável

> Agents de longo prazo em produção não rodam em `while True`. Cada chamada de LLM se torna uma atividade com checkpoint, retry e replay. A integração do OpenAI Agents SDK com a Temporal foi GA em março de 2026. Claude Code Routines (Anthropic) roda invocações agendadas do Claude Code sem um processo local persistente. Sessões pausam em input humano, sobrevivem a deploys e resumem do último checkpoint com chave `thread_id`. Por trás da nova ergonomia vive um padrão antigo — orquestração de workflows — com uma nova entrada: chamadas de LLM como atividades não-determinísticas que devem ser reproduzidas deterministicamente na recuperação.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, máquina de estados de execução durable mínima)
**Pré-requisitos:** Fase 15 · 10 (Modos de permissão), Fase 15 · 01 (Agents de longo prazo)
**Tempo:** ~60 minutos

## O Problema

Considere um agent que roda por quatro horas. Ele chama três ferramentas, pergunta ao usuário duas vezes e faz quarenta chamadas de LLM. No meio do caminho, a máquina onde ele roda reinicia. O que acontece?

- Em um loop `while True` inocente: tudo é perdido. A execução recomeça do zero. As três chamadas de ferramenta (com efeitos colaterais reais) executam novamente. O usuário é questionado de novo sobre coisas que já aprovou. Quarenta chamadas de LLM são cobradas novamente.
- Com execução durable: a execução resume do checkpoint mais recente. Atividades já completadas não são re-executadas; seus resultados são reproduzidos do log durable. O usuário não re-aprova coisas que já aprovou. As chamadas de LLM já feitas não são cobradas novamente.

Esse é o mesmo padrão que engines de workflow vêm implantando por uma década (Temporal, Cadence, Cherami da Uber). O que é novo é que chamadas de LLM agora são um tipo de atividade — não-determinísticas, caras, com efeitos colaterais — e se encaixam neste padrão limpo.

O tema corrente da aula: confiabilidade de longo prazo degrada (METR observa uma "degradação de 35 minutos" — taxa de sucesso cai aproximadamente quadraticamente com o horizonte). Execução durable permite execuções que são mais longas do que o perfil de confiabilidade suporta, o que é uma nova forma de falhar seguramente se o design estiver certo e perigosamente se estiver errado.

## O Conceito

### Atividades, workflows e replay

- **Workflow**: código de orquestração determinístico. Define a sequência de atividades, os ramos, as esperas. Deve ser determinístico para poder ser reproduzido a partir do log de eventos sem divergência surpresa.
- **Atividade**: uma unidade de trabalho não-determinística, potencialmente falhável. Chamada de LLM, chamada de ferramenta, escrita de arquivo, requisição HTTP. Cada atividade é logada com suas entradas e (quando completa) suas saídas.
- **Log de eventos**: o armazenamento backing durable. Cada início de atividade, conclusão, falha, retry, e cada decisão de workflow é registrada.
- **Replay**: na recuperação, o código do workflow re-roda do começo; cada atividade que já completou retorna seu resultado logado sem re-executar. Somente atividades que não completaram são realmente rodadas.

Essa é a mesma forma que o React re-renderiza contra um DOM virtual, ou o Git reconstrói uma árvore de trabalho a partir de commits. Determinismo no orquestrador é o que torna durabilidade barata.

### Por que chamadas de LLM se encaixam no padrão

Chamadas de LLM são:
- Não-determinísticas (temperatura > 0; mesmo temperatura 0 deriva entre versões do modelo).
- Caras (dinheiro e latência).
- Potencialmente falháveis (limites de taxa, timeouts).
- Com efeitos colaterais (se invocam ferramentas).

Esse é exatamente o perfil de atividade. Envolva cada chamada de LLM como uma atividade e você ganha retry com backoff exponencial, checkpointing entre reinícios e uma traça reproduzível para debug.

### Checkpoints com chave `thread_id`

LangGraph, Microsoft Agent Framework, Cloudflare Durable Objects e Claude Code Routines convergiram na mesma forma de API: um `thread_id` (ou equivalente) identifica a sessão; cada transição de estado persiste em um backend (PostgreSQL padrão, SQLite para dev, Redis para cache); resume lê o checkpoint mais recente.

A escolha do backend importa:

- **PostgreSQL**: durável, consultável, sobrevive a deploys. Padrão do LangGraph.
- **SQLite**: somente para dev local; perde dados entre hosts.
- **Redis**: rápido mas efêmero a menos que AOF/snapshot sejam configurados.
- **Cloudflare Durable Objects**: distribuído transparentemente; delimitado por chave única; sobrevive de horas a semanas.

### Input humano como estado de primeira classe

Proposta-então-commit (Aula 15) requer um estado durável "aguardando humano." O workflow pausa, a fila externa segura a requisição pendente, e uma aprovação resume exatamente naquele ponto. Sem durabilidade isso é best-effort; com ela, uma aprovação noturna chega e o workflow recomeça de manhã.

### A degradação de 35 minutos

METR observou que toda classe de agent medida mostra degradação de confiabilidade além de ~35 minutos de operação contínua. Dobrar a duração da tarefa mais ou menos quadruplica a taxa de falha. Execução durable não conserta isso; permite rodar mais do que o perfil de confiabilidade suporta. O padrão seguro é combinar durabilidade com checkpoints que exigem HITL fresco na reentrada, e com interruptores de orçamento (Aula 13) que limitam compute total independente do tempo de relógio.

### Quando execução durable é a resposta errada

- Execuções menores que alguns minutos sem input humano. Overhead > benefício.
- Recuperação de informação estritamente somente-leitura.
- Tarefas onde correção requer end-to-end dentro de uma janela de contexto (algumas tarefas de raciocínio; algumas gerações one-shot).

## Use

`code/main.py` implementa uma engine mínima de execução durable em Python stdlib. Suporta:

- Decorador `@activity` que loga entradas e saídas em um log de eventos JSON.
- Uma função de workflow que sequencia atividades.
- Uma função `run_or_replay(workflow, event_log)` que reproduz atividades completadas sem re-executá-las.

O driver simula um workflow de três atividades, cai no meio da execução e mostra (a) retry inocente re-executando tudo versus (b) replay rodando apenas a atividade que faltava.

## Entregue

`outputs/skill-durable-execution-review.md` revisa um deploy de agent de longa duração proposto para forma correta de execução durable: atividades, determinismo, backend de checkpoint, estado de input humano e política de HITL no resume.

## Exercícios

1. Rode `code/main.py`. Observe a diferença na contagem de execução de atividades entre retry inocente e replay. Mude o ponto de queda e mostre que a contagem de replay muda correspondentemente.

2. Converta a engine de brinquedo para usar `thread_id` explicitamente. Simule duas sessões concorrentes compartilhando a engine e confirme que seus logs de eventos não colidem.

3. Pegue uma atividade na engine de brinquedo. Introduza não-determinismo (um timestamp de relógio real dentro de uma decisão de workflow). Demonstre a divergência no replay. Explique como engines reais lidam com isso (registro de efeitos colaterais, APIs `Workflow.now()`).

4. Leia o post "Runtime behind production deep agents" da LangChain. Liste cada estado que o runtime persiste e nomeie qual modo de falha cada um cobre.

5. Projete uma política de checkpoint para uma tarefa autônoma de codificação de 6 horas. Onde você checkpointa? Como é o resume no crash? O que exige HITL fresco?

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Workflow | "Script do agent" | Código de orquestração determinístico; reproduzível a partir do log de eventos |
| Atividade | "Um passo" | Unidade não-determinística (chamada de LLM, chamada de ferramenta); logada antes e depois |
| Log de eventos | "O armazenamento backing" | Registro durável de cada transição de estado |
| Replay | "Resume" | Re-executa workflow; atividades completadas retornam resultados logados sem re-execução |
| Checkpoint | "Ponto de salvamento" | Estado persistente com chave thread_id; último vence no resume |
| thread_id | "Chave de sessão" | Identificador que delimita o estado durável |
| Degradação de 35 minutos | "Decaimento de confiabilidade" | METR: taxa de sucesso cai ~quadraticamente com o horizonte |
| Não-determinismo | "Deriva no replay" | Relógio real, aleatório, saída de LLM; deve ser registrado como efeito colateral |

## Leituras Adicionais

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — orçamento, turnos e semântica de resume.
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — forma do RequestInfoEvent.
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — requisitos concretos de runtime.
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) — forma de atividade para chamadas de LLM.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — referência da degradação de 35 minutos.
