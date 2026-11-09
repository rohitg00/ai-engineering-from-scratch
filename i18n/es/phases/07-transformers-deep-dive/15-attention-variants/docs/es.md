# Variancias de atención  Ventana deslizante, Sparse, Diferencial

> La atención completa es un círculo. Cada token ve cada token, y la memoria paga el precio. Tres variantes doblan la forma del círculo y recuperan la mitad del costo.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## El problema

Costos de atención plena $O(N^2)$memoria y $O(N^2)$Para un Llama 3 70B de 128K de contexto que es 16 mil millones de entradas de atención por capa, veces 80 capas.$O(N^2)$memoria de activación pero no cambia el costo aritmético  cada token todavía atende a cada otro token.

Tres clases de variantes cambian la topología de la matriz de atención misma:

1. **Sliding window attention (SWA).**Cada token se encuentra en una ventana fija de vecinos, no en el prefijo completo.$O(N \cdot W)$donde$W$Gemma 2/3, las primeras capas del Mistral 7B, Phi-3-Long.
2. **Sparse / block attention.**Sólo pares seleccionados `(i, j)`Los demás se ven obligados a cero peso. Longformer, BigBird, OpenAI transformador escaso.
3. **Differential attention.**Computa dos mapas de atención con proyecciones Q/K separadas, restar uno del otro. Mata el "sink de atención" que desangraza el peso en los primeros tokens.

Los modelos fronterizos de 2026 a menudo los mezclan: la mayoría de las capas son SWA-1024, cada quinto es atención completa global, y un puñado de cabezas diferenciales que limpian la recuperación.

## El concepto

### Atención a las ventanas deslizantes (SWA)

Cada consulta en posición $i$sólo asiste a posiciones en $[i - W, i]$(SWA causal) o $[i - W/2, i + W/2]$Los tokens fuera de la ventana se ponen.$-\infty$en la matriz de puntaje.

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

Para$N = 8192$y $W = 1024$, la matriz de puntaje tiene 1024 × 8192 filas no cero en la expectativa  una reducción de 8 ×.

**KV cache shrinks with SWA.**Sólo el último .$W$Los tokens de K y V deben mantenerse por capa. Para una configuración Gemma-3-ish (1024 ventanas, contexto 128K), la caché KV cae 128x.

**Quality cost.**Los transformadores solo SWA luchan con la recuperación a largo alcance. La solución: intercalar capas SWA con capas de atención completa. Gemma 3 utiliza 5:1 SWA:global. Mistral 7B utilizó una pila de SWA causal donde la información "fluye hacia adelante" a través de ventanas superpuestas  cada capa extiende el campo receptivo efectivo por $W$, y después `L`las capas que el modelo puede asistir `L × W`los tokens de vuelta.

### Atención de escasez / bloqueo

Escoge una .`N × N`El patrón de esparcia anticipado.

