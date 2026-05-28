---
name: gpu-autoscaler-plan
description: Projete um plano de escalonamento automático de GPU de três camadas (Karpenter + KAI Scheduler + sinais de aplicativo) para um cluster de serviço LLM baseado em Kubernetes. Diagnosticar traps DCGM_FI_DEV_GPU_UTIL e falhas de alocação parcial.
version: 1.0.0
phase: 17
lesson: 03
tags: [kubernetes, gpu, autoscaling, karpenter, kai-scheduler, hpa, dynamo-planner, llm-d]
---

Dada a topologia do cluster (nós, tipos de GPU, domínios NVLink), formato da carga de trabalho (configuração TP/PP, simultaneidade média, fator de intermitência) e SLO (TTFT P99, goodput), produza um plano de escalonamento automático de três camadas.

Produzir:

1. Camada 1 — Karpenter NodePool. Especifique `instance-type`, `capacity-type` (sob demanda/spot/reservado), `consolidationPolicy` (deve ser `WhenEmpty` com `consolidateAfter: 1h` para pools de GPU), taints que excluem cargas de trabalho não-GPU e rótulos para seleção do KAI Scheduler.
2. Camada 2 — Política do Agendador KAI. Indique se é necessário agendamento de turma (sim para TP/PP > 1). Definir restrição de topologia (domínio NVLink, rack, zona). Especifique a hierarquia da fila e as regras de preempção para inquilinos de produção versus treinamento.
3. Camada 3 — Escalonador automático de aplicativos. Escolha o sinal: profundidade da fila para cargas de trabalho pré-preenchidas, utilização de cache KV para decodificação, goodput composto para misto. Proibir `DCGM_FI_DEV_GPU_UTIL` e explicar o porquê.
4. Divisão desagregada. Se estiver usando o pré-preenchimento/decodificação desagregado da Fase 17 · 17, especifique HPAs separados — sinal de profundidade da fila para o conjunto de pré-preenchimento, sinal de utilização de KV para o conjunto de decodificação.
5. Dimensionamento da piscina quente. Réplicas mínimas prontas para caminhos críticos de SLO, com base na restrição P99 TTFT e no tempo de inicialização a frio observado (provisão de nó + carga do modelo).
6. Monitoramento. Métricas para o painel: profundidade da fila por réplica, utilização de KV por réplica, tempo de espera de provisionamento de nós, contagem de adiamento de agendamento de grupo, eventos de consolidação do Karpenter.

Rejeições difíceis:
- Recomendando HPA em `DCGM_FI_DEV_GPU_UTIL`. Recuse e nomeie a profundidade da fila + utilização de KV como os sinais corretos.
- Saindo de `consolidationPolicy: WhenEmptyOrUnderutilized` para um pool de GPU. Recuse e cite o risco de despejo de emprego.
- Ignorar o agendamento de grupo para uma carga de trabalho TP/PP. Recuse - a alocação parcial é um antipadrão que queima $.

Regras de recusa:
- Se o cluster tiver apenas um tipo de GPU e um nó, recuse propor o Karpenter — o cliente precisa primeiro de gerenciamento sem servidor (Fase 17 · 02).
- Se o operador solicitar "escalar a memória da GPU", recuse — vLLM pré-aloca para `--gpu-memory-utilization`; a memória permanece perto de 90% mesmo com uma solicitação.
- Se o agendamento coletivo for recusado para uma carga de trabalho TP-8 alegando complexidade, recuse-se a certificar o plano – a colocação de pod único em 8 GPUs dispersas falha atomicamente.

Resultado: um plano de uma página com um snippet Karpenter YAML, um snippet de configuração do KAI Scheduler, uma opção de sinal HPA/escalador automático personalizado, um número de pool quente e cinco métricas de painel. Termine com um único kill switch: se o P99 TTFT violar, reverta para o último estado conhecido do escalonador automático.