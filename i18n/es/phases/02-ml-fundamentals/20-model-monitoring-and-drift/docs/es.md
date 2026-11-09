# Modelos de seguimiento en la producción  Drift de datos y Drift de conceptos

> Un modelo implementado falla sin un mensaje de error. Continúa devolviendo puntajes mientras el mundo se aleja de sus datos de entrenamiento, y solo el monitoreo muestra la brecha.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## Objetivos de aprendizaje

- Elige señales de monitoreo en cuatro capas: salud del sistema, entradas, predicciones y resultados
- Distinguir la deriva de covariado, la deriva previa y la deriva conceptual por la parte de la distribución conjunta que cambia
- Implementar el Índice de Estabilidad de la Población, la estadística de dos muestras Kolmogorov-Smirnov y la prueba del cuadrado de chi desde cero
- Comparar una ventana de referencia fija con ventanas corrientes deslizantes, y explicar cómo el tamaño de la ventana cambia el ruido y el retraso
- Diseñar una política de alerta que limite las falsas alarmas con tamaños de efecto, una corrección de pruebas múltiples y una regla de persistencia
- Decidir qué tipo de deriva necesita reentrenamiento, qué necesita nuevas etiquetas y qué no necesita acción

## El problema

Un modelo de riesgo de pago se convierte en un 95% de precisión. Dos meses después, una campaña de marketing atrae a usuarios de aplicaciones con cestas más grandes. Cuatro meses después, los estafadores cambian sus tácticas, y los pagos que antes eran seguros comienzan a convertirse en devoluciones de cargos.

El servicio modelo devuelve HTTP 200 para cada solicitud durante todo esto. La latencia es normal, y los registros no muestran errores. La primera señal de problemas es un informe financiero sobre devoluciones de cargas, semanas después del daño.

El monitoreo de software verifica si un servicio responde. El monitoreo de modelo verifica si las respuestas siguen siendo correctas y si los datos siguen pareciendo a los datos que entrenaron al modelo. Esta lección construye las estadísticas, las ventanas y la política de alerta para ese segundo trabajo. Los ejecutas en un flujo sintético con dos cambios inyectados y observa qué monitor reacciona a qué cambio.

## El concepto

### Qué controlar

Los primeros tres dan advertencias tempranas, sólo el cuarto mide la corrección y llega tarde.

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

El monitoreo de entradas es el tema principal de esta lección, ya que funciona antes de que lleguen las etiquetas. Tiene un límite que muestra la demostración: algunos cambios dejan las entradas intactas.

### Tres tipos de deriva

Escriba la distribución conjunta de los insumos `x`y etiquetas `y`de dos maneras:

```math
P(x, y) = P(x) \cdot P(y \mid x) = P(y) \cdot P(x \mid y)
```

Cada tipo de deriva cambia un factor diferente:

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

Gama et al. llamen a un cambio en `P(y | x)`El cambio de concepto real se llama cambio en el`P(x)`que deja`P(y | x)`Su encuesta también clasifica la deriva por cómo sucede con el tiempo: repentina, incremental, gradual, o como un concepto que regresa.

La deriva covariada no siempre hace daño.`P(y | x)`Bueno, se mantiene correcto para cada entrada. Aún puede perder precisión cuando el tráfico se mueve a regiones con pocos datos de entrenamiento o cerca del límite de decisión.

### Etiquetas retrasadas

El resultado llega después de la predicción.

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

Durante el retraso, tienes entradas y predicciones pero no resultados. Monitorear las entradas y predicciones, unirse a las etiquetas cuando lleguen y calcular métricas de resultado solo en la parte etiquetada. La demostración utiliza un retraso de etiqueta de 500 eventos, por lo que el monitor de resultados siempre mira 500 eventos en el pasado.

### Ventanas de referencia y corriente

Cada prueba de deriva compara dos muestras:

- **Reference window.**Los datos de entrenamiento o un período de producción que comprobaste a mano se mantiene fijo hasta que vuelvas a entrenar.
- **Current window.**Los acontecimientos más recientes, o los últimos `N`eventos o los últimos `T`- ¿Qué? - Las horas.

Una ventana deslizante se mueve hacia adelante un paso más pequeño que su tamaño, por lo que las ventanas consecutivas se superponen. Una ventana caída se mueve por su tamaño completo. El tamaño de la ventana es un trade-off. Una ventana pequeña reacciona rápidamente, pero califica el ruido como deriva. Una ventana grande es estable, pero informa de un cambio tarde.

La estacionalidad rompe ventanas ingenuas. El tráfico del lunes difiere del tráfico del sábado en muchos productos. Haga que la referencia cubra un ciclo completo, o compare cada ventana con el mismo período en un ciclo anterior.

### Indice de estabilidad de la población

El PSI proviene de la calificación de crédito. Cortar los valores de referencia en contenedores, generalmente diez contenedores en los déciles de referencia, de modo que cada contenedor tenga el 10 por ciento de la referencia. Cuente la proporción de valores actuales en cada contenedor. Luego suma un término por contenedor:

```math
\text{PSI} = \sum_{\text{bins}} (\text{current\_share} - \text{reference\_share}) \cdot \ln\left(\frac{\text{current\_share}}{\text{reference\_share}}\right)
```

Un bin con una cuota de cero hace que el registro sea infinito, por lo que se puede cortar cada cuota a un pequeño valor como 0.0001. PSI es simétrico. Es igual a la divergencia KL de la corriente a la referencia más la divergencia KL de la referencia a la corriente.

Los practicantes leen PSI con bandas fijas: por debajo de 0.1 es estable, 0.1 a 0.25 es un cambio moderado, y por encima de 0.25 es un cambio significativo. Trate estas bandas como una convención, no una prueba. PSI crece con el número de contenedores y se reduce con el tamaño de la muestra. En la demostración, las ventanas de 500 eventos sin puntaje de deriva entre 0.01 y 0.04.

### Estadísticas de Kolmogorov-Smirnov

La estadística de KS de dos muestras `D`es la mayor brecha vertical entre las dos funciones de distribución acumulada empírica:

```math
D = \max_x \left\lvert F_{\text{reference}}(x) - F_{\text{current}}(x) \right\rvert
```

`D`El valor p proviene de la distribución de Kolmogorov con el tamaño de muestra efectivo `n * m / (n + m)`¿ Qué ?

En las muestras grandes, el valor de p se reduce a cero para una brecha que a nadie le importa. Un cambio de desviaciones estándar de 0.02 es "significante" con un millón de eventos por ventana.`D`la misma como un tamaño de efecto, y alerta sólo cuando ambos `D`y el valor p pasa sus umbrales.

### Prueba en cuadrado de chi para características categoricas

Para una característica categórica, como el canal de pago, construye una tabla con dos filas (referencia, corriente) y una columna por categoría.

```math
\begin{aligned}
\text{expected}[r][c] &= \text{row\_total}[r] \cdot \text{column\_total}[c] / \text{grand\_total} \\
\text{chi2} &= \sum_{\text{cells}} (\text{observed} - \text{expected})^2 / \text{expected}
\end{aligned}
```

El examen tiene`k - 1`Grados de libertad para `k`Categorías. Una categoría que aparece sólo en la ventana actual agrega un término grande, por lo que la prueba reacciona a nuevos valores. V de Cramér es el tamaño del efecto. Para una tabla con dos filas, es igual a la raíz cuadrada de `chi2 / grand_total`¿ Qué ?

### Los límites de alerta y las falsas alarmas

Cada prueba tiene una tasa de alarma falsa .`alpha`El monitoreo realiza muchas pruebas con 50 características revisadas cada hora en el`alpha = 0.05`La gente deja de leer las alertas mucho antes de eso.