- **Local + strided (OpenAI sparse transformer).**Atender a la última .$W$fichas más cada `stride`-Todo el tiempo, capturando tanto a largo alcance como local.$O(N \cdot \sqrt{N})$¿Qué es eso?
- **Longformer / BigBird.**Ventana local + un pequeño conjunto de tokens globales (por ejemplo `[CLS]`En el contexto empírico, el contexto 2x es de calidad igualitaria.
- **Native Sparse Attention (DeepSeek, 2025).**Aprenda qué bloques de `(Q, K)`El bloqueo de cero en el núcleo es compatible con FlashAttention.

La matemática es simple (mascarar la matriz de puntaje); la victoria proviene de no cargar nunca las entradas cero en SRAM. FlashAttention-3 y la API 2026 FlexAttention hacen patrones de puntaje personalizados en PyTorch.

### El objetivo de la evaluación es garantizar la eficacia de la evaluación de los resultados de la evaluación.

La atención regular tiene un problema de "senqueo de atención": softmax obliga a cada fila a sumar a 1, por lo que los tokens que no quieren atender a nada en particular se desprenden del peso en el primer token (o los primeros pocos).

La atención diferencial corrige esto mediante la computación **two**mapas de atención y restantes:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

donde$\lambda$Es un escalar aprendido (típicamente 0.50.8). A1 captura los pesos reales del contenido; A2 capta el fregadero.

Resultados reportados (Microsoft 2024): 510% menos perplejidad, contexto efectivo 1,52× más largo en la misma longitud entrenada, recuperación de aguja en haystack más nítida.

### Comparación de variantes

| Variant | Compute | KV cache | Quality vs full | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | $O(N^2)$ | $O(N)$ per layer | baseline | every model's default layer |
| SWA (window 1024) | $O(N \cdot W)$ | $O(W)$ per layer | -0.1 ppl, good with global layers | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | $O(N \cdot \sqrt{N})$ | mixed | similar to SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | $O(N)$ approx | mixed | matches full at 2× context | early long-context BERT |
| Native Sparse (DeepSeek-V3.2) | $O(N \cdot \text{active fraction})$ | $O(N)$ | within 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | $O(2 \cdot N^2)$ | $O(2N)$ | -5 to -10% ppl | DIFF Transformer, early 2026 models |

```figure
gqa-kv-sharing
```

## Construye el mismo

¿ Qué ?`code/main.py`, o su puerto de Rust`code/main.rs`Para ejecutar la versión de Rust:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`Implementamos un comparador de máscaras causales que muestra la atención completa, SWA, local+strided y diferencial lado a lado en una secuencia de juguetes.

### Paso 1: máscara causal completa (línea de base)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Línea de base de la lección 07. Triangular inferior; peso cero por encima de la diagonal.

### Paso 2: máscara causal de ventana deslizante

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

Un parámetro  `window`- Para .`window >= n`, se recupera la atención causal completa.`window = 1`, cada token se atende sólo a sí mismo.

### Paso 3: local + máscara escasa de paso

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

La ventana local es densa más cada uno .`stride`El campo receptor crece en etapas de registro con capas adicionales.

### Paso 4: Atención diferenciada

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

En el código comparamos el mapa de calor de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la concentración de la cubo en el descienda de la cubo.

### Paso 5: Tamaños de caché de KV

Imprima el tamaño de la caché por capa en $N = 131072$Las variantes SWA y raras caen en 10 100 ×. Dobles diferenciales.

## Usalo

Modelos de producción para 2026:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

FlexAttention en PyTorch 2.5+ acepta una función de máscara:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

Esto se compiló a un núcleo Triton personalizado. dentro del 10% de la velocidad de FlashAttention-3 para patrones comunes, y la función de máscara es una llamada Python.

**When to pick each:**

- **Pure full attention** cada capa hasta ~ 16K contexto, o cuando la calidad de recuperación es primordial.
- **SWA + global mix** contexto largo (> 32K), formación y inferencia limitada a la memoria.
- **Sparse block attention** kernel personalizado, patrón personalizado. Reservado para cargas de trabajo especializadas (recuperación, audio).
- **Differential attention** cualquier carga de trabajo en la que la contaminación por sumido de atención sea perjudicial (RAG de largo contexto, aguja en el manto de heno).

## Envío

¿ Qué ?`outputs/skill-attention-variant-picker.md`. La habilidad selecciona una topología de atención para un nuevo modelo dada la longitud del contexto objetivo, las demandas de recuperación y el perfil de computación de formación/inferencia.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Verifique el SWA en`window=4`cero todo fuera de los últimos 4 tokens por fila.`window=n`reproducen la atención causal completa de forma bit-identica.
2. **Medium.**Implementar la SWA causal con `window=1024`¿Cuánto disminuye la pérdida de val vs. plena atención? ¿Cuánto disminuye la memoria máxima?
3. **Hard.**Implemente una mezcla de capas de 5:1 de estilo Gemma-3 (5 SWA, 1 global) en el modelo de piedra angular. Compara la calidad de pérdida, memoria y generación con las líneas de base de SWA pura y global pura en parámetros iguales.
4. **Hard.**Implementar la atención diferencial con un aprendiz $\lambda$En el caso de los equipos de detección de datos, el equipo de detección de datos de detección de datos de datos de detección de datos de datos de detección de datos de datos de detección de datos de datos de detección de datos de datos de detección de datos de detección de datos de detección de datos de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de detección de datos de datos de detección de datos de datos de datos de detección de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de cuyo de cuyo de cuyo de cuyo cuyo cuyo cuyo cuyo cuyo cuyo cuyo cuyo cuyo cuyo cuyo cu

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Each query attends to its last $W$ tokens; KV cache shrinks to $O(W)$. |
| Effective receptive field | "How far back the model sees" | In an $L$-layer SWA stack with window $W$, up to $L \times W$ tokens. |
| Longformer / BigBird | "Local + global + random" | Sparse patterns with a few always-attending global tokens; early long-context approach. |
| Native Sparse Attention | "DeepSeek's kernel trick" | Learn block-level sparsity; skip zero blocks at the kernel level while keeping quality. |
| Differential attention | "Two maps, one subtracts" | DIFF Transformer: subtract a learned $\lambda$ times a second attention map from the first to cancel attention sinks. |
| Attention sink | "Weight bleeds to token 0" | Softmax normalization forces rows to sum to 1; uninformative queries dump weight on position 0. |
| FlexAttention | "Mask-as-Python" | PyTorch 2.5+ API that compiles arbitrary mask functions into FlashAttention-shape kernels. |
| Layer type mix | "5:1 SWA-to-global" | Interleave sparse and full attention layers in a stack to keep quality at lower memory. |

## Leer más

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) el papel de fichaje global + ventana de deslizamiento canónica.
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) local + global + aleatorio.
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) El patrón local+pasado de OpenAI.
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) la mezcla global de la SWA 1:1.
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) la combinación 5:1 con ventana=1024 que ahora es el libro de texto predeterminado.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) papel transformador DIFF.
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) La atención de la disparidad aprendida de DeepSeek-V3.2.
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) Referencia de API para el patrón de máscara como llamada en Use It.
