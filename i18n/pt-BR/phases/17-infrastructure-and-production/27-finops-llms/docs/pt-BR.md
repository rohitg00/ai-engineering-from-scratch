# FinOps para LLM  Economia unitária e atribuição de multi-arrendatários

> As FinOps tradicionais rompem com os gastos de LLM. Os custos são transações de token, não recursos de uptime. Tags não mapeam  uma chamada de API é uma transação, não um ativo. As decisões de engenharia (design de urgência, janela de contexto, comprimento de saída) são decisões financeiras. O playbook de 2026 tem três dimensões de atribuição ao instrumento no primeiro dia: por usuário (`user_id`) para o preço dos assentos e a expansão, por tarefa (`task_id`+ `route`) para o custo e a prioridade da superfície do produto, per tenente (`tenant_id`) para a economia unitária e a renovação. Quatro camadas de tokens  prompt, ferramenta, memória, resposta  um balde de esconderijos gastam. Escala de execução para produtos multi-arrendatários: limites de taxas por arrendatário (2-3x o pico esperado, limpo 429 + retest-after); limite de gastos diários (1,5-3x o limite contratado; desencadeia aperto de taxas + alerta); interruptores de apagão no gasto z-score > 4 (pausa automática + página em chamada). Padrões de atribuição: tag-and-aggregate, telemetria-joiner (trace-ID → faturamento; maior precisão), amostragem e extrapolação, alocação baseada em modelo, streaming em tempo real. Metrica unitária: custo por consulta resolvida, custo por artefato gerado  não tokens $/M. A etiquetação retroativa sempre falha; instrumento de criação a pedido.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-attribution simulator with kill switch)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Explique por que as FinOps tradicionais (tags + tiers) rompem com o gasto LLM e nomeie as três novas dimensões de atribuição.
- Enumere as quatro camadas de token (prompt, ferramenta, memória, resposta) e por que a faturamento de um único balde oculta o custo.
- Desenhar uma escada de aplicação (taxa → limite de gastos → interruptor de eliminação) para um produto multi-arrendatário.
- Escolha uma métrica unitária (custo por consulta / artefato resolvido) em vez de tokens $ / M.

## O problema

A sua conta diz 40.000 dólares.
- Que inquilino a gastou.
- Que característica do produto a levou.
- Se qualquer utilizador individual foi abusador.
- Se a inflamação rápida, as chamadas de ferramentas ou a amplificação da memória foi o culpado.

Tag-and-aggregate no lado do provedor funciona para recursos de nuvem (EC2, S3) onde as tags se propagam para itens de linha. Chamadas LLM API não são auto-tagadas  você tem que estampar usuário / tarefa / inquilino no site da chamada e levar a cabo. Atribuição retroativa sempre perde casos de borda.

## O conceito

### Três dimensões de atribuição

**Per-user**(`user_id`): quem está a custar o que.

