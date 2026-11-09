# SDK de Agentes OpenAI: Transferências, guardrails, rastreamento

> O OpenAI Agents SDK é o framework multi-agente leve construído sobre a API Responses. Cinco primitivos: Agente, Handoff, Guardrail, Sessão, Tracing.`transfer_to_<agent>`Os guardrails desligam-se na entrada ou saída.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Nomear os cinco primitivos do OpenAI Agents SDK.
- Explique as entregas: por que são modeladas como ferramentas, que forma de nome o modelo vê e como o contexto se transfere.
- Distinguir entre barris de entrada, barris de saída e barris de ferramenta; explicar `run_in_parallel`- Contra o modo de bloqueio.
- Implementar um tempo de execução de stdlib com manchas + barris + rastreamento de estilo span.

## O problema

Agentes que não podem delegar limpo acabam por encher tudo em um prompt. Agentes sem barris enviam PII, saída que viola as políticas ou loop para sempre. O SDK do OpenAI codifica os três primitivos que tornam o trabalho de vários agentes tratável.

## O conceito

### Cinco primitivos

1. **Agent.**LLM + instruções + ferramentas + entregas.
2. **Handoff.**Delegação para outro agente. Representado para o modelo como uma ferramenta chamada `transfer_to_<agent_name>`- Não .
3. **Guardrail.**A validação em entrada (apenas primeiro agente), saída (apenas último agente) ou invocação de ferramenta (por ferramenta de função).
4. **Session.**História de conversação automática ao longo das curvas.
5. **Tracing.**Formas de ligação para gerações de LLM, chamadas de ferramentas, entregas, barris.

### As entregas como ferramentas

O modelo vê .`transfer_to_billing_agent`A chamada indica o tempo de execução para:

1. Copiar o contexto da conversa (ou desintegrá-la através de `nest_handoff_history`- O que é?
2. Inicialize o agente-alvo com as instruções.
3. Continuem a correr com o agente alvo.

Este é o padrão de supervisão (Lessão 13 / Lessão 28) produzido.

### Ferras de guarda

Três sabores:

- **Input guardrails.**Rejeita pedidos inseguros ou fora do alcance antes de qualquer chamada de LLM.
- **Output guardrails.**Aplique o último agente, detecta vazamentos de PII, violações de políticas, respostas mal formadas.
- **Tool guardrails.**Executa ferramentas por função, valida argumentos, verifique permissões, executa auditoria.

Modo:

- **Parallel**(default) O LLM Guardrail funciona ao lado do LLM principal. Latência inferior da cauda. Se tropeçar, o trabalho do LLM principal é descartado (desemprego de tokens).
- **Blocking**(`run_in_parallel=False`O Master em Direito da Guarda vai primeiro, se tropeçar, não há tokens desperdiçados na chamada principal.

Os trifles aumentam .`InputGuardrailTripwireTriggered`- Não .`OutputGuardrailTripwireTriggered`- Não .

### Traçamento

Cada geração de LLM, chamada de ferramentas, transferência e guarda-roupa emite um tempo.`OPENAI_AGENTS_DISABLE_TRACING=1`- Não.`add_trace_processor(processor)`Os fãs vão para o seu próprio backend ao lado do OpenAI.

### Sessões

`Session`armazena histórico de conversação em um backend (SQLite, Redis, custom). `Runner.run(agent, input, session=session)`Cargas automáticas e acessórios.

### Onde este padrão vai mal

- **Handoff drift.**Agente A entrega para o Agente B, que entrega para o Agente A. Adicione um contador de saltos.
- **Guardrail bypass.**As barragens de ferramentas só disparam em ferramentas funcionais; ferramentas incorporadas (leitor de arquivos, web-trach) precisam de uma política separada.
- **Over-tracing.**O conteúdo sensível em intervalos.

```figure
ae-agent-handoff
```

## Construí-lo

`code/main.py`Implementa a forma do SDK no stdlib:

- `Agent`- Não .`FunctionTool`- Não .`Handoff`(como ferramenta de função com semântica de transferência).
- `Runner`com barris de entrada/saída/herramienta, remessa de mão e contador de saque.
- Um simples emissor de espaço para mostrar a forma do rastro.
- Um agente de triagem que entrega a faturamento ou suporte com base na consulta do usuário; viagens de guarda em uma entrada.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra duas entregas bem sucedidas, uma viagem de entrada e uma árvore espalhando o que o SDK real emite.

## Usá-lo

- **OpenAI Agents SDK**para os produtos OpenAI-first.
- **Claude Agent SDK**(Lessão 17) para produtos Claude-first.
- **LangGraph**(Lessão 13) quando quiser um estado explícito e um currículo duradouro.
- **Custom**Quando precisar de controlo exato (voz, multi-provedor, implantações federadas).

## Envia-o

`outputs/skill-agents-sdk-scaffold.md`Estabelece um aplicativo de SDK Agents com um agente de triagem, manuais, barris de entrada/saída/herramienta, armazenamento de sessões e um processador de rastreamento.

## Exercícios

1. Adicione um contador de transferências: rejeitar após transferências N.
2. Implementação `nest_handoff_history`como opção  colapsa as mensagens anteriores num só resumo antes da transferência.
3. Escreva um barranco de saída de bloqueio, compara a latência de pedidos que o tropeçam com os que passam.
4. - O fio .`add_trace_processor`Que forma emite por período?
5. Leia os documentos do SDK.`openai-agents-python`O que é que você fez de errado?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "LLM + instructions" | Agent type in the SDK; owns tools and handoffs |
| Handoff | "Transfer" | Tool the model calls to delegate to another agent |
| Guardrail | "Policy check" | Validation on input / output / tool invocation |
| Tripwire | "Guardrail trip" | Exception raised when guardrail rejects |
| Session | "History store" | Conversation memory persisted between runs |
| Tracing | "Spans" | Built-in observability over LLM + tool + handoff + guardrail |
| Blocking guardrail | "Sequential check" | Guardrail runs first; no token waste on trip |
| Parallel guardrail | "Concurrent check" | Guardrail runs alongside; lower latency, wastes tokens on trip |

## Mais leitura

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) primitivos, remessas, vigas, rastreamento
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) Coleta de sabor a clado
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) quando se pode procurar por entregas
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) o SDK padrão Agents abrange o mapa para
