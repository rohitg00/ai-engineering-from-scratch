# KV Cache, Flash Attention e Otimização de Inferência

> Treinamento é paralelo e limitado por FLOPs. Inferência é serial e limitada por memória. Gargalo diferente, truques diferentes.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 02 (Self-Attention), Fase 7 · 05 (Transformer Completo), Fase 7 · 07 (GPT)
**Tempo:** ~75 minutos

## O Problema

Um decoder autoregressivo inocente faz `O(N²)` trabalho pra gerar `N` tokens: a cada passo recomputa attention sobre o prefixo inteiro. Pra uma resposta de 4K tokens são 16 milhões de operações de attention, a maioria redundante. Todo estado oculto de um token de prefixo é determinístico uma vez computado — você só precisa rodar a consulta do novo token contra keys e values cacheados de tudo que veio antes.

Além disso, a própria attention move muitos dados. Attention padrão materializa uma matriz de scores N×N, saída N×d do softmax, saída final N×d — muitas leituras e escritas em HBM. Pra N≥2K, attention vira limitada por memória antes de virar limitada por FLOPs. Kernels de attention clássicos subutilizam GPUs modernas em 4–10×.

Duas otimizações, ambas de Dao et al., levaram inferência de fronteira de "lenta" pra "rápida":

1. **KV cache.** Armazena vetores K e V de cada token de prefixo. A attention de cada novo token é uma consulta contra keys cacheadas. Inferência reduz de `O(N²)` pra `O(N)` por passo de geração.
2. **Flash Attention.** Faz tiles da computação de attention pra que a matriz N×N inteira nunca atinja HBM. Todo softmax + matmul acontece em SRAM. Aceleração de 2–4× em tempo real no A100; 5–10× no H100 com FP8.

Em 2026 ambos são universais. Toda stack de inferência de produção (vLLM, TensorRT-LLM, SGLang, llama.cpp) os assume. Todo modelo de fronteira vem com Flash Attention habilitado.

## O Conceito

![Crescimento do KV cache e tiling do Flash Attention](../assets/kv-cache-flash-attn.svg)

### Matemática do KV cache

Por camada do decoder, por token, por head:

```
bytes_per_token_per_layer = 2 * d_head * dtype_size
                          ^
                          K and V
```

Pra um modelo de 7B com 32 camadas, 32 heads, d_head=128, fp16:

```
per token per layer = 2 * 128 * 2 = 512 bytes
per token (32 layers) = 16 KB
per 32K context = 512 MB
```

