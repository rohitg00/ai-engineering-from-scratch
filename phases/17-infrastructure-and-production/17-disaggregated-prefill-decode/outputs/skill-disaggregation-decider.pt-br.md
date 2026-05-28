---
name: disaggregation-decider
description: Decida se deseja adotar o pré-preenchimento/decodificação desagregado (Dynamo ou llm-d) para uma determinada carga de trabalho e cluster. Quantifique as taxas de pré-preenchimento:decodificação, o custo de transferência de KV e as economias esperadas.
version: 1.0.0
phase: 17
lesson: 17
tags: [disaggregated-serving, dynamo, llm-d, nixl, kv-transfer, prefill-decode]
---

Dado o perfil da carga de trabalho (distribuição do comprimento do prompt/saída, modelo, simultaneidade), a topologia do cluster (GPUs, malha, disponibilidade de RDMA) e o custo de serviço atual, produza uma decisão de desagregação.

Produzir:

1. Desagregar? Sim/Não com justificativa numerada. Linha de base: prompts > 512 E saídas > 200. Estrutura: ajudas disponíveis em RDMA; Somente TCP aumenta o ponto de equilíbrio por mais tempo.
2. Escolha da pilha. NVIDIA Dynamo (orquestrador gerenciado acima de vLLM/SGLang/TRT-LLM) ou llm-d (serviços nativos do Kubernetes). Combine com o contexto operacional.
3. Pré-preenchimento: relação de decodificação. Use leituras do Dynamo Planner Profiler ou calcule a partir do formato da carga de trabalho (pré-preenchimento de TFLOPS versus decodificação de bytes/s). Exemplo: 2 pré-preenchimento: 1 decodificação para RAG pesado; 1:2 para saída pesada.
4. Plano de transferência KV. Transporte nomeado (NIXL sobre fallback InfiniBand/RDMA/TCP). Calcule o imposto de transferência por solicitação para seu prompt P99.
5. Integração do roteador. O roteador com reconhecimento de cache (Fase 17 · 11) deve estar na frente - a desagregação sem correspondência de prefixo perde a vitória do cache.
6. Economias esperadas. Linha de base computacional versus colocada; citar o caso publicado (30-40% no mesmo SLA).

Rejeições difíceis:
- Desagregação de cargas de trabalho de prompt curto (<512 tokens). Recuse – o imposto de transferência domina.
- Implantação sem um roteador com reconhecimento de cache. Recusar – o roteamento cego nega a localidade KV.
- Ignorando topologia (empacotamento de rack). Recusar — ​​A transferência de KV em saltos de vários racks custa mais do que o RDMA no mesmo rack.

Regras de recusa:
- Se o cluster tiver < 4 GPUs, recuse — diversidade de pool insuficiente para que a desagregação valha a pena.
- Se não houver RDMA/InfiniBand e nenhum plano, observe que o TCP aumenta o ponto de equilíbrio para prompts >2K; reavaliar.
- Se a equipe não puder operar dois pools de GPU com escalonamento por função, recuse o llm-d e exija o Dynamo como alternativa gerenciada.

Saída: uma decisão de uma página com Y/N desagregado, escolha de pilha, proporção, transporte, roteador, economia esperada. Finalize com a métrica única para verificar: latência de transferência KV P99; limite ao exceder um limite especificado pelo plano.