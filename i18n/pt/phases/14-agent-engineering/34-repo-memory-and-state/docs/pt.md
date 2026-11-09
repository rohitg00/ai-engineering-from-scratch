# Memória de Repo e estado duradouro

> O histórico de bate-papo é volátil, o repo é duradouro, o banco de trabalho armazena o estado do agente em arquivos versionados, para que a próxima sessão, o próximo agente e o próximo revisor todos leem a partir da mesma fonte de verdade.

**Type:** Build
**Languages:** Python (stdlib + `jsonschema` optional), TypeScript
**Prerequisites:** Phase 14 · 32 (Minimal Workbench)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Defina o que pertence à memória repo e o que pertence ao histórico de bate-papo.
- Autor JSON Schemas para `agent_state.json`E ...`task_board.json`- Não .
- Construir um gerente de estado que carregue, valida, muta e persista estado atomicamente.
- Use o esquema para recusar erros antes que eles corrompam a mesa de trabalho.

## O problema

O agente termina uma sessão. O chat fecha. A próxima sessão abre e pergunta onde começar. O modelo diz "deixe-me verificar os arquivos", lê notas obsoletas e refaz o trabalho que já estava concluído. Ou pior, reescreve um arquivo acabado porque ninguém lhe disse que o arquivo estava concluído.

A correção do banco de trabalho é a memória repo: o estado vive em arquivos JSON no repo, escrito sob um esquema, persistido de forma atômica, diferente na revisão de código.

## O conceito

```mermaid
flowchart LR
  Agent[Agent Loop] --> Manager[StateManager]
  Manager --> Schema[agent_state.schema.json]
  Schema --> Validate{valid?}
  Validate -- yes --> Write[agent_state.json]
  Validate -- no --> Reject[refuse + raise]
  Write --> Manager
```

### O que pertence à memória repo

| Belongs | Does not belong |
|---------|-----------------|
| Active task id | Raw chat transcripts |
| Touched files this session | Token-level reasoning traces |
| Assumptions the agent made | "The user seemed frustrated" |
| Open blockers | Sampled completions |
| Next action | Vendor-specific model ids |

O teste é a durabilidade: será útil daqui a três meses numa reestruturação de CI?

### Estado do primeiro esquema

O JSON Schema é o contrato. Sem ele, cada agente inventa novos campos, cada revisor aprende uma nova forma, e cada script de CI tem que ser especial caso versões passadas.

O esquema abrange:

- - As chaves necessárias.
- Permitido .`status`- Os valores.
- Valores proibidos (por exemplo `null`para matrizes).
- Constrangimentos de padrão (identificadores de tarefas coincidem `T-\d{3,}`)).
- Campo de versão para migrações.

### Atomic escreve

O arquivo do estado é a fonte da verdade; um arquivo sem-escrito é pior do que nenhum arquivo.

### Migrações

Quando o esquema mudar, enviar um script de migração ao lado do golpe do esquema.`schema_version`campo; o gerente recusa-se a carregar um arquivo a partir de uma versão que não pode migrar.

```figure
wb-state-persist
```

## Construí-lo

`code/main.py`Implementos:

- `agent_state.schema.json`E ...`task_board.schema.json`- Não .
- Um validador de apenas stdlib (subconjunto de JSON Schema: necessário, tipo, enum, padrão, itens).
- `StateManager.load`- Não .`StateManager.update`- Não .`StateManager.commit`com o tempo atômico e o renome.
- Uma demonstração que muda o estado, persiste, recarga e prova a viagem de ida e volta.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O roteiro diz:`workdir/agent_state.json`E ...`workdir/task_board.json`, mutá-los em duas curvas e imprime o estado validado em cada passo.

## Padrões de produção em silêncio

Quatro padrões transformam o mínimo da lição em algo que um monorepo multi-agente pode sobreviver.

**Atomic temp-and-rename is not optional.**Um relatório de bugs do projeto Hive de março de 2026 documenta o modo de falha de forma limpa: `state.json`foi escrito através de `write_text()`O sistema de correção é sempre:`tempfile.mkstemp`No mesmo diretório do alvo, escrever:`fsync`- Não .`os.replace`Esta lição é uma lição de que o que eu quero dizer é que o que eu quero dizer é que eu quero que o meu pai me dê uma lição.`atomic_write`Faz exatamente isso.

**Idempotency keys on every non-idempotent tool call.**Se um agente falhar após ligar a uma ferramenta, mas antes de verificar o resultado, a recuperação retrata a chamada da ferramenta. Seguro para leituras; perigoso para e-mails, inserções de DB, uploads de arquivos. O padrão: registro de cada ID de chamada da ferramenta antes da execução em um `pending_calls.jsonl`. Em retest, verifique a identificação; se estiver presente, puxe a chamada e use o resultado armazenado em cache.

