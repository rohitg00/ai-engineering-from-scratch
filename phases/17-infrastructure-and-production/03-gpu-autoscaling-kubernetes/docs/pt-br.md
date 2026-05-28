# Auto-escalabilidade de GPU no Kubernetes — Karpenter, KAI Scheduler, Gang Scheduling

> Três camadas, não uma. O Karpenter provisiona nós dinamicamente (em menos de um minuto, 40% mais rápido que o Cluster Autoscaler). O KAI Scheduler lida com gang scheduling, consciência de topologia e filas hierárquicas — ele evita a armadilha da alocação parcial de 7-de-8, onde sete nós ficam esperando e queimando dinheiro por causa de uma GPU faltando. Auto-escaladores de nível de aplicação (NVIDIA Dynamo Planner, llm-d Workload Variant Autoscaler) escalam em sinais eespecificaçãoíficos de inferência — profundidade de fila, utilização de KV cache — não em duty-cycle de CPU/DCGM. A armadilha clássica do HPA é que `DCGM_FI_DEV_GPU_UTIL` é uma medição de duty-cycle: 100% pode ser 10 requests ou 100. vLLM pré-aloca memória de KV cache, então memória nunca dispara scale-down. Esta aula te ensina a compor as três camadas e evitar a política padrão do Karpenter `WhenEmptyOrUnderutilized` que termina jobs de GPU rodando no meio de uma inferência.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, simulador de auto-escalador de profundidade de fila toy)
**Pré-requisitos:** Fase 17 · 02 (Economia de Plataformas de Inferência), Fase 17 · 04 (Internals de Serving vLLM)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Diagramar as três camadas de auto-escalabilidade (provisionamento de nós, gang scheduling, nível de aplicação) e nomear a ferramenta usada em cada camada.
- Explicar por que `DCGM_FI_DEV_GPU_UTIL` é o sinal errado de HPA para vLLM e nomear dois substitutos (profundidade de fila, utilização de KV cache).
- Descrever o gang scheduling e o modo de falha de alocação parcial que o KAI Scheduler evita (7 de 8 GPUs ociosas).
- Nomear a política de consolidação do Karpenter (`WhenEmptyOrUnderutilized`) que termina jobs de GPU rodando e declarar a alternativa segura de 2026.

## O Problema

Sua equipe entrega um serviço de serving de LLM no Kubernetes. Você configura HPA com `DCGM_FI_DEV_GPU_UTIL` como sinal. O serviço fica em 100% de utilização durante o horário comercial. HPA nunca escala para cima — ele já acha que você está cheio. Você adiciona uma réplica manualmente; TTFT cai. HPA ainda não escala. O sinal está te mentindo.

Separadamente, você usa o Cluster Autoscaler para nós. Um prompt de 1M de tokens chega às 2h da manhã; o cluster gasta 3 minutos provisionando um nó, e o request dá timeout.

Separadamente de novo, você implanta um modelo 70B que precisa de 8 GPUs em 2 nós. O cluster tem 7 GPUs livres e 1 espalhada entre 3 nós. O Cluster Autoscaler provisiona um nó para a 1 GPU faltante. Sete nós esperam 4 minutos queimando dinheiro enquanto o Kubernetes sobe a última GPU.

Três camadas, três modos de falha diferentes. Auto-escalabilidade com consciência de GPU em 2026 não é "ligar o HPA." É compor provisionamento de nós, gang scheduling e auto-escalabilidade por sinais de aplicação.

## O Conceito

### Camada 1 — provisionamento de nós (Karpenter)

O Karpenter observa pods pendentes e provisiona nós em ~45-60 segundos (o Cluster Autoscaler normalmente leva 90-120 segundos para nós de GPU). Ele escolhe tipos de instância dinamicamente pela restrição `NodePool` — se seu pod precisa de 8 H100s e o cluster não tem um nó correspondente, o Karpenter provisiona um diretamente em vez de escalar um grupo existente.

