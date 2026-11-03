# Cache KV, atención flash y optimización de la inferencia

> El entrenamiento es paralelo y ligado a FLOP. La inferencia es seria y ligada a la memoria. Diferentes cuellos de botella, diferentes trucos.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## El problema

Un descifrador autoregresor ingenuo sí .$O(N^2)$trabajo para generar $N$Tokens: en cada paso recalcula la atención sobre el prefijo completo. Para una respuesta de tokens 4K que es 16M operaciones de atención, la mayoría de ellos redundantes. Cada estado oculto de un token prefijo es determinista una vez calculado.

Además, la atención misma mueve muchos datos. La atención estándar materializa una matriz de puntaje N×N, salida de N×d softmax, salida final N×d  demasiadas lecturas y escrituras a HBM. Para N≥2K, la atención se vuelve limitada a la memoria antes de que se convierta en FLOP-bound.

Dos optimizaciones, ambas de Dao et al., empujaron la inferencia fronteriza de "lento" a "rápido":

1. **KV cache.**Almacenar los vectores K y V de cada token prefijo. la atención de cada nuevo token es una consulta contra las claves almacenadas en caché.$O(N^2)$¿ Qué ?$O(N)$por cada paso de generación.
2. **Flash Attention.**El cálculo de la atención se realiza con una tela de tela para que la matriz completa de N×N nunca alcance el HBM. Todo el softmax + matmul ocurre en SRAM. 24× velocidad del reloj de pared en A100; 510× en H100 con FP8.

Para 2026 ambos son universales. Cada pila de inferencias de producción (vLLM, TensorRT-LLM, SGLang, llama.cpp) los asume.

## El concepto

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### Matemáticas de caché de KV

Por capa de decodificación, por token, en todas las cabezas de KV:

```
bytes_per_token_per_layer = 2 * n_kv_heads * d_head * dtype_size
                          ^
                          K and V
```

Para un modelo 7B con 32 capas, 32 cabezas (todas utilizadas para K y V), d_head=128, fp16:

```
per token per layer = 2 * 32 * 128 * 2 = 16384 bytes (16 KiB)
per token (32 layers) = 512 KiB
per 32K context = 16 GiB
```

