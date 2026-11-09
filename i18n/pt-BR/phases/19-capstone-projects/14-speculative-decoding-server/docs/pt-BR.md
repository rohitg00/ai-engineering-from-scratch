# Capstone 14  Servidor de Inferência de Descódigo Especulativo

> A descodificação especulativa  um projeto barato propõe tokens, o modelo-alvo verifica-os em uma passagem  é agora uma otimização pronta para produção, não um truque de pesquisa. A EAGLE-3 em vLLM 0,7 nave 2,5-3x de capacidade em tráfego real. O P-EAGLE (AWS 2026) empurrou ainda mais a especulação paralela. O SpecForge da SGLang treinou os chefes de recrutamento em escala. O centro de especuladores da Red Hat publicou projetos alinhados para modelos abertos comuns. TensorRT-LLM fez a descodificação especulativa de primeira classe na NVIDIA. A pilha de produção de 2026 é vLLM ou SGLang com rascunhos da família EAGLE, quantização FP8 ou INT4, e HPA em fila de espera. Esta pedra angular deve servir dois modelos abertos com uma capacidade de saída de 2,5x+ de linha de base com um relatório completo de latência de cauda.

**Type:** Capstone
**Languages:** Python (serving), TypeScript, C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:**P3 · P7 · P10 · P17
**Time:** 30 hours

## Problemas

A descodificação especulativa tornou-se uma mercadoria em 2026. Os chefes de projeto EAGLE-3 treinam os estados ocultos do modelo alvo e prevêem N tokens à frente; o modelo alvo verifica em uma única passagem. As taxas de aceitação de 60-80% traduzem-se em 2-3x o volume de transmissão de ponta a ponta. VLLM 0.7 integra isso nativamente. O SGLang + SpecForge fornece-lhe o processo de formação. Os especuladores da Red Hat publicam os projetos alinhados para Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B.

A nave está nas operações de serviço, não o modelo. A taxa de aceitação varia com a distribuição de tráfego (ShareGPT vs código vs dados de domínio). A latência da cauda sob rejeição é pior do que sem especulação  você deve relatar p99 em vários tamanhos de lote, não apenas tokens de estado estável / segundo.

## Conceptos

A descodificação especulativa tem duas camadas.**draft**O modelo (capela, ngram ou modelo menor alinhado com o alvo) propõe k tokens candidatos por etapa.**target**O modelo verifica todos os k em uma passagem; qualquer prefixo aceito substitui o caminho ganancioso.

A EAGLE-3 supera os projetos ngram na maioria do tráfego. A P-EAGLE executa especulações paralelas para projetos mais profundos. A compensação: a latência P99 na rejeição é maior porque a passagem de verificação é maior. A configuração de serviço deve relatar latência em balde de tamanho de lote para superficializar isso.

A implementação é Kubernetes. vLLM 0.7 executa uma réplica por GPU ou fragmento paralelo tensor. HPA autoscales em fila-ainda em vez de CPU. FP8 (Marlin) e INT4 (AWQ) quantes mantêm a memória da GPU dentro de um envelope H100 / H200. O relatório de ponta a ponta é de passagem, taxa de aceitação, p50 / p99 no lote 1/8/32, e $ / 1M tokens.

## Arquitetura

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## Estaca

- Servidora: vLLM 0,7 ou SGLang 0,4
- Métodos especulativos: cabeças de projeto EAGLE-3, especulação paralela P-EAGLE, regresso de graus
- Formação em projeto: SpecForge (SGLang) ou Red Hat Speculators
- Modelos-alvo: Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B
- Quantização: FP8 (Marlin), INT4 AWQ
- Implementação: Kubernetes + NVIDIA dispositivo plugin; HPA em fila de espera métrica
- Eval: ShareGPT, MT-Bench-v2, GSM8K, HumanEval para medição de aceitação de domínio-spread
- Referência: TensorRT-LLM descodificação especulativa para uma linha de base do fornecedor

