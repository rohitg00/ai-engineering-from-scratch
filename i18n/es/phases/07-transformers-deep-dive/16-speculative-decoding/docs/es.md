# Descodación especulativa  Draft, Verificar, Replicar

> El decodificación autoregressiva es serie. Cada token espera al anterior. El decodificación especulativa rompe la cadena: un modelo barato elabora N tokens, el modelo caro verifica todos los N en un solo pase hacia adelante. Cuando el borrador está correcto pagaste un gran adelanto para N generaciones.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## El problema

Un 70B LLM muestreo de un token toma ~30 ms en un H100. Un modelo de borrador 3B toma ~3 ms. Si dejamos que el borrador 3B 5 tokens adelante, entonces ejecutar el 70B *una vez* para verificar todos los 5, el total es $5 \times 3 + 30 = 45$ms para hasta 5 tokens aceptados  versus `5×30 = 150 ms`Es el campo de la descodificación especulativa: intercambiar una pequeña cantidad de memoria extra de la GPU (modelo de borrador) por 24× menor latencia de decodificación.

El truco tiene que preservar la distribución. La muestreo especulativa, introducida por Leviathan et al. (2023) y por Chen et al. simultáneamente, garantiza que la secuencia de salida es **identically distributed**No hay compromiso de calidad, sólo más rápido.

Cuatro familias de pares de verificadores de borrador dominan la inferencia de 2026:

1. **Vanilla speculative (Leviathan 2023).**Modelo de proyecto separado (por ejemplo, Llama 3 1B) + verificador (por ejemplo, Llama 3 70B).
2. **Medusa (Cai 2024).**Múltiples cabezas de decodificación en el verificador predicen posiciones `t+1..t+k`No hay un proyecto de modelo separado.
3. **EAGLE family (Li 2024, 2025).**Draft ligero que reutiliza los estados ocultos del verificador; tasa de aceptación más cercana que la vainilla; 34× típico.
4. **Lookahead decoding (Fu 2024).**Iteración Jacobi, no se requiere ningún modelo de proyecto, autoespeculación, nicho pero libre de dependencias.

Cada pila de inferencias de producción en 2026 envíe descifrado especulativo por defecto. vLLM, TensorRT-LLM, SGLang y llama.cpp todos admiten al menos vainilla + EAGLE-2.

## El concepto

### El algoritmo central

Dado un verificador $M_q$y un borrador más barato $M_p$¿Qué es esto ?

1. - ¿ Qué ?$x_1 \ldots x_k$sea el prefijo ya decodificado.
2. **Draft**: uso $M_p$Proponer de forma autoregressiva $d_{k+1}, d_{k+2}, \ldots, d_{k+N}$con probabilidades de proyecto $p_1 \ldots p_N$¿ Qué ?
3. **Verify in parallel**: correr $M_q$Una vez más .$x_1 \ldots x_k, d_{k+1}, \ldots, d_{k+N}$, obtener probabilidades de verificación $q_1 \ldots q_{N+1}$para posiciones $k+1 \ldots k+N+1$¿ Qué ?
4. **Accept/reject each draft token left to right**: para cada uno $i$, acepta con probabilidad $\min(1, q_i(d_i) / p_i(d_i))$¿ Qué ?
5. En el primer rechazo en posición $j$: muestra $t_j$de la distribución "residual" $(q_j - p_j)_+$Todos los proyectos después de la$j$se descartan.
6. Al aceptar todo .$N$: muestra de un token extra $t_{N+1}$de la$q_{N+1}$(el token de bonificación gratuito).

El truco de distribución residual es la visión matemática que mantiene la salida distribuida exactamente como si $M_q$había tomado muestras desde cero.

### Lo que determina la aceleración

- ¿ Qué ?$\alpha$= tasa de aceptación esperada por proyecto de token.$c$= relación de costes entre proyectos y verificadores.

- La generación ingenua hace una llamada de modelo grande por token.
- Especulativo hace una llamada de modelo grande por ...$(1 - \alpha^{N+1}) / (1 - \alpha) \approx 1/(1-\alpha)$fichas cuando $\alpha$Es muy alto.

La regla típica es que ...$\alpha = 0.75$y $N = 5$El costo del proyecto es 5 veces más barato. El total del reloj de pared cae ~ 2,5 veces.

**$\alpha$ depends on:**

- La información sobre la misma familia / formación aumenta$\alpha$- Es muy importante.
- Estrategia de descifrado.$\alpha$- Muestreo de temperatura: más difícil de igualar; disminución de la aceptación.
- Tipo de tarea: el código y la salida estructurada aceptan más (predictable); la escritura creativa de forma libre acepta menos.

### Medusa  proyectos sin modelo de proyecto

Medusa sustituye el modelo de proyecto por cabezas de salida adicionales en el verificador.`t`¿Qué es esto ?

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

Cada cabeza saca sus propias logitas. En la inferencia tomas una muestra de cada cabeza para obtener una secuencia de candidatos, luego verifica con un pase hacia adelante utilizando un esquema de atención al árbol que considera todas las continuidades de candidatos a la vez.

Pros: no hay segundo modelo. Los inconvenientes: añade parámetros entrenables; necesita una etapa de ajuste fino supervisado (~ 1B tokens); la tasa de aceptación es un poco menor que la especulativa de vainilla con un buen borrador.

### Eagle  mejor dibujo mediante la reutilización de estados ocultos