Pra Llama 3 70B (80 camadas, d_head=128, GQA com 8 KV heads):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KB)
per 32K context = 10.4 GB
```

Esses 10 GB são o motivo de Llama 3 70B com contexto de 128K precisar a maioria de uma A100 de 40 GB só pro KV cache em batch size 1.

**GQA é a vitória do KV cache.** MHA com 64 heads seria 32 GB. MLA comprime ainda mais.

### Flash Attention — o truque do tiling

Attention padrão:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

Três viagens de ida e volta em HBM. No H100, largura de banda de HBM é 3 TB/s; SRAM é 30 TB/s. Cada viagem na HBM é um fator de 10 mais lento que manter tudo no chip.

Flash Attention:

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

Uma viagem na HBM por tile. Pegada de memória total cai de `O(N²)` pra `O(N)`. Backward pass recomputa alguns valores do forward pass ao invés de armazenar — mais economia de memória.

**Truque numérico.** Softmax incremental mantém `(max, sum)` entre tiles pra que a normalização final seja exata. Não é aproximação — Flash Attention calcula saída bit-idêntica a attention padrão (módulo não-associatividade do fp16).

**Evolução de versões:**

| Versão | Ano | Mudança chave | Aceleração no hardware de referência |
|--------|-----|--------------|--------------------------------------|
| Flash 1 | 2022 | Kernel tiled em SRAM | 2× no A100 |
| Flash 2 | 2023 | Melhor paralelismo, ordenação causal-first | 3× no A100 |
| Flash 3 | 2024 | Assincronia Hopper, FP8 | 1,5–2× no H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Pipeline de 5 estágios Blackwell, exp2 por software | Primeiro pra inferência (só forward inicialmente) |

Flash 4 é forward-pass-only no lançamento. Treinamento ainda usa Flash 3. Suporte a GQA e varlen pra Flash 4 está pendente (meados de 2026).

### Decodificação eespecificaçãoulativa — a outra vitória de latência

Modelo barato propõe N tokens. Modelo grande verifica todos N em paralelo. Se a verificação aceita k tokens, você pagou uma passada do modelo grande pra k gerações. Típico k=3–5 em código e prosa.

Padrões de 2026:
- **EAGLE 2 / Medusa.** Heads de rascunho integrados que compartilham estados ocultos do verificador. Aceleração de 2–3× sem perda de qualidade.
- **Decodificação eespecificaçãoulativa com modelo rascunho.** Aceleração de 2–4× em hardware de consumidor.
- **Decodificação lookahead.** Iteração de Jacobi; sem modelo rascunho. Nicho mas grátis.

### Batch contínuo

Batching clássico de inferência: espera a sequência mais lenta terminar, depois inicia novo batch. Desperdiça GPU quando respostas curtas terminam cedo.

Batching contínuo (primeiro no Orca, agora no vLLM, TensorRT-LLM, SGLang): insira novas requisições no batch assim que as antigas terminarem. Ganho de throughput de 5–10× pra cargas típicas de chat.

### PagedAttention — KV cache como memória virtual

Feature destaque do vLLM. KV cache é alocado em blocos de 16 tokens; tabela de páginas mapeia posições lógicas pra blocos físicos. Permite compartilhar KV entre amostras paralelas (beam search, amostragem paralela), hot-swap de prefixos pra cache de prompt e desfragmentar memória. Melhoria de throughput de 4× sobre alocação contígua inocente.

## Construindo

Veja `code/main.py`. Implementamos:

1. Um decoder incremental `O(N²)` inocente.
2. Um decoder com KV cache `O(N)`.
3. Um softmax tiled que simula o algoritmo de running-max do Flash Attention.

### Passo 1: KV cache

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

Simples: mantenha crescendo vetores K, V por token em listas por camada, por head.

### Passo 2: softmax tiled

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

Saída bit-idêntica a `softmax(qK) V` de uma vez, mas a qualquer momento o conjunto de trabalho é um bloco `tile × d_head`, não `N × d_head` inteiro.

### Passo 3: comparar decodificação inocente vs cacheada em geração de 100 tokens

Conte operações de attention. Inocente: `O(N²)` = 5050. Cacheada: `O(N)` = 100. O código imprime ambos.

## Usando

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

Produção com vLLM:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

Cache de prefixo entre requisições é uma grande vitória de 2026 — o mesmo prompt de sistema, exemplos few-shot ou documento de contexto longo reutiliza KV entre chamadas. Pra cargas de agentes com prompts de ferramentas repetidos, cache de prefixo rotineiramente dá ganho de throughput de 5×.

## Entregando

Veja `outputs/skill-inference-optimizer.md`. A skill escolhe implementação de attention, estratégia de KV cache, quantização e decodificação eespecificaçãoulativa pra uma nova implantação de inferência.

## Exercícios

1. **Fácil.** Rode `code/main.py`. Confirme que decoders inocente e cacheado produzem a mesma saída; note a diferença na contagem de operações.
2. **Médio.** Implemente cache de prefixo: dado um prompt P e várias completões, rode um forward pass sobre P pra preencher o KV cache, depois ramifique por completão. Meça aceleração vs re-codificar P pra cada uma.
3. **Difícil.** Implemente um PagedAttention brinquedo: KV cache em blocos fixos de 16 tokens com uma free-list. Quando uma sequência terminar, devolva seus blocos ao pool. Simule 1.000 completões de chat com comprimentos variados. Compare fragmentação de memória vs alocação contígua.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| KV cache | "O truque que torna decodificação rápida" | K e V armazenados de cada token de prefixo; queries novas atendem a eles ao invés de recomputar. |
| HBM | "Memória principal da GPU" | High Bandwidth Memory; 80 GB no H100, 192 GB no B200. ~3 TB/s de largura de banda. |
| SRAM | "Memória on-chip" | Memória rápida por SM, ~256 KB por SM no H100. ~30 TB/s de largura de banda. |
| Flash Attention | "Kernel de attention tiled" | Calcula attention sem materializar N×N em HBM. |
| Batch contínuo | "Batching sem espera" | Troca sequências terminadas por novas, sem esvaziar o batch. |
| PagedAttention | "Destaque do vLLM" | KV cache alocado em blocos fixos com tabela de páginas; elimina fragmentação. |
| Cache de prefixo | "Reutilizar prompts longos" | Cache de KV pra prefixo compartilhado entre requisições; corte de custo enorme pra agentes. |
| Decodificação eespecificaçãoulativa | "Rascunho + verificação" | Modelo rascunho barato propõe tokens; modelo grande verifica k em uma passada. |

## Leituras Complementares

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) — Flash 1.
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) — Flash 2.
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) — Flash 3.
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) — Pipeline de 5 estágios Blackwell e o truque de exp2 por software; leia o README do repo pra as ressalvas de lançamento forward-only que esta aula menciona.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) — paper do vLLM.
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — decodificação eespecificaçãoulativa.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — paper EAGLE-1/2 pra abordagem de rascunho integrado citada na aula.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — abordagem Medusa referenciada ao lado de EAGLE.
- [Docs do vLLM — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) — o deep dive canônico sobre o design de blocos de 16 tokens e tabela de páginas.
