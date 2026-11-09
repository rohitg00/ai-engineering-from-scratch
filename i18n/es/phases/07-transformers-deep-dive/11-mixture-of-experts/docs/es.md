# Mixto de expertos (MEE)

> Un transformador 70B denso activa todos los parámetros para cada token. Un 671B MoE activa solo 37B por token y lo supera en cada punto de referencia.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## El problema

Los FLOPs de un transformador denso a la inferencia son iguales al número de parámetros (de 2 veces para el pase hacia adelante). Escala un modelo denso y cada token paga la cuenta completa. Para 2024 la frontera estaba golpeando una pared de cálculo: para ser significativamente más inteligente, se necesitaban exponencialmente más FLOPs por token.

La mezcla de expertos rompe este vínculo.$E$expertos independientes + un router que seleccione $k$Expertos por token. Parámetros totales = $E \times \text{FFN size}$. Parámetros activos por token = $k \times \text{FFN size}$. Configuración típica para 2026: $E=256$¿ Qué ?$k=8$. Escales de almacenamiento con $E$, calcular escalas con $k$¿ Qué ?

La frontera de 2026 es casi completamente MoE: DeepSeek-V3 (671B total / 37B activo), Mixtral 8×22B, Qwen2.5-MoE, Llama 4, Kimi K2, gpt-oss. En el tablero de clasificación independiente de Análisis Artificial, los 10 modelos de código abierto más importantes son todos MoE.

## El concepto

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### El intercambio de FFN

Bloqueo de transformador denso:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

Bloqueo de la MOE:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

Cada experto es un FFN independiente (típicamente SwiGLU). El router es una sola capa lineal.`k`expertos y obtiene una mezcla cerrada de sus resultados.

### El problema de equilibrio de carga

Si el router pone el 90% de los tokens a través del experto 3, los otros expertos pasan hambre.

1. **Auxiliary load-balancing loss**Añade una penalidad proporcional a la variación en el uso experto. Funciona, pero añade un hiperparámetro y una segunda señal de gradiente.
2. **Expert capacity + token dropping**Cada experto procesa como máximo$C \times N/E$Los tokens de sobreflujo saltan la capa.
3. **Auxiliary-loss-free balancing**(DeepSeek-V3). Agregar un sesgo aprendido por experto que cambia la selección de la parte superior del router.

El enfoque de DeepSeek-V3: después de cada paso de formación, para cada experto, compruebe si su uso está por encima o por debajo del objetivo.`±γ`. Utilizaciones de selección `scores + bias`Las probabilidades expertas utilizadas para el gating son las primas .`scores`Desacopla el enrutamiento de la expresión.

### Expertos compartidos

DeepSeek-V2/V3 también divide a los expertos en *compartido* y *routed*. Cada token pasa a través de todos los expertos compartidos. Los expertos enrutados se seleccionan a través de top-k. Los expertos compartidos capturan el conocimiento común; los expertos enrutados se especializan. V3 ejecuta 1 experto compartido más el top-8 de 256 enrutados.

### Expertos de granos finos

MoE clásico (GShard, Switch): cada experto tiene la anchura de un FFN completo. `E`es pequeño (864), `k`es pequeño (12).

MoE moderno de granos finos (DeepSeek-V3, Qwen-MoE): cada experto es más estrecho (1/8 de FFN). $E$es grande (256+), $k$Es más grande (8+). Los mismos parámetros totales, pero las combinaciones escalar mucho más rápido. $\binom{256}{8} \approx 400$El número de "expertos" por token aumenta y la latencia se mantiene estable.

### El perfil de costes

Por símbolo, por capa:

| Config | Active params / token | Total params |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

DeepSeek-V3 supera a Llama 3 70B (denso) en casi todos los puntos de referencia mientras hace **fewer active FLOPs per token**Más parámetros = más conocimiento. más FLOPs activos = más cálculo por token.

### El problema: la memoria

Todos los expertos viven en GPU independientemente de cuál uno dispare. Un modelo 671B necesita ~ 1.3 TB de VRAM para pesos de fp16.

```figure
expert-routing
```

## Construye el mismo

¿ Qué ?`code/main.py`. Una capa compacta de MoE en stdlib puro con:

