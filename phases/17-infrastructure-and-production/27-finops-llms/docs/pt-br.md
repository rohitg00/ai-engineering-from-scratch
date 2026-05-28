# FinOps para LLMs — Economia Unitária e Atribuição Multi-Tenant

> FinOps tradicional quebra no gasto com LLM. Custos são transações em tokens, não tempo de recurso ativo. Tags não mapeiam — uma chamada de API é uma transação, não um ativo. Decisões de engenharia (design do prompt, janela de contexto, tamanho do output) são decisões financeiras. O playbook de 2026 tem três dimensões de atribuição pra instrumentar desde o dia um: por usuário (`user_id`) para pricing por seat e expansão, por tarefa (`task_id` + `route`) para custo da superfície do produto e priorização, por tenant (`tenant_id`) para economia unitária e renovação. Quatro camadas de tokens — prompt, ferramenta, memória, resposta — um balde só esconde gasto. Escada de aplicação para produtos multi-tenant: rate limit por tenant (2-3x o pico esperado, 429 claro + retry-after); teto de gasto diário (1.5-3x o piso contratado; dispara aperto de rate + alerta); kill switches em z-score de gasto > 4 (auto-pausa + page no plantão). Padrões de atribuição: tag-and-aggregate, telemetry-joiner (trace-ID → billing; maior acurácia), sampling-and-extrapolation, alocação baseada em modelo, event-sourced, streaming em tempo real. Métrica unitária: custo por consulta resolvida, custo por artefato gerado — não $/M tokens. Tagging retroativo sempre perde; instrumente no momento da criação da request.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador brincadeira de atribuição de custo com kill switch)
**Pré-requisitos:** Fase 17 · 13 (Observabilidade), Fase 17 · 14 (Caching)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Explicar por que FinOps tradicional (tags + tiers) quebra no gasto com LLM e nomear as três novas dimensões de atribuição.
- Listar as quatro camadas de tokens (prompt, ferramenta, memória, resposta) e por que faturamento em balde único esconde custo.
- Projet uma escada de aplicação (rate → teto de gasto → kill switch) para um produto multi-tenant.
- Escolher uma métrica unitária (custo por consulta resolvida / artefato) em vez de $/M tokens.

## O Problemo

Sua fatura diz $40.000. Você não sabe:
- Qual tenant gastou.
- Que funcionalidade do produto gerou.
- Se algum usuário individual foi abusivo.
- Se foi inchaço de prompt, chamadas de ferramenta ou amplificação de memória o culpado.

Tag-and-aggregate no lado do provedor funciona para recursos de cloud (EC2, S3) onde tags propagam para itens de linha. Chamadas de API LLM não fazem tag automática — você precisa estampar user/task/tenant no local da chamada e carregar adiante. Atribuição retroativa sempre perde edge cases.

## O Conceito

### Três dimensões de atribuição

**Por usuário** (`user_id`): quem custa quanto. Impulsiona pricing por seat, conversas de expansão, identifica power users.

**Por tarefa** (`task_id` + `route`): que superfície do produto custa quanto. Impulsiona priorização de funcionalidade, decisões de matar funcionalidades caras.

**Por tenant** (`tenant_id`): que cliente é lucrativo. Impulsiona economia unitária, pricing de renovação, thresholds de tier.

Instrumente todas as três no local da chamada desde o dia um. Retroativo é sempre pior.

### Quatro camadas de tokens

| Camada | Exemplo | % típico do total |
|--------|---------|-------------------|
| Prompt | input do sistema + do usuário | 40-60% |
| Ferramenta | resultados de tool-calls alimentados de volta | 20-40% (workloads de agent) |
| Memória | conversa anterior / docs recuperados | 10-30% |
| Resposta | output do modelo | 10-30% |

Agrupar as quatro juntas torna a otimização cega. Separe no seu esquema de atribuição.

### Escada de aplicação

1. **Rate limit** por tenant. 2-3x o pico esperado. Retorne 429 com `Retry-After`. Tenant vê atrito; sem conta surpresa.

2. **Teto de gasto diário** por tenant. 1.5-3x o piso contratado. Disparo: apertar rate limit + alertar customer-success.

