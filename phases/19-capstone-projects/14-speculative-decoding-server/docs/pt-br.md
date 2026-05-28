# Capstone 14 — Servidor de Inferência com Speculative Decoding

> EAGLE-3 no vLLM 0.7 entrega 2.5-3x de throughput em tráfego real. P-EAGLE (AWS 2026) empurrou eespecificaçãoulação paralela ainda mais. SpecForge do SGLang treinou cabeçalhos draft em escala. Hub Speculators do Red Hat publicou drafts alinhados para modelos abertos comuns. TensorRT-LLM tornou especificaçãoulative decoding de primeira classe na NVIDIA. O stack de serving de produção de 2026 é vLLM ou SGLang com drafts da família EAGLE, quantização FP8 ou INT4 e HPA em queue-wait. Este capstone é servir dois modelos abertos a 2.5x+ do throughput baseline com um relatório completo de latência de cauda.

**Tipo:** Capstone
**Linguagens:** Python (serving), C++ / CUDA (inspeção de kernel), YAML (configs)
**Pré-requisitos:** Fase 3 (deep learning), Fase 7 (transformers), Fase 10 (LLMs do zero), Fase 17 (infraestrutura)
**Fases exercitadas:** P3 · P7 · P10 · P17
**Tempo:** 30 horas

## Problema

Speculative decoding se tornou commodity em 2026. Cabeçalhos draft EAGLE-3 são treinados nos estados ocultos do modelo alvo e predizem N tokens à frente; o modelo alvo verifica em um único passo. Taxas de aceitação de 60-80% se traduzem em 2-3x de throughput ponta a ponta. vLLM 0.7 integra isso nativamente. SGLang + SpecForge te dá a pipeline de treinamento. Hub Speculators do Red Hat publica drafts alinhados para Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B.

O ofício está nas operações de serving, não no modelo. Taxa de aceitação oscila com a distribuição de tráfego (ShareGPT vs código vs dados de domínio). Latência de cauda sob rejeição é pior que sem eespecificaçãoulação — você precisa reportar p99 em múltiplos tamanhos de batch, não apenas tokens/seg em estado estacionário. Custo por 1M tokens vs API da Anthropic / OpenAI é a alavanca de credibilidade.

## Conceito

Speculative decoding tem duas camadas. Um modelo **draft** (cabeçalho EAGLE-3, ngram ou modelo menor alinhado ao alvo) propõe k tokens candidatos por passo. O modelo **alvo** verifica todos os k em um único passo; qualquer prefixo aceito substitui o caminho guloso. Taxa de aceitação depende do alinhamento draft-alvo e da distribuição de entrada.

EAGLE-3 supera drafts ngram na maioria dos tráfegos. P-EAGLE roda eespecificaçãoulação paralela para árvores draft mais profundas. O trade-off: p99 de latência na rejeição é maior porque o passo de verificação é maior. A config de serving precisa reportar latência agrupada por tamanho de batch para revelar isso.

Deploy é Kubernetes. vLLM 0.7 roda uma réplica por GPU ou shard tensor-paralelo. HPA autoscalas em queue-wait em vez de CPU. Quants FP8 (Marlin) e INT4 (AWQ) mantêm a memória GPU dentro do envelope de um H100 / H200. O relatório ponta a ponta é throughput, taxa de aceitação, p50/p99 em batch 1/8/32 e $/1M tokens.

## Arquitetura

```
entrada de requisições
    |
    v
servidor vLLM (0.7) ou SGLang (0.4)
    |
    +-- draft: cabeçalhos EAGLE-3 | P-EAGLE paralelo | reserva ngram
    +-- alvo: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantizado FP8-Marlin ou INT4-AWQ
    |
    v
passo de verificação: batch k tokens draft pelo alvo
    |
    v (aceitar prefixo; reamostrar para sufixo rejeitado)
    v
stream de tokens de volta ao cliente
    |
    v
métricas Prometheus: throughput, taxa de aceitação, queue wait, latência p50/p99
    |
    v
HPA na métrica queue-wait
```

## Stack

- Serving: vLLM 0.7 ou SGLang 0.4
- Métodos eespecificaçãoulativos: cabeçalhos draft EAGLE-3, eespecificaçãoulação paralela P-EAGLE, reserva ngram
- Treinamento de draft: SpecForge (SGLang) ou Red Hat Speculators
- Modelos alvo: Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B
- Quantização: FP8 (Marlin), INT4 AWQ
- Deploy: Kubernetes + plugin de dispositivo NVIDIA; HPA na métrica queue-wait
- Avaliação: ShareGPT, MT-Bench-v2, GSM8K, HumanEval para medição de aceitação com distribuição de domínio
- Referência: TensorRT-LLM especificaçãoulative decoding como baseline de fornecedor

## Construa

1. **Preparo do modelo alvo.** Escolha Llama 3.3 70B. Quantize para FP8 via Marlin. Implsobelo sob vLLM 0.7 em 1xH100 (ou 2x tensor-paralelo).

