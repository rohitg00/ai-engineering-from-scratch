# Preenchimento/Decodificação desagregada  NVIDIA Dynamo e llm-d

> O prefill é computacional; a decodificação é com memória. Execução de ambos na mesma GPU desperdiça um recurso. A desagregação divide-os em pools separados e transfere o cache KV entre eles através do NIXL (RDMA/InfiniBand ou fallback TCP). A NVIDIA Dynamo (GTC 2025 anunciar, 1.0 GA) fica acima do vLLM/SGLang/TRT-LLM  seu Planner Profiler + SLA Planner pre-preencher:decode proporções de preenchimento de taxa-match automático para atender aos SLOs. A NVIDIA publica ganhos de throughput neste estádio  developer.nvidia.com (2025-06) mostra uma melhoria de ~6x para o DeepSeek-R1 MoE no GB200 NVL72 + Dynamo no regime de latencia média, e a página de produto da Dynamo (developer.nvidia.com, não datada) anuncia até 50x o throughput de MoE no GB300 NVL72 + Dynamo vs Hopper. A figura "30x" é um agregado comunitário em relatórios completos de Blackwell + Dynamo + DeepSeek-R1; não encontramos uma única fonte primária que indique exatamente 30x, então trate-o como uma reivindicação direcional. llm-d (Red Hat + AWS) é Kubernetes-nativo: prefill / decode / roteador como serviços independentes com HPA por função. llm-d 0.5 adiciona descarga de KV hierárquica, roteamento LoRA consciente de cache, rede UCCL, escala-a-zero. Economia: a introdução interna de várias informações sobre clientes sugere poupanças de 3040% em$2M-class inference spend (i.e., $600-800 K/ano) quando se passa de um serviço colocado para um serviço desagregado com Dynamo com SLA constante;$2M→$A figura 600-800K é uma composição interna, não um único estudo de caso publicado  usá-lo como uma âncora de ordem de magnitude, não uma citação de referência.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy disaggregated-vs-colocated simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 08 (Inference Metrics)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique por que o preenchimento e a decodificação têm diferentes atribuições ótimas de GPU e quantifique o resíduo sob colocação.
- Diagrama da arquitetura desagregada: pré-reempimento, decodificação, transferência de KV através de NIXL, roteador.
- Cita a condição em que a desagregação NÃO dá resultados (indicações curtas, saídas curtas).
- Distinguir o NVIDIA Dynamo (pilha acima) do llm-d (nativo Kubernetes) e combinar cada um com um contexto operacional.

## O problema

Você executa Llama 3.3 70B em 8 H100s. Sob carga de trabalho mista (prompts long + short outputs), GPUs estão ociosos durante a decodificação porque a maior parte do cálculo foi gasto em prefill. Sob diferentes cargas de trabalho (prompts short + long outputs), acontece o oposto. Colocado prefill + decodificação significa que você supera em ambos.

Impacto orçamental: 20-40% do tempo da GPU é desperdiçado no recurso errado. Você está comprando computador H100 para executar decodificação ligada à memória, ou comprando largura de banda H100 HBM para executar preenchimento ligado à computação. Ambos são desperdícios caros.

A desagregação divide prefill e decode em pools separados com tamanho para cada garganta de engarrafamento.

## O conceito

### Por que os gargalos de engarrafamento diferem

**Prefill** executar o transformador sobre o prompt de entrada completo em um avanço. Multiplicações de matriz dominam; computação-ligada. H100 FP8 dá ~ 2000 TFLOPS de passagem útil.

**Decode** gerar um token de cada vez, lendo os pesos completos em cada iteração. Memória-largura de banda limitada. HBM3 dá ~ 3 TB / s. A eficiência do lote é boa apenas em alta concurência  os pesos leídos amortizam em todo o lote.

Colocando-os: você compra GPUs otimizadas para ambos. H100 é bom em ambos, mas custa o mesmo de qualquer maneira. Em escala, você quer pré-reempimento de pool em H100 / computação pesada; decodificação de pool em H200 / memória pesada, ou com quantização agressiva.

### A arquitetura

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (prompt only)                  │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill pool │ ─── NIXL ────► │ Decode pool  │
            │  (compute)   │                │  (memory)    │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL é o transporte inter-nodo da NVIDIA. Utiliza RDMA/InfiniBand quando disponível, fallback TCP de outra forma. A latência de transferência é real  normalmente 20-80 ms para o cache KV de um prompt de token 4K em 70B FP8.

### Dinamo vs. llm-d

**NVIDIA Dynamo**(Anúncio da CGV 2025, 1.0 GA):
- Senta-se acima do VLLM, SGLang, TRT-LLM como orquestrador.
- Planner Profiiler mede a carga de trabalho, SLA Planner configura automaticamente prefill:decode ratios.
- Núcleo de rugos, extensão Python.
- Ganhos de rendimento: NVIDIA relata 6x para DeepSeek-R1 MoE no GB200 NVL72 + Dynamo no regime de latencia média (developer.nvidia.com, 2025-06); relatórios comunitários de "até 30x" em pilhas completas Blackwell + Dynamo + DeepSeek-R1 carecem de uma única fonte primária e devem ser tratados como direcionais.
- GB300 NVL72 + Dynamo: até 50 vezes o volume de MoE vs Hopper por página de produto da Dynamo (desenvolvedor.nvidia.com, não datado).

