# Cache KV, Atensão Flash e Optimização de Inferência

> O treinamento é paralelo e ligado ao FLOP. A inferência é serial e ligada à memória.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## O problema

Um descodificador autoregressivo ingênuo faz .$O(N^2)$trabalho para gerar $N$Tokens: em cada passo recalcula a atenção sobre o prefixo completo. Para uma resposta de token 4K que é 16M operações de atenção, a maioria delas redundantes. Cada estado oculto de um token prefixo é determinista uma vez calculado.

Além disso, a atenção em si move muitos dados. A atenção padrão materializa uma matriz de pontuação N×N, saída N×d softmax, saída final N×d  muita leitura e escrita para HBM. Para N≥2K, a atenção se torna limitada à memória antes de se tornar FLOP-bound.

Duas otimizações, ambas de Dao et al., empurraram a inferência de fronteira de "lento" para "rápido":

1. **KV cache.**Armazenar os vetores K e V de cada token pré-fix. A atenção de cada novo token é uma consulta contra as chaves armazenadas em cache.$O(N^2)$- Não .$O(N)$por fase de geração.
2. **Flash Attention.**Tire a computação de atenção para que a matriz completa N×N nunca atinja HBM. Todo softmax + matmul acontece na SRAM. 24× velocidade do relógio de parede em A100; 510× em H100 com FP8.

Em 2026, ambos são universais. Todas as pilhas de inferência de produção (vLLM, TensorRT-LLM, SGLang, llama.cpp) assumem-nos.

## O conceito

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### Matemática do cache KV

Por camada de decodificador, por token, em todas as cabeças KV:

```
bytes_per_token_per_layer = 2 * n_kv_heads * d_head * dtype_size
                          ^
                          K and V
```

Para um modelo 7B com 32 camadas, 32 cabeças (todas utilizadas para K e V), d_head=128, fp16:

```
per token per layer = 2 * 32 * 128 * 2 = 16384 bytes (16 KiB)
per token (32 layers) = 512 KiB
per 32K context = 16 GiB
```

Para Llama 3 70B (80 camadas, d_head=128, GQA com 8 cabeças de KV):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
per 32K context = 10 GiB
```

Esse 10 GiB em 32K cresce para 40 GiB em 128K, o que é o todo de um A100 de 40 GB apenas para cache KV no tamanho de lote 1.

**GQA is the KV-cache win.**O MHA com 64 cabeças KV seria 8x maior, cerca de 80 GiB em 32K.

Arraste as dimensões e observe o movimento do tamanho do cache. Empurre o comprimento da sequência ou batch para cima e veja a velocidade com que ele sopra além de uma única GPU:

```figure
kv-cache-sizer
```

### Atenção flash  o truque de tecelagem

Atenção padrão:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

Três viagens de ida e volta de HBM. Em H100, a largura de banda de HBM é de 3 TB/s; SRAM é de 30 TB/s. Cada viagem de HBM é um fator de 10 desaceleração versus manter tudo no chip.

Atenção flash:

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

Uma viagem de HBM por telha.$O(N^2)$- Não .$O(N)$Passada para trás recalcula alguns valores da passada para frente em vez de armazená-los  outra vitória de memória.

**Numerical trick.**Funcionamento de softmax mantém `(max, sum)`A atenção flash calcula a saída bit-identical para atenção padrão (modulo fp16 não-asociatividade).

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

Flash 4 é avançado apenas no lançamento. O treinamento ainda usa Flash 3.

### Descodagem especulativa  a outra vitória de latência

O modelo barato propõe N tokens. O modelo grande verifica todos os N em paralelo. Se a verificação aceita k tokens, você pagou 1 grande modelo pass para frente para k gerações.

2026 padrões:
- **EAGLE 2 / Medusa.**cabeças de rascunho integradas que compartilham os estados ocultos do verificador. 23x aceleração sem perda de qualidade.
- **Speculative decoding with draft model.**2×4x de aceleração no hardware do consumidor.
- **Lookahead decoding.**Iteração Jacobi, não é necessário um modelo de projeto.

### Batchagem contínua

Inferência em lote clássica: esperar a sequência mais lenta para terminar, e depois iniciar um novo lote.

Batchamento contínuo (primeiro enviado em Orca, agora em vLLM, TensorRT-LLM, SGLang): troca de novas solicitações no lote assim que os antigos terminam. 510x ganho de throughput para cargas de trabalho típicas de chat.

### PagedAttention  cache KV como memória virtual

O cache KV é alocado em blocos de 16 tokens; uma tabela de página mapeia posições lógicas para blocos físicos. Permite compartilhar KV em amostras paralelas (pesquisa de feixe, amostragem paralela), prefixos de troca de calor para cache rápida e memória de defragmentação. Melhoria de 4x de throughput em relação à alocação contígua ingênua.

```figure
flash-attention-memory
```

## Construí-lo

```figure
iso-machine {"machine":"kv-cache"}
```

Veja .`code/main.py`, ou seu porto de Rust `code/main.rs`Para executar a versão Rust:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`Implementamos:

