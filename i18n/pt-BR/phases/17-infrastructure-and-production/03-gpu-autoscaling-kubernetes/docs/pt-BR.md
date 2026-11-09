# GPU Autoescala em Kubernetes  Karpenter, KAI Scheduler, Gang Scheduling

> Três camadas, não uma. Os pontos de provisão de Karpenter são dinâmicos (menos de um minuto, 40% mais rápido que o Cluster Autoscaler). O KAI Scheduler lida com a programação de gangues, a consciência de topologia e as filas hierárquicas. Previve a armadilha de alocação parcial de 7 de 8 onde sete nós esperam e queimam em uma GPU faltante. Os autoscalers de nível de aplicação (NVIDIA Dynamo Planner, llm-d Workload Variant Autoscaler) escalam em sinais específicos de inferência  profundidade de fila, utilização do cache KV  não ciclo de trabalho da CPU / DCGM. A armadilha clássica da HPA é que`DCGM_FI_DEV_GPU_UTIL`é uma medição do ciclo de trabalho: 100% pode ser 10 solicitações ou 100. vLLM pré-aloca a memória cache KV, para que a memória nunca inicie a escalação. Esta lição ensina você a compor as três camadas e evitar o default Karpenter `WhenEmptyOrUnderutilized`A política que termina a execução de trabalhos de GPU no meio da inferência.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Diagrama as três camadas de autoescalação (provisão de nós, agendamento de banda, nível de aplicação) e nome a ferramenta utilizada em cada camada.
- Explique por que .`DCGM_FI_DEV_GPU_UTIL`é o sinal HPA errado para vLLM e nomear duas substituições (profundeza da fila, utilização do cache KV).
- Descreva a programação de banda e o modo de falha de alocação parcial que o KAI Scheduler impede (7 das 8 GPUs inactivas).
- Nomear a política de consolidação da Karpenter (`WhenEmptyOrUnderutilized`) que encerra a execução de trabalhos de GPU e estabelece a alternativa segura para 2026.

## O problema

A sua equipa envia um serviço de LLM em Kubernetes.`DCGM_FI_DEV_GPU_UTIL`O HPA nunca aumenta a escala, já pensa que você está cheio, adiciona uma réplica manualmente, o TTFT cai, o HPA ainda não escala, o sinal está mentindo.

Separadamente, você usa o Cluster Autoscaler para nós. Um sinal de 1M chega às 2 da manhã; o cluster passa 3 minutos provisionando um nó, e os tempos de solicitação.

Separadamente, você implementa um modelo 70B que requer 8 GPUs em 2 nós. O cluster tem 7 GPUs livres, espalhados por 3 nós, e precisa de mais 1. Cluster Autoscaler fornece um nó para o 1 GPU faltante. As 7 GPUs reservadas ficam inativas por 4 minutos queimando dinheiro enquanto Kubernetes ganha a última GPU.

Três camadas, três modos de falha diferentes. Autoescalação consciente da GPU em 2026 não é "ativar HPA". É compor provisionamento de nós, agendamento de banda e autoescalação de sinais de aplicação.

## O conceito

### Layer 1  provisionamento de nós (Karpenter)

Karpenter observa os pods pendentes e os nós de provisão em ~ 45-60 segundos (Cluster Autoscaler normalmente leva 90-120 segundos para os nós GPU).`NodePool`restrição  se o seu módulo precisa de 8 H100s e o cluster não tem um nó correspondente, Karpenter provê um diretamente em vez de escalar um grupo existente.

**The consolidation trap**O default do Karpenter.`consolidationPolicy: WhenEmptyOrUnderutilized`É perigoso para os pools de GPU. Ele terminará um nó de GPU em execução para migrar pods para uma instância de tamanho certo mais barata. Para cargas de trabalho de inferência que significam despejar solicitações em execução e recarregar um modelo 70B no novo nó. Perda é minutos de capacidade mais falhas de solicitação.

Configuração segura para pools de GPU:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

Deixa o Karpenter consolidar nós verdadeiramente vazios depois de uma hora, mas nunca despejar um emprego em execução.

### Layer 2  agendamento de gangs (KAI Scheduler)

O KAI Scheduler (projeto "Karp" então renomeado) lida com o que o kube-scheduler padrão não faz:

**Gang scheduling**Uma cápsula de inferência distribuída que requer 8 GPUs ou todas as 8 começam juntas ou nenhuma. sem isso, você tem a armadilha de alocação parcial: 7 de 8 cápsulas começam, esperam indefinidamente, queimam dinheiro.

**Topology awareness** saber quais GPUs compartilham NVLink, que estão na mesma plataforma, que têm InfiniBand entre eles. Colocar pods de acordo. Uma carga de trabalho tensor-parallel DeepSeek-V3 67B deve permanecer em um domínio NVLink; KAI Scheduler respeita isso.

**Hierarchical queues** várias equipes competem pelo mesmo pool de GPU com prioridade e quota.

O KAI é implementado ao lado do kube-scheduler como um cronograma secundário; você anota cargas de trabalho para usá-lo.

### Capela 3  sinais de nível de aplicação

