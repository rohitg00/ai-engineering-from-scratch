# Predicción de múltiples tokens (MTP)

> Cada LLM autoregresivista desde GPT-2 a Llama 3 se pone a una pérdida por posición: predica el siguiente token. DeepSeek-V3 añadió una segunda pérdida por posición: predecir el token después de eso. Los parámetros adicionales 14B (en un modelo 671B) se destilaron de nuevo en el modelo principal a través del flujo de gradiente, y las cabezas MTP entrenadas se reutilizaron a la inferencia como diseñadores de decodificación especulativa con una aceptación del 80%+. El rendimiento de 1,8x generación llegó de forma gratuita. Esta lección construye el módulo MTP secuencial del informe técnico de DeepSeek, calcula la pérdida y el diseño de parámetros de cabeza compartida, y explica por qué MTP mantiene la cadena causal mientras que el MTP paralelo original de Gloeckle et al. lo rompió.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 04 (pre-training a mini GPT), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Indique el objetivo de formación MTP y derive la pérdida conjunta en profundidades de predicción.
- Explica la diferencia entre las cabezas MTP paralelas de Gloeckle et al. (2024) y los módulos MTP secuenciales de DeepSeek-V3 y por qué el diseño secuencial preserva la cadena causal.
- Calcule el parámetro y el gasto de memoria de la adición de módulos MTP a una carrera previa al entrenamiento.
- Implemente un módulo MTP desde cero: la incorporación compartida, el bloque de transformador por profundidad, la proyección y la cabeza de salida compartida.

## El problema

La predicción de la próxima señal es el objetivo estándar de formación LLM. Cada estado oculto está supervisado para predecir exactamente una cosa: el token inmediatamente siguiente. Esa es una señal sorprendentemente débil. La mayor parte de la información en una secuencia se extiende más allá de una estructura simbólica, coherencia, factualidad, flujo aritmético. El modelo tiene que aprenderlos acumulando muchas señales de un solo token en billones de tokens.

MTP pregunta: ¿qué pasa si cada estado oculto fuera supervisado para predecir múltiples tokens futuros a la vez? Gloeckle y otros. (Meta, 2024) mostró que esto ayuda. Su implementación colocó varias cabezas de salida independientes en la parte superior de la columna vertebral, cada una prediciendo un descenso diferente. Paralelas, simples, pero las cabezas vieron el mismo estado oculto sin ningún refinamiento jerárquico y las predicciones no se encadenaron causalmente, por lo que no podían usarse para la descodificación especulativa.

DeepSeek-V3 (diciembre 2024) rediseñó MTP como módulos secuenciales que mantienen la cadena causal en cada profundidad de predicción.`t+1`de la`h_i^(0)`, luego predice .`t+2`de un nuevo estado oculto.`h_i^(1)`que combinado `h_i^(0)`con el `E(t+1)`El sistema de integración compartida y la cabeza de salida compartida mantienen el parámetro sobre la carga modesta. En la escala de DeepSeek-V3, 14B parámetros adicionales en los módulos MTP en la parte superior de los pesos del modelo principal 671B. Ese 2% compró señales de entrenamiento más densas Y un borrador de descodación especulativa listo a la inferencia.

Esta lección construye un módulo MTP único y la pérdida de profundidad D desde cero. Las matemáticas son ordenadas. La implementación es de 150 líneas.

## El concepto

### La receta de MTP secuencial

DeepSeek-V3 añade `D`Modulos MTP en la parte superior del modelo principal.`t_{i+1}`Cada módulo .`k`(para `k = 1..D`) predice el token `k`pasos más lejos, `t_{i+k+1}`, dado un prefijo a través de la posición `i`¿ Qué ?

Modulo `k`se compone de:

- Un bloque de transformador .`T_k`con su propia atención y MLP.
- Una matriz de proyección `M_k`que combina el estado oculto de profundidad anterior con la incorporación del siguiente token de verdad fundamental.
- La incorporación compartida `E`(el mismo que el modelo principal).
- El eje de salida compartido `Out`(el mismo que el modelo principal).