Para Llama 3 70B (80 capas, d_head=128, GQA con 8 capas de KV):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
per 32K context = 10 GiB
```

Ese 10 GiB en 32K crece a 40 GiB en 128K, que es el conjunto de un A100 de 40 GB sólo para el caché KV en el tamaño de lote 1.

**GQA is the KV-cache win.**El MHA con 64 cabezas de KV sería 8 veces más grande, aproximadamente 80 GiB en 32K.

Arraste las dimensiones y observa el tamaño de la caché. Empuje la longitud de la secuencia o lote hacia arriba y vea qué tan rápido se desvanece más allá de una sola GPU:

```figure
kv-cache-sizer
```

### La atención de flash  el truco de la balsa

Atención estándar:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

Tres viajes de ida y vuelta de HBM. En H100, el ancho de banda de HBM es de 3 TB/s; SRAM es de 30 TB/s. Cada viaje de HBM es un factor de 10 de desaceleración frente a mantener todo en el chip.

Atención instantánea:

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

Un viaje de HBM por baldosas.$O(N^2)$¿ Qué ?$O(N)$. El pase hacia atrás recalcula algunos valores del pase hacia adelante en lugar de almacenarlos  otra ganancia de memoria.

**Numerical trick.**El funcionamiento de softmax se mantiene `(max, sum)`La atención flash calcula la salida idéntica a la atención estándar (modulo fp16 no asociativa).

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

Flash 4 es solo avanzado al lanzamiento. El entrenamiento todavía utiliza Flash 3.

### Descodación especulativa  la otra latencia gana

El modelo barato propone N tokens. El modelo grande verifica todos los N en paralelo. Si la verificación acepta k tokens, pagó 1 pase adelante de modelo grande para k generaciones.

2026 incumplimientos:
- **EAGLE 2 / Medusa.**Tías de proyección integradas que comparten los estados ocultos del verificador. 23x aceleración sin pérdida de calidad.
- **Speculative decoding with draft model.**2×4 veces más rápido en el hardware de consumo.
- **Lookahead decoding.**Iteración Jacobi, no se necesita un modelo de borrador. Nicho pero gratis.

### Participación continua

Inferencia clásica de lote: esperar a que termine la secuencia más lenta, luego iniciar un nuevo lote.

Batchamiento continuo (en Orca, ahora en vLLM, TensorRT-LLM, SGLang): intercambiar nuevas solicitudes en el lote tan pronto como terminen las viejas.

### PagedAttention  KV caché como memoria virtual

La función principal de vLLM. El caché KV se asigna en bloques de 16 tokens; una tabla de página mapea las posiciones lógicas de los bloques físicos. Permite compartir KV a través de muestras paralelas (busca de haces, muestreo paralelo), prefijos de intercambio caliente para el caché rápido y memoria de desfragmentación. Mejora de rendimiento 4x sobre asignación contiguosa ingenua.

```figure
flash-attention-memory
```

## Construye el mismo

```figure
iso-machine {"machine":"kv-cache"}
```

¿ Qué ?`code/main.py`Implementamos:

1. Un ingenuo .$O(N^2)$decodificador incremental.
2. ¿ Qué es esto ?$O(N)$Descriptor de caché KV.
3. Una softmax de tejas que simula el algoritmo de ejecución máxima de Flash Attention.

### Paso 1: Caché de KV

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

Sencillo: sigue creciendo por token K, V vectores en por capa, por lista de cabeza.

### Paso 2: softmax de azulejos

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

Una salida idéntica a bit `softmax(qK) V`en un solo disparo, pero en cualquier momento el juego de trabajo es un `tile × d_head`Bloqueo, no el completo `N × d_head`¿ Qué ?

### Paso 3: Comparar la descifrado ingenuo con caché

Cuenta las operaciones de atención. Ambos decodificadores hacen las mismas comparaciones de clave de consulta: paso `t`Asiste a la reunión .`t`los tokens, por lo que el total es 1 + 2 + ... + N = N(N+1)/2. El código utiliza N = 10 e imprime 55 para cada decodificador. Para una generación de 100 tokens, ambos hacen 5050 comparaciones. La caché guarda las proyecciones K y V. Sin una caché, cada paso calcula K y V de nuevo para el prefijo completo, así que una generación de 100 tokens calcula 5050 estados de tokens. Con la caché, los K y V de cada token se calculan una vez, por lo que la misma generación calcula 100 estados de los tokens.

## Usalo

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

Producción de VLLM:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

El caché de prefijos en las solicitudes es un gran éxito para 2026  el mismo sistema de instrucciones, ejemplos de pocos disparos o documento de contexto largo reutiliza KV en las llamadas. Para las cargas de trabajo de agentes con instrucciones de herramientas repetidas, el caché de prefijos es rutinariamente 5x ganancia de rendimiento.

## Envío

¿ Qué ?`outputs/skill-inference-optimizer.md`La habilidad selecciona la implementación de la atención, la estrategia de caché KV, la cuantificación y la descifrado especulativo para una nueva implementación de inferencias.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`- Confirmar que los descifradores ingenuos y almacenados en caché producen la misma salida; nota la diferencia de op-count.
2. **Medium.**Implementar el caché de prefijos: dado un prompt P y varias completas, ejecuta un pase hacia adelante sobre P para llenar el caché KV, luego ramifica por completado.
3. **Hard.**Implementar un juguete PagedAttention: KV cache en bloques fijos de 16 tokens con una lista libre. Cuando una secuencia termine, devuelva sus bloques a la piscina. Simula 1.000 terminaciones de chat con diferentes longitudes. Compara fragmentación de memoria con asignación contiguosa.

## Términos clave

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

## Leer más

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) Flash 1.
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) Flash 2.
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) Flash 3.
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) Blackwell 5 etapas de tubería y el truco de software-exp2; lea el repo README para las advertencias de lanzamiento sólo hacia adelante que menciona esta lección.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) Papel de la VLLM.
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) Descripción de especificaciones.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) Documento de EAGLE-1/2 para el enfoque de proyecto integrado que cita la lección.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) el enfoque Medusa mencionado junto con EAGLE.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) el profundo inmersión canónica en el bloque de 16 tokens y diseño de tabla de páginas.