**Per-task**(`task_id`+ `route`Os drives apresentam prioridades, decisões sobre características de morte e custo.

**Per-tenant**(`tenant_id`): qual cliente é rentável.

O instrumento todos os três no local de chamada no primeiro dia.

### Quatro camadas simbólicas

| Layer | Example | Typical % of total |
|-------|---------|---------------------|
| Prompt | system + user input | 40-60% |
| Tool | tool-call results fed back | 20-40% (agent workloads) |
| Memory | prior conversation / retrieved docs | 10-30% |
| Response | model output | 10-30% |

A combinação de todos os quatro faz com que a otimização se torne cega.

### Escada de execução

1. **Rate limit**- O número de inquilinos é de 2 a 3 vezes o máximo esperado.`Retry-After`O inquilino vê fricção, não há conta de surpresa.

2. **Daily spend cap**O limite de taxa de aperto + alerta de sucesso do cliente.

3. **Kill switch**Em termos de pontuação z de gastos > 4 em relação à linha de base do inquilino.

### Padrões de atribuição

- **Tag-and-aggregate**As informações sobre o processo de elaboração de dados são:
- **Telemetry joiner**A maior precisão, o que as equipes maduras fazem.
- **Sampling + extrapolation**A taxa de desemprego é de 5 a 10% e a taxa de desemprego é de 5 a 10%.
- **Model-based allocation**Para dados legais sem etiquetas.
- **Event-sourced**O custo é o resultado de eventos em um fluxo (Kafka/Kinesis).
- **Real-time streaming**: actualizações do painel de instrumentos subsegundo.

### O custo por X é a métrica unitária

Os tokens $/M são vendedores.

- Custo por bilhete de apoio resolvido.
- Custo por artigo gerado.
- Custo por tarefa de agente bem sucedida.
- Custo por minuto de sessão de utilizador.

A ligação do custo ao resultado do produto, caso contrário, a otimização não é corrigida.

### Forma de rastreamento da atribuição de custos

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

Emite em cada chamada. Armazenar em data lake. Agregado por dimensão. Fase 17 · 13 observabilidade stack é onde esta vive.

### A pilha de poupanças compostas

Stack: cache + batch + rota + gateway.
- Cache L2 (Fase 17 · 14): entrada ~10 vezes mais barata.
- Batch (Fase 17 · 15): desconto de 50%.
- Rota para modelo barato (fase 17 · 16): redução de custos de 60%.
- Eficiência do gateway (fase 17 · 19): redundância + retestes.

O melhor caso empilhado: ~ 5-10% da linha de base ingênua. A maioria das equipes tem 2-3 alavancas envolvidas; poucos empilham todas as quatro.

### Números que você deve lembrar

- Dimensões de atribuição: por utilizador, por tarefa, por inquilino.
- Quatro camadas de símbolo: prompt, ferramenta, memória, resposta.
- Desligação de disparos: gastar pontuação z > 4.
- Metrica unitária: custo por consulta resolvida, não tokens $/M.
- Optimizações em pilhas: ~ 5-10% da linha de base possível.

```figure
i4-spend-ladder
```

## Usá-lo

`code/main.py`Simula um serviço de LLM para vários inquilinos com a escada de execução de três níveis. Injeta um inquilino abusivo e demonstra o disparo do interruptor de morte.

## Envia-o

Esta lição produz`outputs/skill-finops-plan.md`- Tendo em conta o produto e a escala, desenha o esquema de atribuição e a escada de execução.

## Exercícios

1. Corra .`code/main.py`Em que ponto do "s" o interruptor de morte dispara?
2. Desenhe um painel de custos por inquilino, por tarefa.
3. O teu maior inquilino é negativo por unidade econômica, e propõe três intervenções por impacto do cliente.
4. Calcule o custo por bilhete resolvido para um produto de suporte: 3M tokens/ticket, ~ 800 bilhetes/dia, todas as entradas na taxa caché GPT-5 de $0,125/M (preço da lista de lançamento; verifique o cartão de taxa ao vivo).
5. Argumentem se a etiquetação retroativa pode funcionar.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Per-user attribution | "user-level cost" | `user_id` stamped on every call |
| Per-task attribution | "feature cost" | `task_id` + `route` identify product surface |
| Per-tenant attribution | "customer cost" | `tenant_id`; drives unit economics |
| Four token layers | "cost layers" | prompt + tool + memory + response |
| Rate limit | "429 guard" | Per-tenant ceiling enforced at gateway |
| Daily spend cap | "daily ceiling" | Tenant-scoped budget with alert |
| Kill switch | "auto-pause" | Spend z-score > 4 triggers auto-suspension |
| Cost per resolved | "product unit metric" | Cost tied to product outcome, not tokens |
| Telemetry joiner | "trace-to-billing" | Highest-accuracy attribution pattern |
| Stacked optimization | "cache+batch+route+gateway" | Compounding savings to ~5-10% baseline |

## Mais leitura

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
