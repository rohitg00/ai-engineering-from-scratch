# Estabilidad numérica

> El punto flotante es una abstracción que se filtra, te morderá durante el entrenamiento y no lo verás venir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Implemente softmax y log-sum-exp estable numéricamente utilizando el truco de subtracción máxima
- Identificar el sobreflujo, el bajo flujo y la cancelación catastrófica en los cálculos de puntos flotantes
- Verificar los gradientes analíticos contra los gradientes numéricos utilizando diferencias finitas centradas
- Explicar por qué se prefiere bfloat16 sobre float16 para el entrenamiento y cómo la escalación de pérdidas evita el descenso de la corriente

## El problema

El modelo de tren de tres horas, luego la pérdida se convierte en NaN. añade una declaración de impresión. los logits están bien en el paso 9.000. en el paso 9.001 están bien`inf`En el paso 9.002 cada gradiente es`nan`y el entrenamiento está muerto.

O: tu modelo se prepara para la finalización pero la precisión es un 2% peor que las afirmaciones del papel. Lo comprobas todo. La arquitectura coincide. Los hiperparámetros coinciden. Los datos coinciden. El problema es que el papel usó float32 y usaste float16 sin la escala correcta. Treinta y dos bits de error de redondeo acumulado se comieron silenciosamente tu precisión.

O: se implementa la pérdida de entropía cruzada desde cero. Funciona en pequeños logits. Cuando los logits superan 100, regresa`inf`La máxima suave se desbordó porque`exp(100)`Es más grande de lo que float32 puede representar. cada marco ML maneja esto con un truco de dos líneas.

La estabilidad numérica no es una preocupación teórica. Es la diferencia entre una carrera de entrenamiento que tiene éxito y una que falla silenciosamente.

## El concepto

### IEEE 754: Cómo almacenan los números reales las computadoras

Los ordenadores almacenan números reales como valores de puntos flotantes siguiendo el estándar IEEE 754. Una float tiene tres partes: un bit de signo, un exponente y una mantissa (significand).

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

La mantissa determina la precisión (cuántos dígitos significativos). El exponente determina el rango (cuán grande o pequeño puede ser un número).

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 le da aproximadamente 7 dígitos decimales de precisión. Eso significa que puede distinguir entre 1.0000001 y 1.0000002, pero no entre 1.00000001 y 1.00000002. Después de 7 dígitos, todo es ruido redondeado.

float16 le da aproximadamente 3 dígitos. El número más grande que puede representar es 65.504. Eso es muy pequeño para ML donde los logits, gradientes y activaciones superan rutinariamente esto.

bfloat16 es la respuesta de Google al problema de rango de float16. Tiene el mismo exponente de 8 bits que float32 (el mismo rango, hasta 3.4e38) pero solo 7 bits mantissa (menos precisión que float16). Para el entrenamiento de redes neuronales, el rango importa más que la precisión, por lo que bfloat16 generalmente gana.

### ¿Por qué 0.1 + 0.2 ! es igual a 0.3

El número 0.1 no puede ser representado exactamente en el punto flotante binario.

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float32 reduce esto a 23 bits de mantissa. El valor almacenado es aproximadamente 0.100000001490116. Del mismo modo, 0.2 se almacena como aproximadamente 0.200000002980232. Su suma es 0.300000004470348, no 0.3.

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

Esto es importante para ML porque:

1. Comparaciones de pérdidas como `if loss < threshold`puede dar respuestas equivocadas
2. La acumulación de muchos valores pequeños (actualizaciones graduales en miles de pasos) deriva de la suma real
3. Las pruebas de comprobación y reproductibilidad fallan si se comparan los floats con `==`

La solución: nunca comparar los flotadores con`==`- Usar .`abs(a - b) < epsilon`o `math.isclose()`¿ Qué ?

### Cancelación catastrófica

Cuando se restan dos números de puntos flotantes casi iguales, los dígitos significativos se cancelarán y se queda con ruido redondeado promovido a dígitos principales.

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

Eso es un error relativo del 19% de una sola restancia.

- Computa la variación de los datos con una media grande: $\mathbb{E}[x^2] - \mathbb{E}[x]^2$¿ Cuándo ?$\mathbb{E}[x]$es grande
- Subtraer probabilidades de registro casi iguales
- Computa gradientes de diferencia finita con un epsilon demasiado pequeño

