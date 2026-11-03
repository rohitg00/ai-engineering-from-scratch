# Descifrado especulativo y ÁGuila

> Un LLM fronterizo que genera un token requiere un pase completo hacia adelante sobre miles de millones de parámetros. Ese pase hacia adelante está masivamente sobreprovisionado: la mayoría de las veces un modelo mucho más pequeño puede adivinar los próximos 3-5 tokens correctamente, y el modelo grande sólo necesita *verificar* la adivinación. Cuando la suposición es correcta tienes 5 tokens por el precio de uno. Descodación especulativa (Leviathan et al. 2023) hizo esto exactamente, y EAGLE-3 (2025) empujó las tasas de aceptación a ~ 4.5 tokens por verificación  un aumento de velocidad de 4-5 veces en la distribución de salida coincidente.

**Type:** Build
**Languages:** Python (with numpy)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## El problema

El rendimiento de descifrado para un modelo de clase 70B en H100 es típicamente de 40-80 tokens/segundo. Cada token requiere un pase avanzado completo que lee todos los pesos del modelo de HBM. No se puede hacer que el modelo sea más pequeño sin cambiar su salida. No se puede aumentar el tamaño del lote más allá de la memoria. Estás atascado  a menos que puedas dejar que el modelo salga más de un token por pase avanzado.

La generación autoregresista parece inherentemente seria:`x_{t+1} = sample(p(· | x_{1:t}))`Pero hay una oportunidad de concurrencia. si tuvieras un predictor barato que dijera "los próximos 4 tokens son probablemente [a, b, c, d]" podrías verificar todas las 5 posiciones en un **single forward pass of the big model**y acepta el prefijo más largo.

Leviathan, Kalai, Matias (2023, "Inferencia rápida de transformadores a través de la descodificación especulativa") hizo esto exactamente a través de una regla inteligente de aceptación / rechazo que preserva la distribución de muestras del modelo objetivo.

## El concepto

### La configuración de dos modelos

- **Target model** `M_p`El modelo grande, lento y de alta calidad del que realmente quieres muestras.`p(x)`¿ Qué ?
- **Draft model** `M_q`: un modelo pequeño, rápido y de menor calidad.`q(x)`. 5-30 veces más pequeño.

Por paso:

1. Proyecto de modelo propone `K`los tokens autoregresivamente: `x_1, x_2, ..., x_K ~ q`¿ Qué ?
2. El modelo objetivo ejecuta un pase hacia adelante sobre todos .`K+1`Las posiciones paralelas, producen `p(x_k)`para cada token propuesto.
3. Acepta/rechace cada token de izquierda a derecha a través de la regla de muestreo de rechazo modificada a continuación.
4. Si se rechaza algún token, muestre el reemplazo de la distribución corregida y detenga.`p(· | x_1...x_K)`¿ Qué ?

Si el borrador coincide perfectamente con el objetivo, obtienes tokens K + 1 por objetivo avanzado. Si el borrador está equivocado en la posición 1, obtienes solo 1 token.

### La regla de exactitud

La descifrado especulativo es **provably equivalent in distribution to sampling from p**La regla de rechazo:

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

donde`(p - q)+`En el caso de los proyectos de investigación, el objetivo de la evaluación de los resultados de los proyectos de investigación es el de la evaluación de los resultados de los proyectos de investigación.`p ≈ q`Cuando no están de acuerdo, se construye la distribución residual de modo que la muestra general sigue siendo exactamente `p`¿ Qué ?

**Greedy case.**Para el muestreo de temperatura=0 sólo compruebe `argmax(p) == x_t`Si es así, acepta; si no, saca.`argmax(p)`y detenerse.

### El aumento esperado

Si la tasa de aceptación a nivel de tokens del modelo de proyecto es `α`, los tokens esperados producidos por cada pase de destino es:

```math
\mathbb{E}[\text{tokens}] = \frac{1 - \alpha^{K+1}}{1 - \alpha} \qquad K = \text{draft length}, \ \alpha \in [0, 1]
```

En el`α = 0.8, K = 4`¿ Qué es esto ?`(1 - 0.8^5)/(1 - 0.8) = 3.36`Los precios de los precios de los productos de la Unión Europea son de un nivel de interés de la Unión Europea.`cost_q * K + cost_p`(K proyectos de pasos más una verificación de objetivo).`cost_p >> cost_q * K`la relación de aceleración es `3.36× / 1 = 3.36×`en el rendimiento.

