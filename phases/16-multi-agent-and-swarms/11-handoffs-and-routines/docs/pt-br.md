# Handoffs e Routines — Orquestração Stateless

> O Swarm da OpenAI (outubro de 2024) destilou a orquestração multi-agent em dois primitives: **routines** (instruções + tools como system prompt) e **handoffs** (uma tool que retorna outro Agent). Sem máquina de estados, sem DSL de branching — o LLM roteia chamando a tool de handoff certa. O OpenAI Agents SDK (março de 2025) é o sucessor em produção. O Swarm em si continua sendo a referência conceitual mais limpa — o código inteiro cabe em algumas poucas centenas de linhas. O padrão é viral porque a superfície de API é mais ou menos "agent = prompt + tools; handoff = função que retorna agent." Limitação: stateless, então memória é problema de quem chama.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 04 (Primitive Model)
**Tempo:** ~60 minutos

## Problema

Todo framework multi-agent quer que você aprenda seu DSL: nodes e edges do LangGraph, crews e tasks do CrewAI, GroupChat e managers do AutoGen. Os DSLs são abstrações reais, mas fazem a coisa parecer mais pesada do que precisa.

O Swarm vai na direção opusa: usa a capacidade de tool-calling que o modelo já tem. Handoffs viram chamadas de tool. O orquestrador é o agent que está segurando a conversa no momento. A máquina de estados está implícita nos prompts dos agents.

## Conceito

### Dois primitives

**Routine.** Um system prompt que define o papel do agent e as tools disponíveis. Pense como um conjunto de instruções delimitado: "você é um agent de triagem; se o usuário perguntar sobre reembolsos, faça handoff para o agent de reembolso."

**Handoff.** Uma tool que o agent pode chamar que retorna um novo objeto Agent. O runtime do Swarm detecta o valor de retorno Agent e troca o agent ativo para o próximo turno.

Essa é toda a abstração.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

O system prompt do agent de triagem faz ele escolher o handoff certo com base na mensagem do usuário. O tool-calling do LLM faz o roteamento.

### Por que é viral

- **API pequena.** Dois conceitos pra aprender.
- **Usa o que o modelo já faz.** Tool calling já é production-grade em todos os providers.
- **Sem ônus de máquina de estados.** Você não descreve o grafo; os prompts dos agents descrevem pra quem eles fazem handoff.

### O trade-off stateless

O Swarm é explicitamente stateless entre runs. O framework mantém um histórico de mensagens durante uma run, mas não persiste nada. Memória, continuidade, tarefas de longa duração — tudo problema de quem chama.

Em produção (OpenAI Agents SDK, março de 2025) uma das principais coisas que mudou foi: o SDK adiciona gerenciamento de sessão built-in, guardrails e tracing enquanto mantém o primitive de handoff.

### Quando Swarm/handoffs se encaixam

- **Padrões de triagem.** Agent de frente roteia o usuário para um especialista.
- **Handoffs baseados em habilidade.** "Se a tarefa precisa de código, chama o coder; se precisa de pesquisa, chama o pesquisador."
- **Conversas curtas e delimitadas.** Suporte ao cliente, FAQ-to-ticket, workflows simples.

### Quando o Swarm tropeça

- **Sessões longas com memória compartilhada.** Handoffs resetam o estado da conversa pro prompt do novo agent + histórico. Sem estado persistente entre agents sem memória gerenciada pelo chamador.
- **Execução paralela.** Handoff é um-de-cada-vez — o agent ativo muda. Paralelismo requer o chamador orquestrando múltiplas runs do Swarm.
- **Auditoria e replay.** Runs stateless são difíceis de repetir exatamente; a escolha de handoff do LLM não é determinística.

### OpenAI Agents SDK (março de 2025)

O sucessor em produção adiciona:

- **Estado de sessão.** Thread persistente entre runs.
- **Guardrails.** Hooks de validação de input/output.
- **Tracing.** Cada chamada de tool e handoff é registrada.
- **Filtros de handoff.** Controle o que é transferido de contexto no handoff.

O primitive de handoff sobrevive; ergonomia de produção é adicionada ao redor dele.