En el entrenamiento, para un prefijo a través de posición `i`, el estado oculto por profundidad es:

```math
\begin{aligned}
h_i^{(0)} &= \text{main model backbone at position } i \\
h_i^{(k)} &= T_k\Big( M_k \cdot \mathop{\mathrm{concat}}\big(\mathop{\mathrm{RMSNorm}}(h_i^{(k-1)}), \mathop{\mathrm{RMSNorm}}(E(t_{i+k}))\big) \Big) \quad \text{for } k \ge 1
\end{aligned}
```

La predicción por profundidad es:

```math
\text{logits}_{i+k+1} = \mathop{\mathrm{Out}}(h_i^{(k)}) \quad \text{for } k = 1, \ldots, D
```

La pérdida por profundidad es la entropía cruzada contra la verdad fundamental .`t_{i+k+1}`¿Qué es esto ?

```math
L_k = \mathop{\mathrm{CE}}(\text{logits}_{i+k+1}, t_{i+k+1})
```

La pérdida articular a través de profundidades:

```math
L_{\text{MTP}} = \frac{\lambda}{D} \sum_{k=1}^{D} L_k
```

`lambda`El equipo de entrenamiento de DeepSeek-V3 utiliza 0,3 para el primer 10% del entrenamiento y 0,1 después.`L_main + L_MTP`¿ Qué ?

### ¿Por qué secuenciales, no paralelos?

El MTP paralelo original de Gloeckle tenía cabezas de salida D, cada una aplicada directamente a `h_i^(0)`Cada cabeza predice .`t_{i+k}`Eso se entrena bien, pero las predicciones no están condicionadas entre sí.`head_1`La salida para ayudar .`head_2` las cabezas disparar en paralelo.

El diseño secuencial de DeepSeek-V3 construye `h_i^(k)`de la`h_i^(k-1)`más la incorporación real de la siguiente ficha `E(t_{i+k})`. Que preserva la cadena causal: predecir`t_{i+k+1}`, el módulo en profundidad `k`ve lo que estaba en`t_{i+k}`. Esto es estructuralmente idéntico a la forma en que un decodificador autorregresor consume su propia salida, lo que hace que los módulos MTP sean directamente utilizables como diseñadores de decodificación especulativa.

En la inferencia: alimento `h_i^(k-1)`y el redactado `t_{i+k}`en módulo `k`, obtener una predicción para`t_{i+k+1}`Repito. Es exactamente un borrador de estilo EAGLE, utilizando el módulo entrenado MTP como la red de borrador. DeepSeek-V3 informa de aceptación de 80% + en el primer módulo MTP y ~ 1.8x de velocidad.

### Contabilidad de parámetros

Para un modelo con escondidas`h`y vocabulario `V`¿Qué es esto ?

- Modelo principal: miles de millones de parámetros, más una cabeza de salida de tamaño `V * h`¿ Qué ?
- Cabeza de salida compartida: reutilice la cabeza del modelo principal.
- Embedado compartido: reutilice el embedado del modelo principal.
- Modulo por MTP:
  - Proyección `M_k`¿ Qué es esto ?`(2h) * h = 2h^2`¿ Qué ?
  - Bloqueo de transformador `T_k`: atención (`4h^2`para MHA) más MLP (normalmente `8h^2`para SwiGLU con una relación de 8/3).`12h^2`por cuadra.

Total de extras por módulo: `~14h^2`Para DeepSeek-V3 `h = 7168`, D = 1 módulo: `~14 * 7168^2 = ~720M`La diferencia es que la mayoría de las capas expertas son MoE en el módulo MTP también.

### El pago de la descifrado especulativo

Durante el entrenamiento previo, los módulos MTP retrasan el entrenamiento en aproximadamente un 10% (computación más avanzada, pérdida adicional).

