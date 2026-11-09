# Orçamentos de acção, limites de iteração e governadores de custos

> O custo mensal de LLM de um agente de comércio eletrônico de médio porte aumentou de $1,200 to $O software de gestão de dados da Microsoft, que é o software de gestão de dados, é o mais recente e mais recente de todos os sistemas de gestão de dados da Microsoft.`max_tokens`O SDK de código Claude da Anthropic envia os mesmos primitivos sob diferentes nomes. Limites de velocidade financeira , por exemplo, cortar o acesso em > $ 50 em 10 minutos  pegar loops mais rápido do que os limites mensais.

**Type:** Learn
**Languages:** Python (stdlib, layered cost-governor simulator), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 12 (Durable execution)
**Time:** ~60 minutes

## O problema

Os agentes autônomos gastam dinheiro real em cada turno. A má saída de um chatbot é uma má resposta; o mau ciclo de um agente é uma conta. O termo documentado pela indústria para o modo de falha é "Denial of Wallet"

A solução não é um número. É uma pilha de limites em diferentes escalas de tempo e granularidades: por pedido, por tarefa, por hora, por dia, por mês. Uma pilha bem projetada pega um loop fugitivo em minutos, um vazamento lento em horas e uma liberação ruim em um dia. A mesma pilha mantém um orçamento quando o agente é de longo horizonte e autônomo.

Esta é uma lição de engenharia: a matemática é trivial, a disciplina é onde as equipes falham. A lista de limites abaixo é todos nomeados ou no Microsoft Agent Governance Toolkit ou no Antropic Claude Code Agent SDK documentos.

## O conceito

### A pilha de governadores de custos

1. **`max_tokens` per request.**Simples, impede que qualquer chamada emite um final ilimitado.
2. **Per-task token budget.**Ao longo da corrida, não exceda os tokens N. Parar duro no limite.
3. **Per-task dollar budget.**O mesmo que os tokens, mas em moeda.`max_budget_usd`em Claude Code.
4. **Per-tool call cap.**Não mais do que N `WebFetch`- chamadas, N`shell_exec`chamadas, etc.
5. **Iteration cap (`max_turns`).**Iterações de loop de agente total; impede loop de raciocínio infinito.
6. **Per-minute / per-hour / per-day / per-month cap.**Fragmentos de vidro, vazamentos em diferentes escalas de tempo.
7. **Financial velocity limit.**Por exemplo, "se gastar mais de 50 dólares em 10 minutos, corte o acesso".
8. **Tiered model routing.**Default para um modelo menor; escala para um maior apenas quando um classificador julgar a tarefa que o justifica.
9. **Prompt caching.**Contexto de sistema rápido e estável armazenado no cache do fornecedor; custo de token de reenvio é próximo de zero.
10. **Context windowing.**Compactação / resumo para manter o contexto ativo abaixo de um limiar; redução direta de custos de tokens.
11. **HITL checkpoints on expensive actions.**Antes de uma ação conhecida por ser cara (longa chamada de ferramentas, grande download, uma atualização de modelo cara), é necessário um toque humano.
12. **Kill switch on budget breach.**A sessão aborta quando qualquer tampa se acende. A tampa é gravada; requer um caminho separado de reabilitação.

### Por que a pilha, não um boné

Um único limite mensal pega um agente fugitivo apenas depois que a carteira desapareceu. Um único limite por solicitação não pega nada no nível da sessão. Diferentes modos de falha exigem diferentes escalas de tempo:

- **Runaway loop**(Agente preso em uma nova tentativa de 5 segundos): capturado pelo limite de velocidade.
- **Slow leak**(agente que realiza ~ 2x o trabalho esperado por tarefa): capturado pelo limite diário.
- **Bad release**(nova versão utiliza tokens 5x): capturado por limite semanal / mensal.
- **Legitimate surge**(demanda real, não um bug): capturado por limite hora/dia com registro claro.

