# Compilação de Inferência Especializada em Hardware  FP8 e NVFP4 em Blackwell

> Compilação de inferências especializada em hardware negocia portabilidade para o throughput, e TensorRT-LLM  NVIDIA-só, sintonizado para Blackwell  é o exemplo mais claro do comércio dando frutos.$0.012 per million tokens on a 120B model in Q1-Q2 2026, against $0,09/M em H100 + vLLM  uma diferença económica de 7x. A pilha compõe dois formatos de pontos flutuantes com duas técnicas de servidão: FP8 permanece crítico para cache KV e núcleos de atenção porque tem a faixa dinâmica que eles precisam; NVFP4 (4-bit microscaling) lida com pesos e ativações; previsão multi-token (MTP) e prefill / decode desagregado adicionar mais 2-3x no topo. O modelo de suporte Day-0 carrega pesos FP4 diretamente sem conversão pós-treino. A atração para as equipes de engenharia de 2026: TRT-LLM é open source, mas específica para NVIDIA  CUDA- e Blackwell especializada , então adotando-a negocia com a portabilidade para a capacidade de transmissão. Faça as contas com a sua mistura de modelos e hardware antes de se comprometer.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy FP8/NVFP4 memory and cost calculator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 13 (Quantization)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique por que o FP8 permanece crítico para o cache e a atenção do KV mesmo quando os pesos estão no NVFP4.
- Calcular a pegada HBM de um modelo de fronteira sob o BF16, FP8 e NVFP4 e explicar de onde vêm as economias.
- Nomear as características específicas do Blackwell que utilizam o TRT-LLM (dia-0 FP4, MTP, serviço desagregado, primitivos para todos).
- Decida quando o bloqueio NVIDIA da TRT-LLM vale a diferença de custo 7x contra o vLLM no Hopper.

## O problema

A fronteira da economia de inferência em 2026 é "quantos tokens por dólar". A resposta depende de quatro escolhas empilhadas: geração de hardware (Hopper H100/H200 vs Blackwell B200/GB200), precisão (BF16 → FP8 → NVFP4), motor de servidão (vLLM vs SGLang vs TRT-LLM), e orquestração (plain vs disaggregated vs Dynamo).

No Hopper com VLLM, um MoE 120B corre em ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$A diferença entre o hardware e o hardware é de 11 a 15x por GPU LLM em relação ao Hopper.

Não se pode replicar isso fora da pilha da NVIDIA. Isso é a troca  portabilidade para a economia. Entender quais opções da pilha dão qual parte da lacuna é o ponto desta lição.

## O conceito

### Por que o FP8 ainda é o piso para o cache KV

Um erro comum em 2026: assumir que NVFP4 se aplica em todos os lugares. Não. O cache KV precisa de FP8 (8 bits flutuantes) porque armazena chaves de atenção e valores que abrangem uma ampla faixa dinâmica. Quantizar KV para FP4 causa perda de precisão catastrófica  a cauda da distribuição cai e as pontuações de atenção colapsam.

NVFP4 (2025-2026) aplica-se a pesos e ativações. Microscaling: cada bloco de pesos tem seu próprio fator de escala para que pequenos blocos possam abranger diferentes intervalos dinâmicos sem perda de escala por tensor. Para ativações, FP4 mantém-se porque as ativações são de pequeno alcance dentro de uma camada.

A configuração típica de Blackwell:

- Pesos: NVFP4 (4 bits de microscálise).
- Ativações: NVFP4.
- Caché KV: FP8.
- Acumulador de atenção: FP32 (estabilidade de suavidade máxima).

### Os primitivos específicos de Blackwell utilizam TRT-LLM

- **Day-0 FP4 weights**A Comissão propõe que os modelos de transporte de carga sejam utilizados para a realização de uma avaliação de qualidade e de qualidade de qualidade.
- **Multi-token prediction (MTP)**A proposta de directiva é a seguinte:
- **Disaggregated serving**A ideia é a mesma que a Dynamo (Fase 17 · 20).
- **All-to-all communication primitives**A NVLink 5 reduziu a latência de comunicação de especialistas em MoE em 3x contra Hopper.
- **NVFP4 + MXFP8 microscaling**A manipulação acelerada de fatores de escala em núcleos tensores Blackwell.

### Os números que você deve memorizar

- HGX B200 a US$ 0,02 / M em tokens GPT-OSS-120B via TRT-LLM.
- GB200 NVL72 a tokens de US$ 0,012/M via Dynamo (orquestração TRT-LLM).
- H100 + vLLM ≈ $ 0,09 / M tokens em carga de trabalho comparável.
- Aumento de 2,8 vezes em três meses de atualizações do TRT-LLM (2026).
- 11-15 vezes por GPU LLM de rendimento, Blackwell vs Hopper.
- MLPerf Inference v6.0 (abril 2026): Blackwell domina todas as tarefas submetidas.

