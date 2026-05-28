---
name: ab-plan
description: Projete um teste LLM A/B - escolha plataforma (Statsig ou GrowthBook), métrica primária, grades de proteção, tamanho de amostra com buffer de ruído LLM, CUPED, parada sequencial e correção de comparação múltipla.
version: 1.0.0
phase: 17
lesson: 21
tags: [ab-testing, statsig, growthbook, cuped, sequential, benjamini-hochberg, srm]
---

Dada a mudança de recurso (prompt/modelo/parâmetro de geração), métricas de linha de base, aumento esperado e postura da equipe (OSS nativo do armazém vs SaaS em pacote), produza um plano A/B.

Produzir:

1. Plataforma. Statsig (pacote SaaS, de propriedade da OpenAI) ou GrowthBook (MIT OSS, nativo do warehouse). Justificar.
2. Métrica primária + guarda-corpos. Primária é a métrica que você está tentando mover; guardrails são coisas que não devem regredir (custo/solicitação, latência P99, taxa de recusa).
3. Tamanho da amostra. Cálculo de potência clássico × 1,4 (buffer de não determinismo LLM).
4. Projeto. Horizonte fixo ou sequencial. Sequencial se você espera sinais fortes; corrigido se a mudança for sutil.
5. COPO. Habilite se existirem dados pré-período para a métrica primária; especifique o regressor.
6. Correção. Bonferroni para pequeno número de testes; Benjamini-Hochberg por muitos testes relacionados.
7. SRM. Exigir verificação do SRM em todos os experimentos; interromper e depurar se sinalizado.

Rejeições difíceis:
- Envio em vibrações. Recusar – requer exceção A/B ou exceção não-A/B documentada.
- Executar >5 experimentos na mesma métrica primária sem BH/Bonferroni. Recusar — ​​falsa descoberta certa.
- Ignorando a verificação do SRM. Recuse – bugs de atribuição são comuns.

Regras de recusa:
- Se o tráfego for < 1.000 usuários/semana para o recurso, recuse A/B fixo — em vez disso, exija shadow + canary (Fase 17 · 20).
- Se a métrica primária for subjetiva (por exemplo, “qualidade”) sem uma proxy objetiva, exija avaliação humana em paralelo.
- Se a hipótese de elevação for menor que o nível de ruído do LLM, recuse — o experimento não pode detectá-la com um tamanho de amostra realista.

Resultado: um plano de uma página com plataforma, primário + proteções, tamanho da amostra, design, CUPED, correção, política de SRM. Termine com a regra de decisão: primário significativo + todos os guardrails não significativos-negativos → navio; qualquer violação do guardrail → não envie independentemente do primário.