EAGLE-1/2/3 (Li et al., 20242025) hace que el modelo de proyecto sea un pequeño transformador (típicamente de 1 capa) que ingere los estados ocultos de última capa del verificador. Debido a que el borrador ve la representación de las características del verificador, sus predicciones se correlacionan fuertemente con la distribución de salida del verificador. Las tasas de aceptación aumentan de ~ 0,6 (vanilla) a 0,85+. Estas son tasas por token en los puntos de referencia de chat, con un borrador entrenado en datos de chat correspondientes. En el caso del tráfico de producción mixta, la fase 17 · 05 se plantea con 0,6 a 0,8 para EAGLE-3, y el tráfico de dominio puede ser menor.

EAGLE-3 (2025) añadió la búsqueda de árboles sobre las continuas candidatos. vLLM y SGLang nave EAGLE-2/3 como la ruta de especificación predeterminada para Llama 3/4 y Qwen 3.

### El baile de caché KV

Los datos de verificación $N$Los tokens de proyecto en el verificador en un solo pase hacia adelante. Esto extiende la caché KV del verificador en $N$Si algunos borrados son rechazados, debe volver a rodar el caché a la longitud del prefijo aceptado.

Implementaciones de la producción (vLLM's `--speculative-config`Es un problema de la vida, pero no es difícil, pero es difícil.

```figure
draft-verify-tokens
```

## Construye el mismo

¿ Qué ?`code/main.py`Implementamos el algoritmo de muestreo especulativo principal (paso de rechazo + distribución residual) con:

- Un "modelo grande" que es una determinación-softmax sobre una distribución codificada a mano (para que podamos verificar la aceptación matemática analíticamente).
- Un "modelo de borrador" que es una perturbación del modelo grande.
- Un bucle de aceptación/rechazo que produce la misma distribución marginal que la muestreo directo.

`code/main.rs`El número aleatorio es diferente del de Python, pero las conclusiones impresas son las mismas.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### Paso 1: el paso de rechazo

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u`es un número aleatorio uniforme. `q_prob`es la probabilidad del verificador para el token redactado. `p_prob`El teorema de Leviathan es que esta decisión de Bernoulli, seguida de muestreo del residual en el rechazo, conserva exactamente la distribución del verificador.

### Paso 2: distribución residual

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

Subtracción `p`de la`q`En el caso de los elementos, aplastar los valores negativos a cero, renormalizarlo.

### Paso 3: un paso especulativo

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

Cinco aceptados → un bono → seis tokens producidos en un pase de verificación.

### Paso 4: medir la tasa de aceptación

ejecutar 10.000 pasos especulativos en diferentes niveles de calidad del borrador. tasa de aceptación de la trama vs KL divergencia entre la distribución del borrador y el verificador. Usted debe ver una relación monótona limpia.

### Paso 5: verificar la equivalencia de distribución

Empiricamente: el histograma de tokens producido por el bucle especulativo debe coincidir con el histograma producido por muestreo directamente del verificador. Este es el teorema de Leviatán en la práctica.

## Usalo

Producción:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

TensorRT-LLM tiene la ruta más rápida de Medusa a mediados de 2026. `faster-whisper`Envuelve la descifrado especulativo para Whisper-large con un pequeño borrador.

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- Generación de secuencia única de 15 tokens.
- Muestreo de alta temperatura ($\alpha$(se puede utilizar para el tratamiento de las
- Despliegues con restricciones de memoria (el modelo de proyecto añade VRAM).

## Envío

¿ Qué ?`outputs/skill-spec-decode-picker.md`La habilidad elige una estrategia de decodificación especulativa (vanilla / Medusa / EAGLE / lookahead) y parámetros de ajuste (N, temperatura de proyecto) para una nueva carga de trabajo de inferencia.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`. Confirmar que la distribución especulativa de tokens coincide con la distribución directa de muestras del verificador en 50.000 tokens dentro de un chi-cuadrado p > 0,05.
2. **Medium.**Aceleración de gráfico (tokens por modelo grande hacia adelante) como función de $N$por$\alpha = 0.5, 0.7, 0.85$Identificar el óptimo$N$por cada uno $\alpha$. (Intención: tokens esperados por llamada de verificación = $(1 - \alpha^{N+1}) / (1 - \alpha)$(en inglés).
3. **Hard.**Implemente una pequeña Medusa: toma la piedra angular GPT de la Lección 14, añada 3 cabezas LM adicionales que predicen las posiciones t+2, t+3, t+4. Entrenamiento en tinyshakespeare con una pérdida conjunta de múltiples cabezas. Compara las tasas de aceptación con un borrador de vainilla hecho mediante el truncado del mismo modelo.
4. **Hard.**Implementar el rollback: comience con un prefijo KV de 10 tokens, alimenta 5 tokens de borrador, simula un rechazo en la posición 3. Verifique que sus lecturas de la caché coincidan correctamente con "prefijo + primeros 2 borradores aceptados" en la siguiente iteración.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate ($\alpha$) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## Leer más

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) el algoritmo central y el teorema de equivalencia.
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) introducción simultánea; prueba limpia de rechazo de Bernoulli.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) Papel de Medusa; verificación de la atención al árbol.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) EAGLE-1; proyecto con condición de estado oculto.
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) EAGLE-2; profundidad dinámica del árbol.
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840)- El Águila-3.
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) Mirando hacia adelante, sin plan de enfoque.
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) referencia canónica de producción con las cuatro estrategias conectadas.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) el código de referencia de EAGLE-1/2/3.
