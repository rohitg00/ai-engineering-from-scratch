# Métodos de muestreo

> La muestreo es la forma en que la IA explora el espacio de posibilidades.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Implementar muestreo inverso de CDF, rechazo e importancia desde cero utilizando solo números aleatorios uniformes
- Construir muestreo de temperatura, top-k y top-p (núcleo) para la generación de tokens de modelos de lenguaje
- Explica el truco de reparameterización y por qué permite la retropropagación mediante muestreo en VAEs
- ejecuta el MCMC de Metropolis-Hastings para tomar muestras de una distribución objetivo no normalizada

## El problema

Un modelo de lenguaje termina de procesar su solicitud y produce un vector de 50.000 logitos, uno para cada token en su vocabulario. Ahora tiene que elegir uno. ¿Cómo?

Si siempre elige el token de mayor probabilidad, cada respuesta es idéntica. Determinista. Aburrida. Si elige uniformemente al azar, la salida es vagañosa. La respuesta vive en algún lugar entre estos extremos, y que en algún lugar está controlada por muestreo.

La toma de muestras no se limita a la generación de textos. El aprendizaje de refuerzo estima los gradientes de las políticas mediante trayectorias de muestreo. Los VAEs aprenden representaciones latentes tomando muestras de las distribuciones aprendidas y propagándose hacia atrás a través de la aleatoriedad. Los modelos de difusión generan imágenes mediante muestreo de ruido y denociación iterativa. Los métodos de Monte Carlo estiman integrales que no tienen solución de forma cerrada. Los algoritmos MCMC exploran distribuciones posteriores de alta dimensión que son imposibles de enumerar.

Cada sistema de IA generativo es un sistema de muestreo. La estrategia de muestreo determina la calidad, diversidad y controlabilidad de la salida. Esta lección construye todos los métodos principales de muestreo desde cero, comenzando con números aleatorios uniformes y terminando con las técnicas que impulsan los LLM y modelos generativos modernos.

## El concepto

### Por qué es importante tomar muestras

La muestreo aparece en cuatro roles fundamentales en IA y aprendizaje automático:

**Generation.**Los modelos de lenguaje, modelos de difusión y GAN producen resultados mediante muestreo. El algoritmo de muestreo controla directamente la creatividad, la coherencia y la diversidad. La temperatura, la top-k y el muestreo de núcleo son los botones que los ingenieros hacen diariamente.

**Training.**Muestras de descenso de gradiente estocástico mini-partidos. Muestras de descenso de neuronas para desactivar. Muestras de aumento de datos muestran transformaciones aleatorias. Muestras de importancia reponderan muestras para reducir la variación de gradiente en el aprendizaje de refuerzo (PPO, TRPO).

**Estimation.**Muchas cantidades en ML no tienen solución de forma cerrada. La pérdida esperada sobre una distribución de datos, la función de partición de un modelo basado en energía, la evidencia en la inferencia bayesiana. La estimación de Monte Carlo aproxima todas estas cosas mediante una media sobre muestras.

**Exploration.**Los algoritmos MCMC exploran las distribuciones posteriores en la inferencia bayesiana.

El reto principal: sólo se puede tomar muestras directamente de distribuciones simples (uniforme, normal).

### Muestreo aleatorio uniforme

Cada método de muestreo comienza aquí. Un generador de números aleatorios uniforme produce valores en$[0, 1)$donde cada subintervalo de igual longitud tiene igual probabilidad.

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

Para tomar muestras uniformes de un conjunto discreto de $n$los artículos, generar $U$y regresar .$\lfloor n U \rfloor$. Para muestras de un rango continuo $[a, b]$, computación $a + (b - a) U$¿ Qué ?

La clave: un solo número aleatorio uniforme contiene exactamente la cantidad adecuada de aleatoriedad para producir una muestra de cualquier distribución.

### Método inverso de CDF (muestreo de transformación inversa)

La función de distribución acumulada (CDF) asigna los valores a probabilidades:

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

