# OpenAI Agents SDK: Handoffs, Guardrails, Tracing

> O OpenAI Agents SDK é o framework leve de multi-agentes construído sobre a Responses API. Cinco primitivos: Agent, Handoff, Guardrail, Session, Tracing. Handoffs são tools chamadas `transfer_to_<agent>`. Guardrails disparam no input ou output. Tracing está ativo por padrão.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 06 (Tool Use)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Nomear os cinco primitivos do OpenAI Agents SDK.
- Explicar handoffs: por que são modelados como tools, qual formato de nome o modelo vê, e como o contexto é transferido.
- Distinguir input guardrails, output guardrails e tool guardrails; explicar `run_in_parallel` vs modo blocking.
- Implementar um runtime em stdlib com handoffs + guardrails + tracing em estilo span.

## O Problema

Agentes que não delegam direitinho acabam enfiando tudo num prompt só. Agentes sem guardrails vazam PII, geram output que viola políticas, ou entram em loop infinito. O SDK da OpenAI codifica os três primitivos que tornam o trabalho multi-agente viável.

## O Conceito

### Cinco primitivos

1. **Agent.** LLM + instruções + tools + handoffs.
2. **Handoff.** Delegação para outro agente. Representado pro modelo como uma tool chamada `transfer_to_<agent_name>`.
3. **Guardrail.** Validação no input (primeiro agente apenas), output (último agente apenas), ou invocação de tool (por function tool).
4. **Session.** Histórico de conversa automático entre turns.
5. **Tracing.** Spans embutidos para gerações LLM, chamadas de tool, handoffs, guardrails.

### Handoffs como tools

O modelo vê `transfer_to_billing_agent` na lista de tools. Chamá-lo sinaliza pro runtime:

1. Copiar o contexto da conversa (ou colapsar via `nest_handoff_history` beta).
2. Inicializar o agente alvo com suas instruções.
3. Continuar a execução com o agente alvo.

Esse é o supervisor pattern (Aula 13 / Aula 28) productizado.

### Guardrails

Três tipos:

- **Input guardrails.** Rodam no input do primeiro agente. Rejeitam pedidos inseguros ou fora do escopo antes de qualquer chamada LLM.
- **Output guardrails.** Rodam no output do último agente. Capturam vazamentos de PII, violações de política, respostas malformadas.
- **Tool guardrails.** Rodam por function tool. Validam argumentos, verificam permissões, auditam execução.

Modo:

- **Parallel** (padrão). O LLM do guardrail roda junto com o LLM principal. Latência de cauda menor. Se disparar, o trabalho do LLM principal é descartado (desperdício de tokens).
- **Blocking** (`run_in_parallel=False`). O LLM do guardrail roda primeiro. Se disparar, nenhum token é desperdiçado na chamada principal.

Tripwires disparam `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`.

### Tracing

Ativo por padrão. Cada geração LLM, chamada de tool, handoff e guardrail emite um span. `OPENAI_AGENTS_DISABLE_TRACING=1` desativa. `add_trace_processor(processor)` redireciona spans pro seu próprio backend junto com o da OpenAI.

### Sessions

`Session` armazena o histórico de conversa num backend (SQLite, Redis, custom). `Runner.run(agent, input, session=session)` carrega e acrescenta automaticamente.

### Onde esse pattern dá errado

- **Handoff drift.** Agente A passa pro B que volta pro A. Adicione um contador de hops.
- **Guardrail bypass.** Tool guardrails só disparam em function tools; tools built-in (leitor de arquivo, web fetch) precisam de política separada.
- **Over-tracing.** Conteúdo sensível nos spans. Combine com as regras de content-capture do OTel GenAI (Aula 23) — armazene externamente, referencie por ID.

## Construa

`code/main.py` implementa o formato do SDK em stdlib:

- `Agent`, `FunctionTool`, `Handoff` (como uma function tool com semântica de transferência).
- `Runner` com guardrails de input/output/tool, dispatch de handoff e contador de hops.
- Um emissor simples de span pra mostrar o formato do trace.
- Um agente de triagem que passa pra billing ou support baseado na query do usuário; guardrail dispara em um input.

Execute:

```
python3 code/main.py
```

O trace mostra dois handoffs bem-sucedidos, um trigger de input guardrail, e uma árvore de spans espelhando o que o SDK real emite.

## Use

- **OpenAI Agents SDK** para produtos OpenAI-first.
- **Claude Agent SDK** (Aula 17) para produtos Claude-first.
- **LangGraph** (Aula 13) quando você quer estado explícito e retomada durável.
- **Custom** quando você precisa de controle exato (voz, multi-provider, deploy federado).

## Entregue

`outputs/skill-agents-sdk-scaffold.md` monta um scaffold de app Agents SDK com agente de triagem, handoffs, guardrails de input/output/tool, session store e um trace processor.

## Exercícios

1. Adicione um contador de hops no handoff: recuse após N transferências. Trace o comportamento.
2. Implemente `nest_handoff_history` como opção — colapse mensagens anteriores num resumo antes de transferir.
3. Escreva um output guardrail blocking. Compare a latência em prompts que o disparariam vs os que passam.
4. Conecte `add_trace_processor` a um logger JSON. Qual formato ele emite por span?
5. Leia a documentação do SDK. Porte seu toy stdlib pro `openai-agents-python`. O que você modelou errado?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Agent | "LLM + instruções" | Tipo de agente no SDK; possui tools e handoffs |
| Handoff | "Transferência" | Tool que o modelo chama pra delegar a outro agente |
| Guardrail | "Checagem de política" | Validação em input / output / invocação de tool |
| Tripwire | "Trigger de guardrail" | Exceção levantada quando o guardrail rejeita |
| Session | "Armazenamento de histórico" | Memória de conversa persistida entre runs |
| Tracing | "Spans" | Observabilidade embutida sobre LLM + tool + handoff + guardrail |
| Blocking guardrail | "Checagem sequencial" | Guardrail roda primeiro; sem desperdício de tokens no trigger |
| Parallel guardrail | "Checagem concorrente" | Guardrail roda junto; menor latência, desperdiça tokens no trigger |

## Leitura Complementar

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — primitivos, handoffs, guardrails, tracing
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — contraparte estilo Claude
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — quando usar handoffs
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — o padrão que os spans do Agents SDK mapeiam
