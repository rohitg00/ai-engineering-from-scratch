---
name: skill-inference-optimization
description: Diagnosticar e otimizar a inferência LLM atendendo ao rendimento, à latência e ao custo
version: 1.0.0
phase: 10
lesson: 12
tags: [inference, kv-cache, batching, speculative-decoding, vllm, optimization]
---

# Padrão de otimização de inferência LLM

Duas fases: pré-preenchimento (ligado à computação, paralelo) e decodificação (ligado à memória, sequencial).
Cada otimização visa um ou ambos.

```
Request -> Prefill (process prompt) -> Decode (generate tokens) -> Response
              |                            |
         Compute-bound               Memory-bound
         Optimize: fusion,           Optimize: batching,
         prefix caching              quantization, speculation
```

## Estrutura de decisão

### Etapa 1: Identifique seu gargalo

Meça a proporção de operações:byte para sua carga de trabalho:

| operações:byte | Limite | O que otimizar |
|----------|-------|-----------------|
| <50 | Memória | Quantize o cache KV, aumente o tamanho do lote |
| 50-200 | Transicional | Ambos são importantes, comece com lote |
| > 200 | Calcular | Fusão de kernel, paralelismo de tensores, FP8 |

### Etapa 2: Escolha seu motor

- **Padrão**: vLLM (suporte de modelo mais amplo, PagedAttention, API compatível com OpenAI)
- **Saída multivoltas/estruturada**: SGLang (cache de prefixo RadixAttention, decodificação restrita)
- **Taxa de transferência máxima da NVIDIA**: TensorRT-LLM (fusão de kernel, FP8 em H100)

### Etapa 3: aplicar otimizações em ordem

1. **Cache KV** – sempre ativado, sem desvantagens
2. **Lote contínuo** – sempre ativado, sem desvantagens (vLLM/SGLang faz isso por padrão)
3. **Cache de prefixo** – ative se você tiver prompts de sistema compartilhados (a maioria dos chatbots faz)
4. **Quantização** – O cache KV INT8/FP8 reduz a memória de 2 a 4x com perda mínima de qualidade
5. **Decodificação especulativa** – adicione quando a latência for mais importante do que a taxa de transferência
6. **Paralelismo de tensor** – dividido entre GPUs quando o modelo não cabe em uma

## Fórmula de memória cache KV

```
per_token = 2 * num_layers * num_kv_heads * head_dim * bytes_per_param
total = per_token * sequence_length * num_concurrent_users
```

Referência rápida para modelos comuns (BF16):

| Modelo | Por token | 100 usuários em 4K |
|-------|-----------|----------------|
| Lhama 3 8B | 32 KB | 12,5 GB |
| Lhama 3 70B | 320 KB | 125 GB |
| Lhama 3 405B | 504 KB | 197GB |

## Lista de verificação de decodificação especulativa

- O modelo de rascunho deve ser 5 a 10 vezes menor que o alvo (por exemplo, rascunhos de 8B para 70B)
- Taxa de aceitação > 70% para aceleração significativa
- Melhor em texto previsível (código, saída estruturada, linguagem natural)
- Pior em tarefas criativas/de amostragem pesada (a baixa temperatura ajuda)
- EAGLE > draft-target > n-gram para a maioria das cargas de trabalho

## Erros comuns

- Executando decodificação em lote = 1 (limitado à memória, GPU 95% ociosa na computação)
- Alocação de blocos de cache KV contíguos (use PagedAttention, obtenha desperdício quase zero)
- Ignorar o cache de prefixo quando 80% das solicitações compartilham o mesmo prompt do sistema
- Superprovisionamento de memória GPU para pesos de modelo, não deixando nada para o cache KV
- Medir o rendimento sem medir a latência (alto rendimento em 10s TTFT é inútil)
- Usando decodificação especulativa com alta temperatura (a taxa de aceitação cai abaixo de 50%)

## Lista de verificação de monitoramento

- Tempo até o primeiro token (TTFT): latência de pré-preenchimento, meta < 500 ms para uso interativo
- Latência entre tokens (ITL): velocidade de decodificação, meta <50ms para streaming
- Taxa de transferência (tokens/segundo): total de todos os usuários simultâneos
- Utilização do cache KV: porcentagem de cache alocado em uso
- Utilização de lote: porcentagem de slots de lote preenchidos por iteração
- Profundidade da fila: solicitações aguardando um slot de lote