- `n_experts=8`Expertos de SWIGU (una línea cada uno, para ilustración)
- Top-k=2 enrutamiento
- Peso de puertas normalizado de la máxima suave
- equilibrio sin pérdidas auxiliares por sesgo de expertos

`code/main.rs`El número aleatorio es diferente del de Python, pero las conclusiones impresas son las mismas.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### Paso 1: el router

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

El sesgo afecta la selección, no el peso de la puerta. Ese es el truco de DeepSeek-V3  sesgo corrige el desequilibrio de carga sin dirigir las predicciones del modelo.

### Paso 2: ejecuta 100 tokens a través del router

El uso de los datos de los datos de los usuarios es distorsionado.`-γ`para expertos sobreutilizados, `+γ`En el caso de las aplicaciones de la aplicación de la norma de uso (en el caso de las aplicaciones de uso insuficiente), el uso converge a una distribución uniforme en varias iteraciones.

### Paso 3: Comparación de parámetros

Imprima el "equivalente denso" de una configuración de MoE. DeepSeek-V3-forma: 256 enrutado + 1 compartido, 8 activo, d_model=7168. El conteo total de parámetros es impresionante. El conteo activo es una séptima de un Llama 3 70B denso.

## Usalo

Embarcación de la cara:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 Inferencia de producción: vLLM admite el enrutamiento de MoE de forma nativa. SGLang tiene el camino paralelo experto más rápido. Ambos manejan automáticamente la selección top-k y el paralelismo experto.

**When to pick MoE:**
- Quieres una calidad de frontera con un menor costo de inferencia por token.
- Tiene la infraestructura paralela VRAM / experto.
- Su carga de trabajo es token-pesado (chat, código) no contexto-pesado (docs largos).

**When NOT to pick MoE:**
- Despliegue de borde  usted paga el almacenamiento completo para cualquier FLOP activo.
- El servicio de un solo usuario de servicio  de enrutamiento experto de latencia crítica añade gastos generales.
- Los modelos pequeños (<7B)  La ventaja de calidad de MoE sólo aparece por encima de un umbral de cálculo (~6B parámetros activos).

## Envío

¿ Qué ?`outputs/skill-moe-configurator.md`. La habilidad elige E, k y diseño compartido de expertos para un nuevo presupuesto de parámetros del Ministerio de Economía, tokens de capacitación y objetivo de implementación.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Observe cómo la actualización de sesgo sin pérdidas auxiliares equilibra el uso de expertos en más de 50 iteraciones.
2. **Medium.**Reemplazar el router aprendido con un router basado en hash (determinístico, sin aprendizaje). Comparar calidad y equilibrio. ¿Por qué el router aprendido es mejor?
3. **Hard.**Implementar el tipo GRPO "routing de despliegue" (tructo DeepSeek-V3.2): registro que los expertos disparan durante la inferencia, forzar el mismo enrutamiento durante el cálculo de gradientes. Medir el efecto en una configuración de política de gradientes de juguete.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Expert | "One FFN among many" | An independent feed-forward network; parameters dedicated to a sparse slice of the FFN computation. |
| Router | "The gate" | A tiny linear layer that scores each token against each expert; top-k selection. |
| Top-k routing | "k active experts per token" | Each token's FFN computation goes through exactly k experts, weighted by gate. |
| Auxiliary loss | "Load-balance penalty" | Extra loss term that penalizes skewed expert usage. |
| Auxiliary-loss-free | "DeepSeek-V3's trick" | Balance via per-expert bias on the router's selection only; no extra gradient. |
| Shared expert | "Always on" | Extra expert through which every token passes; captures common knowledge. |
| Expert parallelism | "Shard by expert" | Distribute different experts to different GPUs; route tokens across the network. |
| Sparsity | "Active params < total params" | The ratio $k \times \text{expert size} / (E \times \text{expert size})$; 37/671 ≈ 5.5% for DeepSeek-V3. |

## Leer más

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538)¿La idea?
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) Switch, el clásico MoE.
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) Mixtral 8×7B.
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) MLA + MoE sin pérdidas auxiliares + MTP.
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) el papel de balance basado en sesgos.
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) el experto de granos finos + compartido dividido de este curso de los usos del router.
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) documento original compartido de expertos.