**Separate large artifacts from state.**Não armazenar CSVs, transcrições longas, ou arquivos gerados em `agent_state.json`. Salvar o artefato como um arquivo separado (ou fazer upload para armazenamento de objetos) e manter apenas o caminho em estado.

**Event sourcing for audit, snapshots for resume.**Aplicar a um registro de eventos (`state.events.jsonl`) em cada mutação; periodicamente , um instantâneo de `state.json`Resume lê o snapshot, em seguida, reproduza qualquer evento após o timestamp do snapshot. Isso custa mais disco, mas permite que você reproduzir as decisões do agente, literalmente, essencial ao depurar corridas de longo horizonte. Postgres usa a mesma ideia de log mais checkpoint na camada de armazenamento com seu WAL, embora em um nível muito menor que os eventos de aplicação.

**Schema migrations or refuse to load.**O `schema_version`Quando o gerente carrega um arquivo em uma versão desconhecida, ele se recusa a ler. Envie um script de migração ao lado do schema bump; `tools/migrate_state.py`funciona de forma idempotente em todas as startups.

## Usá-lo

Em produção:

- **LangGraph checkpointers.**O ponto de verificação persiste no estado do gráfico para SQLite, Postgres ou um backend personalizado. O esquema que esta lição ensina é o que você alcança quando o ponto de verificação morre e você precisa ler o estado à mão.
- **Letta memory blocks.**Blocos persistentes com esquemas estruturados (Fase 14 · 08).
- **OpenAI Agents SDK session store.**Os backends plugáveis, conscientes de esquemas.

## Envia-o

`outputs/skill-state-schema.md`gera um par de JSON Schema específico do projeto (estado + tabela), um Python `StateManager`- Sim. - Sim. - Sim. - Sim. - Sim. - Sim.

## Exercícios

1. Adicionar um`last_human_touch`Recusar qualquer agente a escrever dentro de cinco segundos de uma edição humana.
2. Extender o validador para suportar `oneOf`Assim, uma tarefa pode ser uma tarefa de construção ou uma tarefa de revisão com diferentes campos necessários.
3. Adicionar um`schema_version`campo e escrever a migração de v1 para v2 (renome `blockers`- Não .`risks`)).
4. Mover o backend de armazenamento de um arquivo local para SQLite.`StateManager`A API é idêntica.
5. E o que é que vai mal e como é que a renome atomizada te salva?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Repo memory | "Notes file" | State stored in tracked files in the repo, under schema |
| Schema-first | "Validate inputs" | Define the contract before the writer, refuse drift |
| Atomic write | "Just rename" | Write to temp, fsync, rename, so partial failures cannot corrupt |
| Migration | "Schema bump" | A script that turns vN state into v(N+1) state |
| System of record | "Source of truth" | The artifact the workbench treats as authoritative |

## Mais leitura

- [JSON Schema specification](https://json-schema.org/specification.html)
- [LangGraph checkpointers](https://langchain-ai.github.io/langgraph/concepts/persistence/)
- [Letta memory blocks](https://docs.letta.com/v1-sdk/memory/memory-blocks)
- [Fast.io, AI Agent State Checkpointing: A Practical Guide](https://fast.io/resources/ai-agent-state-checkpointing/) Primeiro ponto de controlo com idempotencia
- [Fast.io, AI Agent Workflow State Persistence: Best Practices 2026](https://fast.io/resources/ai-agent-workflow-state-persistence/) Controle de concurência, TTL, aquisição de eventos
- [Hive Issue #6263 — non-atomic state.json writes silently ignored](https://github.com/aden-hive/hive/issues/6263) o modo de falha num projecto real
- [eunomia, Checkpoint/Restore Systems: Evolution, Techniques, Applications](https://eunomia.dev/blog/2025/05/11/checkpointrestore-systems-evolution-techniques-and-applications-in-ai-agents/) Primíticas de CR do histórico do sistema operacional aplicadas a agentes
- [Indium, 7 State Persistence Strategies for Long-Running AI Agents in 2026](https://www.indium.tech/blog/7-state-persistence-strategies-ai-agents-2026/)
- [Microsoft Agent Framework, Compaction](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/compaction) Gestor de pontos de controlo do fornecedor
- Fase 14 · 08  Blocos de memória e cálculo do tempo de sono
- Fase 14 · 32  o mínimo de três arquivos esta lição esquematiza
- Fase 14 · 40  Pacotes de entrega leídos a partir do mesmo esquema
