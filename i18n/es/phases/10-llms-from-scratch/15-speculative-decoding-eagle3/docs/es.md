# Descifrado especulativo y EAGLE-3

> Fase 7 · Lección 16 probó las matemáticas: la regla de rechazo Leviatán conserva exactamente la distribución del verificador. Esta lección es la visión de la pila de capacitación de la descifrado especulativo de producción de 2026. EAGLE-3 convirtió el modelo de proyecto de una aproximación barata en una red pequeña especialmente construida entrenada en los propios estados ocultos del verificador, luego agregó un bucle de prueba de tiempo de entrenamiento que alinea sus distribuciones de tren e inferencia. Resultado: 3x a 6.5x de velocidad de extremo a extremo, tasas aceptadas por token por encima de 0.9 en chat, sin compensación distributiva. Cada pila de inferencias de producción en 2026 lo envían por defecto.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 7 · 16 (speculative decoding math), Phase 10 · 12 (inference optimization)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Explique el teorema de Leviatán en una frase y demuestre que el bucle especulativo produce muestras distribuidas idénticamente al verificador.
- Siga la progresión de dos años desde la descodificación de especificaciones de vainilla (Leviathan 2023) a través de EAGLE, EAGLE-2 y EAGLE-3 y nombre la limitación exacta que se retira en cada paso.
- Calcule la velocidad esperada desde la tasa de aceptación `α`y la relación de costes entre proyectos y verificadores `c`, y elegir la longitud óptima del borrador `N`para cada régimen.
- Implemente el ciclo especulativo completo desde cero: diseño, verificación, rechazo-muestra del residual, rodar la caché KV de nuevo en el rechazo, emitir el token de bonificación en la aceptación completa.

## El problema

El código autoregresivista en un modelo 70B funciona a 35 tokens por segundo en un H100. La GPU no está ni cerca de saturada. El ancho de banda de memoria es el techo: cada token carga 70B de pesos de HBM, hace un paso de aritmética y produce una flotación.

El descifrado especulativo convierte eso en un problema de rendimiento que realmente se puede resolver.`N`fichas en `N`El verificador se ejecuta una vez en el prefijo más todos`N`Los proyectos de la Comisión de Asuntos Económicos y Monetarios`i`En el caso de los modelos de futuro grandes, el modelo de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de futuro de los modelos de los modelos de futuro de los modelos de los modelos de futuro de los modelos de los modelos de futuro de los modelos de los modelos de futuro de los modelos de los modelos de futuro de los modelos de los modelos de los modelos de futuro de los modelos de los modelos de los modelos de los modelos de los modelos de futuro de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los modelos de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los cuales son de los`N+1`aceptaron tokens en lugar de uno.

El teorema que importa es Leviathan, Kalman, Matias (ICML 2023): la distribución de salida es idéntica a lo que el muestreo del verificador directamente habría producido. No aproximadamente. Identicamente. Esta es toda la razón por la que el descifrado especulativo es aceptable en la producción.

Una buena versión vale 2 veces más velocidad que una versión barata. EAGLE, EAGLE-2, y EAGLE-3 (Li et al., 20242025) convirtieron "el borrador = versión más pequeña del mismo modelo" en una disciplina de ingeniería precisa.

## El concepto

### El invariante: muestreo de rechazo de Leviatán

- ¿ Qué ?`p(t)`ser la distribución del borrador para el siguiente símbolo dado algún prefijo, y `q(t)`Es el de la verificación.`d ~ p`- Aceptar con probabilidad .`min(1, q(d) / p(d))`. En caso de rechazo, muestra de la distribución residual `(q - p)_+ / ||(q - p)_+||_1`. Las muestras resultantes se distribuyen de acuerdo con `q`Esto es cierto sin importar lo malo que sea .`p`Es  peor es, más a menudo rechazas, pero la salida sigue siendo exacta.