El CDF inverso hace mapas de probabilidades de vuelta a valores.$U \sim \text{Uniform}(0, 1)$, entonces$X = F^{-1}(U)$se sigue a la distribución objetivo.

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**Exponential distribution example:**

```
PDF: f(x) = lambda * exp(-lambda * x),   x >= 0
CDF: F(x) = 1 - exp(-lambda * x)

Solve F(x) = u for x:
  u = 1 - exp(-lambda * x)
  exp(-lambda * x) = 1 - u
  x = -ln(1 - u) / lambda

Since (1 - U) and U have the same distribution:
  x = -ln(u) / lambda
```

Esto funciona perfectamente cuando puedes escribir .$F^{-1}$Para la distribución normal, no hay CDF inverso de forma cerrada, por lo que usamos otros métodos (Box-Muller, o aproximación numérica).

**Discrete version:**Para las distribuciones discretas, construye el CDF como una suma acumulada, genera $U$, y encontrar el primer índice donde la suma acumulada exceda $U$Así es como ...`sample_categorical`trabaja en la Lección 06.

### Muestras de rechazo

Cuando no se puede invertir el CDF pero puede evaluar el PDF objetivo hasta una constante, el muestreo de rechazo funciona.

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = Z/M, where Z is the integral of p(x)
                (Z = 1, so the rate is 1/M, when p is normalized)
```

Cuanto más estrecha sea la línea$M$En las dimensiones bajas (1-3), el muestreo de rechazo funciona bien. En las dimensiones altas, la tasa de aceptación disminuye exponencialmente porque la mayor parte del volumen de la propuesta es rechazada. Esta es la maldición de dimensionalidad para el muestreo de rechazo.

**Example: sampling from a truncated normal.**Utilice una propuesta uniforme en el rango reducido.$M$es el máximo del PDF normal en ese rango.

**Example: sampling from a semicircle.**Propón uniformemente en el rectángulo de borde. Aceptar si el punto cae dentro del semicírculo. Así es como calcula Monte Carlo.$\pi$: la tasa de aceptación es igual a la proporción de superficie $\pi/4$¿ Qué ?

### Muestreo de importancia

A veces no se necesitan muestras de la distribución objetivo $p(x)$Necesitas estimar una expectativa bajo$p(x)$, y tienes muestras de una distribución diferente .$q(x)$¿ Qué ?

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

En PPO (Proportion Optimization) se recopilan trayectorias bajo una vieja política.$\pi_{\text{old}}$Pero quieren optimizar una nueva política $\pi_{\text{new}}$. La importancia del peso es $\pi_{\text{new}}(a \mid s) / \pi_{\text{old}}(a \mid s)$La PPO recorta estos pesos para evitar que la nueva política se desvíe demasiado de la antigua.

La variación del estimador de la muestreo de importancia depende de la similitud $q$¿ Qué es ?$p$Si ...$q$es muy diferente de $p$La normalización de la importancia de la muestra se divide por la suma de los pesos para reducir este problema:

```math
\mathbb{E}_p[f(x)] \approx \frac{\sum_i w_i \, f(x_i)}{\sum_i w_i}
```

### Estimación de Monte Carlo

La estimación de Monte Carlo aproxima las integrales mediante la media de muestras aleatorias.

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

La tasa de error es independiente de las dimensiones, por lo que los métodos de Monte Carlo dominan en dimensiones altas donde la integración basada en la red es imposible.

**Estimating pi:**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**Estimating expectations:**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### La cadena Markov Monte Carlo (MCMC): Metrópolis-Hastings

MCMC construye una cadena de Markov cuya distribución estacionaria es la distribución objetivo $p(x)$. Después de suficientes pasos, las muestras de la cadena son (aproximadamente) muestras de $p(x)$¿ Qué ?

```
Target: p(x)  (known up to a normalizing constant)
Proposal: q(x'|x)  (how to propose the next state given the current state)

Metropolis-Hastings algorithm:
  1. Start at some x_0
  2. For t = 1, 2, ..., T:
     a. Propose x' ~ q(x'|x_t)
     b. Compute acceptance ratio:
        alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
     c. Accept with probability min(1, alpha):
        - If u < alpha (u ~ Uniform(0,1)): x_{t+1} = x'
        - Otherwise: x_{t+1} = x_t
  3. Discard first B samples (burn-in)
  4. Return remaining samples