El único parámetro real es `α`Un buen borrador es todo.

### Formación del proyecto: Destilación

Un modelo pequeño al azar hace un borrador pobre.

1. Elija una arquitectura pequeña (~ 1B para un objetivo de 70B, ~ 500M para un objetivo de 7B).
2. ejecuta el modelo objetivo en un gran corpus de texto; almacena sus distribuciones de tokens siguientes.
3. Entrenar el borrador con la divergencia KL contra la distribución del objetivo (no contra tokens de verdad básica).

El resultado:`α`Normalmente 0.6-0.8 en codificación, 0.7-0.85 en chat de lenguaje natural.

### ÁGuila: dibujo de árboles + reutilización de características

Li, Wei, Zhang, Zhang (2024, "AIGLE: Muestreo especulativo requiere de repensar la incertidumbre de la característica") observaron dos ineficiencias en la descodificación especulativa estándar:

1. El borrador hace K pasos de serie, cada pila completa. Pero el borrador podría reutilizar las características del objetivo (estados ocultos) de la verificación más reciente  el objetivo ya calculado representaciones ricas que el borrador está derivando de cero.
2. El borrador de salida de una cadena lineal. Si el borrador podría emitir un árbol de candidatos (cada nodo con varias conjeturas), el pase hacia adelante único del objetivo podría verificar múltiples caminos de candidatos en paralelo a través de una máscara de atención de árbol, y elegir la rama más larga aceptada.

Cambios de EAGLE-1:
- Introducción de borrador = estado oculto final del objetivo en la posición t, no tokens crudos.
- Arquitectura de proyecto = 1 capa de decodificador de transformador (no un modelo pequeño separado).
- La salida = árbol de K = 4-8 candidatos por profundidad, profundidad 4-6.

EAGLE-2 (2024) añade una topología dinámica de árboles: el árbol crece más ancho donde el proyecto es incierto y se mantiene estrecho donde es seguro.`α_effective`sin aumentar el coste de verificación.

ELLE-3 (Li et al. 2025, "EAGLE-3: Acelerar la Inferencia de los Grandes Modelos de Lenguaje a través de la Prueba de Tiempo de Entrenamiento") elimina la dependencia fija de las características de la capa superior y entrena el borrador con una nueva pérdida de "simulación de tiempo de prueba"  el borrador se entrena en resultados que coinciden con la distribución del tiempo de prueba del objetivo en lugar de la distribución de formación forzada por el profesor. La tasa de aceptación aumenta de 0,75 (EAGLE-2) a 0,82 (EAGLE-3), y la media de tokens/verificación de 3,0 a 4,5. Estas cifras provienen de una configuración de referencia. La aceptación depende del par de modelos, el árbol de proyecto y el tráfico: la fase 10 · 15 cotiza de 0.88 a 0.92 por token de camino aceptado en los puntos de referencia de chat, y la fase 17 · 05 planes con 0.6 a 0.8 en el chat general de producción.

### Verificación de la atención de los árboles

Cuando el borrador de salida de un árbol, el modelo objetivo lo verifica en una sola pasada hacia adelante utilizando un **tree attention mask** una máscara causal que codifica la topología del árbol en lugar de una línea pura. Cada token atiende solo a sus antepasados en el árbol. El pase de verificación es todavía un adelante, un matmul; la máscara topológica cuesta solo unas pocas entradas KV adicionales.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

Si ...`a, b`están compitiendo candidatos de primer token y `c, d, e, f`Las posiciones de salida son las más largas en cualquier camino aceptado.

### Cuando gana y cuando no gana

**Wins:**
- Chat / completado con texto predecible (código, inglés común, salida estructurada). `α`Es muy alto.
- Configuración con computación de GPU no utilizada durante la decodificación (fase de memoria).

**Loses / no win:**
- Resultados altamente estocásticos (escritura creativa a alta temperatura). `α`caídas hacia `1/|vocab|`¿ Qué ?
- El lote que sirve con una concurrencia muy alta  el lote ya llena los FLOPs, poco espacio para la verificación de árboles.
- Modelos muy pequeños donde el proyecto no es mucho más pequeño.

Las tiendas de producción suelen reportar un aumento de velocidad de 2-3 veces en el chat, 3-5 veces en la generación de código y casi cero en la escritura creativa.

```figure
speculative-decoding
```

## Construye el mismo

