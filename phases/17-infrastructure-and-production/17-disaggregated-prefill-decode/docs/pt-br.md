# Prefill/Decode Desagregado — NVIDIA Dynamo e llm-d

> Prefill é compute-bound; decode é memory-bound. Rodar ambos na mesma GPU desperdiça um recurso. A desagregação os separa em pools distintos e transfere KV cache entre eles via NIXL (RDMA/InfiniBand ou reserva TCP). NVIDIA Dynamo (anúncio GTC 2025, 1.0 GA) fica acima do vLLM/SGLang/TRT-LLM — seu Planner Profiler + SLA Planner ajusta automaticamente as razões prefill:decode para atingir SLOs. NVIDIA publica ganhos de throughput nessa faixa — developer.nvidia.com (2025-06) mostra melhoria de ~6x para DeepSeek-R1 MoE no GB200 NVL72 + Dynamo no regime de latência média, e a página do Dynamo (developer.nvidia.com, sem data) anuncia até 50x de throughput MoE no GB300 NVL72 + Dynamo vs Hopper. O valor "30x" é um agregado comunitário de relatórios full-stack Blackwell + Dynamo + DeepSeek-R1; não encontramos uma única fonte primária afirmando exatamente 30x, então trate como afirmação direcional. llm-d (Red Hat + AWS) é Kubernetes-native: prefill / decode / router como Services independentes com HPA por papel. llm-d 0.5 adiciona offloading hierárquico de KV, cache-aware LoRA routing, networking UCCL, scale-to-zero. Economia: consolidado interno de múltiplas divulgações de clientes sugere 30-40% de economia em gastos de inferência na faixa de $2M (ou seja, $600-800K/ano) ao mudar de serving colocado para desagregado com Dynamo em SLA constante; o valor eespecificaçãoífico $2M→$600-800K é um composto interno, não um caso publicado — use como âncora de ordem de magnitude, não como citação. Prompts curtos (<512 tokens, output curto) não justificam o custo de transferência.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador desagregado-vs-colocado)
**Pré-requisitos:** Fase 17 · 04 (Internals do vLLM Serving), Fase 17 · 08 (Métricas de Inferência)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar por que prefill e decode têm alocações GPU ótimas diferentes e quantificar o desperdício sob colocação.
- Diagramar a arquitetura desagregada: pool de prefill, pool de decode, transferência de KV via NIXL, router.
- Nomear a condição quando a desagregação NÃO compensa (prompts curtos, outputs curtos).
- Distinguir NVIDIA Dynamo (stack-above) de llm-d (Kubernetes-native) e associar cada um a um contexto operacional.

## O Problema

Você roda Llama 3.3 70B em 8 H100s. Sob workload misto (prompts longos + outputs curtos), GPUs ficam ociosas durante decode porque a maior parte do compute foi gasta em prefill. Sob workload diferente (prompts curtos + outputs longos), o oposto acontece. Prefill + decode colocados significa que você superprovisiona ambos.

Impacto no orçamento: 20-40% do tempo de GPU é desperdiçado no recurso errado. Você está comprando compute H100 para rodar decode memory-bound, ou comprando largura de banda HBM H100 para rodar prefill compute-bound. Ambos são desperdício caro.

A desagregação separa prefill e decode em pools dimensionados para o gargalo de cada um. KV cache transfere do pool de prefill para o pool de decode via interconnect de alta largura de banda.

## O Conceito

### Por que os gargalos são diferentes

**Prefill** — rode o transformer sobre o input prompt completo num forward. Multiplicações de matriz dominam; compute-bound. H100 FP8 fornece ~2000 TFLOPS de throughput útil. Eficiência de batch é boa — um forward processa muitos tokens.

**Decode** — gere um token por vez, lendo os pesos completos a cada iteração. Memory-bandwidth-bound. HBM3 fornece ~3 TBR/s. Eficiência de batch é boa apenas em alta concorrência — a leitura dos pesos se amortiza pelo batch.

Colocando ambos: você compra GPUs otimizadas para os dois. H100 é bom em ambos mas custa o mesmo. Em escala, você quer pool de prefill em H100 / pesado em compute; pool de decode em H200 / pesado em memória, ou com quantização agressiva.

### A arquitetura

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (apenas prompt)                │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │  Pool prefill│ ─── NIXL ────► │  Pool decode │
            │   (compute)  │                │   (memória)  │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL é o transporte inter-node da NVIDIA. Usa RDMA/InfiniBand quando disponível, reserva TCP caso contrário. Latência de transferência é real — tipicamente 20-80 ms para KV cache de um prompt de 4K tokens em 70B FP8. É por isso que prompts curtos não justificam desagregação: o imposto de transferência excede a economia.

### Dynamo vs llm-d

**NVIDIA Dynamo** (anúncio GTC 2025, 1.0 GA):
- Fica acima de vLLM, SGLang, TRT-LLM como orquestrador.
- Planner Profiler mede workload, SLA Planner auto-configura razões prefill:decode.
- Core em Rust, extensibilidade em Python.
- Ganhos de throughput: NVIDIA relata 6x para DeepSeek-R1 MoE no GB200 NVL72 + Dynamo no regime de latência média (developer.nvidia.com, 2025-06); relatos comunitários de "até 30x" em stacks completas Blackwell + Dynamo + DeepSeek-R1 não têm uma fonte primária única e devem ser tratados como direcionais.
- GB300 NVL72 + Dynamo: até 50x throughput MoE vs Hopper segundo a página do Dynamo (developer.nvidia.com, sem data).