### Quanto custa a qualidade do FP4

NVFP4 é agressivo. Em cargas de trabalho pesadas de raciocínio (cadeia de pensamento, matemática, código-gen com longo contexto), os pesos FP4 se degradam visiblemente. A calibração por bloco mitiga, mas não elimina. Os modelos de raciocínio de equipes geralmente usam pesos FP8 + ativações FP4 como um compromisso, ou se apegam ao H200 com FP8 em todo.

A regra: sempre valida a qualidade da tarefa no seu conjunto de avaliação antes de se comprometer com pesos NVFP4.

### Por que é uma decisão de bloqueio da NVIDIA

TRT-LLM é um kernel de código fechado. Os modelos precisam ser compilados para um SKU específico de GPU. Sem AMD, sem Intel, sem ARM. Se sua estratégia infra é multi-vendor, TRT-LLM é um não-starter para o nível TRT-LLM servido.

### 2026 receita prática

Para uma conta de inferência anual de US$ 100 milhões, executar Hopper + vLLM deixa 7-10x na mesa. Migração de cargas de trabalho dominantes de custo para Blackwell + TRT-LLM + Dynamo. Mantenha o nível de experimentação em H100 + vLLM para a velocidade de iteração do modelo. Valida a qualidade em cada modelo convertido NVFP4 antes da produção.

### O bônus de desagregação

A porção desagregada do TRT-LLM (pools separados de preenchimento e decodificação) é coberta em profundidade na fase 17 · 20. Na Blackwell, os multiplicadores são empilhados: pesos FP4 × aceleração MTP × colocação desagregada × roteamento consciente de cache. O número 7x assume esta pilha completa.

```figure
pipeline-parallel
```

## Usá-lo

`code/main.py`calcula a pegada HBM, o decodificador de throughput (regime de memória limitada) e os tokens $/M para um modelo em três pilhas: H100 + BF16 + vLLM, H100 + FP8 + vLLM, B200 + NVFP4/FP8 + TRT-LLM. Execute-o para ver o efeito de composição e a proporção da lacuna que cada mudança contribui.

## Envia-o

Esta lição produz`outputs/skill-trtllm-blackwell-advisor.md`. Dada a carga de trabalho, o tamanho do modelo e o volume anual dos tokens, decide se a pilha Blackwell + TRT-LLM vale a pena o bloqueio NVIDIA.

## Exercícios

1. Corra .`code/main.py`Em um MoE 120B com parâmetros ativos de 30%, calcular o rendimento de decodificação limitada de largura de banda de memória em H100 BF16, H100 FP8 e B200 NVFP4/FP8.
2. Um cliente gasta US$ 2 milhões por ano em H100 + vLLM. Qual é o número de GPUs Blackwell que eles precisam comprar para amortizar uma migração para TRT-LLM em 12 meses, dada a lacuna econômica de 7x?
3. Você vê a queda de precisão 3 pontos no MATH após a conversão de peso NVFP4. Nomear dois caminhos de recuperação: um de qualidade em primeiro lugar (manter pesos FP8) e um de custo em primeiro lugar (calibrar com dados no domínio).
4. Leia os resultados da inferência do MLPerf v6.0. Qual tarefa tem a menor lacuna de Blackwell-over-Hopper e porquê?
5. Compute o HBM necessário para um modelo 405B com pesos NVFP4 + FP8 KV cache em contexto 128k.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| FP8 | "eight-bit float" | 8-bit floating point; used for KV cache and attention due to dynamic range |
| NVFP4 | "four-bit micro" | NVIDIA's 4-bit microscaling FP format; weights and activations on Blackwell |
| MXFP8 | "MX eight" | Microscaling FP8 variant; hardware-accelerated on Blackwell Tensor Cores |
| Day-0 FP4 | "ship FP4 weights" | Model providers release weights already in FP4; no post-train conversion step |
| MTP | "multi-token prediction" | TRT-LLM's integrated speculative-decoding draft (Phase 17 · 05) |
| Disaggregated serving | "split prefill/decode" | Prefill and decode on separate GPU pools; KV transferred over NVLink/IB |
| All-to-all | "MoE expert comm" | Communication pattern routing tokens to expert GPUs; NVLink 5 cuts 3x |
| InferenceX | "SemiAnalysis inference bench" | The 2026 industry-accepted cost-per-token benchmark |

## Mais leitura

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) Abril 2026 Resultados do MLPerf.
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/)- NVLink 5 todos-a-todos e núcleos MoE.
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) documentação oficial do motor.
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) Orquestração desagregada acima da TRT-LLM.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) o conjunto de referências que publica números Blackwell.