`code/main.py`¿Qué es esto ?

- Una referencia `speculative_decode(target, draft, prompt, K, temperature)`que implemente la regla exacta de rechazo y compruebe que conserva la distribución del objetivo (prueba empírica KL < 0,01 frente a la muestra del objetivo común).
- Un dibujante de árboles de estilo EAGLE que construye un árbol de profundidad K con ramificación de p.
- Un constructor de máscaras de atención de árbol que produce el patrón causal correcto para un verificador.
- Un arnés de tasa de aceptación que funciona en un pequeño LM (distilla un GPT-2-pequeño de un objetivo medio GPT-2-).

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_dists = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_dists.append(probs)
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_dists[k][tok]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_dists[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## Usalo

- **vLLM**y **SGLang**En el VLLM, pasa `--speculative-config`un objeto JSON con `method`¿ Qué ?`model`, y `num_speculative_tokens`; EAGLE-3 es `"method": "eagle3"`¿ Qué ?
- **NVIDIA TensorRT-LLM**apoya los árboles Medusa y Eagle nativo.
- **Reference draft models**¿ Qué es esto ?`Qwen/Qwen3-0.6B`(proyectos para el Qwen3-32B), `meta-llama/Llama-3.2-1B-Instruct`(proyectos de Llama 3.x 70B).
- **Medusa heads**(Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"): en lugar de un modelo de proyecto, añadir K heads de predicción paralela al objetivo mismo.

## Envío

Esta lección produce`outputs/skill-speculative-tuning.md` una habilidad que perfila la carga de trabajo de un modelo objetivo y elige: modelo de borrador, K (duración del borrador), ancho del árbol, temperatura y cuándo volver a decodificar.

## Los ejercicios

1. Implemente la regla exacta de rechazo y verifique empíricamente.`speculative_decode`y mediante muestreo objetivo simple; calcular la distancia de TV entre las dos distribuciones de salida. Debe ser < 0,01.

2. Calcule la fórmula de aceleración.`α`y `K`, gráfico de tokens esperados por objetivo-avance.$K$por$\alpha \in \lbrace 0.5, 0.7, 0.9 \rbrace$¿ Qué ?

3. Entrenar un pequeño borrador. Toma un objetivo de 124M GPT-2 y destila un borrador de 30M GPT-2 en 100M tokens con pérdida KL.`α`En el texto retrasado.

4. Implemente el dibujo de árbol estilo EAGLE. En lugar de una cadena, tenga el dibujo de salida de tres ramas en cada profundidad. Construya la máscara de atención del árbol. Verifique si el objetivo acepta la rama correcta más larga.

5. Mide los modos de falla. ejecuta el decodificación especulativa a temperatura=1.5 (alto estocástico). muestra que α se derrumba y el algoritmo es más lento que el decodificación simple debido a la carga general de proyección.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Target model | "The big model" | The slow, high-quality model you want samples from (p distribution) |
| Draft model | "The speculator" | The small, fast predictor (q distribution); 5-30x smaller |
| K / draft length | "Look-ahead" | Number of speculated tokens per verify pass |
| α / acceptance rate | "Hit rate" | Per-token probability that the draft's proposal is accepted |
| Exact rejection rule | "The accept test" | r < p/q compare that preserves target's distribution |
| Residual distribution | "Corrected p-q" | (p - q)+ / ||(p - q)+||_1, the distribution to sample from on rejection |
| Tree drafting | "Branching speculation" | Draft outputs a tree of candidates, verified in one pass with tree-structured attention mask |
| Tree attention mask | "Topological mask" | Causal mask encoding the tree topology so each node attends only to its ancestors |
| Medusa heads | "Parallel heads" | K extra prediction heads on the target itself; no separate draft model |
| EAGLE feature reuse | "Hidden-state draft" | Draft input is target's last hidden state, not raw tokens, shrinking the draft |
| Test-time simulation loss | "EAGLE-3 training" | Train draft on outputs matching target's test-time distribution, not teacher forcing |

## Leer más

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) la regla exacta de rechazo y el análisis teórico de aceleración
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) papel de muestreo especulativo simultáneo en DeepMind
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) Alternativas de cabezas paralelas a un modelo de proyecto
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) Reutilización de las características y elaboración de árboles
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) Topología dinámica de árboles
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) Comparecimiento entre el tiempo de prueba y el tiempo de trenes
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) Descodación Jacobi/lookahead, alternativa libre de especuladores