La solución: reorganizar fórmulas para evitar restar números grandes, casi iguales. Para la variación, utilice el algoritmo Welford o centrar los datos primero. Para las probabilidades de registro, trabaje en el espacio de registro en todo.

### Sobreflujo y bajoflujo

El exceso de flujo ocurre cuando un resultado es demasiado grande para representarlo. El bajo flujo ocurre cuando es demasiado pequeño (más cercano a cero que el número positivo representativo más pequeño).

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

El `exp()`la función es la fuente principal de desbordamiento en ML:

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

El `log()`La función se dirige en la otra dirección:

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

En ML, `exp()`aparece en softmax, sigmoid y cálculos de probabilidad. `log()`La combinación de las diferencias entre las diferencias de la entropía cruzada, las probabilidades de log y las diferencias de KL.`log(exp(x))`Es un campo minado sin los trucos correctos.

### El truco de la cuenta de registro

Computación`log(sum(exp(x_i)))`El riesgo de que se produzca una acción directa es numéricamente peligroso.`x_i`es grande,`exp(x_i)`Si todo el mundo se desborda`x_i`son muy negativos, cada uno `exp(x_i)`flujos subsiguientes a cero y `log(0)`¿ Es verdad ?`-inf`¿ Qué ?

El truco: restar el valor máximo antes de exponenciar.

```math
\log\left(\sum_i \exp(x_i)\right) = \max(x) + \log\left(\sum_i \exp(x_i - \max(x))\right)
```

Por qué funciona esto: después de restar `max(x)`, el exponente más grande es `exp(0) = 1`No es posible el desbordamiento. Al menos un término en la suma es 1, por lo que la suma es al menos 1, y `log(1) = 0`No hay flujo de bajo .`-inf`Es posible.

Prueba:

```math
\begin{aligned}
& \log\left(\sum_i \exp(x_i)\right) \\
&= \log\left(\sum_i \exp(x_i - c + c)\right) && \text{(add and subtract } c\text{)} \\
&= \log\left(\sum_i \exp(x_i - c) \cdot \exp(c)\right) && (\exp(a+b) = \exp(a) \cdot \exp(b)) \\
&= \log\left(\exp(c) \cdot \sum_i \exp(x_i - c)\right) && \text{(factor out } \exp(c)\text{)} \\
&= c + \log\left(\sum_i \exp(x_i - c)\right) && (\log(a \cdot b) = \log(a) + \log(b))
\end{aligned}
```

Se ha establecido`c = max(x)`y el exceso se elimina.

Este truco aparece en todas partes en ML:
- Normalización de la máxima suave
- Computación de pérdidas de entropía cruzada
- Sumatoria de probabilidades de registro en modelos de secuencias
- Mezcla de gaussianos
- Inferencia por variación

### Por qué Softmax necesita el truco de la soustración máxima

Softmax convierte logits en probabilidades:

```math
\mathop{\mathrm{softmax}}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
```

Sin el truco, los logitos de [100, 101, 102] causan sobreabundancia:

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

2.69e43 > 3.4e38, the float32 maximum, so every term overflows.
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

