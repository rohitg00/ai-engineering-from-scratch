---
name: cold-start-planner
description: Escolha e empilhe mitigações de inicialização a frio para implantações LLM sem servidor. Fases do orçamento (nó, imagem, pesos, mecanismo, primeiro encaminhamento) e correspondência das mitigações ao SLA.
version: 1.0.0
phase: 17
lesson: 10
tags: [cold-start, serverless, bottlerocket, model-streamer, gpu-snapshot, warm-pool, serverlessllm]
---

Dado o tamanho do modelo, o SLA (TTFT P99), o formato do tráfego (estável ou intermitente) e a postura orçamentária, produza um plano de mitigação de inicialização a frio.

Produzir:

1. Orçamento inicial a frio. Divida o caminho bruto de inicialização a frio (provisão de nó, extração de imagem, pesos para HBM, inicialização do mecanismo, primeiro encaminhamento). Use 2.026 segundos nominais para o tamanho do modelo indicado.
2. Seleção de camada. Escolha o número mínimo de camadas que traz o total abaixo do SLA: imagem pré-projetada (L1), streamer de modelo (L2), instantâneo de GPU (L3), pool quente (L4), carregamento em camadas (L5). Justifique cada camada em relação à fase específica que ela ataca.
3. Dimensionamento da piscina quente. Indique `min_workers` para o caminho principal. Se o SLA for TTFT P99 < 60s em um modelo 70B+, torne a piscina aquecida obrigatória, independentemente do custo.
4. Estimativa de custos. Custo mensal da GPU para o pool quente escolhido e o número esperado de inicializações a frio por dia.
5. Política de cauda. O que acontece com o primeiro usuário em uma réplica nova: ele entra na fila para uma réplica quente ou paga a taxa de inicialização a frio? Nomeie uma política específica (por exemplo, "encaminhe a primeira solicitação para qualquer réplica quente dentro de 10s; passe para fria").
6. Modo de falha. O que acontece se uma réplica quente morrer no meio da sessão. A recuperação é automática (migração ao vivo) ou é uma inicialização a frio na próxima solicitação?

Rejeições difíceis:
- Propor “basta adicionar piscina aquecida” sem computar o custo mensal.
- Reivindicar uma mitigação sem uma fase específica que ela ataca (por exemplo, "usar Bottlerocket" sem dizer que elimina a atração da imagem dos anos 180).
- Ignorar a restrição de topologia por GPU em snapshots de GPU — se a plataforma migrar SKU, os snapshots serão inválidos.

Regras de recusa:
- Se o SLA for TTFT P99 < 5s em uma nova partida a frio de 70B sem pool quente, recuse – matematicamente impossível em velocidades de infraestrutura de 2026.
- Se o orçamento proíbe o pool quente, mas o SLA exige inicialização a frio abaixo dos 30 anos, nomeie a correção específica da plataforma (instantâneos de GPU modal, pré-aquecimento Baseten) e recuse-se a prometer o SLA em uma plataforma diferente sem ele.
- Se a operadora solicitar escala até zero com tráfego intermitente e um modelo de 70B, recuse-se a prometer SLA — a matemática não funciona sem snapshots ou pools quentes.

Resultado: um plano de uma página listando fases, camadas, `min_workers`, custo mensal, política final, modo de falha. Termine com a métrica única para alertar: P99 duração da partida a frio durante a última hora contínua.