**A armadilha da consolidação**: a política padrão `consolidationPolicy: WhenEmptyOrUnderutilized` do Karpenter é perigosa para pools de GPU. Ele vai terminar um nó de GPU rodando para migrar pods para uma instância mais barata e de tamanho adequado. Para workloads de inference, isso significa evacuar requests em execução e recarregar um modelo 70B no novo nó. A perda são minutos de capacidade mais falhas de request.

Configuração segura para pools de GPU:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

Permite que o Karpenter consolide nós realmente vazios depois de uma hora mas nunca evacua um job em execução.

### Camada 2 — gang scheduling (KAI Scheduler)

O KAI Scheduler (projeto "Karp" depois renomeado) lida com o que o kube-scheduler padrão não resolve:

**Gang scheduling** — agendamento all-or-nothing. Um pod de inferência distribuída que precisa de 8 GPUs ou começa as 8 juntas ou nenhuma começa. Sem isso, você pega a armadilha da alocação parcial: 7 dos 8 pods começam, esperam indefinidamente, queimam dinheiro.

**Consciência de topologia** — saber quais GPUs compartilham NVLink, quais estão no mesmo rack, quais têm InfiniBand entre elas. Colocar os pods de acordo. Um workload de DeepSeek-V3 67B com tensor parallelism tem que ficar em um domínio NVLink; o KAI Scheduler respeita isso.

**Filas hierárquicas** — múltiplas equipes competindo pelo mesmo pool de GPU com prioridade e quota. A prioridade de produção da Equipe A é preemptada pelo job de treinamento da Equipe B apenas se as regras de prioridade permitirem.

KAI é implantado ao lado do kube-scheduler como um agendador secundário; você anota os workloads para usá-lo. Ray e vLLM production-stack integram os dois.

### Camada 3 — sinais de nível de aplicação

**A armadilha do HPA**: `DCGM_FI_DEV_GPU_UTIL` é uma métrica de duty-cycle — mede se a GPU estava trabalhando em cada intervalo de amostragem. 100% de utilização pode significar 10 requests concorrentes ou 100; a GPU estava ocupada de qualquer jeito. Escalar por duty-cycle é escalar às cegas.

Pior, vLLM e engines similares pré-alocam memória de KV cache (até `--gpu-memory-utilization`). Uso de memória fica perto de 90% mesmo com um request. HPA baseado em memória nunca faz scale-down.

**Sinais de substituição para 2026**:

- Profundidade de fila (número de requests esperando prefill).
- Utilização de KV cache (fração de blocos alocados para sequências ativas).
- P99 TTFT por réplica (seu sinal de SLA).
- Goodput (requests que atingem todos os SLOs por segundo).

NVIDIA Dynamo Planner e llm-d Workload Variant Autoscaler consomem esses sinais e escalam réplicas. Eles substituem o HPA inteiramente para serving de LLM.

### Quando usar o quê

| Decisão de escala | Ferramenta |
|-------------------|------------|
| Adicionar/remover nós | Karpenter |
| Agendar jobs multi-GPU | KAI Scheduler |
| Adicionar/remover réplicas | Dynamo Planner / llm-d WVA (ou HPA custom na profundidade de fila) |
| Escolher tipo de GPU | Karpenter NodePool |
| Preemptar baixa prioridade | Filas do KAI Scheduler |

### Prefill/decode disaggregado complica tudo

Se você roda prefill/decode disaggregado (Fase 17 · 17), você tem duas classes de pods com triggers de escala diferentes: pods de prefill escalam na profundidade da fila, pods de decode escalam na pressão do KV cache. O llm-d expõe esses como `Services` separados com HPA por papel. Não tente colocar um único HPA na frente dos dois.

### Cold start importa aqui também

