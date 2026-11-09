# Atención diferencial (V2)

> La atención Softmax distribuye una pequeña cantidad de probabilidad sobre cada token no coincidente. Más de 100 mil tokens que suman el ruido y ahogan la señal. El Transformador Diferencial (Ye et al., ICLR 2025) lo fija calculando la atención como la diferencia de dos softmaxes, restando el suelo de ruido compartido. DIFF V2 (Microsoft, enero 2026) es la reescritura de la pila de producción: coincide con la latencia de decodificación de la línea de base de Transformer, no hay núcleos personalizados, compatible con FlashAttention. Esta lección es de extremo a extremo de V1, con una aplicación de juguete de trabajo de la operación de diferencia que se puede ejecutar en stdlib Python.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 02 (self-attention), Phase 7 · 15 (attention variants), Phase 10 · 14 (architecture walkthrough)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Explique exactamente por qué la atención softmax tiene un suelo de ruido y por qué crece con la longitud del contexto.
- Derivar la fórmula de atención diferencial y explicar por qué la restancia anula el componente de ruido compartido mientras se conserva la señal.
- Caminar la diferencia entre V1 y V2: qué se hizo más rápido, qué se hizo más simple, qué se hizo más estable, y por qué cada cambio era necesario para la pre-entrenamiento de producción.
- Implemente la atención diferencial desde cero en Python puro y verifique empíricamente la propiedad de cancelación de ruido en una consulta sintética de señal más ruido.

## El problema

La atención estándar de softmax tiene una propiedad matemática que se convierte en un dolor de cabeza operativo a escala.`q`, los pesos de atención son`softmax(qK^T / sqrt(d))`Softmax nunca puede producir ceros exactos: cada token no coincidente obtiene cierta masa positiva. Esa masa residual es ruido, y se escala con la longitud del contexto. En 128k tokens, incluso si cada token no coincidente obtiene solo el 0.0001% de la probabilidad, 127.999 de ellos combinados contribuyen aproximadamente al 13% del total. El modelo tiene que aprender a recorrer un piso de ruido que crece con el contexto.

Empiricamente esto aparece como interferencia de la cabeza de atención: citas alucinadas en RAG de largo contexto, fallos perdidos en el medio en tareas de recuperación de 100k tokens, y degradación sutil de precisión en puntos de referencia de aguja en haystack más allá de 32k. El documento del Transformador Diferencial (arXiv:2410.05258, ICLR 2025) midió la brecha: los Transformadores DIFF alcanzaron una menor perplejidad, una mayor precisión en el contexto largo y menos alucinaciones que las líneas de base del mismo tamaño.

El DIFF V1 tenía tres problemas que lo mantuvieron fuera de las tuberías de pre-entrenamiento fronterizo. Su caché de valor tenía que cargarse dos veces por paso de decodificación, requería kernels CUDA personalizados que rompieron la compatibilidad con FlashAttention, y su RMSNorm por cabeza desestabilizó el entrenamiento a largo plazo en escala de 70B-plus. DIFF V2 (blog de Microsoft unilm, 20 de enero de 2026) arregló los tres. Esta lección recorre ambas versiones, construye el operador de diferencia y marca la cancelación de ruido en una consulta de juguete.

## El concepto

### El suelo de ruido de softmax

Para una consulta `q`y llaves `K = [k_1, ..., k_N]`, los pesos de atención son:

```math
w_i = \frac{\exp(q \cdot k_i / \sqrt{d})}{\sum_j \exp(q \cdot k_j / \sqrt{d})}
```

No , no .`w_i`es siempre cero.`k_i`no tiene nada que ver con `q`, el resultado `q . k_i`no es 0  fluctúa alrededor de cero con la varianza `||q||^2 / d`Después de la normalización de softmax, cada token no relacionado todavía contribuye.`O(1/N)`La contribución total de los tokens no relacionados es `O((N-1)/N) = O(1)` no una pequeña cantidad.

Lo que el modelo quiere es algo como un top-k duro: alto peso en tokens coincidentes, peso casi cero en todas partes. Softmax es demasiado suave para hacer eso directamente.

### La idea de diferencia