```

Para propuestas simétricas $(q(x' \mid x) = q(x \mid x'))$, la relación se simplifica a $p(x')/p(x)$Este es el algoritmo original de Metropolis.

**Why it works.**La regla de aceptación garantiza el equilibrio detallado: la probabilidad de estar en $x$y se mueve a$x'$es igual a la probabilidad de estar en $x'$y se mueve a$x$. El equilibrio detallado implica que$p(x)$es la distribución estacionaria de la cadena.

**Practical considerations:**
- Incendio: descartar las muestras tempranas antes de que la cadena alcance el equilibrio
- El adelgazamiento: mantenga cada uno$k$- la muestra para reducir la autocorrelación
- Escala de las propuestas: demasiado pequeña y la cadena se mueve lentamente (alta aceptación, lenta exploración); demasiado grande y la mayoría de las propuestas son rechazadas (baja aceptación, en su lugar)
- La tasa óptima de aceptación de una propuesta gaussiana en grandes dimensiones es de aproximadamente 0,234

### Muestras de Gibbs

El muestreo de Gibbs es un caso especial de MCMC para distribuciones multivariadas. En lugar de proponer un movimiento en todas las dimensiones a la vez, actualiza una variable a la vez de su distribución condicional.

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

La muestreo de Gibbs requiere que puedas muestrar de cada distribución condicional .$p(x_i \mid x_{-i})$Esto es sencillo para muchos modelos:
- Redes bayesianas: los condicionals siguen de la estructura del gráfico
- Mezclas gaussianas: los condicionantes son gaussianas
- Modelos de aislamiento: la condicional de cada giro depende sólo de sus vecinos

La tasa de aceptación es siempre de 1 (se acepta cada propuesta) porque la muestreo de la condición exacta satisface automáticamente el equilibrio detallado.

**Limitation.**Cuando las variables están altamente correlacionadas, la muestreo de Gibbs se mezcla lentamente porque actualizar una variable a la vez no puede hacer grandes movimientos diagonales a través de la distribución.

### Muestreo de temperatura (utilizado en LLM)

Modelos de lenguaje logs de salida $z_1, \ldots, z_V$Softmax convierte estas en probabilidades.

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**Why it works.**Dividiendo los logits por $T < 1$La diferencia entre los logitos se amplifica.$z_1 = 2$y $z_2 = 1$, dividido por $T = 0.5$da .$z_1/T = 4$y $z_2/T = 2$Después de softmax, el token de mayor logit obtiene una participación mucho mayor.

**In practice:**
- $T = 0.0$: codificación codificada, mejor para preguntas y respuestas de hecho
- $T = 0.3\text{-}0.7$: ligeramente creativo, bueno para la generación de código
- $T = 0.7\text{-}1.0$: equilibrado, bueno para la conversación general
- $T = 1.0\text{-}1.5$: escritura creativa, lluvia de ideas
- $T > 1.5$: cada vez más aleatorios, raramente útiles

La temperatura no cambia qué tokens son posibles, sino la masa de probabilidad asignada a cada token.

### Muestreo de la parte superior

El muestreo de top-k restringe el candidato establecido a la $k$los tokens con las mayores probabilidades, luego renormaliza y muestra de ese conjunto restringido.

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Keep only the top k tokens
  4. Renormalize: p_i' = p_i / sum(p_j for j in top-k)
  5. Sample from the renormalized distribution

k = 1:  greedy decoding
k = V:  no filtering (standard sampling)
k = 40: typical setting, removes long tail of unlikely tokens
```