**The HPA trap**- Não .`DCGM_FI_DEV_GPU_UTIL`é uma métrica de ciclo de trabalho  que mede se a GPU estava fazendo trabalho em cada intervalo de amostragem. Utilização 100% poderia significar 10 solicitações simultâneas ou 100; a GPU estava ocupada de qualquer maneira. Escalagem no ciclo de trabalho está a escalando cegamente.

Pior ainda, os motores vLLM e similares pré-alocam a memória cache KV (até `--gpu-memory-utilization`O uso de memória permanece próximo de 90% mesmo com uma única solicitação.

**2026 replacement signals**- Não .

- Profundidade da fila (número de pedidos em espera de preenchimento).
- Utilização do cache KV (qual é a fração de blocos atribuída às sequências ativas).
- Por replica P99 TTFT (o seu sinal SLA).
- O resultado final é o resultado final do processo de verificação.

O Planeador Dynamo da NVIDIA e o Variante de Carga de Trabalho de llm-d Autoscaler consomem esses sinais e réplicas de escala.

### Quando utilizar o que

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### Preenchimento/decodificação desagregado complica tudo

Se executar pré-reempimento/decodificação desagregada (Fase 17 · 17), terá duas classes de cápsulas com diferentes desencadeadores de escala: escala de cápsulas de pré-reempimento na profundidade da fila, escala de cápsulas de decodificação na pressão do cache KV. llm-d expõe-as como separadas `Services`Não tente colocar um único HPA em frente a ambos.

### O início frio também importa aqui .

A mitigação do início a frio (fase 17 · 10) é quando o tempo de provisionamento do nó torna-se visível ao usuário.`min_workers=1`) para os caminhos críticos para o SLO, ou utilizar o ponto de controlo de estilo Modal na camada de aplicação.

### Números que você deve lembrar

- Provisão de nós de carpenter: ~ 45-60s vs Cluster Autoscaler ~ 90-120s (nodos GPU).
- O agendador KAI evita a queda de resíduos de alocação parcial  7 em 8.
- `DCGM_FI_DEV_GPU_UTIL`como sinal HPA: quebrado; utilizar profundidade de fila ou utilização de KV.
- Carpenter `WhenEmptyOrUnderutilized`O que é que é o problema?`WhenEmpty + consolidateAfter: 1h`Para inferir.

```figure
autoscaling
```

## Usá-lo

`code/main.py`Simula um autoescalador de três camadas em uma carga de trabalho de GPU quebrada. Compara HPA ingênuo (ciclo de serviço), HPA de profundidade de fila e escalação programada pela banda KAI. Relata solicitações não atendidas, minutos de GPU inativos e uma pontuação composta.

## Envia-o

Esta lição produz`outputs/skill-gpu-autoscaler-plan.md`Considerando a topologia do cluster, a forma da carga de trabalho e o SLO, ele desenha um plano de autoescalação de três camadas.

## Exercícios

1. Corra .`code/main.py`Sob uma carga de trabalho intensa, quantos pedidos o HPA naívo de ciclo de trabalho faz cair que a HPA de profundidade de fila captura?
2. Desenhar um NodePool Karpenter para um cluster que serve Llama 3.3 70B FP8 no H100 SXM5. Especificar `capacity-type`- Não .`disruption.consolidationPolicy`- Não .`consolidateAfter`, e uma mancha que mantém as cargas de trabalho não GPU fora destes nós.
3. A sua equipa diz que as implementações estão presas em espera porque "GPUs disponíveis, mas pod não agendar". Diagnose  é este Karpenter, kube-agendador, ou KAI agendador? Que métricas confirmam?
4. Escolha um sinal para os módulos de preenchimento desagregados em autoescala e um sinal diferente para os módulos de decodificação.
5. Calcule o custo do `WhenEmptyOrUnderutilized`Em um serviço de produção 24x7 que tenha uma média de 60 eventos de queda de solicitações por dia no P99 TTFT > 10s.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler; sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler predecessor; slower, group-based |
| KAI Scheduler | "the GPU scheduler" | Secondary scheduler for gang + topology + queues |
| Gang scheduling | "all or nothing" | Schedule N pods atomically or defer all of them |
| Topology awareness | "rack-aware" | Place pods based on NVLink/IB/rack placement |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | Duty-cycle metric; NOT a scaling signal for LLMs |
| Queue depth | "waiting requests" | Correct HPA signal for prefill-bound scaling |
| KV cache utilization | "memory pressure" | Correct HPA signal for decode-bound scaling |
| Consolidation | "Karpenter consolidation" | Node termination to cheaper instance type |
| `WhenEmpty + 1h` | "safe consolidation" | Policy that doesn't evict running GPU jobs |

## Mais leitura

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) documentos de projeto e exemplos de configuração.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) semântica das políticas de consolidação e padrões de segurança da GPU.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) Dinamo Planner, sinais de escalagem.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) Padrão de integração de raios.
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) Orientações específicas para a gestão de Kubernetes.
- [llm-d GitHub](https://github.com/llm-d/llm-d) Design de cargas de trabalho Variante Autoscaler.