1. Se calcula que el sistema de detección de densidad de datos de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información de la información.

2. El módulo MTP ya está entrenado para predecir los próximos tokens. Reutilizado como red de proyecto, ofrece tasas de aceptación de más del 80%. En ese nivel, la descifrado N = 3 o N = 5 especificación da 1,8 veces de rendimiento. El costo del tiempo de entrenamiento del 10% se paga la primera vez que ejecuta la inferencia.

### Relación con el ÁGuila

El proyecto de formación de la empresa de formación de base de la empresa de formación de base de la empresa de formación de base de la empresa de formación de base de la empresa de formación de base de la empresa de formación de base de la empresa de formación de base de la empresa de formación de base de la empresa de formación de base de la empresa de formación de base de la empresa de formación de base de la empresa de formación de la empresa de formación de base de la empresa de formación de la empresa de formación de base de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de formación de la empresa de la empresa de formación de la empresa de formación de la empresa de la empresa de formación de la empresa de la empresa de formación de la empresa de la empresa de formación de la empresa de la empresa de formación de la empresa de la empresa de la empresa de formación de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la empresa de la

| Dimension | EAGLE-3 | MTP (DeepSeek-V3) |
|-----------|---------|------------------|
| When trained | Post-pre-training | During pre-training |
| Backward-compatible with existing weights | Yes | No (need to re-train) |
| Draft params | 1-2 transformer layers | 1 transformer block + projection |
| Acceptance rate | 0.88-0.92 | 0.80+ at depth 1 |
| Benefit beyond speedup | Speculative decoding only | Denser training signal + speedup |

```figure
multi-token-predict
```

## Construye el mismo

`code/main.py`construye un único módulo MTP de extremo a extremo: incorporación compartida, proyección, bloque de transformador, cabeza de salida compartida. Luego calcula la pérdida de entropía cruzada por profundidad en una secuencia sintética corta e imprime el conteo de parámetros por componente. Un vocabulario de juguete de 32 tokens mantiene los números legibles.

### Paso 1: mesa de incorporación compartida

Un solo .`vocab_size x hidden`La tabla se utiliza por el modelo principal y por cada módulo MTP en cada profundidad.

### Paso 2: la combinación por profundidad

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

Real DeepSeek-V3 concatenar los dos vectores RMSNormed a `[2h]`y proyectos con un `h x 2h`El juguete utiliza adición vectorial para la brevedad de STDlib.

### Paso 3: el bloque del transformador a la profundidad k

En el juguete, un bloque de atención lineal de una sola capa y un MLP SwiGLU mantienen la estructura visible sin numpy.

### Paso 4: la cabeza de salida compartida

Reutilice la proyección de salida del modelo principal.

### Paso 5: pérdida por profundidad

Entropia cruzada de softmax (logits) contra el token de verdad de base en compensación `k+1`. Agregar a través de las profundidades con el `lambda / D`factor de escala.

### Paso 6: Contabilidad de parámetros

Imprima el recuento total de parámetros, el recuento compartido (embedded, head) y el recuento extra por módulo.

## Usalo

MTP se integra en DeepSeek-V3 (diciembre 2024) y la serie DeepSeek-R1.

- La pila de servicio de DeepSeek consume módulos MTP como descifradores especulativos fuera de la caja.
- VLLM y SGLang tienen caminos de integración para DeepSeek-V3 MTP a partir de abril de 2026.
- El tutorial ROCm SGLang de AMD muestra una configuración especulativa de decodificación MTP específica con velocidad medida 1,8x en el punto de control V3.

Cuando utilizar MTP en una nueva carrera previa al entrenamiento:

- Usted controla la línea completa de pre-entrenamiento y quiere bancar la señal de entrenamiento más densa.
- Sabes que servirás el modelo a escala y querrás descifrar especulativas de forma gratuita.
- Tu tamaño oculto es de al menos 4096. En la escala 1B el gasto superior hace más daño que la ganancia ayuda.