```figure
cf-spec-decode
```

## Construí-lo

1. **Target model prep.**Escolha Llama 3.3 70B. Quantize para FP8 através de Marlin. Deploie sob vLLM 0,7 em 1xH100 (ou 2x tensor paralelo).

2. **Draft source.**Puxar um cabeçalho de projeto alinhado EAGLE-3 da Red Hat Speculators (ou treinar um através SpecForge).

3. **Baseline numbers.**Antes da especulação: tokens/s no lote 1/8/32, p50/p99 latência, utilização de GPU.

4. **Enable EAGLE-3.**Configuração de desvio; reiniciação do mesmo índice de referência. Raporto de aceleração, taxa de aceitação, p99 delta de latência de cauda.

5. **P-EAGLE.**Permitir especulação paralela; medir árvore de projeto mais profunda versus série EAGLE-3.

6. **Domain traffic.**Execute ShareGPT vs HumanEval vs. tráfego específico de domínio através do mesmo servidor. Meter a taxa de aceitação por distribuição. Identificar quando os rascunhos se deslocam.

7. **Second target model.**Execute o mesmo pipeline no Qwen3-Coder-30B MoE. O projecto é mais complicado (ruído de roteamento do MoE).

8. **K8s HPA.**Deploição sob K8s com rastreamento de HPA `queue_wait_ms`Demonstrar escala quando a carga triplica-se.

9. **Cost comparison.**Compute $ 1M em tokens contra Claude Sonnet 4.7 e OpenAI GPT-5.4 na mesma avaliação.

## Usá-lo

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## Envia-o

`outputs/skill-inference-server.md`Uma pilha de serviço medida com decodificação especulativa, um relatório completo de referência e uma implantação de K8s.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2.5x+ throughput at matched quality on two models |
| 20 | Acceptance rate on realistic traffic | Per-distribution acceptance-rate report |
| 20 | P99 tail-latency discipline | p99 at batch 1/8/32 with and without speculation |
| 20 | Ops | K8s deploy, HPA on queue-wait, rollout smooth |
| 15 | Write-up and methodology | Clear explanation of what changed and why |
| **100** | | |

## Exercícios

1. Medir a degradação da taxa de aceitação quando o projecto estiver uma versão atrás do objetivo (por exemplo, Llama 3.3 -> 3,4 drift).

2. Implementar o regresso de ngram: se a aceitação da EAGLE-3 cair abaixo de um limiar, passar para os projectos de ngram.

3. Execute um experimento controlado de MoE: o mesmo Qwen3-Coder-30B com ruído de roteamento injetado versus fora. Messa a sensibilidade à aceitação do projeto.

4. Estende-se para H200 (141 GB). Relate o modelo de tamanho por réplica de cabeçalho ganho e se você pode servir um Llama 3.3 70B não quantificado.

5. Descodificação especulativa TensorRT-LLM no mesmo hardware H100.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | Small model that proposes N tokens for the target to verify |
| EAGLE-3 | "2026 draft architecture" | Draft head trained on target hidden states; ~75% acceptance |
| P-EAGLE | "Parallel speculation" | Tree of draft branches verified in one target pass |
| Acceptance rate | "Hit rate" | Fraction of drafted tokens accepted without resampling |
| Quantization | "FP8 / INT4" | Lower-precision weights to fit more model in GPU memory |
| Queue wait | "HPA metric" | Time a request waits in the pending queue before inference starts |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic hub of EAGLE drafts for common open models |

## Mais leitura

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) a pilha de serviço de referência
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) papel paralelo de descodificação especulativa + integração
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) Projeto de formação de cabeças
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) centro de projeto alinhado
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) Alternativa de fornecedor
- [Fireworks.ai serving architecture](https://fireworks.ai/blog)Referência comercial
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) o papel de método
- [vLLM repository](https://github.com/vllm-project/vllm) código e referências
