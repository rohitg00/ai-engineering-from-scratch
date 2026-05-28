---
name: multi-region-router
description: Design a multi-region LLM routing plan with KV-cache locality, residency boundaries, DR manifest, and a quarterly failover drill.
version: 1.0.0
phase: 17
lesson: 11
tags: [multi-region, kv-cache, routing, dr, bedrock-cri, vllm-router, llm-d, gorgo]
---
---
name: multi-region-router
description: Design a multi-region LLM routing plan with KV-cache locality, residency boundaries, DR manifest, and a quarterly failover drill.
version: 1.0.0
phase: 17
lesson: 11
tags: [multi-region, kv-cache, routing, dr, bedrock-cri, vllm-router, llm-d, gorgo]
---

Dadas as regiões em escopo, limites de residência, diversidade esperada de cache de prefixo e SLA TTFT, produza um roteamento multirregional e um plano de DR.

Produzir:

1. Escolha do roteador. Escolha um roteador com reconhecimento de cache (vLLM Router, roteador llm-d) e descreva o canal de eventos KV. Indique o algoritmo de prefixo-hash (por exemplo, rolagem de 512 tokens) e o desempate (menor profundidade da fila).
2. Política de roteamento. Minimização regional ou global (estilo GORGO) de pré-preenchimento + RTT? Justifique com a distribuição de comprimento de prompt – prompts longos (> 8K tokens) se beneficiam do roteamento entre regiões; prompts curtos não.
3. Particionamento de residência. Antes de qualquer otimização: quais solicitações estão vinculadas a quais regiões por motivos legais (GDPR, HIPAA). Proibir o roteamento entre residências mesmo quando o TTFT melhorar.
4. Camada CRI comercial. Recomendamos ativar o Bedrock Cross-Region Inference ou o GKE Multi-Cluster Gateway como camada de disponibilidade. Declare claramente que esta camada NÃO é uma otimização TTFT.
5. Manifesto de DR. Mínimo de três arquivos (repositório HF + configuração do mecanismo + manifesto de implantação). Verifique se o tokenizer, as configurações de quantização, o RoPE, os modelos de bate-papo e os adaptadores LoRA estão incluídos. Indique o armazenamento (replicação entre regiões S3, GCS multirregional).
6. Exercício de failover. Cadência trimestral. Quem o executa, o que é medido (RTO, RPO, tempo de aquecimento do cache). Meta: RTO de 30 minutos correspondente ao exercício real do JPMorgan em 2024.

Rejeições difíceis:
- Ignorando residência para otimização de roteamento. Recusar – a violação do GDPR supera o ganho do TTFT.
- Reivindicar o Bedrock CRI "resolve" o roteamento entre regiões. Recusar — ​​CRI é disponibilidade, não TTFT.
- Apenas fazendo backup de pesos. Recusar – nomeie a estatística de falha de DR de 32% e exija o manifesto de três arquivos.

Regras de recusa:
- Se apenas uma região estiver no escopo, recuse o plano — uma única região tem diferentes modos de falha (a Fase 17 · 03 cobre isso).
- Se a residência e o SLA TTFT forem incompatíveis (por exemplo, a residência na UE força o pré-preenchimento no prefixo frio por solicitação com P99 TTFT < 100 ms em prompts de 8K), recuse-se a prometer o SLA e aumente a exigência do produto.

Saída: um roteador de nomenclatura de plano de uma página, política de roteamento, partições de residência, postura da camada CRI, manifesto de DR, proprietário de perfuração trimestral. Termine com a métrica única para alertar sobre: ​​taxa de acertos de cache de prefixo entre regiões caindo abaixo de um limite especificado pelo plano.