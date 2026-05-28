---
name: inference-server
description: Ship a speculative-decoding inference server with EAGLE-3 or P-EAGLE drafts, K8s autoscaling, and a full throughput/latency/cost report.
version: 1.0.0
phase: 19
lesson: 14
tags: [capstone, inference, vllm, sglang, eagle-3, p-eagle, speculative-decoding, quantization, hpa]
---
---
name: inference-server
description: Ship a speculative-decoding inference server with EAGLE-3 or P-EAGLE drafts, K8s autoscaling, and a full throughput/latency/cost report.
version: 1.0.0
phase: 19
lesson: 14
tags: [capstone, inference, vllm, sglang, eagle-3, p-eagle, speculative-decoding, quantization, hpa]
---

Dados dois modelos de destino abertos (Llama 3.3 70B e Qwen3-Coder-30B MoE ou GPT-OSS-120B), envie uma pilha de serviços de produção com decodificação especulativa, quantização e escalonamento automático do Kubernetes. Publique acelerações medidas e números de latência final.

Plano de construção:

1. Implantar modelos alvo sob vLLM 0.7 (ou SGLang 0.4) com quantização FP8 Marlin.
2. Carregue um rascunho EAGLE-3 alinhado do Red Hat Speculators (ou treine um via SpecForge).
3. Números de linha de base: tokens/s e latência p50/p99 no lote 1/8/32 sem especulação.
4. Ative o EAGLE-3. Execute novamente o mesmo benchmark. Aceleração do relatório, taxa de aceitação, delta de latência final p99.
5. Habilitar especulação paralela P-EAGLE; relate a inflexão onde as árvores mais profundas ajudam ou prejudicam.
6. Execute os benchmarks entre distribuições: ShareGPT, HumanEval, dados de domínio. Publique o desvio da taxa de aceitação.
7. Repita no segundo modelo alvo (MoE); identificar a sensibilidade ao ruído de roteamento na aceitação do rascunho.
8. Implante no Kubernetes com rastreamento HPA `queue_wait_ms`. Demonstre a expansão quando a carga triplicar.
9. Compare tokens de $/1 milhão com Anthropic Claude Sonnet 4.7 e OpenAI GPT-5.4 em avaliações correspondentes.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Aceleração medida versus linha de base | Rendimento 2,5x+ com qualidade correspondente em ambos os modelos |
| 20 | Taxa de aceitação em tráfego realista | Relatório de taxa de aceitação por distribuição |
| 20 | Disciplina de latência de cauda P99 | p99 no lote 08/01/32 com e sem especulação |
| 20 | Operações | Implantação de K8s, HPA em espera na fila, implementação tranquila, atualização com drenagem inicial |
| 15 | Redação e metodologia | Derivação clara de métricas, linhas de base correspondentes |

Rejeições difíceis:

- Relatórios de rendimento em estado estacionário sem latência final.
- HPA na CPU em vez de espera na fila. Irá se debater sob a saturação da GPU.
- Ignorando o alinhamento da versão de destino do rascunho. Rascunhos desviados custam mais do que nenhuma especulação.
- Comparações de custos que omitem os descontos de cache imediato das APIs hospedadas.

Regras de recusa:

- Recuse-se a servir sem ralo extensível. Atualizar no local enquanto as solicitações estão em andamento é desqualificante.
- Recuse-se a relatar a taxa de aceitação agregada entre distribuições. A distribuição por distribuição é obrigatória.
- Recuse-se a reivindicar vitórias de decodificação especulativa em bs=32 sem um número não especulativo correspondente.

Saída: um repositório contendo as configurações de vLLM / SGLang, o script de download de rascunho EAGLE-3, manifestos de implantação K8s, configuração HPA em espera de fila, o chicote de referência para dados ShareGPT / HumanEval / domínio, uma tabela de comparação de tokens de $ / 1 milhão e um artigo nomeando as três regressões de latência final, decodificação especulativa introduzida e a mitigação (gate em lote, fallback de ngram, ajuste de quantização) que corrigiu cada uma.