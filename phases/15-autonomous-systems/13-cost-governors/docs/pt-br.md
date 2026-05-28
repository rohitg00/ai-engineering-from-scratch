# Orçamentos de Ação, Limites de Iteração e Controladores de Custo

> O custo mensal de LLM de um agente de e-commerce de médio porte saltou de $1.200 para $4.800 depois que a equipe habilitou a skill de "rastreamento de pedidos." Isso não é um bug de precificação. É um agente que encontrou um novo loop e continuou gastando dentro dele. O Agent Governance Toolkit da Microsoft (2 de abril de 2026) codifica a defesa contra essa classe: `max_tokens` por request, orçamentos de token e dólar por tarefa, limites por dia/mês, limites de iteração, roteamento de modelo em camadas, cache de prompt, janela de contexto, checkpoints HITL em ações caras, interruptores de emergência em violação de orçamento. O Claude Code Agent SDK da Anthropic disponibiliza as mesmas primitivas com nomes diferentes. Limites de velocidade financeira — ex: cortar acesso se >$50 em 10 minutos — pegam loops mais rápido que limites mensais.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de controlador de custo em camadas)
**Pré-requisitos:** Fase 15 · 10 (Modos de permissão), Fase 15 · 12 (Execução durable)
**Tempo:** ~60 minutos

## O Problema

Agents autônomos gastam dinheiro real em cada turno. A saída ruim de um chatbot é uma resposta ruim; o loop ruim de um agente é uma conta. O termo documentado pela indústria para o modo de falha é "Denial of Wallet" — o agente continua raciocinando, continua chamando ferramentas, continua cobrando, e nada o para porque nada foi projetado para isso.

O fix não é um número. É uma stack de limites em diferentes escalas de tempo e granularidades: por request, por tarefa, por hora, por dia, por mês. Uma stack bem projetada pega um loop runaway em minutos, um vazamento lento em horas, e uma versão ruim em um dia. A mesma stack mantém um orçamento quando o agente é de longo prazo e autônomo.

Essa é uma aula de engenharia: a matemática é trivial, a disciplina é onde as equipes falham. A lista de limites abaixo é toda nomeada tanto no Agent Governance Toolkit da Microsoft quanto na documentação do Claude Code Agent SDK da Anthropic.

## O Conceito

### A stack de controladores de custo

1. **`max_tokens` por request.** Simples. Impede que qualquer chamada emita um completion ilimitado.
2. **Orçamento de token por tarefa.** Ao longo de toda a execução, não exceda N tokens. Parada rígida no limite.
3. **Orçamento de dólar por tarefa.** Igual ao de tokens mas em moeda. `max_budget_usd` no Claude Code.
4. **Limite de chamada por ferramenta.** No máximo N chamadas `WebFetch`, N chamadas `shell_exec`, etc.
5. **Limite de iteração (`max_turns`).** Total de iterações do loop do agent; impede loops infinitos de raciocínio.
6. **Limite por minuto / hora / dia / mês.** Janelas rolantes. Pega vazamentos em diferentes escalas de tempo.
7. **Limite de velocidade financeira.** Ex: "se gasto exceder $50 em 10 minutos, cortar acesso." Pega queima baseada em loop antes que limites mensais disparem.
8. **Roteamento de modelo em camadas.** Modelo menor como padrão; escalar para um maior somente quando um classificador julga que a tarefa merece.
9. **Cache de prompt.** System prompt e contexto estável armazenados no cache do provedor; custo de reenvio de token é quase zero.
10. **Janela de contexto.** Compactação / resumo para manter o contexto ativo abaixo de um limite; redução direta de custo de token.
11. **Checkpoints HITL em ações caras.** Antes de uma ação conhecida como cara (chamada longa de ferramenta, download grande, upgrade custoso de modelo), exigir toque humano.
12. **Interruptor de emergência em violação de orçamento.** Sessão aborta quando qualquer limite dispara. Limite é registrado; requer caminho de reabilitação separado.

### Por que a stack, não um limite

Um único limite mensal pega um agente runaway só depois que a carteira acabou. Um único limite por request não pega nada no nível de sessão. Diferentes modos de falha requerem diferentes escalas de tempo:

- **Loop runaway** (agent preso em retry de 5 segundos): pego por limite de velocidade.
- **Vazamento lento** (agent fazendo ~2x o trabalho esperado por tarefa): pego por limite diário.
- **Versão ruim** (nova versão usa 5x tokens): pego por limite semanal / mensal.
- **Surto legítimo** (demanda real, não bug): pego por limite de hora / dia com log claro.