Cuatro reglas mantienen la tasa de alerta útil:

1. **Correct for multiple tests.**La corrección de Bonferroni divide `alpha`La demostración utiliza una familia.`alpha`de 0,01 en dos ensayos, por lo que cada ensayo utiliza 0,005.
2. **Require an effect size.**Alerta sólo cuando el PSI,`D`, o el V de Cramér también pasa un umbral.
3. **Require persistence.**Alerta sólo después de`k`Las ventanas de deriva consecutivas.`k = 2`¿ Qué ?
4. **Separate warnings from alerts.**Una advertencia va a un panel de control.

La demostración muestra la regla 2 en funcionamiento. Una ventana limpia tiene un valor p-cuadrado de 0.0009, por debajo de la prueba.`alpha`Su V de Cramér está por debajo de 0.1, así que la póliza registra una advertencia, no una alerta.

### Trigadores de la reentrenamiento

Hay tres factores comunes que provocan la reeducación:

- **Schedule.**Reentrenarse cada semana o mes. Esto es simple, pero se reentren cuando nada ha cambiado y espera cuando algo ha cambiado.
- **Drift.**Reentrenamiento cuando la deriva de entrada en características importantes se mantiene por encima del umbral.
- **Performance.**Reentrenamiento cuando una métrica de resultado cae por debajo del valor de referencia menos una tolerancia.

El tipo de deriva decide lo que puede hacer la reentrenamiento:

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

Después de la reentrenamiento, prueba el nuevo modelo con los datos etiquetados más recientes.

```figure
mlprod-drift-psi
```

## Construye el mismo

El código en `code/main.py`sólo utiliza la biblioteca estándar.

### Paso 1: contenedores de cuantiles y IPS

Los bordes de la basura son los deciles de referencia.`bisect_right`encuentra la basura de cada valor.

```python
def quantile_edges(reference: list[float], bins: int = 10) -> list[float]:
    ordered = sorted(reference)
    n = len(ordered)
    edges = [ordered[min(n - 1, (n * i) // bins)] for i in range(1, bins)]
    return sorted(set(edges))


def psi_from_fractions(expected: list[float], actual: list[float], eps: float = 1e-4) -> float:
    total = 0.0
    for e, a in zip(expected, actual):
        e, a = max(e, eps), max(a, eps)
        total += (a - e) * math.log(a / e)
    return total
```

### Paso 2: La estadística KS y su valor p

Caminar ambas muestras ordenadas juntos. en cada valor distinto, pasar por cada copia de ella en ambas muestras, luego comparar las dos acciones acumulativas. Esto maneja los lazos correctamente.

```python
def ks_statistic(sample_a: list[float], sample_b: list[float]) -> float:
    a, b = sorted(sample_a), sorted(sample_b)
    n, m = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < n and j < m:
        x = min(a[i], b[j])
        while i < n and a[i] <= x:
            i += 1
        while j < m and b[j] <= x:
            j += 1
        d = max(d, abs(i / n - j / m))
    return d
```

El valor p utiliza la serie para la distribución de Kolmogorov,`2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`, con `lambda = sqrt(n * m / (n + m)) * D`¿ Qué ?

### Paso 3: La prueba de chi-cuadrado

`chi2_sf`Computa la función de supervivencia del cuadrado de chi a través de la función gama incompleta superior regularizada.`chi_square_test`construye la tabla de dos filas, calcula la estadística y devuelve el valor p y V de Cramér.

