---
name: finops-plan
description: Design an LLM FinOps program — attribution schema (user/task/tenant + four token layers), three-tier enforcement ladder, and unit metric (cost per resolved / artifact).
version: 1.0.0
phase: 17
lesson: 27
tags: [finops, cost-attribution, multi-tenant, kill-switch, unit-economics, rate-limit]
---
---
name: finops-plan
description: Design an LLM FinOps program — attribution schema (user/task/tenant + four token layers), three-tier enforcement ladder, and unit metric (cost per resolved / artifact).
version: 1.0.0
phase: 17
lesson: 27
tags: [finops, cost-attribution, multi-tenant, kill-switch, unit-economics, rate-limit]
---

Dada a superfície do produto, os níveis de locatário, os gastos mensais e o estado de atribuição atual, produza um plano FinOps.

Produzir:

1. Esquema de atribuição. `user_id`, `task_id`, `route`, `tenant_id` carimbados no local da chamada. Quatro contagens de camada de token (prompt/ferramenta/memória/resposta). Padrão de junção de telemetria preferido.
2. Métrica unitária. Defina a métrica de resultado do produto — custo por ticket resolvido, custo por artefato, custo por tarefa do agente, custo por sessão. Vincule ao modelo de faturamento.
3. Escada de fiscalização. Limite de taxa por locatário (pico de 2 a 3x), limite de gastos diários (contrato de 1,5 a 3x), interruptor de interrupção na pontuação z > 4.
4. Painel. Cinco visualizações principais: gasto atual por locatário, custo por resultado por tarefa, distribuição por usuário, impacto na taxa de acerto do cache, divisão de roteamento de modelo.
5. Auditoria de otimização empilhada. Verifique o cache (Fase 17 · 14), lote (Fase 17 · 15), roteamento (Fase 17 · 16), gateway (Fase 17 · 19) estão todos ativados. Sinalize alavancas faltando.
6. Revise a cadência. Semanalmente: maiores gastadores + anomalias. Mensalmente: economia da unidade por inquilino. Trimestralmente: nova triagem de cargas de trabalho em interativo/semi/lote.

Rejeições difíceis:
- Envio sem atribuição no site call. Recuse – a marcação retroativa perde cerca de 10-30% dos gastos.
- Faturamento de balde único. Recusar – requer divisão de quatro camadas de token.
- Kill switch sem base de pontuação z. Recusar — ​​exigir estatísticas de base antes de armar.

Regras de recusa:
- Se o produto tiver < 10 inquilinos, recuse a aplicação total de vários inquilinos — exija primeiro a atribuição básica por inquilino.
- Se o custo/resultado for indefinido, recuse o painel – escolha primeiro uma métrica unitária.
- Se qualquer inquilino único representar > 40% do gasto total, exija uma revisão dedicada da economia da unidade antes do envio do plano.

Resultado: um plano de uma página com esquema de atribuição, métrica de unidade, escada de aplicação, painel, auditoria de otimização empilhada, cadência de revisão. Termine com o alerta único: gasto diário vs projeção; página quando delta > 20%.