Con el truco, restar max ((x) = 102:

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

Las probabilidades son idénticas, el cálculo es seguro, no es una optimización, es un requisito para la corrección.

### NaN e Inf: detección y prevención

`nan`(No es un número) y `inf`(infinidad) se propagan viralmente a través de la computación.`nan`en una actualización de gradiente hace el peso `nan`, que produce cada salida posterior `nan`El entrenamiento está muerto en un paso.

¿ Cómo ?`inf`aparece:
- `exp()`de un número positivo grande
- División por cero: `1.0 / 0.0`
- `float32`sobrecarga de acumulaciones

¿ Cómo ?`nan`aparece:
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- `sqrt()`de un número negativo
- `log()`de un número negativo
- Cualquier aritmética que involucre una existente `nan`

Detección:

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

Estrategias de prevención:

1. Entradas de acoplamiento a `exp()`¿ Qué es esto ?`exp(clamp(x, -80, 80))`
2. Añadir epsilon a los denominadores: `x / (y + 1e-8)`
3. Añadir epsilon dentro `log()`¿ Qué es esto ?`log(x + 1e-8)`
4. Utilice implementaciones estables (log-sum-exp, softmax estable)
5. Recorte gradual para evitar una explosión de peso
6. Comprueba si`nan`- ¿ Qué ?`inf`después de cada paso hacia adelante durante la depuración

### Verificación de los gradientes numéricos

Los gradientes analíticos (de la retropropagación) pueden tener errores.

La fórmula de diferencia centrada:

```math
\frac{df}{dx} \approx \frac{f(x + h) - f(x - h)}{2h}
```

Esto es ...$O(h^2)$Es mucho mejor que la diferencia del futuro.$(f(x+h) - f(x)) / h$que es sólo $O(h)$¿ Qué ?

Elegir$h$La respuesta es destructiva si se anula demasiado poco y con una catástrofe.`h = 1e-5`¿ Qué ?`1e-7`Es típico.

El control: calcular la diferencia relativa entre los gradientes analíticos y numéricos.

```math
\text{relative\_error} = \frac{\lvert \text{grad}_{\text{analytical}} - \text{grad}_{\text{numerical}} \rvert}{\max(\lvert \text{grad}_{\text{analytical}} \rvert, \lvert \text{grad}_{\text{numerical}} \rvert, 10^{-8})}
```

Reglas de los pulgares:
- relativo_error < 1e-7: perfecto, el gradiente es correcto
- error relativo < 1e-5: aceptable, probablemente correcto
- relativo_error > 1e-3: algo está mal
- relativo_error > 1: el gradiente está completamente equivocado

Siempre compruebe los gradientes cuando se implementa una nueva capa o función de pérdida. PyTorch proporciona `torch.autograd.gradcheck()`Por esto.

### Formación de precisión mixta

Las GPU modernas tienen hardware especializado (Cores tensores) que computa multiplicidades de matriz float16 2-8 veces más rápido que float32.

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

El problema con el entrenamiento puro de float16: los gradientes son a menudo muy pequeños (1e-8 o más pequeños). Float16 subfluye cualquier cosa por debajo de ~6e-8 a cero.

La solución es la escala de pérdidas:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

La escalación dinámica de pérdidas ajusta automáticamente el factor de escala.`inf`, lo redujeron a la mitad.$N$Pasen los pasos sin sobrecarga, dobla.

### Bfloat16 vs. float16: ¿Por qué bfloat16 gana para el entrenamiento?

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16 tiene una mayor precisión (10 bits de mantissa vs 7) pero un rango limitado (max ~65,504). bfloat16 tiene una menor precisión pero el mismo rango que float32 (max ~3.4e38).

Para la formación de redes neuronales:

- Las activaciones y los logitos superan regularmente los 65.504 durante los picos de entrenamiento.
- La escalación de pérdidas es necesaria con float16 pero generalmente innecesaria con bfloat16 porque su rango cubre el espectro de magnitud de gradiente.
- bfloat16 es una simple truncation de float32: dejar caer los 16 bits más bajos de la mantissa.

bfloat16 es preferido para la inferencia donde los valores están limitados y la precisión es más importante. bfloat16 es preferido para el entrenamiento donde el rango es más importante.

### El recorte gradual

Los gradientes explosivos ocurren cuando los gradientes crecen exponencialmente a través de muchas capas (comúnes en RNNs, redes profundas y transformadores).

Dos tipos de recortes:

**Clip by value:**Enlazar cada elemento de gradiente de forma independiente.

```
grad = clamp(grad, -max_val, max_val)
```

Simple pero puede cambiar la dirección del vector de gradiente.

**Clip by norm:**escalar todo el vector de gradiente para que su norma no exceda un umbral.

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

Preserva la dirección del gradiente.`torch.nn.utils.clip_grad_norm_()`Es la opción estándar.

Valores típicos: `max_norm=1.0`para transformadores, `max_norm=0.5`para RL, `max_norm=5.0`para redes más simples.

El recorte de gradientes no es un hack, es un mecanismo de seguridad.

### Las capas de normalización como estabilizadores numéricos

La normalización de lote, la normalización de capas y la normalización de RMS se presentan generalmente como reguladores que ayudan a la convergencia del entrenamiento.

Sin normalización, las activaciones pueden crecer o contraerse exponencialmente a través de capas:

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

Normalización de los recicladores y las activaciones de recalculación en cada capa:

```math
\mathop{\mathrm{LayerNorm}}(x) = \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x) + \epsilon} \cdot \gamma + \beta
```

El `epsilon`(normalmente 1e-5) evita la división por cero cuando todas las activaciones son idénticas.`gamma`y `beta`Deja que la red restaure cualquier escala que necesite.

Esto mantiene los valores en un rango numéricamente seguro en toda la red, evitando tanto el desbordamiento en el paso hacia adelante como la explosión de gradiente en el paso hacia atrás.

### Los errores numéricos ML comunes

**Bug: Loss is NaN after a few epochs.**
Causa: los logits crecieron demasiado, la suavidad se sobrecargó o la tasa de aprendizaje es demasiado alta y los pesos divergieron.
Corrección: utilizar softmax estable (sustracción máxima), reducir la velocidad de aprendizaje, añadir recorte de gradientes.

**Bug: Loss is stuck at log(num_classes).**
Causa: las salidas del modelo son probabilidades casi uniformes. A menudo significa que los gradientes están desapareciendo o el modelo no está aprendiendo en absoluto.
Corrección: comprobar que las etiquetas de datos son correctas, verificar la función de pérdida, comprobar las RELU muertas.

**Bug: Validation accuracy is lower than expected by 1-3%.**
Causa: precisión mixta sin una escalación adecuada de pérdidas.
Corrección: habilitar la escalación dinámica de pérdidas o cambiar a bfloat16.

**Bug: Gradient norms are 0.0 for some layers.**
Causa: neuronas muertas de ReLU (todas las entradas negativas), o float16 bajo flujo.
Corrección: utilizar LeakyReLU o GELU, usar escala de gradientes, comprobar la inicialización del peso.

**Bug: Model works on one GPU but gives different results on another.**
Causa: orden de acumulación de puntos flotantes no determinista. Las reducciones paralelas de GPU suman en diferentes órdenes en diferentes equipos, y la adición de puntos flotantes no es asociativa.
Corrección: acepta pequeñas diferencias (1e-6), o fija `torch.use_deterministic_algorithms(True)`Y acepta la pena de velocidad.

**Bug: `exp()` returns `inf` in loss computation.**
Causa: los logits crudos pasados a `exp()`Sin el truco de la subtracción máxima.
Corrección: uso `torch.nn.functional.log_softmax()`que implementa log-sum-exp internamente.

**Bug: Training diverges after switching from float32 to float16.**
Causa: float16 no puede representar magnitudes de gradiente por debajo de 6e-8 o activaciones por encima de 65,504.
Corrección: utilizar precisión mixta con escala de pérdida (AMP), o utilizar bfloat16 en su lugar.

```figure
logsumexp-stability
```

## Construye el mismo

### Paso 1: Demostrar los límites de precisión de los puntos flotantes

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### Paso 2: Implementar naivamente versus softmax estable

```python
import math

def softmax_naive(logits):
    exps = [math.exp(z) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

safe_logits = [2.0, 1.0, 0.1]
print(f"Naive:  {softmax_naive(safe_logits)}")
print(f"Stable: {softmax_stable(safe_logits)}")

dangerous_logits = [100.0, 101.0, 102.0]
print(f"Stable: {softmax_stable(dangerous_logits)}")
# softmax_naive(dangerous_logits) would return [nan, nan, nan]
```

### Paso 3: Implementar log-sum-exp estable

```python
def logsumexp_naive(values):
    return math.log(sum(math.exp(v) for v in values))

def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))

safe = [1.0, 2.0, 3.0]
print(f"Naive:  {logsumexp_naive(safe):.6f}")
print(f"Stable: {logsumexp_stable(safe):.6f}")

large = [500.0, 501.0, 502.0]
print(f"Stable: {logsumexp_stable(large):.6f}")
# logsumexp_naive(large) returns inf
```

### Paso 4: Implementar una entropía cruzada estable

```python
def cross_entropy_naive(true_class, logits):
    probs = softmax_naive(logits)
    return -math.log(probs[true_class])

def cross_entropy_stable(true_class, logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = math.log(sum(math.exp(s) for s in shifted))
    log_prob = shifted[true_class] - log_sum_exp
    return -log_prob

logits = [2.0, 5.0, 1.0]
true_class = 1
print(f"Naive:  {cross_entropy_naive(true_class, logits):.6f}")
print(f"Stable: {cross_entropy_stable(true_class, logits):.6f}")
```

### Paso 5: Verificación gradual

```python
def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad

def check_gradient(analytical, numerical, tolerance=1e-5):
    for i, (a, n) in enumerate(zip(analytical, numerical)):
        denom = max(abs(a), abs(n), 1e-8)
        rel_error = abs(a - n) / denom
        status = "OK" if rel_error < tolerance else "FAIL"
        print(f"  param {i}: analytical={a:.8f} numerical={n:.8f} "
              f"rel_error={rel_error:.2e} [{status}]")

def f(params):
    x, y = params
    return x**2 + 3*x*y + y**3

def f_grad(params):
    x, y = params
    return [2*x + 3*y, 3*x + 3*y**2]

point = [2.0, 1.0]
analytical = f_grad(point)
numerical = numerical_gradient(f, point)
check_gradient(analytical, numerical)
```

## Usalo

### Simulación de precisión mixta

```python
import struct

def float32_to_float16_round(x):
    packed = struct.pack('f', x)
    f32 = struct.unpack('f', packed)[0]
    packed16 = struct.pack('e', f32)
    return struct.unpack('e', packed16)[0]

def simulate_bfloat16(x):
    packed = struct.pack('f', x)
    as_int = int.from_bytes(packed, 'little')
    truncated = as_int & 0xFFFF0000
    repacked = truncated.to_bytes(4, 'little')
    return struct.unpack('f', repacked)[0]
```

### Clicado gradual

```python
def clip_by_norm(gradients, max_norm):
    total_norm = math.sqrt(sum(g**2 for g in gradients))
    if total_norm > max_norm:
        scale = max_norm / total_norm
        return [g * scale for g in gradients]
    return gradients

grads = [10.0, 20.0, 30.0]
clipped = clip_by_norm(grads, max_norm=5.0)
print(f"Original norm: {math.sqrt(sum(g**2 for g in grads)):.2f}")
print(f"Clipped norm:  {math.sqrt(sum(g**2 for g in clipped)):.2f}")
print(f"Direction preserved: {[c/clipped[0] for c in clipped]} == {[g/grads[0] for g in grads]}")
```

### Detección de NaN/Inf

```python
def check_tensor(name, values):
    has_nan = any(math.isnan(v) for v in values)
    has_inf = any(math.isinf(v) for v in values)
    if has_nan or has_inf:
        print(f"WARNING {name}: nan={has_nan} inf={has_inf}")
        return False
    return True

check_tensor("good", [1.0, 2.0, 3.0])
check_tensor("bad",  [1.0, float('nan'), 3.0])
check_tensor("ugly", [1.0, float('inf'), 3.0])
```

¿ Qué ?`code/numerical.py`El archivo `code/numerical.ts`es un puerto TypeScript con las mismas funciones y demos.

## Envío

Esta lección produce:
- `code/numerical.py`con softmax estable, log-sum-exp, entropía cruzada, control de gradientes y simulación de precisión mixta
- `outputs/prompt-numerical-debugger.md`para el diagnóstico de la NNA/Inf y de los problemas numéricos en la formación

Estas implementaciones estables reaparecen en la fase 3 cuando se construye el ciclo de formación y en la fase 4 cuando se implementan mecanismos de atención.

## Los ejercicios

1. **Catastrophic cancellation.**Calcule la variación de [1000000.0, 1000001.0, 1000002.0] utilizando la fórmula ingenua $\mathbb{E}[x^2] - \mathbb{E}[x]^2$Luego computa con el algoritmo en línea de Welford. Compara los errores con la varianza verdadera (0.6667).

2. **Precision hunt.**Encuentra el menor valor positivo float32 `x`Es así .`1.0 + x == 1.0`En Python. Esta es la máquina epsilon. Verifique si coincide.`numpy.finfo(numpy.float32).eps`¿ Qué ?

3. **Log-sum-exp edge cases.**Prueba su`logsumexp_stable`Función con: a) todos los valores iguales, b) un valor mucho mayor que los demás, c) todos los valores muy negativos (-1000).