### Swarm vs GroupChat

Ambos usam roteamento guiado por LLM, mas diferem em **quem escolhe o próximo**:

- GroupChat: um selecionador (função ou LLM) escolhe o próximo orador de fora.
- Swarm: o agent atual escolhe seu sucessor chamando uma tool de handoff.

Swarm é "agent decide o que vem depois"; GroupChat é "manager decide o que vem depois." A decisão do Swarm vive na chamada de tool do agent ativo; a do GroupChat vive no `GroupChatManager`.

## Construa

`code/main.py` implementa o Swarm do zero: um dataclass Agent, um mecanismo de handoff (tool retorna Agent), e um loop de run que detecta trocas de agent.

Demo: um agent de triagem roteia para especialistas de reembolso, vendas ou suporte. Cada especialista tem suas próprias tools. O loop de run imprime cada handoff.

Execute:

```
python3 code/main.py
```

## Use

`outputs/skill-handoff-designer.md` desenha uma topologia de handoff para uma tarefa dada: quais agents existem, quais handoffs podem chamar, qual contexto é transferido.

## Deploy

Checklist:

- **Logging de handoff.** Cada handoff escreve um evento de trace com from-agent, to-agent, snapshot de contexto.
- **Regras de transferência de contexto.** Defina o que muda no handoff: histórico completo (carente), últimas N mensagens ou um resumo.
- **Guardrail no handoff.** Um handoff para um especialista com permissões de tool diferentes deve ser autenticado — caso contrário, prompt injection pode forçar handoffs indesejados.
- **Detecção de loop.** Dois agents trocando handoffs infinitamente é uma falha comum; detecte com um check simples de ring de últimos K.
- **Agent de fallback.** Se o alvo do handoff não existir, caia em um padrão seguro.

## Exercícios

1. Execute `code/main.py`, faça triagem para o agent de reembolso. Confirme que o agent ativo no segundo turno é o de reembolso.
2. Adicione uma regra de detecção de loop: se os mesmos dois agents fizeram handoff 3 vezes seguidas, force uma saída. Projete o fallback.
3. Leia os docs do OpenAI Agents SDK sobre filtros de handoff. Implemente uma versão "resumo-no-handoff": o agent de saída comprime o contexto em um resumo antes que o agent de entrada assuma.
4. Compare o handoff do Swarm com um selecionador de GroupChatManager. Qual padrão piora a prompt injection e por quê?
5. Leia o cookbook do Swarm (https://developers.openai.com/cookbook/examples/orchestrating_agents). Identifique uma decisão de design explícita que o Swarm toma e que o OpenAI Agents SDK mudou ou manteve.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Routine | "O prompt do agent" | System prompt + lista de tools. Define papel e handoffs disponíveis. |
| Handoff | "Transferir para outro agent" | Uma tool que o agent ativo pode chamar que retorna um novo Agent. O runtime troca o agent ativo. |
| Stateless | "Sem memória entre runs" | Swarm não persiste nada; memória é responsabilidade de quem chama. |
| Active agent | "Quem está falando agora" | O agent segurando a conversa no momento. Handoff muda isso. |
| Context transfer | "O que muda no handoff" | Política do que o agent de entrada vê: completo, últimas N ou resumido. |
| Handoff loop | "Agents ping-pong" | Modo de falha onde dois agents ficam fazendo handoff um pro outro. |
| OpenAI Agents SDK | "Swarm em produção" | Sucessor de março de 2025; adiciona sessões, guardrails, tracing sobre o primitive de handoff. |
| Handoff filter | "Controle na transferência" | Feature do SDK para inspecionar e modificar contexto na fronteira do handoff. |

## Leitura Complementar

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — a articulação de referência
- [Repo do OpenAI Swarm](https://github.com/openai/swarm) — implementação original, mantida como referência conceitual
- [Docs do OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — sucessor em produção com sessões e tracing
- [Notas da Anthropic sobre handoff no Claude](https://docs.anthropic.com/en/docs/claude-code) — como os subagents do Claude Code usam um padrão semelhante a handoff via `Task`