Top-k impide que el modelo seleccione fichas extremadamente improbables (tipo, tontería) que existen en la larga cola de la distribución del vocabulario.$k$Cuando el modelo es seguro (un token tiene una probabilidad del 95%), $k = 40$Si el modelo es incierto (la probabilidad se distribuye entre 1000 tokens), $k = 40$Se corta las opciones plausibles.

### Muestreo de la parte superior (núcleo)

El muestreo top-p ajusta dinámicamente el tamaño del conjunto candidato. En lugar de mantener un número fijo de tokens, se guarda el conjunto más pequeño de tokens cuya probabilidad acumulada excede $p$¿ Qué ?

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Find smallest k such that sum of top-k probabilities >= p
  4. Keep only those k tokens
  5. Renormalize and sample

p = 0.9:  keeps tokens covering 90% of probability mass
p = 1.0:  no filtering
p = 0.1:  very restrictive, nearly greedy
```

Cuando el modelo es seguro, la muestreo de núcleo mantiene pocos tokens (tal vez 2-3). Cuando el modelo es incierto, mantiene muchos (tal vez 200). Este comportamiento adaptativo es por lo que la muestreo de núcleo generalmente produce un texto mejor que el top-k.

**Common combinations:**
- Temperatura 0,7 + p superior 0,9: buena configuración de uso general
- Temperatura 0.0 (compulsiva): mejor para tareas deterministas
- Temperatura 1.0 + top-k 50: Fan et al. (2018) configuración original de papel

Se pueden combinar top-k y top-p. Aplique top-k primero, luego top-p en el conjunto restante.

### Tricuación de reparameterización (utilizada en VAEs)

Los autoencodadores variacionales (VAE) aprenden codificando entradas en una distribución en espacio latente, tomando muestras de esa distribución y descifrando la muestra de nuevo.

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

El truco de reparameterización separa la aleatoriedad de los parámetros:

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

Esto funciona porque$\mathcal{N}(\mu, \sigma^2)$tiene la misma distribución que $\mu + \sigma \cdot \mathcal{N}(0, 1)$. La clave: mover la aleatoriedad a una fuente libre de parámetros ($\epsilon$), luego expresar la muestra como una transformación diferenciable de los parámetros.

**In the VAE training loop:**
1. Fuentes de codificación $\mu$y $\log(\sigma^2)$para cada entrada
2. Muestra $\epsilon \sim \mathcal{N}(0, 1)$
3. Computación$z = \mu + \sigma \epsilon$
4. Descifrar$z$para reconstruir la entrada
5. Propagación hacia atrás a través de los pasos 4, 3, 2, 1 (posible porque el paso 3 es diferenciable)

Sin el truco de reparameterización, las VAEs no pueden ser entrenadas con la retropropagación estándar.

### Gumbel-Softmax (Muestreo categórico diferenciable)

El truco de reparameterización funciona para distribuciones continuas (Gaussian). Para distribuciones categoricas discretas, necesitamos un enfoque diferente. Gumbel-Softmax proporciona una aproximación diferenciable a la muestreo categórico.

**The Gumbel-Max trick (non-differentiable):**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax (differentiable approximation):**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax produce una relajación continua de una muestra discreta. La salida es un vector de probabilidad (blando un-hot) en lugar de un duro un-hot. Los gradientes fluyen a través del softmax. Durante el pase hacia adelante en el entrenamiento, se puede usar el estimador "directo a través": utilizar el argmax duro para el pase hacia adelante pero los gradientes blandos de Gumbel-Softmax para el pase hacia atrás.

**Applications:**
- Variables latentes discretas en las VAEs
- Buscar arquitectura neuronal (escoler operaciones discretas)
- Mecanismos de atención dura
- Aprendizaje reforzado con acciones discretas

### Muestreo estratificado

El muestreo estándar de Monte Carlo puede dejar vacíos en el espacio de muestreo por casualidad.

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

El muestreo estratificado siempre tiene una variación inferior o igual en comparación con el Monte Carlo estándar:

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**Applications:**
- Integración numérica (quasi-Monte Carlo)
- División de datos de formación (segurando el equilibrio de clases en cada pliegue)
- Muestreo de importancia con estratificación (combinación de ambas técnicas)
- NeRF (Neural Radiance Fields) utiliza muestreo estratificado a lo largo de los rayos de la cámara

### Conexión a modelos de difusión

Los modelos de difusión generan imágenes a través de un proceso de muestreo.$T$El proceso inverso aprende a denogar, recuperando la imagen original paso a paso.

```
Forward process (known):
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon
  where epsilon ~ N(0, I)

  After T steps: x_T ~ N(0, I)  (pure noise)