Cuando no:

- La configuración de un modelo denso previamente entrenado.
- Los modelos de investigación en los que se quiere una línea de base limpia para comparar.

## Envío

Esta lección produce`outputs/skill-mtp-planner.md`. Dado que se ha especificado el modelo de ejecución previa a la formación (tamaño del modelo, datos, cálculo), se devuelve un plan para integrar el MTP: número de profundidades D, `lambda`el tiempo de la inferencia y el cableado de descodación especulativa.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Muestre que la pérdida por profundidad disminuye monótona a medida que la señal sintética se fortalece. Modifique la sintética para usar un patrón fijo y verifique la convergencia de las pérdidas de profundidad 1 y profundidad 2.

2. Compute el coste de un modelo 70B denso (oculto 8192, 80 capas) con módulo D=1 MTP. Compara con el coste de 14B reportado por DeepSeek-V3. Explique por qué el número de DeepSeek es mayor: el bloque de transformador MTP hereda la misma estructura MoE, inflando el recuento de parámetros por módulo.

3. Implementar D=2 en el juguete: añadir un segundo módulo MTP que toma $h^{(1)}$y predice`t_{i+3}`Verifique la pérdida conjunta y la contabilidad de parámetros coincide con las ecuaciones 19-21 del documento de DeepSeek.

4. Cambiar el juguete a MTP paralelo (estilo de Gloeckle): añadir cabezas de salida D en la parte superior del estado oculto principal, cada uno prediciendo un desvio diferente. Medir cómo las pérdidas por profundidad se comparan con la versión secuencial en la misma señal sintética. La versión secuencial debe producir una menor pérdida de profundidad k para k > 1 porque se condiciona con las predicciones intermedias.

5. Utilice el módulo de MTP formado como un borrador de estilo EAGLE: llama al módulo k para proponer `t_{i+k+1}`Si se alcanza el 50% + en el juguete, se ha reproducido la propiedad empírica MTP-as-draft.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MTP module | "Extra loss block" | A small transformer block plus projection that predicts a token `k` positions ahead of the main model |
| Prediction depth | "Which offset" | The integer `k` such that module `k` predicts `t_{i+k+1}` from prefix through position `i` (the main model is depth 0 and predicts `t_{i+1}`) |
| Parallel MTP | "Gloeckle-style" | D independent heads on the same backbone hidden state, no conditional chain |
| Sequential MTP | "DeepSeek-V3 style" | Each module conditions on the previous depth's hidden state plus the next token's embedding; preserves causal chain |
| Shared output head | "Reuse the main head" | The MTP modules call the main model's LM head, not a separate output projection |
| Shared embedding | "Reuse the main table" | Same vocabulary embedding table is used everywhere; no duplicate parameters |
| Projection matrix $M_k$ | "Combine hidden + next-token" | An `h x 2h` linear layer that folds the previous hidden state and the target-token embedding into the next depth's input |
| Joint loss $L_{\text{MTP}}$ | "Averaged extra losses" | Arithmetic mean of per-depth cross-entropy losses, scaled by `lambda` |
| Acceptance rate at depth 1 | "How often MTP draft is right" | The rate at which the D=1 MTP module's top-1 prediction equals the main model's top-1 prediction; 80%+ on DeepSeek-V3 |
| Lambda weighting | "Extra-loss importance" | Per-depth scaling factor; 0.3 at start of training, 0.1 later on DeepSeek-V3 |

## Leer más

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) la descripción completa de la MTP secuencial (sección 2.2), incluidas las ecuaciones de pérdida conjunta y la aceleración de 1,8 veces en la inferencia
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) el diseño de DeepSeek mejora en el
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) 685B total (671B principal + 14B MTP), notas de despliegue
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) el marco de decodificación especulativa MTP se ajusta a
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) La arquitectura del proyecto de 2025 de EAGLE, la contraparte MTP, compite con