3. **Kill switch** em z-score de gasto > 4 relativo ao baseline do tenant. Auto-pause no tenant; page no plantão; escalar pra ops + CS.

### Padrões de atribuição

- **Tag-and-aggregate**: estampe headers de metadata; agregue depois. Simples; grosseiro.
- **Telemetry joiner**: junte traces ao billing via trace IDs. Maior acurácia. O que times maduros fazem.
- **Amostragem + extrapolação**: amostragem de 5-10%, multiplique. Custo-eficiente pra gasto grosseiro; perde caudas.
- **Alocação baseada em modelo**: regressão pra inferir driver de custo. Para dados legacy sem tags.
- **Event-sourced**: custo como eventos em stream (Kafka / Kinesis). Tempo real.
- **Streaming em tempo real**: dashboard atualiza em sub-segundo.

### Custo por X é a métrica unitária

$/M tokens é linguagem de vendor. Métricas de produto:

- Custo por ticket de suporte resolvido.
- Custo por artigo gerado.
- Custo por tarefa de agente bem-sucedida.
- Custo por minuto de sessão de usuário.

Vincule custo a um resultado do produto. Senão otimização é desancorada.

### Formato do trace de atribuição de custo

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

Emita em toda chamada. Armazene no data lake. Agregue por dimensão. A stack de observabilidade da Fase 7 · 13 é onde isso vive.

### A stack de economias acumuladas

Stack: cache + batch + route + gateway. Com as quatro:
- Cache L2 (Fase 17 · 14): entrada ~10x mais barata.
- Batch (Fase 17 · 15): 50% off.
- Rotação para modelo barato (Fase 17 · 16): 60% de redução de custo.
- Eficiência do gateway (Fase 17 · 19): redundância + retries.

Melhor caso empilhado: ~5-10% do baseline bruto. A maioria dos times tem 2-3 alavancas ativas; poucos empilham as quatro.

### Números pra lembrar

- Dimensões de atribuição: por usuário, por tarefa, por tenant.
- Quatro camadas de tokens: prompt, ferramenta, memória, resposta.
- Kill switch: z-score de gasto > 4.
- Métrica unitária: custo por consulta resolvida, não $/M tokens.
- Otimizações empilhadas: ~5-10% do baseline possível.

## Use

`code/main.py` simula um serviço LLM multi-tenant com a escada de aplicação em três níveis. Injeta um tenant abusivo e demonstra o kill switch disparando.

## Entregue

Esta aula produz `outputs/skill-finops-plan.md`. Dado produto e escala, projeta o esquema de atribuição e a escada de aplicação.

## Exercícios

1. Execute `code/main.py`. Em qual z-score o kill switch dispara? Como escolhe o threshold?
2. Projet um dashboard de custo por tenant e por tarefa. Quais são as 5 views que você constrói primeiro?
3. Seu maior tenant tem economia unitária negativa. Proponha três intervenções ordenadas por impacto no cliente.
4. Calcule custo por ticket resolvido para um produto de suporte: 3M tokens/ticket, ~800 tickets/dia, taxa do GPT-5 com cache.
5. Argumente se tagging retroativo pode algum dia funcionar. Quando é aceitável?

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|---------------------------|
| Atribuição por usuário | "custo no nível do usuário" | `user_id` estampado em toda chamada |
| Atribuição por tarefa | "custo da funcionalidade" | `task_id` + `route` identificam superfície do produto |
| Atribuição por tenant | "custo do cliente" | `tenant_id`; impulsiona economia unitária |
| Quatro camadas de tokens | "camadas de custo" | prompt + ferramenta + memória + resposta |
| Rate limit | "guard de 429" | Piso por tenant aplicado no gateway |
| Teto de gasto diário | "piso diário" | Budget escopado por tenant com alerta |
| Kill switch | "auto-pausa" | z-score de gasto > 4 dispara auto-suspensão |
| Custo por resolvido | "métrica unitária do produto" | Custo vinculado a resultado do produto, não tokens |
| Telemetry joiner | "trace-para-billing" | Padrão de atribuição de maior acurácia |
| Otimização empilhada | "cache+batch+route+gateway" | Economias acumuladas até ~5-10% do baseline |

## Leitura Complementar

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