- ¿ Qué ?`N`de estas llamadas de ida a vuelta utilizando un verificador de paso hacia adelante `prefix + d_1 + ... + d_N`El verificador devuelve .`q_1, q_2, ..., q_{N+1}`Al primer rechazo en posición, el eje de la mano se encuentra en la posición de la mano.`j`, muestra de `residual(q_j, p_j)`Cuando se acepte, muestra un token de bonificación de`q_{N+1}`¿ Qué ?

### Lo que determina la aceleración

- ¿ Qué ?`α`Se calcula que el valor de la moneda de mercado de la moneda de mercado es el valor de la moneda de mercado de la moneda de mercado de la moneda de mercado de la moneda de mercado de la moneda de mercado de la moneda de mercado de la moneda de la Unión.`c = cost(draft) / cost(verifier)`El número esperado de tokens aceptados por verificador a plazo es:

```math
\mathbb{E}[\text{accepted}] = \frac{1 - \alpha^{N+1}}{1 - \alpha}
```

El tiempo total esperado de pared por token aceptado es `(N * c + 1) / E[accepted]`Minimizar eso con respecto a`N`Y obtienes el punto dulce.`α = 0.8, c = 0.05`: óptimo `N`Es alrededor de 57, velocidad es 3.2x.`α = 0.95, c = 0.02`: óptimo `N`es alrededor de 8×10, la aceleración empuja 5×.

La única palanca más grande es`α`- Desde el`α = 0.6`(proyecto de vainilla) a `α = 0.9`(EGLE-3) en fijo `N = 5`El resultado de la verificación de los tokens aceptados es de 2,2 tokens esperados por verificador, y se eleva a 4,1.

### El progreso de dos años

**Vanilla speculative (Leviathan, 2023).**El modelo de proyecto es un LLM de formación independiente más pequeño de la misma familia.`α ≈ 0.6`, acelerar alrededor de 2x en el mejor de los casos.

**EAGLE-1 (Li et al., 2024).**Draft es un pequeño transformador  típicamente de una o dos capas  que toma el estado oculto de última capa del verificador como entrada y predice el siguiente token directamente. Debido a que el borrador ve la representación de las características del verificador, su distribución está mucho más cerca de la del verificador. `α`se eleva a 0,70,8.

**EAGLE-2 (Li et al., 2024).**Añade un árbol de proyecto dinámico: en lugar de proponer una sola secuencia de `N`Los proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación y desarrollo de proyectos de investigación.`α`por token de camino aceptado sube por encima de 0.85.

**EAGLE-3 (Li et al., 2025, NeurIPS).**Hay dos cambios más. Primero, deje de perder la predicción de características por completo  EAGLE-1/2 entrenó el borrador para que coincida con los estados ocultos del verificador, lo que limita la cantidad de datos que ayuda. EAGLE-3 se entrena directamente en la predicción de tokens. En segundo lugar, prueba de tiempo de formación (TTT): durante el entrenamiento de proyectos, devuelva las propias predicciones anteriores del proyecto como entradas en múltiples pasos, de la misma manera que funciona en la inferencia. Esto alinea la distribución del tren y de las pruebas y detiene la acumulación de errores. Aceleración medida: hasta 6,5 veces en chat, mejora del 38% en el rendimiento en el lote 64 en SGLang en H100.

### Revuelo de la caché KV

La verificación extiende la caché KV del verificador en `N`En el caso de que el rechazo ocurra en posición`j`, el contenido del caché pasado posición `j-1`Las dos implementaciones comunes: escribir a un buffer de rasguño y comprometerse a la aceptación (vLLM, TensorRT-LLM), o mantener una caché KV física más una longitud lógica y truncate en rechazo.

Para la búsqueda de árboles EAGLE-2, el verificador ejecuta la atención con una máscara no causal que respeta la topología de los árboles.

### Proyectos de arquitecturas para 2026