Reverse process (learned):
  x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (1 - alpha_t)/sqrt(1 - alpha_bar_t) * epsilon_theta(x_t, t)) + sigma_t * z
  where z ~ N(0, I)

  Each denoising step is a sampling step.
```

La conexión con los métodos en esta lección:
- Cada paso de desinfección utiliza el truco de reparameterización (ruido de muestra, aplicar la transformación determinista)
- El horario de ruido$\lbrace \alpha_t \rbrace$controla una forma de anulación de temperatura
- El entrenamiento utiliza la estimación de Monte Carlo para aproximar el ELBO (evidencia límite inferior)
- El muestreo ancestral en modelos de difusión es una cadena de Markov (cada paso depende solo del estado actual)

Todo el proceso de generación de imágenes es muestreo iterativo: comience desde el ruido y, en cada paso, muestre una versión ligeramente menos ruidosa condicionada al modelo de denotación aprendido.

```figure
monte-carlo-pi
```

## Construye el mismo

### Paso 1: Muestreo uniforme y inverso de CDF

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

Generar 10.000 muestras exponenciales y verificar la media es $1/\lambda$¿ Qué ?

### Paso 2: Muestreo de rechazo

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

Utilice muestras de rechazo para extraer de una distribución normal truncada.

### Paso 3: Muestreo de importancia

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

Estimación $\mathbb{E}[X^2]$En el caso de las empresas de la Unión Europea, el valor de la ayuda es el valor de la ayuda.$\mu^2 + \sigma^2$¿Qué es lo que se hace?

### Paso 4: Estimación de Monte Carlo de pi

```python
def monte_carlo_pi(n):
    inside = 0
    for _ in range(n):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        if x*x + y*y <= 1:
            inside += 1
    return 4 * inside / n
```

### Paso 5: MCMC de Metropolis-Hastings

```python
def metropolis_hastings(target_log_pdf, proposal_sample, proposal_log_pdf, x0, n_samples, burn_in):
    samples = []
    x = x0
    for i in range(n_samples + burn_in):
        x_new = proposal_sample(x)
        log_alpha = (target_log_pdf(x_new) + proposal_log_pdf(x, x_new)
                     - target_log_pdf(x) - proposal_log_pdf(x_new, x))
        if math.log(random.random()) < log_alpha:
            x = x_new
        if i >= burn_in:
            samples.append(x)
    return samples
```

Muestra de una distribución bimodal (mezcla de dos Gaussianos). Visualiza la trayectoria de la cadena.

### Paso 6: Muestreo de Gibbs

```python
def gibbs_sampling_2d(conditional_x_given_y, conditional_y_given_x, x0, y0, n_samples, burn_in):
    x, y = x0, y0
    samples = []
    for i in range(n_samples + burn_in):
        x = conditional_x_given_y(y)
        y = conditional_y_given_x(x)
        if i >= burn_in:
            samples.append((x, y))
    return samples