**llm-d** (Red Hat + AWS, Kubernetes-native):
- Prefill / decode / router como Services Kubernetes independentes.
- HPA por papel com sinais de profundidade de fila (prefill) / utilização de KV (decode).
- `topologyConstraint packDomain: rack` empacota cliques prefill+decode no mesmo rack para transferência KV de alta largura de banda.
- llm-d 0.5 (2026): offloading KV hierárquico, cache-aware LoRA routing, networking UCCL, scale-to-zero.

Use Dynamo se você quer um orquestrador stack-above gerenciado. Use llm-d se você quer primitivas Kubernetes-native e está comprometido com o ecossistema CNCF.

### Economia

Compilado interno (não um único caso publicado — âncora de ordem de magnitude):

- $2M/ano em gastos de inferência com serving colocado.
- Mudado para desagregado com Dynamo.
- Mesmo volume de requests, mesmo SLA de latência P99.
- Economia relatada: $600K-$800K/ano (redução de 30-40%).
- Sem hardware novo.

Sintetizamos esse valor de múltiplas divulgações de clientes em vez de um caso citável único; ponto publicado mais próximo é o TTFT 2x mais rápido / throughput 61% maior do Baseten com Dynamo KV routing (baseten.co, 2025-10), e a projeção da VAST + CoreWeave de 60-130% mais tokens/$ a 40-60% de taxa de hit de KV (vastdata.com, 2025-12). A economia vem de dimensionar cada pool corretamente; workloads pesados em prefill (RAG com prefixos 8K+) se beneficiam mais que workloads balanceados.

### Quando NÃO desagregar

- Prompts < 512 tokens e outputs < 200 tokens: imposto de transferência domina o ganho.
- Cluster pequeno (< 4 GPUs): sem diversidade de pool.
- Time não consegue operar dois pools de GPU com escalação por papel: Dynamo ajuda mas não trivialmente.
- Sem fabric RDMA: imposto de transferência TCP é mais pesado.

### O router integra com Fase 17 · 11

Routers desagregados são KV-cache-aware (Fase 17 · 11). Um request cai no pool de decode que contém seu prefixo — se não há match, segue prefill → decode. Taxa de hit e desagregação se multiplicam — o cache-aware router determina se um novo prefill é sequer necessário.

### MoE no Blackwell é onde os números reais estão

GB300 NVL72 + Dynamo mostra 50x throughput MoE sobre baselines Hopper. Roteamento de experts MoE é compute-heavy no prefill mas memory-heavy no decode (cache de experts), então desagregação é um benefício duplo. Serving de modelos frontier em 2026 é dominado por MoE (DeepSeek-V3, futuras variantes GPT-5).

### Números que você deve lembrar

Números de benchmark flutuam — NVIDIA e o stack de inferência publicam resultados atualizados a cada trimestre. Reconfie antes de citar.

- DeepSeek-R1 no GB200 NVL72 + Dynamo: ~6x throughput vs baseline no regime de latência média (developer.nvidia.com, 2025-06); afirmações comunitárias "até 30x" em stacks completas Blackwell + Dynamo são agregados direcionais sem uma fonte primária única.
- GB300 NVL72 + Dynamo: até 50x throughput MoE vs Hopper (developer.nvidia.com, sem data).
- Âncora de economia (compilado interno, não um caso único): $600-800K/ano de um gasto anual de $2M em SLA constante.
- Limiar de desagregação: prompts >512 tokens + outputs >200 tokens.
- Transferência KV via NIXL: 20-80 ms para KV de prompt 4K em 70B FP8.

## Use

`code/main.py` simula serving colocado vs desagregado. Reporta throughput, custo por request e o cruzamento de comprimento de prompt.

## Entregue

Esta aula produz `outputs/skill-disaggregation-decider.md`. Dados workload e cluster, decide se desagregar.

## Exercícios

1. Execute `code/main.py`. Em que comprimento de prompt a desagregação vence a colocação?
2. Projete o pool de prefill e o pool de decode para um serviço de RAG com comprimento P99 de prefixo 8K, output 300.
3. Dynamo vs llm-d: escolha um para uma loja pura Kubernetes sem preferência de runtime Python.
4. Calcule custo de transferência KV: prefill 4K em 70B FP8 = ~500 MB KV. Com RDMA 100 GB/s, transferência = 5 ms. Com TCP 10 GB/s = 50 ms. Qual importa para seu SLA?
5. Roteamento de experts MoE muda padrões de acesso ao KV. Como a desagregação se comporta com MoE que ativa diferentes experts por token?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Serving desagregado | "separar prefill/decode" | Pools de GPU separados para cada fase |
| NIXL | "transporte NVIDIA" | Transferência KV inter-node do Dynamo (RDMA/TCP) |
| NVIDIA Dynamo | "o orquestrador" | Coordenador stack-above para vLLM/SGLang/TRT-LLM |
| llm-d | "Kubernetes native" | Stack desagregada Red Hat + AWS K8s |
| Planner Profiler | "auto-config Dynamo" | Mede workload, configura razões de pool |
| SLA Planner | "política Dynamo" | Ajusta razões prefill:decode para atingir SLOs |
| `packDomain: rack` | "topologia llm-d" | Empacotar prefill+decode no mesmo rack para KV rápido |
| UCCL | "collective unificado" | Camada de networking do llm-d 0.5 para scale-to-zero |
| Roteamento de experts MoE | "expert por token" | Padrão DeepSeek-V3; desagregação ajuda |

## Leituras Adicionais

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Inferência LLM Desagregada no Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [Blog TensorRT-LLM Desaggregated Serving](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [GitHub do llm-d](https://github.com/llm-d/llm-d)
- [Release notes do llm-d 0.5](https://github.com/llm-d/llm-d/releases)