| Strategy | Draft type | `α` | Speedup | Training cost |
|----------|-----------|-----|---------|---------------|
| Vanilla | Separate small LLM | 0.55-0.70 | 1.8-2.3× | None (reuse existing small model) |
| Medusa | Extra LM heads on verifier | 0.65-0.75 | 2-3× | ~1B SFT tokens |
| EAGLE-1 | 1-layer transformer on hidden states | 0.70-0.80 | 2.5-3× | ~60B tokens |
| EAGLE-2 | EAGLE-1 + dynamic draft tree | 0.80-0.88 | 3-4× | ~60B tokens |
| EAGLE-3 | Multi-layer feature fusion + TTT | 0.88-0.92 | 3.5-6.5× | ~60-200B tokens |
| Lookahead | No draft (Jacobi iteration) | N/A | 1.3-1.6× | None |

El `α`La columna es la tasa de aceptación por token a lo largo de la ruta aceptada, en los puntos de referencia de chat, con un borrador entrenado en datos de chat correspondientes. Es la banda superior. La fase 10 · 25 cita 0,82 para EAGLE-3 de una configuración diferente, y la fase 17 · 05 planea lanzamientos de producción con 0,6 a 0,8 en el chat general. Medida `α`en su propio tráfico antes de elegir`N`¿ Qué ?

En 2026 producción: vLLM y SGLang por defecto a EAGLE-3 cuando esté disponible, EAGLE-2 de lo contrario. TensorRT-LLM tiene la ruta Medusa más rápida para los modelos públicos de Meta y NVIDIA. llama.cpp envío el borrador de vainilla para las implementaciones de CPU.

```figure
l5-spec-decode-eagle
```

## Construye el mismo

¿ Qué ?`code/main.py`. Este es el ciclo especulativo completo de Leviathan con todas las piezas: proyecto de N, verificación paralela de paso, rechazo por posición, muestreo residual, token de bonificación, KV rollback y verificación empírica de que la distribución de salida coincide con la muestreo directo de `q`¿ Qué ?

### Paso 1: la regla de rechazo

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### Paso 2: distribución residual

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### Paso 3: un paso especulativo completo

El `spec_step`proyectos de función `N`fichas de `p`, luego los verifica todos en un paralelo .`q`El token de la prueba de la prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba de prueba`q_{N+1}`¿ Qué ?

### Paso 4: contabilidad de KV

El simulador rastrea una lógica .`kv_length`En el caso de los trabajadores, el número de trabajadores por trabajador se reduce a un`k`proyectos, `kv_length += k`. Sobre un rechazo en posición`j`, el caché ya está escrito pasado .`j`, pero la longitud lógica está fijada en `prefix_length + j + 1` uno más allá de la señal de corrección.

### Paso 5: el cheque de Leviatán

Realice 50.000 pasos especulativos, cuenta la distribución empírica de los tokens aceptados, compara con 50.000 muestras directas de`q`La estadística del cuadrado de chi debe estar muy por debajo del valor crítico.

### Paso 6: aceleración vs. α

Arrojar la calidad del borrador perturbando`p`lejos de`q`en diferentes amplitudes.`α`, luego trazar los tokens esperados por llamada de verificador como función de `α`y `N`El código imprime una tabla que muestra la calidad de los proyectos de la clase EAGLE-3 (`α ≈ 0.9`) desbloquea 45 tokens por llamada de verificador.

## Usalo

Nivel de producción `vllm serve`con EAGLE-3:

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --speculative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_speculative_tokens": 5,
    "method": "eagle3"
  }'
