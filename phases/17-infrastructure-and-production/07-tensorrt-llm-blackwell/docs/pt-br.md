# TensorRT-LLM no Blackwell com FP8 e NVFP4

> TensorRT-LLM é exclusivo da NVIDIA mas ganha no Blackwell. No GB200 NVL72 com orquestração Dynamo, a SemiAnalysis InferenceX mediu $0,012 por milhão de tokens em um modelo de 120B no Q1-Q2 de 2026, contra $0,09/M no H100 + vLLM — um gap econômico de 7x. A stack combina três regimes de ponto flutuante: FP8 continua sendo crítico para KV cache e kernels de attention porque tem a faixa dinâmica que eles precisam; NVFP4 (microscaling de 4-bit) lida com pesos e ativações; multi-token prediction (MTP) e prefill/decode disaggregado adicionam mais 2-3x em cima. Suporte a modelos day-0 carrega pesos FP4 diretamente sem conversão pós-treinamento. O detalhe para equipes de engenharia de 2026: TRT-LLM é uma stack fechada da NVIDIA, então adotá-la troca portabilidade por throughput. Faça a matemática na sua mistura de modelos e hardware antes de se comprometer.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, calculadora toy de memória e custo FP8/NVFP4)
**Pré-requisitos:** Fase 17 · 04 (Internals de Serving vLLM), Fase 10 · 13 (Quantização)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar por que FP8 continua sendo crítico para KV cache e attention mesmo quando pesos estão em NVFP4.
- Computar a pegada de HBM de um modelo de fronteira sob BF16, FP8 e NVFP4 e raciocinar de onde vêm as economias.
- Nomear as funcionalidades específicas do Blackwell que o TRT-LLM explora (FP4 day-0, MTP, serving disaggregado, primitivas all-to-all).
- Decidir quando o lock-in da NVIDIA do TRT-LLM vale o gap de custo de 7x vs vLLM no Hopper.

## O Problema

A fronteira da economia de inferência em 2026 é "quantos tokens por dólar". A resposta depende de quatro escolhas empilhadas: geração de hardware (Hopper H100/H200 vs Blackwell B200/GB200), precisão (BF16 → FP8 → NVFP4), engine de serving (vLLM vs SGLang vs TRT-LLM) e orquestração (plain vs disaggregado vs Dynamo).

No Hopper com vLLM, um MoE de 120B roda a ~$0,09 por milhão de tokens. No Blackwell com TRT-LLM + Dynamo, o mesmo modelo roda a ~$0,012 — 7x mais barato. Parte desse gap é hardware (Blackwell tem 11-15x o throughput de LLM por GPU vs Hopper). Parte é a stack: pesos FP4, draft MTP, prefill/decode disagregado e NVLink 5 all-to-all para comunicação de experts MoE.

Você não replica isso fora da stack da NVIDIA. Esse é o tradeoff — portabilidade por economia. Entender quais escolhas de stack dão qual parcela do gap é o ponto desta aula.

## O Conceito

### Por que FP8 ainda é o piso para KV cache

Um erro comum em 2026: assumir que NVFP4 se aplica em tudo. Não se aplica. KV cache precisa de FP8 (ponto flutuante de 8-bit) porque armazena chaves e valores de attention que cobrem uma ampla faixa dinâmica. Quantizar KV para FP4 causa perda catastrófica de acurácia — a cauda da distribuição cai e os scores de attention colapsam. Os bits de expoente do FP8 dão ao KV cache a faixa que ele precisa.

NVFP4 (2025-2026) se aplica a pesos e ativações. Microscaling: cada bloco de pesos tem seu próprio fator de escala para que blocos pequenos possam cobrir diferentes faixas dinâmicas sem perda de escala por tensor. Para ativações, FP4 funciona porque ativações têm faixa pequena dentro de uma camada.

A config típica do Blackwell:

- Pesos: NVFP4 (microscaling de 4-bit).
- Ativações: NVFP4.
- KV cache: FP8.
- Acumulador de attention: FP32 (estabilidade do softmax).

### As primitivas específicas do Blackwell que o TRT-LLM usa

- **Pesos FP4 day-0**: provedores de modelo entregam pesos FP4 diretamente; TRT-LLM carrega sem conversão pós-treinamento. Sem etapa AWQ / GPTQ para FP4.
- **Multi-token prediction (MTP)**: mesma ideia do EAGLE (Fase 17 · 05) mas integrado na build do TRT-LLM.
- **Serving disaggregado**: prefill e decode em pools de GPU separados, KV cache transferido via NVLink ou InfiniBand. Mesma ideia do Dynamo (Fase 17 · 20).
- **Primitivas de comunicação all-to-all**: NVLink 5 cortou a latência de comunicação de experts MoE em 3x vs Hopper. Os kernels MoE do TRT-LLM são otimizados para isso.
- **Microscaling NVFP4 + MXFP8**: tratamento de fatores de escala acelerado por hardware nos Tensor Cores do Blackwell.

### Os números que você deve memorizar