**llm-d**(Red Hat + AWS, nativo de Kubernetes):
- Preencher / decodificar / rotear como serviços Kubernetes independentes.
- HPA por função com sinais de profundidade de fila (preenchimento) / utilização de KV (decodificação).
- `topologyConstraint packDomain: rack`Pacotes prefill+decode clicks no mesmo rack para transferência de KV de alta largura de banda.
- Ilm-d 0.5 (2026): descarga de KV hierárquica, roteamento LoRA consciente do cache, rede UCCL, escala-a-zero.

Use o Dynamo se quiser um orquestrador gerenciado, use o llm-d se quiser primitivos nativos Kubernetes e comprometidos com o ecossistema CNCF.

### Economia

Composto interno (não um único estudo de caso publicado  âncora de ordem de magnitude):

- 2 milhões de dólares por ano para a dedução de um serviço colocado.
- - Desagregado com a Dynamo.
- O mesmo volume de solicitação, o mesmo SLA de latência P99.
- Economias reportadas: $600K–$800K/ano (3040% de redução).
- Não há hardware novo.

Sintetizamos esse número a partir de múltiplas divulgações de clientes em vez de um único estudo de caso citável; ponto de dados mais próximo publicado é o TTFT 2x mais rápido da Baseten / 61% de maior throughput com roteamento Dynamo KV (baseten.co, 2025-10), e projeção de VAST + CoreWeave de 60130% mais tokens / $ a 4060% KV taxa de sucesso (vastdata.com, 2025-12). As economias vêm do tamanho certo de cada piscina; as cargas de trabalho pesadas de pré-enchimento (RAG com prefixos 8K+) beneficiam mais do que as equilibradas.

### Quando não se desagregar

- Indicações < 512 tokens e saídas < 200 tokens: o imposto sobre transferências domina o ganho.
- Cluster pequeno (< 4 GPUs): não há diversidade suficiente.
- A equipe não pode operar dois pools de GPU com escalação por papel: a Dynamo ajuda, mas não trivialmente.
- Não há tecido RDMA: o imposto de transferência TCP é mais pesado.

### O roteador integra-se com a fase 17 · 11

Roteadores desagregados são conscientes do cache KV (Fase 17 · 11). Um pedido aterra no pool de decodificação com seu prefixo  se não coincidir, ele flui prefill → decodificar.

### O MoE em Blackwell é onde os números reais estão

GB300 NVL72 + Dynamo mostra 50x MoE throughput sobre as linhas de base Hopper. Routing especialista MoE é computação pesada no prefill, mas memória pesada no decodificação (experto caches), por isso, a desagregação é uma dupla vitória. 2026 modelo fronteiriço serve é MoE-dominante (DeepSeek-V3, futuras variantes GPT-5).

### Números que você deve lembrar

Os números de referência são estimados por NVIDIA e a pilha de inferências, que atualizam os resultados a cada trimestre.

- DeepSeek-R1 no GB200 NVL72 + Dynamo: ~6x de rendimento vs linha de base no regime de latencia média (developer.nvidia.com, 2025-06); reivindicações comunitárias "até 30x" em pilhas completas de Blackwell + Dynamo são agregados direcionais sem uma única fonte primária.
- GB300 NVL72 + Dynamo: até 50 vezes o volume MoE vs Hopper (desenvolvedor.nvidia.com, não datado).
- Ancoramento de poupança (composto interno, não um único estudo de caso): $600-800K/year off a $2 milhões de despesas anuais a SLA constante.
- Limite de desagregação: indicações > 512 tokens + saídas > 200 tokens.
- Transferência de KV através do NIXL: 20-80 ms para KV de 4K-prompt em 70B FP8.

```figure
prefill-decode-split
```

## Usá-lo

`code/main.py`Simula a distribuição colocada versus desagregada. Relata o rendimento, o custo por pedido e o crossover de comprimento de prompt.

## Envia-o

Esta lição produz`outputs/skill-disaggregation-decider.md`- Tendo em conta a carga de trabalho e o cluster, decide se se desagrega.

## Exercícios

1. Corra .`code/main.py`A que ponto a desagregação supera a colocação?
2. Desenhar o pré-reempimento e o decodificador para um serviço RAG com comprimento de prefixo P99 8K, saída 300.
3. Dynamo vs llm-d: escolha um para uma loja pura Kubernetes sem preferência de Python.
4. Computação custo de transferência de KV: 4K prefill em 70B FP8 = ~ 500 MB KV. Em RDMA 100 GB / s, transferência = 5 ms. Em TCP 10 GB / s = 50 ms. O que importa para o seu SLA?
5. Como a desagregação se comporta com o MoE que ativa diferentes especialistas por token?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Disaggregated serving | "split prefill/decode" | Separate GPU pools for each phase |
| NIXL | "NVIDIA transport" | Dynamo's inter-node KV transfer (RDMA/TCP) |
| NVIDIA Dynamo | "the orchestrator" | Stack-above coordinator for vLLM/SGLang/TRT-LLM |
| llm-d | "Kubernetes native" | Red Hat + AWS K8s disaggregated stack |
| Planner Profiler | "Dynamo auto-config" | Measures workload, configures pool ratios |
| SLA Planner | "Dynamo policy" | Auto-rate-matches prefill:decode to meet SLOs |
| `packDomain: rack` | "llm-d topology" | Pack prefill+decode on same rack for fast KV |
| UCCL | "unified collective" | llm-d 0.5 networking layer for scale-to-zero |
| MoE expert routing | "expert per token" | DeepSeek-V3 pattern; disaggregation helps |

## Mais leitura

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases)
