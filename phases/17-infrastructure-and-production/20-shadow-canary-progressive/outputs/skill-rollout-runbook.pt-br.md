---
name: rollout-runbook
description: Projete um plano de implementação shadow → canary → A/B → 100% para um novo modelo LLM ou modelo de prompt, com cinco portas canary, limites de reconhecimento de ruído e um caminho de reversão rápido em segundos.
version: 1.0.0
phase: 17
lesson: 20
tags: [rollout, canary, shadow, progressive-delivery, feature-flags, argo-rollouts, flagger, kserve]
---

Dada uma mudança candidata (novo modelo, novo modelo de prompt, nova política de roteador), métricas de produção de linha de base e tolerância ao risco, produza um runbook de implementação.

Produzir:

1. Plano sombrio. Duração (24-72 horas). Métricas registradas: saídas, contagens de tokens, latência, recusa, erro. Alerta sobre: ​​mudança de custo >20%, mudança de comprimento de saída >30%, qualquer violação de esquema.
2. Progressão canária. Estágios (1% → 10% → 25% → 50% → 75% → 100%). Duração por etapa (30m-24h com base no volume de tráfego; certifique-se de que cada etapa tenha dados suficientes para obter confiança estatística).
3. Cinco portões. Especifique os limites exatos para latência P99, custo/solicitação, erro/recusa, comprimento de saída P99, taxa de rejeição. Definir acima do nível de ruído (esperar 15% de variação irredutível).
4. Ferramentas. Nomeie o controlador de implementação (Argo Rollouts, Flagger, KServe) e o sistema de sinalização de recursos para reversão instantânea.
5. Caminho de reversão. Documente as três ações: inverter sinalizador → reverter resumo fixado → verificar. Tempo alvo: menos de 60 segundos de ponta a ponta.
6. Pular A/B? Justificar. As alterações na variante aprimorada ignoram A/B; mudanças distintamente diferentes (novo comportamento, nova curva de custos) requerem A/B.

Rejeições difíceis:
- Ignorando o modo sombra. Recusa – picos de custos e regressões de comprimento ultrapassam a avaliação offline.
- Portões com variação superior a 15%. Recuse – alarmes falsos interromperão implementações legítimas.
- Reversão que requer reimplantação. Recuse – não é um retrocesso, é um relatório de danos.

Regras de recusa:
- Se a alteração for crítica para a segurança (por exemplo, alteração no tratamento de PII), exija porta adicional explícita: zero vazamento de PII na amostra de sombra antes de iniciar o canário.
- Se o volume de tráfego for <100 req/hora, exija estágios canário estendidos — caso contrário, o ruído do portão sobrecarregará o sinal.
- Se a equipe não puder fornecer métricas de linha de base para os cinco portões canários, recuse a implementação – a linha de base é um pré-requisito.

Saída: um runbook de uma página com sombra, canário, portas, ferramentas, reversão, postura A/B. Termine com um requisito de exercício de reversão: ensaie a reversão uma vez antes da primeira implantação real.