```python
def chi_square_test(reference_counts: dict[str, int], current_counts: dict[str, int]) -> ChiSquareResult:
    categories = [c for c in sorted(set(reference_counts) | set(current_counts))
                  if reference_counts.get(c, 0) + current_counts.get(c, 0) > 0]
    rows = [[reference_counts.get(c, 0) for c in categories], [current_counts.get(c, 0) for c in categories]]
    row_totals = [sum(r) for r in rows]
    grand = sum(row_totals)
    if len(categories) < 2 or 0 in row_totals:
        return ChiSquareResult(0.0, 0, 1.0, 0.0)
    statistic = 0.0
    for col, _ in enumerate(categories):
        col_total = rows[0][col] + rows[1][col]
        for r in range(2):
            expected = row_totals[r] * col_total / grand
            statistic += (rows[r][col] - expected) ** 2 / expected
    dof = len(categories) - 1
    return ChiSquareResult(statistic, dof, chi2_sf(statistic, dof), math.sqrt(statistic / grand))
```

### Paso 4: ventanas y el monitor de deriva

`SlidingWindow`Se mantiene el último .`size`eventos en un `deque`- ¿ Qué ?`DriftMonitor`El número de puntos de referencia se calcula y se cuenta una vez.`check`El método devuelve el PSI, `D`, y el valor KS p para cada característica numérica, y el resultado chi-cuadrado para cada característica categórica.

### Paso 5: Política de alerta

La política convierte cada métrica fijada en un nivel y cuenta ventanas de deriva consecutivas por señal:

```python
def level(self, metrics: dict[str, float]) -> str:
    if "psi" in metrics:
        if metrics["psi"] >= self.psi_drift or (metrics["ks"] >= self.ks_drift and metrics["ks_p"] < self.alpha):
            return "drift"
        return "warn" if metrics["psi"] >= self.psi_warn else "ok"
    if metrics["p"] < self.alpha and metrics["v"] >= self.min_cramers_v:
        return "drift"
    return "warn" if metrics["p"] < self.alpha else "ok"
```

`update`retorno `ALERT`en la ventana que completa la racha, y `resolved`en la primera ventana limpia después de una alerta.

### Paso 6: Un arroyo con deriva inyectada

El stream tiene 9000 eventos de pago con un `amount`, una `channel`, y un fraude .`label`Se define en cuatro segmentos:

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

El modelo es un umbral de `amount`Windows tiene 500 eventos y se mueve en 250. Las etiquetas llegan 500 eventos tarde.

```bash
python3 code/main.py
npx tsx code/main.ts
```

```console
  end    PSI   KS D   chi2 p    acc  levels (amount/channel/accuracy)  events
 3000  0.010  0.041  3.0e-01  0.932  ok/ok/ok
 3250  0.152  0.163  7.6e-06  0.924  drift/warn/ok
 3500  0.463  0.298  2.8e-26  0.936  drift/drift/ok                     ALERT amount
 3750  0.609  0.343  3.5e-35  0.942  drift/drift/ok                     ALERT channel
 ...
 5500  0.026  0.044  2.6e-01  0.898  ok/ok/ok                           resolved amount, resolved channel
 ...
 7250  0.040  0.048  7.1e-01  0.848  ok/ok/drift
 7500  0.022  0.039  6.1e-01  0.778  ok/ok/drift                        ALERT accuracy
```

Lea el resultado en tres partes:

- **Covariate drift.**La deriva comienza en el evento 3000, y el `amount`La precisión se mantiene entre 0,89 y 0,95, porque la regla de etiqueta no ha cambiado.
- **Recovery.**Las entradas vuelven a la normalidad a 5000, y ambas alertas se resuelven a 5500.
- **Concept drift.**La deriva comienza a 6500, y los monitores de entrada permanecen en silencio porque las entradas no cambiaron. La precisión cae de 0,946 a entre 0,76 y 0,79.

## Usalo

**scipy.** `scipy.stats`Las estadísticas coinciden con el código de cero.

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

Lo hemos comprobado .`ks_statistic`y `chi_square_test`La estadística KS, la estadística chi-cuadrado y el valor p-cuadrado de chi coincidieron con la precisión de punto flotante.