Divide las proyecciones de Q y K de cada cabeza en dos: $Q = (Q_1, Q_2)$y $K = (K_1, K_2)$Computa dos mapas de atención:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d})
\end{aligned}
```

Producción:

```math
\mathop{\mathrm{DiffAttn}} = (A_1 - \lambda \cdot A_2) V
```

La subtracción anula cualquier distribución de ruido que comparten los dos mapas. Si ambos mapas tienen un peso aproximadamente uniforme en los 127k tokens no relacionados (que, a partir de una inicialización aleatoria, lo harán), los otros se anulan. La señal  peso máximo en los pocos tokens realmente relevantes  solo se anula si aparece en ambos mapas a la misma magnitud, lo que no ocurre una vez que el modelo se muestre.

`lambda`es un escalar por cabeza que se puede aprender, parametrizado como `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`Puede ser negativo.`lambda_init`por defecto a un pequeño número positivo como 0.8.

### ¿Por qué esta coincide con la cancelación de ruido de cabeza

Piensa en dos micrófonos ruidosos que graban la misma voz. Ambos recogen el altavoz más el ruido de fondo correlacionado. Sustraer uno del otro y el ruido compartido cae. La voz sobrevive porque las dos señales difieren en fase o amplitud en lo suficiente como para evitar la cancelación completa.`lambda`Aprende exactamente este equilibrio.

### V1 vs V2: la diferencia

V1 mantuvo el conteo de parámetros igual al de la línea de base Transformer. Para obtener dos consultas por cabeza redujo a la mitad la dimensión de la cabeza. Eso costó la expresividad de la cabeza y  más dolorosamente  redujo a la mitad el caché de valor por cabeza. Decode tuvo que cargar el caché de valor dos veces por paso (una vez por rama softmax). Resultado: decodificar más lento que la línea de base a pesar de la cantidad de parámetros coincidentes.

V2 duplica el número de cabezas de consulta y mantiene las cabezas de KV iguales (prestando parámetros de la proyección ascendente). La dimensión de la cabeza se mantiene igual a la línea de base. Después de la restancia, la dimensión adicional se proyecta hacia abajo para que coincida con la línea de base del Transformer $O_W$Tres cosas suceden a la vez:

1. La velocidad de decodificación coincide con la línea de base (la caché de KV se carga una vez).
2. FlashAttention se ejecuta sin cambios (no hay núcleo personalizado).
3. La intensidad aritmética al decodificar aumenta (más cálculo por byte cargado desde HBM).

V2 también elimina el RMSNorm por cabeza que V1 utilizó para estabilizar la subtracción. En escalas de pre-entrenamiento de clase 70B, ese RMSNorm desestabilizó el entrenamiento tardío. V2 lo reemplaza con un esquema de inicialización más simple que mantiene el entrenamiento estable sin el módulo extra.

### ¿Cuándo alcanzarlo?

| Workload | Benefit |
|----------|---------|
| Long-context RAG (64k+) | Cleaner attention maps, fewer hallucinated citations |
| Needle-in-haystack benchmarks | Substantial accuracy lift past 32k |
| Multi-document QA | Less cross-document interference |
| Code completion at 8k | Marginal, not worth the architecture change |
| Short chat (< 4k) | Essentially indistinguishable from baseline |

El valor crece con la longitud del contexto. en tokens de 4k el piso de ruido es lo suficientemente pequeño como para que la atención estándar esté bien. en 128k te está haciendo daño.

### Cómo se apila con otros botones 2026

| Feature | Compatible with DIFF V2? |
|---------|------------------------|
| GQA | Yes (V2 increases Q heads, not KV heads) |
| MLA (DeepSeek) | Yes in principle, no published paper combining them |
| MoE | Yes (attention is independent of MLP block) |
| RoPE | Yes (unchanged) |
| YaRN / long-context scaling | Yes (exactly where DIFF helps most) |
| FlashAttention | Yes in V2 (was no in V1) |
| Speculative decoding | Yes (attention change is invisible to the spec-decode loop) |

```figure
differential-attention
```

## Construye el mismo

`code/main.py`Una consulta de juguete con una estructura conocida de señal más ruido permite medir directamente la relación ruido-anulación.

### Paso 1: atención estándar de softmax

Opciones de matriz de Stdlib: listas de listas, matmul manual, softmax con restancia de estabilidad numérica de la máxima.

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### Paso 2: Divide Q, K en dos mitades

Estilo V1: reducir a la mitad la dimensión de la cabeza. Estilo V2: mantener la dimensión de la cabeza y duplicar el número de cabezas. La implementación del juguete utiliza V1 para la claridad pedagógica  las matemáticas son idénticas, sólo la contabilidad difiere.

### Paso 3: dos ramas de softmax + restancia

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

Nota: los pesos de salida pueden ser negativos. Eso está bien  el caché de valor todavía maneja las contribuciones firmadas. La proyección V posterior absorbe la señal.

### Paso 4: medición de la cancelación del ruido

Construye una secuencia sintética de longitud 1024. Coloque el signo en una posición conocida, llene el resto con ruido. Calcule a) el peso de atención estándar de la máxima suavidad en la posición de la señal y b) el peso de atención diferencial. Medir la relación señal-ruido en cada uno. La atención DIFF produce confiablemente una relación señal-ruido más alta en un factor de 3x-10x dependiendo de cuánto se hayan entrenado las dos ramas para diferir.

### Paso 5: Contabilidad de parámetros V1 vs V2

Dado un config (oculto = 4096, cabezas = 32, d_head = 128), imprime:

- Transformador de línea de base: Q, K, V de cada tamaño `hidden * hidden`, MLP en 4 * oculto.
- DIFF V1: Q, K de cada tamaño `hidden * hidden`, tamaño V `hidden * hidden`(sin cambios), cabeza tenue a la mitad internamente.`lambda`Parámetros $(O(\text{heads} \cdot d_{\text{head}}))$¿ Qué ?
- DIFF V2: tamaño Q `2 * hidden * hidden`, tamaño K `hidden * hidden`, tamaño V `hidden * hidden`Extra tenue proyectado hacia abajo antes .$O_W$. Agrega lo mismo .`lambda`los parámetros.

El juguete mide el coste de parámetros adicionales para V2 (aproximadamente `hidden * hidden`extra por bloque de atención) y imprime.

## Usalo

DIFF V2 aún no está siendo enviado en todos los servidores de inferencia de producción a partir de abril de 2026, pero la integración está en marcha en vLLM y SGLang.

- Modelos internos de producción de largo contexto de Microsoft.
- Replicaciones de investigación en varias carreras de capacitación de modelo abierto dirigidas a más de 256k contextos.
- Arquitecturas híbridas que combinan la atención DIFF con la atención de ventanas deslizantes en capas alternativas.

Cuando alcanzaran esto en 2026:

- El entrenamiento de un nuevo modelo desde cero dirigido a un contexto efectivo de 64k más.
- La regulación de un modelo de contexto largo donde los fallos perdidos en el medio dominan su evaluación.

Cuando no lo harías:

- Se está sirviendo un modelo denso pre-entrenado con un rendimiento estable en el contexto largo.
- Su contexto siempre es inferior a 16k.

## Envío

Esta lección produce`outputs/skill-diff-attention-integrator.md`. Dado una arquitectura de modelo, longitud del contexto objetivo, perfil de alucinación y presupuesto de formación, se produce un plan de integración para añadir atención diferenciada a una nueva carrera pre-entrenamiento o ajuste del LoRA.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Verificar que la relación señal-ruido reportada para la atención diferencial es mayor que la atención softmax estándar en la consulta sintética.

2. Calcule el delta de conteo de parámetros desde la línea de base hasta DIFF V1 y desde la línea de base hasta DIFF V2 para un modelo de clase 7B (oculto = 4096, cabezas = 32, d_head = 128, 32 capas). Muestre qué componentes obtuvieron parámetros y cuáles se mantuvieron iguales.

3. Lea la sección 3 del documento DIFF V1 (arXiv:2410.05258) y la sección 2 del blog DIFF V2 Hugging Face. En dos frases, explique por qué el RMSNorm V1 por cabeza era necesario y por qué V2 podía eliminarlo sin causar divergencia en el entrenamiento.

4. Implementar una ablación: calcular la atención diferencial con `lambda = 0`(puro primer softmax) y `lambda = 1`En la consulta sintética, mide cómo cambia la señal-ruido a través del barrido.`lambda`que maximiza la señal-ruido.

5. Extenda el juguete a GQA + DIFF V2. Seleccione 8 cabezas KV y 32 cabezas Q. Muestre que el tamaño de la caché KV coincide con un modelo GQA de referencia con la misma configuración (8, 32).

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Differential attention | "Two softmaxes minus each other" | Split Q, K into two halves, compute two softmax maps, subtract the second (scaled by $\lambda$) from the first, then multiply by V |
| Noise floor | "The non-zero tail of softmax" | The $O(1/N)$ weight softmax puts on every unrelated token, which sums to $O(1)$ across long contexts |
| lambda | "The subtraction scale" | Per-head learnable scalar parameterized as `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`; can be negative |
| DIFF V1 | "The ICLR 2025 version" | Original Differential Transformer; halves head dim to preserve parameter count, needs custom kernel, slower decode |
| DIFF V2 | "The January 2026 fix" | Doubles Q heads keeping KV heads; matches baseline decode speed and works with FlashAttention |
| Per-head RMSNorm | "The V1 stabilizer" | Extra norm V1 applied after the difference; V2 removed it to prevent late-training instability |
| Signal-to-noise ratio | "How much attention is wasted" | Ratio of weight on the true signal position to average weight on unrelated positions |
| Lost in the middle | "Long-context failure mode" | Empirical phenomenon where retrieval accuracy dips for documents in the middle of a long context — DIFF attention reduces this |
| Arithmetic intensity | "FLOPs per byte loaded" | Ratio V2 increased at decode by doubling queries per KV load; important for memory-bound decode |

## Leer más

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) el documento original con teoría de cancelación de ruido y ablaciones de largo contexto
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) la reescritura de la pila de producción, el decodificación de línea de base correspondiente, compatible con FlashAttention
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) análisis teórico de por qué la restancia recupera la estructura de atención preentrenada
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) Variante de compartimiento de parámetros
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) el DIFF del transformador de línea de base restará de
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) los objetivos de atención del FIDD en el contexto largo