Mitigação de cold start (Fase 17 · 10) é onde o tempo de provisionamento de nó se torna visível para o usuário. O warm-up de 45-60 segundos do Karpenter mais o carregamento de um modelo de 20GB mais a inicialização da engine significa que um request do zero leva 2-5 minutos. Mantenha um pool quente (`min_workers=1`) para camadas críticas de SLA, ou use checkpointing estilo Modal na camada de aplicação.

### Números que você deve memorizar

- Provisionamento de nós do Karpenter: ~45-60s vs Cluster Autoscaler ~90-120s (nós de GPU).
- KAI Scheduler evita desperício de alocação parcial — armadilha 7-de-8.
- `DCGM_FI_DEV_GPU_UTIL` como sinal de HPA: quebrado; use profundidade de fila ou utilização de KV.
- Karpenter `WhenEmptyOrUnderutilized`: termina jobs de GPU rodando. Use `WhenEmpty + consolidateAfter: 1h` para inferência.

## Use

`code/main.py` simula um auto-escalador de três camadas em um workload de GPU bursty. Compara HPA ingênuo (duty-cycle), HPA por profundidade de fila e escalabilidade com gang scheduling do KAI. Reporta requests não atendidos, minutos de GPU ociosa e um score composto.

## Entregue

Esta aula produz `outputs/skill-gpu-autoscaler-plan.md`. Dada topologia de cluster, forma do workload e SLO, projeta um plano de auto-escalabilidade de três camadas.

## Exercícios

1. Execute `code/main.py`. Em um workload bursty, quantos requests o HPA ingênuo por duty-cycle perde que o HPA por profundidade de fila pega? De onde vem a diferença?
2. Projete um NodePool do Karpenter para um cluster servindo Llama 3.3 70B FP8 em H100 SXM5. Eespecificaçãoifique `capacity-type`, `disruption.consolidationPolicy`, `consolidateAfter` e um taint que mantém workloads não-GPU fora desses nós.
3. Sua equipe relata que deployments estão presos no Pending porque "GPUs disponíveis mas o pod não agenda." Diagnosticar — é Karpenter, kube-scheduler ou KAI Scheduler? Quais métricas confirmam?
4. Escolha um sinal para auto-escalar pods de prefill disaggregados e um sinal diferente para pods de decode. Justifique os dois.
5. Calcule o custo da armadilha de consolidação `WhenEmptyOrUnderutilized` em um serviço de produção 24x7 que média 60 eventos de perda de request/dia com TTFT P99 > 10s.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Karpenter | "o provisionador de nós" | Auto-escalador de nós do Kubernetes; provisionamento sub-minuto |
| Cluster Autoscaler | "o escalador antigo" | Predecessor do auto-escalador de nós do Kubernetes; mais lento, baseado em grupo |
| KAI Scheduler | "o agendador de GPU" | Scheduler secundário para gang + topologia + filas |
| Gang scheduling | "all or nothing" | Agendar N pods atomicamente ou adiar todos |
| Consciência de topologia | "consciente do rack" | Colocar pods baseado em posicionamento NVLink/IB/rack |
| `DCGM_FI_DEV_GPU_UTIL` | "utilização de GPU" | Métrica de duty-cycle; NÃO é sinal de escala para LLMs |
| Profundidade de fila | "requests esperando" | Sinal correto de HPA para escala limitada por prefill |
| Utilização de KV cache | "pressão de memória" | Sinal correto de HPA para escala limitada por decode |
| Consolidação | "consolidação do Karpenter" | Terminação de nó para tipo de instância mais barato |
| `WhenEmpty + 1h` | "consolidação segura" | Política que não evacua jobs de GPU rodando |

## Leitura Complementar

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) — docs de design e exemplos de configuração.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) — semântica da política de consolidação e configurações-padrão seguros para GPU.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — sinais de escala do Dynamo Planner.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) — padrão de integração com Ray.
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) — orientação eespecificaçãoífica para Kubernetes gerenciado.
- [llm-d GitHub](https://github.com/llm-d/llm-d) — design do Workload Variant Autoscaler.