```

### Paso 7: Muestreo de temperatura

```python
def softmax(logits):
    max_l = max(logits)
    exps = [math.exp(z - max_l) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def temperature_sample(logits, temperature):
    scaled = [z / temperature for z in logits]
    probs = softmax(scaled)
    return sample_from_probs(probs)
```

Muestre cómo la temperatura cambia la distribución de salida para un conjunto de logits de token.

### Paso 8: Muestreo de la parte superior y de la parte superior

```python
def top_k_sample(logits, k):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    top = indexed[:k]
    top_logits = [l for _, l in top]
    probs = softmax(top_logits)
    idx = sample_from_probs(probs)
    return top[idx][0]

def top_p_sample(logits, p):
    probs = softmax(logits)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cumsum = 0
    selected = []
    for token_idx, prob in indexed:
        cumsum += prob
        selected.append((token_idx, prob))
        if cumsum >= p:
            break
    sel_probs = [pr for _, pr in selected]
    total = sum(sel_probs)
    sel_probs = [pr / total for pr in sel_probs]
    idx = sample_from_probs(sel_probs)
    return selected[idx][0]
```

### Paso 9: Truco de reparameterización

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

Demostrar que los gradientes fluyen a través de la muestra reparametrizada pero no a través de la muestreo directa.

### Paso 10: Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

Muestre cómo la disminución de la temperatura hace que la salida se acerque a un vector de un solo calor.

Las implementaciones completas con todas las visualizaciones están en `code/sampling.py`¿ Qué ?

El puerto de TypeScript está en `code/sampling.ts`Utiliza su propio generador aleatorio semillado, por lo que sus números aleatorios difieren de la salida de Python.

## Usalo

Con NumPy y SciPy, las versiones de producción:

```python
import numpy as np

rng = np.random.default_rng(42)

exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")

from scipy import stats
normal = stats.norm(loc=0, scale=1)
print(f"CDF at 1.96: {normal.cdf(1.96):.4f}")
print(f"Inverse CDF at 0.975: {normal.ppf(0.975):.4f}")

logits = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
temperature = 0.7
scaled = logits / temperature
probs = np.exp(scaled - scaled.max()) / np.exp(scaled - scaled.max()).sum()
token = rng.choice(len(logits), p=probs)
print(f"Sampled token index: {token}")
```

Para el MCMC a escala, utilice bibliotecas dedicadas:
- PyMC: modelado bayesiano completo con NUTS (HMC adaptativo)
- Emcee: ensamblador de muestras MCMC
- NumPyro/JAX: MCMC acelerado por GPU

Construiste esto desde cero, ahora sabes lo que hacen las llamadas de la biblioteca.

## Los ejercicios

1. Implemente muestreo inverso de CDF para la distribución de Cauchy.$F(x) = 0.5 + \arctan(x)/\pi$. Generar 10.000 muestras y trazar el histograma contra el PDF real. Observe las colas pesadas (valores extremos lejos del centro).

2. Utilice el muestreo de rechazo para generar muestras de una distribución Beta(2, 5) utilizando una propuesta Uniform(0, 1).

3. Estima la integral de $\sin(x)$de 0 a $\pi$Con el uso de Monte Carlo con 1.000, 10.000 y 100.000 muestras. Comparar el error en cada nivel.$O(1/\sqrt{N})$¿ Qué ?

4. Implementar Metropolis-Hastings para muestrar de una distribución 2D $p(x, y)$proporcional a $\exp(-(x^2 y^2 + x^2 + y^2 - 8x - 8y) / 2)$- Desarrollar las muestras y la trayectoria de la cadena.

5. Construir una demostración completa de generación de texto: dado un vocabulario de 10 palabras con logits, generar secuencias de 20 tokens utilizando (a) codicioso, (b) temperatura = 0,7, (c) top-k = 3, (d) top-p = 0,9. Comparar la diversidad de las salidas en 5 carreras.

### Indicios

**Exercise 1.**Resolver$u = F(x)$por$x$, que da$x = \tan(\pi(u - 0.5))$. Compruebe que la mediana de la muestra está cerca de 0 y que alrededor del 6% de las muestras tienen$\lvert x \rvert > 10$, que es $1 - (2/\pi)\arctan(10)$¿ Qué ?

**Exercise 2.**La densidad Beta ((2, 5) es $30x(1-x)^4$. Encuentra su valor más grande en el modo $x = 1/5$y utilizar ese valor como $M$En el`rejection_sample`. La tasa de aceptación teórica es $1/M$, así que compártala con la fracción de propuestas que aceptas.

**Exercise 3.**El valor exacto es 2. Llame.`monte_carlo_integral(math.sin, 0, math.pi, n)`por cada uno $n$y repite cada carrera con varias semillas.$n$crece en un factor de 10, el error promedio debe caer en aproximadamente $\sqrt{10} \approx 3.2$¿ Qué ?

**Exercise 4.**Escriba el registro del objetivo, que es $-(x^2 y^2 + x^2 + y^2 - 8x - 8y)/2$, y pasarlo a `metropolis_hastings_2d`. Registrar la tasa de aceptación de cada propuesta de desviación estándar: un valor muy pequeño acepta casi todos los pasos pero se mueve lentamente, y un valor muy grande rechaza casi todos los pasos.

**Exercise 5.**La codificación codificada toma el índice de la logit más grande en cada paso.`temperature_sample`¿ Qué ?`top_k_sample`, y `top_p_sample`El codicioso debe dar la misma secuencia en las 5 carreras, así que cuenta las secuencias distintas para cada método para medir la diversidad.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Sampling | "Drawing random values" | Generating values according to a probability distribution. The mechanism behind all generative AI |
| Uniform distribution | "All equally likely" | Every value in $[a, b]$ has equal probability density $1/(b-a)$. The starting point for all sampling methods |
| Inverse CDF | "Probability transform" | $F^{-1}(U)$ converts a uniform sample into a sample from any distribution with known CDF. Exact and efficient |
| Rejection sampling | "Propose and accept/reject" | Generate from a simple proposal, accept with probability proportional to target/proposal ratio. Exact but wastes samples |
| Importance sampling | "Reweight samples" | Estimate expectations under $p(x)$ using samples from $q(x)$ by weighting each sample by $p(x)/q(x)$. Core to PPO in RL |
| Monte Carlo | "Average random samples" | Approximate integrals as sample averages. Error $O(1/\sqrt{N})$ regardless of dimension |
| MCMC | "Random walk that converges" | Construct a Markov chain whose stationary distribution is the target. Metropolis-Hastings is the foundational algorithm |
| Metropolis-Hastings | "Accept uphill, sometimes downhill" | Propose moves, accept based on density ratio. Detailed balance ensures convergence to target distribution |
| Gibbs sampling | "One variable at a time" | Update each variable from its conditional distribution holding others fixed. 100% acceptance rate |
| Temperature | "Confidence knob" | Divides logits by $T$ before softmax. $T<1$ sharpens (more confident), $T>1$ flattens (more diverse) |
| Top-k sampling | "Keep the k best" | Zero out all but the $k$ highest-probability tokens, renormalize, sample. Fixed candidate set size |
| Nucleus sampling (top-p) | "Keep the probable ones" | Keep the smallest set of tokens whose cumulative probability exceeds $p$. Adaptive candidate set size |
| Reparameterization trick | "Move randomness outside" | Write $z = \mu + \sigma \epsilon$ where $\epsilon \sim \mathcal{N}(0,1)$. Makes sampling differentiable. Essential for VAE training |
| Gumbel-Softmax | "Soft categorical sampling" | Differentiable approximation to categorical sampling using Gumbel noise + softmax with temperature |
| Stratified sampling | "Forced coverage" | Divide sample space into strata, sample from each. Always lower variance than naive Monte Carlo |
| Burn-in | "Warm-up period" | Initial MCMC samples discarded before the chain reaches its stationary distribution |
| Detailed balance | "Reversibility condition" | $p(x) T(x \to y) = p(y) T(y \to x)$. Sufficient condition for $p$ to be the stationary distribution of a Markov chain |
| Diffusion sampling | "Iterative denoising" | Generate data by starting from noise and applying learned denoising steps. Each step is a conditional sampling operation |

## Leer más

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010)- un tutorial detallado sobre los fundamentos del MCMC
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144)- papel original Gumbel-Softmax
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)- papel de muestreo de núcleo (top-p)
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)- Papel de la AEV que introduce el truco de reparameterización
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)- DDPM conecta el muestreo a la generación de imágenes