2. **Fonte do draft.** Puxe um cabeçalho draft EAGLE-3 alinhado do Red Hat Speculators (ou treine um via SpecForge). Carregue na config de especificaçãoulative decoding do vLLM.

3. **Números baseline.** Antes da eespecificaçãoulação: tokens/s em batch 1/8/32, latência p50/p99, utilização de GPU. Publique.

4. **Habilite EAGLE-3.** Troque a config; reexecute o mesmo teste. Relate aceleração, taxa de aceitação, delta de p99 de latência de cauda.

5. **P-EAGLE.** Habilite eespecificaçãoulação paralela; meça árvore draft mais profunda vs EAGLE-3 serial. Relate o ponto de inflexão onde P-EAGLE ajuda vs prejudica.

6. **Tráfego de domínio.** Rode ShareGPT vs HumanEval vs tráfego eespecificaçãoífico de domínio pelo mesmo servidor. Meça taxa de aceitação por distribuição. Identifique quando os drafts divergem.

7. **Segundo modelo alvo.** Rode a mesma pipeline no Qwen3-Coder-30B MoE. Draft é mais complicado (ruído de roteamento MoE). Relate.

8. **HPA K8s.** Implsobelo sob K8s com HPA rastreando `queue_wait_ms`. Demonstre scale-out quando a carga triplica.

9. **Comparação de custo.** Compute $/1M tokens vs Claude Sonnet 4.7 da Anthropic e GPT-5.4 da OpenAI na mesma avaliação. Publique.

## Use

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[servir]    vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 ativo
[decode]    bs=8, tokens_aceitos_por_passo=3.2, taxa_aceitação=0.76
[latência]  primeiro-token 42ms, resposta-completa 980ms (620 tokens)
[custo]     $0.34 por 1M tokens de saída em throughput sustentado
```

## Entregue

`outputs/skill-inference-server.md` descreve a entrega. Um stack de serving medido com especificaçãoulative decoding, um relatório de teste completo e um implantação K8s.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Aceleração medida vs baseline | 2.5x+ de throughput com qualidade equivalente em dois modelos |
| 20 | Taxa de aceitação em tráfego realístico | Relatório de taxa de aceitação por distribuição |
| 20 | Disciplina de p99 de latência de cauda | p99 em batch 1/8/32 com e sem eespecificaçãoulação |
| 20 | Operações | Deploy K8s, HPA em queue-wait, rollout suave |
| 15 | Escrito e metodologia | Explicação clara do que mudou e por quê |
| **100** | | |

## Exercícios

1. Meça a degradação da taxa de aceitação quando o draft está uma versão atrás do alvo (ex.: deriva de Llama 3.3 -> 3.4). Construa um alerta de monitoramento.

2. Implemente reserva ngram: se a aceitação do EAGLE-3 cair abaixo de um limiar, troque para drafts ngram. Relate melhoria na confiabilidade.

3. Rode um experimento MoE controlado: mesmo Qwen3-Coder-30B com ruído de roteamento injetado vs sem. Meça sensibilidade da aceitação do draft.

4. Estenda para H200 (141 GB). Relate o espaço ganho em tamanho-de-modelo-por-réplica e se você pode servir um Llama 3.3 70B não-quantizado.

5. Teste TensorRT-LLM especificaçãoulative decoding no mesmo hardware H100. Relate onde ele ganha vs vLLM.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Modelo draft | "Speculator" | Modelo pequeno que propõe N tokens para o alvo verificar |
| EAGLE-3 | "Arquitetura draft de 2026" | Cabeçalho draft treinado em estados ocultos do alvo; ~75% de aceitação |
| P-EAGLE | "Eespecificaçãoulação paralela" | Árvore de ramificações draft verificadas em um único passo do alvo |
| Taxa de aceitação | "Taxa de acerto" | Fração de tokens draft aceitados sem reamostragem |
| Quantização | "FP8 / INT4" | Pesos de precisão reduzida para caber mais modelo na memória GPU |
| Queue wait | "Métrica HPA" | Tempo que uma requisição espera na fila pendente antes da inferência começar |
| Hub Speculators | "Drafts alinhados" | Hub Red Hat Neural Magic de drafts EAGLE para modelos abertos comuns |

## Leitura Complementar

- [Documentação EAGLE e P-EAGLE do vLLM](https://docs.vllm.ai) — stack de serving de referência
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-especificaçãoulative-decoding-in-vllm/) — paper de especificaçãoulative decoding paralelo + integração
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — pipeline de treinamento de cabeçalho draft
- [Red Hat Speculators](https://github.com/neuralmagic/especificaçãoulators) — hub de drafts alinhados
- [Speculative decoding TensorRT-LLM](https://nvidia.github.io/TensorRT-LLM/) — alternativa de fornecedor
- [Arquitetura de serving Fireworks.ai](https://fireworks.ai/blog) — referência comercial
- [Paper EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) — paper do método
- [Repositório vLLM](https://github.com/vllm-project/vllm) — código e benchmarks