```

SGLang con EAGLE-3 en el lote 64 en H100: aproximadamente 1,38 veces más rendimiento que la descodificación de vainilla del lote 64, según el papel EAGLE-3.

Cuando se busca la descifrado especulativo:

- Cualquier carga de trabajo interactiva en la que la latencia p50 importa más que el máximo rendimiento.
- Generación de código y salida estructurada (JSON, SQL). `α`El objetivo de la distribución es muy predecible.
- La generación de forma larga (miles de tokens).

Cuando no:

- Los modelos muy pequeños (< 3B) el borrador no es mucho más barato que el verificador.
- Pequeñas implementaciones de CPU de lote 1.
- Muestreo creativo de muy alta temperatura donde `α`Se derrumba.

## Envío

Esta lección produce`outputs/skill-eagle3-tuner.md`. Dado el volumen de trabajo de la inferencia (modelo, tamaño de lote, latencia objetivo, perfil de tarea), se recomienda una estrategia de descodificación especulativa y parámetros de ajuste (familia de proyectos, `N`, profundidad de árbol, cambio de temperatura consciente).

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar las estadísticas de chi-cuadrados en la verificación de distribución Leviathan se mantiene por debajo del valor crítico del 95% en 50.000 muestras.

2. Especialización`N`de 1 a 10 con `α`se mantiene en 0,9 y `c`Se mantiene en 0.04. Entraña los tokens esperados por llamada de verificador y el tiempo de pared real por token.`N`Esto minimiza el tiempo de la pared.

3. Modificar el código para simular la búsqueda de árboles EAGLE-2: en cada paso, el borrador propone un árbol de forma `[2, 2, 2]`El verificador se ejecuta una vez y el camino aceptado con mayor probabilidad gana.`α`comparar con la codificación de especificaciones de cadena lineal en cálculo equivalente.

4. Implemente un simulador de retroceso de KV en lote para dos secuencias simultáneas. La secuencia A tiene todos los borradores aceptados; la secuencia B rechaza en la posición 2.`kv_length`Se actualiza por secuencia y no se pierde ningún trabajo.

5. Lea la sección 4 (Test de tiempo de entrenamiento) del documento EAGLE-3. Explique en dos frases por qué el entrenamiento de proyectos ingenuos sin TTT sufre de sesgo de exposición y por qué alimentar el proyecto con sus propias predicciones durante el entrenamiento lo corrige.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Leviathan rule | "min(1, q over p)" | Bernoulli accept/reject with probability `min(1, q(d)/p(d))`, preserves the verifier distribution exactly when you sample from the residual on rejection |
| Residual distribution | "(q minus p) plus, normalized" | `(q - p)_+` clamped at zero and renormalized — the correct distribution to sample from on rejection |
| Acceptance rate α | "how often the draft is right" | Expected per-token Bernoulli-success probability under the rejection rule; governs all speedup math |
| EAGLE-1 | "hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden state (Li et al., 2024) |
| EAGLE-2 | "dynamic draft tree" | EAGLE-1 plus a tree of candidate continuations scored with tree attention in one verifier pass |
| EAGLE-3 | "training-time test" | Drops the feature-prediction loss, trains on direct token prediction with the draft fed its own outputs during training |
| Training-time test (TTT) | "exposure bias fix" | Run the draft autoregressively during training so train and test input distributions match — the direct analog of scheduled sampling |
| KV rollback | "undo rejected drafts" | Bookkeeping that resets the verifier's KV cache to the accepted-prefix length after a rejection |
| Bonus token | "the free one" | When all `N` drafts accept, sample one extra from `q_{N+1}` at no additional verifier cost |
| Tree attention | "verify many candidates at once" | Attention with a non-causal mask that respects the topology of a draft tree; computes `q_i` for every node in the tree in one forward pass |

## Leer más

- [Leviathan, Kalman, Matias — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) el documento fundamental y el teorema de equivalencia
- [Chen et al. — Accelerating Large Language Model Decoding with Speculative Sampling (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) introducción independiente simultánea con una prueba clara
- [Li et al. — EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) EAGLE-1, proyecto con condición de estado oculto
- [Li et al. — EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) búsqueda dinámica de árboles
- [Li et al. — EAGLE-3: Scaling up Inference Acceleration via Training-Time Test (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) el incumplimiento de la producción de 2026
- [Cai et al. — Medusa: Multiple Decoding Heads (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) Un enfoque alternativo libre de proyectos
- [vLLM Speculative Decoding documentation](https://docs.vllm.ai/en/latest/features/spec_decode.html) referencia de producción canónica con todas las estrategias conectadas
