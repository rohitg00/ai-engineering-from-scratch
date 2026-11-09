# Mecanismo de atención  El avance

> El decodificador deja de mirar a un resumen comprimido y comienza a mirar toda la fuente.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## El problema

La lección 09 terminó con un fallo medido. Un codificador-decodificador GRU entrenado en una tarea de copia de juguete va desde una precisión del 89% en longitud 5 a casi la probabilidad en longitud 80. La razón es estructural, no un error de entrenamiento: cada bit de información que el codificador recolecta tiene que encajar en un estado oculto de tamaño fijo, y el decodificador nunca ve nada más.

Bahdanau, Cho y Bengio publicaron una solución de tres líneas en 2014. En lugar de darle al decodificador solo el estado final del codificador, mantenga cada estado del codificador.`i`Ese promedio ponderado es el contexto, y cambia cada paso del decodificador.

Esa es la idea. Los transformadores la extendieron. La autoatención la aplicó a una sola secuencia. La atención multi-cabeza la corrió en paralelo. Pero la versión de 2014 ya rompió el cuello de botella, y una vez que la tienes, el eje central de los transformadores es la ingeniería, no conceptual.

## El concepto

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

En cada paso del decodificador `t`¿Qué es esto ?

1. Utilice el estado oculto del decodificador anterior `s_{t-1}`como un **query**¿ Qué ?
2. Escóralo contra cada estado oculto del codificador .`h_1, ..., h_T`Un escalar por posición de codificador.
3. Softaxe las puntuaciones para obtener pesas de atención `α_{t,1}, ..., α_{t,T}`que la suma es de 1.
4. Vector de contexto `c_t = Σ α_{t,i} * h_i`- Media ponderada de estados de codificación.
5. El descifrador toma `c_t`más el token de salida anterior, produce el siguiente token.

El promedio ponderado es el punto. Cuando el decodificador necesita traducir "Je" a "I", pesa el estado del codificador sobre "Je" alto y los otros bajo. Cuando necesita "no", pesa "pas" alto. El vector de contexto remodela cada paso.

## Las formas (la cosa que muerde a todos)

