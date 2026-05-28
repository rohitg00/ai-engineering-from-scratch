---
name: batch-triager
description: Faça a triagem de cargas de trabalho do LLM em faixas interativas/semiinterativas/em lote, calcule economias de descontos empilhados (lote + cache) e sinalize cargas de trabalho mal triadas.
version: 1.0.0
phase: 17
lesson: 15
tags: [batch-api, openai-batch, anthropic-batches, vertex-batch, triage, cost]
---

Dada uma carga de trabalho (nome, expectativa do usuário quanto à latência, volume de tráfego, estrutura de prompt compartilhada), produza um plano de triagem + custo.

Produzir:

1. Pista. Interativo (vinculado a TTFT, sincronização), semiinterativo (minutos OK, fila assíncrona) ou em lote (OK pela manhã, API em lote). Justifique com a expectativa específica do usuário.
2. Custo atual. Calcule o custo mensal na configuração atual (sincronização, sem cache, etc.).
3. Custo alvo. Custo de cálculo após configuração recomendada (lote + cache ou sincronização + cache). Expresse como% da corrente.
4. Plano de migração. Etapas específicas do provedor (escolha aquela que corresponde ao modelo da carga de trabalho, não ambas):
   - OpenAI: migre para `/v1/batches`. O cache de prompts é ativado automaticamente para prompts qualificados (≥1.024 tokens) — não há `cache_control` para definir. Opcionalmente, passe `prompt_cache_key` para uma atribuição mais precisa.
   - Antrópico: migrar para Message Batches. A reutilização de cache requer blocos `cache_control` explícitos (por exemplo, `{"type": "ephemeral"}`) nos intervalos de prompt armazenáveis ​​em cache; pilhas de descontos em lote com preços de leitura em cache.
   - Ambos: instrumente um webhook de sucesso/falha e uma via de transbordamento para sincronizar lotes que perdem a janela de resposta.
5. Risco. E se o tempo de entrega do lote for de 20 horas no P99? Nomeie o comportamento downstream do sistema (entrega de e-mail, transbordamento de fila para sincronização).
6. Observável. Métrica que detecta erros de triagem: latência de conclusão do trabalho em lote P95; alerta se > 12 horas.

Rejeições difíceis:
- Executar um pipeline noturno em modo de sincronização sem lote quando o usuário precisa apenas de latência "pela manhã". Recuse – destaque os cerca de 90% dos gastos vazados.
- Lote promissor para qualquer coisa com expectativa de usuário inferior a 15 minutos. Recusar — ​​o SLA do lote é de 24h.
- Ignorando o cache de prompt em uma carga de trabalho em lote com prompt de sistema compartilhado. Recuse – o desconto acumulado é o ponto.

Regras de recusa:
- Se a carga de trabalho for comercializada como "tempo real", mas a expectativa real do usuário for de minutos, exija uma confirmação explícita antes de recomendar o lote.
- Se a carga de trabalho for direcionada a um provedor sem cache imediato em lote (por exemplo, qualquer pilha personalizada ou auto-hospedada sem reutilização de prefixo KV), observe que apenas o desconto em lote se aplica e recalcula sem economias acumuladas. O cache em lote OpenAI é automático; O cache em lote antrópico requer blocos `cache_control` explícitos.
- Se a carga de trabalho tiver SLA de latência estrita (por exemplo, P99 < 60s), recuse o lote imediatamente — ele pertence a uma via diferente.

Resultado: uma triagem de uma página com faixa, custo atual, custo alvo, etapas de migração, risco, observável. Termine com uma cadência: faça nova triagem de todas as cargas de trabalho trimestralmente à medida que a superfície do produto muda.