4. **Gradient checking a neural network layer.**Implementar una sola capa lineal `y = Wx + b`y su paso analítico hacia atrás.`numerical_gradient`para verificar la corrección de una matriz de peso 3x2.

5. **Loss scaling experiment.**Simula el entrenamiento con float16: crea gradientes aleatorios en el rango [1e-9, 1e-3], conviértelo en float16, y mide qué fracción se convierte en cero. Luego aplica la escala de pérdida (multiplica por 1024), conviértelo en float16, vuelva a escalar y mísera la fracción cero nuevamente.

### Indicios

**Exercise 1.**Convertir los tres valores con `np.float32`Antes de que los cuadremos, luego llama.`variance_naive`y `welford_variance`Un valor cercano a$10^{12}$en float32 tiene un espacio mucho mayor que 1, así que espera que el resultado ingenuo sea lejos de 0.6667 y el resultado Welford sea cercano.

**Exercise 2.**Comience con`x = np.float32(1.0)`y la reducen a la mitad mientras`np.float32(1.0) + x != np.float32(1.0)`. Mantenga cada valor en float32, luego compare el último valor que todavía cambió la suma con `numpy.finfo(numpy.float32).eps`, que es $2^{-23}$¿ Qué ?

**Exercise 3.**Prevé cada respuesta primero.$n$valores iguales $c$, el resultado es $c + \ln n$Para un valor grande, el resultado es cercano a ese valor.$-1000 + \ln n$, mientras que `logsumexp_naive`retorno `-inf`porque cada exponencial se desciende a 0.