### Superfície de orçamento de arame

O SDK Claude Code Agent expõe (documentos públicos):

- `max_turns` Capítulo de iteração.
- `max_budget_usd`- Capítulo de 1 do artigo 92.° do Tratado.
- `allowed_tools`- Não .`disallowed_tools` alufrator de ferramentas e denilista.
- Pontos de gancho antes da utilização da ferramenta para contabilização de custos personalizada.

Combinar com a escada de modo de autorização (Lessão 10).`autoMode`sessão sem `max_budget_usd`O Antropic define explicitamente o modo automático como exigindo controles de orçamento; o classificador é ortogonal ao custo.

### Lei da UE sobre IA, Agência OWASP Top 10

O Kit de Ferramentas de Governança de Agentes da Microsoft abrange os requisitos do Top 10 do Agente OWASP e do artigo 14.o da Lei da IA da UE (supervisão humana).

### O observado .$1,200 → $4.800 casos

O caso real nos documentos da Microsoft: um agente de comércio eletrônico cujo custo mensal quadruplicou após a adição de uma nova ferramenta. A ferramenta permitiu ao agente fazer um sondagem sobre o estado da ordem durante cada sessão. Não há detecção de circuito. Não há gorjeta por ferramenta. Não há alerta sobre crescimento semanal. A correcção era um limite por ferramenta e um alerta de crescimento diário. Esta é uma modelo: cada nova superfície da ferramenta é um novo ciclo potencial; cada nova ferramenta precisa de seu próprio limite e de seu próprio alerta.

```figure
cost-governor-stack
```

## Usá-lo

`code/main.py`O agente simulado entra em um ciclo de pesquisa após algumas voltas; o pilão em camadas o pega dentro da janela de velocidade enquanto um único limite mensal não dispararia até dias depois.

## Envia-o

`outputs/skill-agent-budget-audit.md`Audita a pilha de governadores de custos da implantação de agentes proposta e identifica as camadas ausentes.

## Exercícios

1. Corra .`code/main.py`Confirme o limite de velocidade antes do limite de iteração em uma trajetória de ciclo de votação.

2. Desenhar um conjunto de tampas por ferramenta para um agente do navegador (Lessão 11). Qual ferramenta precisa do tampão mais apertado?

3. Leia os documentos do Kit de ferramentas de governança de agentes da Microsoft. Enumere cada tipo de tampa os nomes do kit de ferramentas. Mapeie cada um para um dos modos de falha (loop de fuga, vazamento lento, liberação ruim, aumento).

4. Preço de uma execução durante a noite sem supervisão para uma tarefa realista (por exemplo, "triar 50 emissão num repo").`max_budget_usd`2x a sua estimativa de pontos.

5. O Claude Code.`max_budget_usd`Desenhar um limite de velocidade complementar que você impõe externamente.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Denial of Wallet | "Runaway bill" | Agent loop generating spend with no cap to stop it |
| max_tokens | "Per-request cap" | Ceiling on a single completion's size |
| max_turns | "Iteration cap" | Ceiling on agent loop iterations in a session |
| max_budget_usd | "Dollar kill switch" | Session cost cap; aborts on breach |
| Velocity limit | "Rate cap" | Limit on spend per short window (e.g., $50 / 10 min) |
| Tiered routing | "Small model first" | Cheap model default; escalate only when classifier warrants |
| Prompt caching | "Cached system prompt" | Provider-side cache reduces re-send token cost to near zero |
| HITL checkpoint | "Human approval gate" | Human tap required before expensive action |

## Mais leitura

- [Anthropic Claude Code Agent SDK — agent loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop)- Não .`max_turns`- Não .`max_budget_usd`, alistadores de ferramentas.
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop)- pontos de controlo de governadores de custos.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) Controle dos custos do lado do fornecedor.
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)- Mecânica de cache.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) perfil de custos para agentes de longo horizonte.