Aquí es donde cada aplicación de atención va mal la primera vez.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`¿ Qué ?

- `s_{t-1}`tiene forma`(d_s,)`¿ Qué ?`h_i`tiene forma`(d_h,)`¿ Qué ?
- `W_a`tiene forma`(d_attn, d_s)`- ¿ Qué ?`U_a`tiene forma`(d_attn, d_h)`¿ Qué ?
- Su suma dentro del tanh tiene forma .`(d_attn,)`¿ Qué ?
- `v_α`tiene forma`(d_attn,)`. El producto interno con `v_α`Se derrumba hasta una escala.**This is what `v_α` does.**No es magia, es la proyección que convierte un vector de atención-dim en una puntuación escalar.

**Luong (multiplicative) score.**Tres variantes:

- `dot`¿ Qué es esto ?`e_{t,i} = s_t^T * h_i`- Requiere .`d_s == d_h`- No se puede hacer nada si el codificador es bidireccional.
- `general`¿ Qué es esto ?`e_{t,i} = s_t^T * W * h_i`con`W`forma`(d_s, d_h)`Elimina la restricción de igual oscuridad.
- `concat`Es raro utilizarlo ya que los dos primeros son más baratos.

**One Bahdanau / Luong gotcha worth naming.**Bahdanau utiliza `s_{t-1}`(el estado del decodificador * antes de * generar la palabra actual). Luong utiliza `s_t`(el estado * después *). mezclarlos produce gradientes sutiles y incorrectos que son extremadamente difíciles de deshacer.

```figure
attention-heatmap
```

## Construye el mismo

### Paso 1: atención aditiva (Bahdanau)

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

Compruebe sus formas con la tabla de arriba.`encoder_states`tiene forma`(T_enc, d_h)`- ¿ Qué ?`projected_enc`tiene forma`(T_enc, d_attn)`- ¿ Qué ?`projected_dec`tiene forma`(d_attn,)`y las emisiones. `combined`tiene forma`(T_enc, d_attn)`- ¿ Qué ?`scores`tiene forma`(T_enc,)`- ¿ Qué ?`weights`tiene forma`(T_enc,)`- ¿ Qué ?`context`tiene forma`(d_h,)`- Envíalo.

### Paso 2: Luong punto y general

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

Es por eso que el papel de Luong aterrizó, la misma precisión en la mayoría de las tareas, mucho menos código.

### Paso 3: ejemplo numérico trabajado

Dado tres estados de codificación (aproximadamente "cat", "sat", "mat") y un estado de decodificación que se alinea más con el primero, la distribución de la atención se concentra en la posición 0.

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

La primera fila gana. Luego mueve el estado del decodificador más cerca del tercer estado del codificador y observa el cambio de pesas. Eso es todo.

### Paso 4: por qué este es el puente a los transformadores

Traducir el idioma anterior a Q/K/V:

- **Query**= estado del decodificador `s_{t-1}`
- **Key**= estados de codificación (lo que anotamos en contra)
- **Value**= estados del codificador (lo que pesamos y suma)

En la atención clásica, las claves y los valores son lo mismo. La autoatención los separa: se puede consultar una secuencia contra sí misma, con diferentes proyecciones aprendidas para K y V. La atención multi-cabeza la ejecuta en paralelo con diferentes proyecciones aprendidas. Los transformadores apilan la etapa entera muchas veces y dejan caer RNNs.

Las matemáticas son las mismas, las formas son las mismas, el salto pedagógico de la atención Bahdanau a la atención escalada de producto es principalmente la notación.

## Usalo

PyTorch y TensorFlow envían la atención directamente.

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

Es una capa de atención de transformador. Batalla de consulta de 5 posiciones, batalla de clave/valor de 10 posiciones, 128-dim cada, 8 cabezas. `output`es las nuevas consultas aumentadas de contexto. `weights`es la matriz de alineación 5x10 que puedes visualizar.

### Cuando la atención clásica todavía importa

- La versión de una sola cabeza, de una sola capa, basada en RNN hace que cada concepto sea visible.
- tareas de secuenciación en el dispositivo en las que los transformadores no encajan.
- Cualquier artículo de 2014-2017. Lo leerás mal sin conocer la convención de Bahdanau.
- Análisis de alineación de granos finos en MT. Los pesos de atención en bruto son una herramienta de interpretabilidad incluso en los modelos de transformadores, y leerlos requiere saber qué son.

### La trampa de la atención-peso-como-explicación

Las pesas de atención parecen interpretables: son pesas que suman a uno a través de posiciones; puedes trazarlas; alta significa "mirado esto".

No son tan interpretables como parecen. Jain y Wallace (2019) mostraron que las distribuciones de atención pueden ser permutadas y reemplazadas por alternativas arbitrarias sin cambiar las predicciones de modelos para algunas tareas. Nunca reportes los pesos de atención como evidencia de razonamiento sin una ablación o verificación contrafactual.

## Envío

Salvo como`outputs/prompt-attention-shapes.md`¿Qué es esto ?

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## Los ejercicios

1. **Easy.**Implementación `softmax`En el código de código se encuentran los tokens de relleno para que la atención tenga peso cero.
2. **Medium.**Añadir atención multi-cabeza a la Luong `general`forma. dividido`d_h`en el`n_heads`Los grupos, la atención por cabeza, concatenado.
3. **Hard.**Entrenar un codificador-decodificador GRU con Bahdanau atención en la tarea de copia de juguete de la lección 09. Precisión de trama vs longitud de secuencia. Comparar con la línea de base de no atención. Usted debe ver la brecha se amplía a medida que crece la longitud, confirmando la atención levanta el cuello de botella.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## Leer más

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)- El periódico.
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) las tres variantes de puntaje y su comparación.
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) la advertencia de interpretación.
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) Paseo en marcha con PyTorch.