**Exercise 4.**Para$y = Wx + b$con una pérdida $L$, el gradiente para $W$es el producto exterior del gradiente aguas arriba y $x$. Envuelve la pérdida como función de la aplanada $W$, llamando`numerical_gradient`, y pasar ambos resultados a `check_gradient`¿ Qué ?

**Exercise 5.**Muestre las magnitudes en una escala de registro con `10 ** np.random.uniform(-9, -3, n)`y convertirse con `np.float16`. Float16 no puede mantener los valores por debajo de aproximadamente $6 \times 10^{-8}$, así que espera aproximadamente un cuarto de los valores se vuelven cero antes de escalar y casi ninguno después de que se multiplica por 1024.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| IEEE 754 | "The float standard" | International standard defining binary floating point formats, rounding rules, and special values (inf, nan). Every modern CPU and GPU implements it. |
| Machine epsilon | "The precision limit" | The smallest value $e$ such that $1.0 + e \ne 1.0$ in a given float format. For float32, it is about 1.19e-7. |
| Catastrophic cancellation | "Precision loss from subtraction" | When subtracting nearly equal floating point numbers, significant digits cancel and rounding noise dominates the result. |
| Overflow | "Number too big" | A result exceeds the maximum representable value and becomes inf. exp(89) overflows float32. |
| Underflow | "Number too small" | A result is closer to zero than the smallest representable positive number and becomes 0.0. exp(-104) underflows float32. |
| Log-sum-exp trick | "Subtract the max first" | Computing $\log(\sum \exp(x))$ by factoring out $\exp(\max(x))$ to prevent overflow and underflow. Used in softmax, cross-entropy, and log-probability math. |
| Stable softmax | "Softmax that does not explode" | Subtracting $\max(\text{logits})$ before exponentiating. Numerically identical result, no overflow possible. |
| Gradient checking | "Verify your backprop" | Comparing analytical gradients from backpropagation against numerical gradients from finite differences to catch implementation bugs. |
| Mixed precision | "Float16 forward, float32 backward" | Using lower-precision floats for speed-critical operations and higher-precision floats for numerically sensitive operations. Typical speedup is 2-3x. |
| Loss scaling | "Prevent gradient underflow" | Multiplying the loss by a large constant before backprop so gradients stay in float16's representable range, then dividing by the same constant before weight updates. |
| bfloat16 | "Brain floating point" | Google's 16-bit format with 8 exponent bits (same range as float32) and 7 mantissa bits (less precision than float16). Preferred for training. |
| Gradient clipping | "Cap the gradient norm" | Scaling the gradient vector so its norm does not exceed a threshold. Prevents exploding gradients from ruining weights. |
| NaN | "Not a Number" | Special float value from undefined operations (0/0, inf-inf, sqrt(-1)). Propagates through all subsequent arithmetic. |
| Inf | "Infinity" | Special float value from overflow or division by zero. Can combine to produce NaN (inf - inf, inf * 0). |
| Numerical gradient | "Brute force derivative" | Approximating a derivative by evaluating $f(x+h)$ and $f(x-h)$ and dividing by $2h$. Slow but reliable for verification. |

## Leer más

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)-- la referencia definitiva, densa pero completa
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740)-- el documento de NVIDIA que introdujo la escala de pérdidas para el entrenamiento float16
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html)-- Guía práctica de precisión mixta en PyTorch
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16)-- por qué Google eligió este formato para TPU
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm)-- algoritmo para reducir el error de redondeo en las sumas de puntos flotantes