### A superfície de orçamento do Claude Code

O Claude Code Agent SDK expõe (docs públicas):

- `max_turns` — limite de iteração.
- `max_budget_usd` — limite de dólar; sessão aborta em violação.
- `allowed_tools` / `disallowed_tools` — allowlist e denylist de ferramentas.
- Ponto de hook antes do uso de ferramenta para contabilidade de custo customizada.

Combine com a escala de modos de permissão (Aula 10). Uma sessão `autoMode` sem `max_budget_usd` é autonomia sem governança. Anthropic enquadra explicitamente Auto Mode como requerendo controles de orçamento; o classificador é ortogonal ao custo.

### EU AI Act, OWASP Agentic Top 10

O Agent Governance Toolkit da Microsoft cobre o OWASP Agentic Top 10 e o Artigo 14 do EU AI Act (supervisão humana). Para produção na UE, logging e aplicação de limites não são opcionais.

### O caso observado de $1.200 → $4.800

O caso real na documentação da Microsoft: um agente de e-commerce cujo custo mensal triplicou depois que uma nova ferramenta foi adicionada. A ferramenta permitia que o agente fizesse polling de status do pedido em cada sessão. Sem detecção de loop. Sem limite por ferramenta. Sem alerta de crescimento semana a semana. O fix foi um limite por ferramenta mais um alerta de crescimento diário. Esse é um template: cada nova superfície de ferramenta é um novo potencial loop; cada nova ferramenta precisa do seu próprio limite e do seu próprio alerta.

## Use

`code/main.py` simula uma execução de agente com e sem stack de controladores de custo em camadas. O agente simulado deriva para um loop de polling após alguns turnos; a stack em camadas pega dentro da janela de velocidade enquanto um único limite mensal não dispararia senão dias depois.

## Entregue

`outputs/skill-agent-budget-audit.md` audita a stack de controladores de custo de um implantação de agente proposto e sinaliza camadas ausentes.

## Exercícios

1. Rode `code/main.py`. Confirme que o limite de velocidade dispara antes do limite de iteração em uma trajetória de loop de polling. Agora desabilite o limite de velocidade e meça quanto o agente "gasta" antes que o limite de iteração o pegue.

2. Projete um conjunto de limites por ferramenta para um agente de navegador (Aula 11). Qual ferramenta precisa do limite mais apertado? Qual pode rodar sem limite sem risco?

3. Leia a documentação do Agent Governance Toolkit da Microsoft. Liste cada tipo de limite nomeado pelo toolkit. Mapeie cada um para um dos modos de falha (loop runaway, vazamento lento, versão ruim, surto).

4. Precifique uma execução noturna sem assistência para uma tarefa realista (ex: "triar 50 issues em um repo"). Defina `max_budget_usd` em 2x sua estimativa pontual. Justifique o 2x.

5. `max_budget_usd` do Claude Code dispara no custo agregado da sessão. Projete um limite de velocidade complementar que você aplicaria externamente. O que dispara o corte, e como é a reabilitação?

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Denial of Wallet | "Conta runaway" | Loop de agente gerando gasto sem limite para parar |
| max_tokens | "Limite por request" | Teto do tamanho de um único completion |
| max_turns | "Limite de iteração" | Teto de iterações do loop de agente em uma sessão |
| max_budget_usd | "Interruptor de emergência em dólar" | Limite de custo da sessão; aborta em violação |
| Limite de velocidade | "Limite de taxa" | Limite de gasto por janela curta (ex: $50 / 10 min) |
| Roteamento em camadas | "Modelo menor primeiro" | Modelo barato como padrão; escalar somente quando classificador autoriza |
| Cache de prompt | "System prompt cacheado" | Cache do lado do provedor reduz custo de reenvio de token a quase zero |
| Checkpoint HITL | "Gate de aprovação humana" | Toque humano exigido antes de ação cara |

## Leituras Adicionais

- [Anthropic Claude Code Agent SDK — agente loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop) — `max_turns`, `max_budget_usd`, allowlists de ferramenta.
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — checkpoints de controlador de custo.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — controles de custo do lado do provedor.
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/prompt-caching) — mecânica de cache.
- [Anthropic — Measuring agente autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — perfil de custo para agentes de longo prazo.