- HGX B200 a $0,02/M tokens no GPT-OSS-120B via TRT-LLM.
- GB200 NVL72 a $0,012/M tokens via Dynamo (orquestrando TRT-LLM).
- H100 + vLLM ≈ $0,09/M tokens em workload comparável.
- Ganho de throughput de 2,8x em três meses de atualizações do TRT-LLM (2026).
- 11-15x o throughput de LLM por GPU, Blackwell vs Hopper.
- MLPerf Inference v6.0 (abril de 2026): Blackwell domina cada tarefa submetida.

### O que FP4 realmente custa em qualidade

NVFP4 é agressivo. Em workloads com carga de raciocínio pesada (chain-of-thought, matemática, code-gen com contexto longo), pesos FP4 degradam visivelmente. Calibração por bloco mitiga mas não elimina. Equipes que entregam modelos de raciocínio muitas vezes usam pesos FP8 + ativações FP4 como compromisso, ou ficam no H200 com FP8 inteiro.

A regra: sempre valide a qualidade da tarefa no seu eval set antes de se comprometer com pesos NVFP4.

### Por que isso é uma decisão de lock-in da NVIDIA

TRT-LLM é C++ + CUDA + kernels de código fechado. Modelos precisam ser compilados para um SKU de GPU específico. Sem AMD, sem Intel, sem ARM. Se sua estratégia de infra é multi-vendor, TRT-LLM é inviável para o tier servido por TRT-LLM — você ainda pode servir do vLLM em hardware misto. Se você é exclusivamente NVIDIA, o gap de 7x paga pelo lock.

### Receita prática de 2026

Para uma conta de inferência anual de $100M+, rodar no Hopper + vLLM deixa 7-10x na mesa. Migre workloads dominantes de custo para Blackwell + TRT-LLM + Dynamo. Mantenha o tier de experimentação no H100 + vLLM para velocidade de iteração de modelos. Valide qualidade em cada modelo convertido para NVFP4 antes de produção.

### O bônus do disaggregamento

Serving disagregado do TRT-LLM (pools separados de prefill e decode) é coberto em profundidade na Fase 17 · 20. No Blackwell, o multiplicador empilha: pesos FP4 × speedup MTP × posicionamento disagregado × roteador com consciência de cache. O número de 7x assume essa stack completa.

## Use

`code/main.py` computa pegada de HBM, throughput de decode (regime limitado por memória) e $/M-tokens para um modelo em três stacks: H100 + BF16 + vLLM, H100 + FP8 + vLLM, B200 + NVFP4/FP8 + TRT-LLM. Execute para ver o efeito composto e a parcela do gap que cada mudança contribui.

## Entregue

Esta aula produz `outputs/skill-trtllm-blackwell-advisor.md`. Dado um workload, tamanho de modelo e volume anual de tokens, decide se a stack Blackwell + TRT-LLM vale o lock-in da NVIDIA.

## Exercícios

1. Execute `code/main.py`. Em um MoE de 120B com 30% de parâmetros ativos, compute o throughput de decode limitado por largura de banda de memória em H100 BF16, H100 FP8 e B200 NVFP4/FP8. De onde vem o maior salto?
2. Um cliente gasta $2M/ano em H100 + vLLM. Qual é o número de break-even de GPUs Blackwell que ele precisa comprar para amortizar uma migração para TRT-LLM em 12 meses, dado o gap econômico de 7x?
3. Você vê queda de 3 pontos em MATH após conversão de pesos para NVFP4. Nomeie duas rotas de recuperação: uma priorizando qualidade (manter pesos FP8), uma priorizando custo (calibrar com dados de domínio).
4. Leia os resultados do MLPerf v6.0 de inferência. Qual tarefa tem o menor gap Blackwell-over-Hopper e por quê?
5. Compute o HBM necessário para um modelo de 405B com pesos NVFP4 + KV cache FP8 a 128k de contexto. Cabe em um único nó GB200 NVL72?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| FP8 | "float de oito bits" | Ponto flutuante de 8-bit; usado para KV cache e attention por causa da faixa dinâmica |
| NVFP4 | "micro de quatro bits" | Formato FP de microscaling de 4-bit da NVIDIA; pesos e ativações no Blackwell |
| MXFP8 | "MX oito" | Variante microscaling de FP8; acelerado por hardware nos Tensor Cores do Blackwell |
| FP4 day-0 | "entregar pesos FP4" | Provedores de modelo lançam pesos já em FP4; sem etapa de conversão pós-treinamento |
| MTP | "multi-token prediction" | Draft de speculative decoding integrado no TRT-LLM (Fase 17 · 05) |
| Serving disagregado | "separar prefill/decode" | Prefill e decode em pools de GPU separados; KV transferido via NVLink/IB |
| All-to-all | "comunicação de experts MoE" | Padrão de comunicação roteando tokens para GPUs de expert; NVLink 5 corta 3x |
| InferenceX | "benchmark de inferência SemiAnalysis" | O benchmark de custo-por-token aceito pela indústria em 2026 |

## Leitura Complementar

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) — resultados do MLPerf de abril de 2026.
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) — NVLink 5 all-to-all e kernels MoE.
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) — documentação oficial da engine.
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) — orquestração disagregada acima do TRT-LLM.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — a suíte de benchmarks que publica números do Blackwell.