1. Um ingênuo .$O(N^2)$Decodificador incremental.
2. A.$O(N)$Descóderas em cache KV.
3. Um softmax de azulejos que simula o algoritmo de execução máxima da Flash Attention.

### Passo 1: cache KV

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

Simples: continuar a crescer vetores por token K, V em listas por camada, por cabeça.

### Passo 2: softmax de azulejos

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

Saída de bits idêntica a `softmax(qK) V`em um tiro, mas a qualquer momento o conjunto de trabalho é um `tile × d_head`Bloco, não o completo.`N × d_head`- Não .

### Passo 3: Compare a descodificação ingênua com a em cache

As duas decodificadoras fazem as mesmas comparações de chave de consulta: passo `t`- Não .`t`Tokens, então o total é 1 + 2 + ... + N = N(N+1)/2. O código usa N = 10 e imprime 55 para cada decodificador. Para uma geração de 100 tokens, ambos fazem 5050 comparações. O cache guarda as projeções K e V. Sem um cache, cada passo calcula K e V novamente para o prefixo completo, então uma geração de 100 tokens calcula 5050 estados de tokens. Com o cache, o K e o V de cada token são calculados uma vez, então a mesma geração calcula 100 estados de token.

## Usá-lo

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

Produção de VLLM:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

O pré-acessamento de pré-contexto em todas as solicitações é um grande ganho de 2026  o mesmo sistema de prompt, alguns exemplos de tiros ou documento de contexto longo reutiliza KV em todas as chamadas. Para cargas de trabalho de agente com repetidas solicitações de ferramentas, o pré-acessamento de pré-contexto é rotineiramente ganho de throughput de 5x.

## Envia-o

Veja .`outputs/skill-inference-optimizer.md`A habilidade escolhe implementação de atenção, estratégia de cache KV, quantização e decodificação especulativa para uma nova implantação de inferências.

## Exercícios

1. **Easy.**Corra .`code/main.py`- Confirmar que os decodificadores ingênuos e armazenados em cache produzem a mesma saída; observar a diferença de op-count.
2. **Medium.**Implementar o caching de prefixos: dado um prompt P e várias conclusões, executar uma passagem para frente sobre P para preencher o cache KV, em seguida, ramificar por conclusão.
3. **Hard.**Implementar um brinquedo PagedAttention: KV cache em blocos fixos de 16 tokens com uma lista livre. Quando uma sequência terminar, devolva seus blocos ao pool. Simula 1000 conclusões de bate-papo com comprimentos variados. Compare fragmentação de memória versus alocação contígua.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## Mais leitura

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135)Flash 1.
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691)Flash 2.
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608)Flash 3.
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) O pipeline de 5 etapas Blackwell e o truque de software-exp2; leia o repo README para as advertências de lançamento apenas para o futuro mencionadas nesta lição.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)- Papel de trabalho.
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)- Descodagem de especificações.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) O documento EAGLE-1/2 para a abordagem de projecto integrado que cita a lição.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) a abordagem Medusa referenciada ao lado da AGLE.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) o mergulho profundo canônico no bloco de 16 tokens e no design da tabela de páginas.