El código utiliza la distribución limitada de Kolmogorov.`ks_2samp`El método de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la muestra de la que la muestra de la muestra de la muestra de la muestra de la muestra de la que la muestra de la muestra de la que la muestra de la muestra de la que la muestra de la que la muestra de la muestra de la muestra`chi2_contingency`aplica la corrección de continuidad de Yates por defecto, por lo que las estadísticas difieren allí.

**Monitoring libraries.**Varias bibliotecas de código abierto empaquetan estas pruebas con informes y tablas de control:

- **Evidently**Para una referencia con 1000 filas o menos, utiliza la prueba KS para columnas numéricas y la prueba chi-cuadrado para columnas categoricas. Para datos más grandes, utiliza la distancia Wasserstein y la divergencia Jensen-Shannon con un umbral de 0.1. PSI es uno de los otros métodos que puede seleccionar.
- **NannyML**La evaluación de rendimiento basada en la confianza (CBPE) utiliza las probabilidades previstas del modelo, que deben estar bien calibradas. La documentación de NannyML afirma que CBPE maneja el cambio de covariado pero no se enfrenta a la deriva conceptual.
- **TensorFlow Data Validation**El estudio de la teoría de la diferenciación de datos de forma conjunta, que se utiliza en la sección de datos, compara las extensiones consecutivas de datos.

El código de inicio muestra lo que cada una de estas herramientas calcula.

Para las solicitudes de LLM, el[LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md)En la fase de infraestructura se cubren las herramientas de seguimiento y evaluación.

## Envío

Esta lección produce`outputs/skill-drift-monitoring.md`La habilidad planifica los monitores para un nuevo modelo y tria una alerta de deriva. Pregunta qué capa disparó, qué tipo de deriva se ajusta a la evidencia y si la acción correcta es esperar, recalibrar, recoger etiquetas o retrenar.

## Los ejercicios

1. Ejecutar la transmisión con ventanas de 200 y 2000 eventos, grabar las falsas advertencias antes del evento 3000 y el retraso de la alerta.
2. Se ha establecido`n_tests=1`¿ Qué ?`patience=1`, y `min_cramers_v=0`Cuenta las alertas en el período limpio de 5000 a 6500.
3. Añadir una característica cuya media crece en 0,01 por 100 eventos.
4. Implemente la distancia Jensen-Shannon en los mismos contenedores decile.
5. Añade un monitor para ver la velocidad de predicción positiva del modelo y explique por qué permanece en silencio durante la deriva conceptual.

## Términos clave

| Term | What people say | What it means |
|------|----------------|----------------------|
| Data drift | "The data changed" | A change in the distribution of inputs, predictions, or labels compared with a reference window |
| Covariate drift | "New kinds of users" | `P(x)` changes while `P(y \| x)` stays the same |
| Prior drift | "More positives than before" | `P(y)` changes while `P(x \| y)` stays the same, also called label shift |
| Concept drift | "The rules of the game changed" | `P(y \| x)` changes, so the same input now has a different correct answer |
| Reference window | "The baseline data" | A fixed sample, often the training data, that every current window is compared with |
| PSI | "The stability score" | A symmetric sum over bins of (current share minus reference share) times the log of their ratio |
| KS statistic | "The KS test" | The largest gap between two empirical cumulative distribution functions |
| Cramér's V | "Effect size for categories" | The chi-square statistic scaled to the range 0 to 1 |
| Label delay | "Ground truth comes later" | The time between a prediction and the arrival of its true outcome |
| Alert fatigue | "Too many pages" | People ignore alerts because most of them were false alarms |

## Leer más

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation): deriva real y virtual, patrones de deriva y métodos de adaptación
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): pruebas de dos muestras para la detección de cambios
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785): métodos de detección, comprensión y adaptación a la deriva
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/): cómo se comporta el PSI con el tamaño de la muestra y el recuento de la basura
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html): métodos exactos y asintóticos de p-valor para la prueba de KS de dos muestras
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift): selección de prueba predeterminada por tipo de columna y tamaño de datos
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html): CBPE y sus supuestos
