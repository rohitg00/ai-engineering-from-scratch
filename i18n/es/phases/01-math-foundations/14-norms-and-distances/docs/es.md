# Normas y distancias

> Su función de distancia define lo que significa "similar".

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## Objetivos de aprendizaje

- Implemente L1, L2, cosino, Mahalanobis, Jaccard, y edite las funciones de distancia desde cero
- Seleccione la métrica de distancia apropiada para una tarea de ML dada y explique por qué las alternativas fallan
- Conectar las normas L1 y L2 a la regularización LASSO y Ridge y sus regiones de restricción geométrica
- Demostrar cómo el mismo conjunto de datos produce diferentes vecinos más cercanos bajo diferentes métricas

## El problema

Hay dos vectores. Tal vez son palabras incrustadas. Tal vez son perfiles de usuarios. Tal vez son matrices de píxeles.

La respuesta depende en su totalidad de la función de distancia que elijas. Dos puntos de datos pueden ser vecinos más cercanos bajo una métrica y distantes entre sí bajo otra. Tu clasificador KNN, tu motor de recomendación, tu base de datos vectorial, tu algoritmo de agrupamiento, tu función de pérdida - todo depende de esta elección.

No hay una distancia universal mejor. L2 funciona para datos espaciales. La similitud cosínica domina la PNL. Jaccard maneja conjuntos. Editar distancia maneja cuerdas. Mahalanobis cuenta por correlaciones. Wasserstein mueve masa de probabilidad. Cada uno codifica una suposición diferente sobre lo que significa "similar".

Esta lección construye todas las funciones de distancia importantes desde cero, muestra cuándo cada una es la herramienta correcta, y demuestra cómo los mismos datos producen vecinos más cercanos completamente diferentes dependiendo de qué métrica se utiliza.

## El concepto

### Normas: medición de la magnitud del vector

Una norma mide el "tamaño" de un vector.$d(a, b) = \lVert a - b \rVert$Así que entender las normas es entender las distancias.

### L1 Norma (distancia de Manhattan)

La norma L1 suma los valores absolutos de todos los componentes.

```math
\lVert x \rVert_1 = |x_1| + |x_2| + \cdots + |x_n|
```

Se llama distancia de Manhattan porque mide la distancia que caminas en una red de la ciudad donde solo puedes moverte a lo largo de ejes.

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

Cuándo utilizar L1:
- Datos escasos de alta dimensión (funciones de texto, codificación única)
- Cuando se quiere robustez a los valores extremos (una sola gran diferencia no domina)
- Problemas de selección de características (la regularización de L1 promueve la esparcia)

Conexión a la regularización L1 (Lasso): añadir $\lVert w \rVert_1$La función de pérdida de la función de pérdida de la función de pérdida de la función de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de pérdida de

Conexión a las funciones de pérdida: El error absoluto medio (MAE) es la distancia promedio L1 entre las predicciones y los objetivos.

### L2 Norma (distancia euclidiana)

La norma L2 es la distancia en línea recta.

```math
\lVert x \rVert_2 = \sqrt{x_1^2 + x_2^2 + \cdots + x_n^2}
```

Esta es la distancia que aprendiste en la clase de geometría.$n$las dimensiones.

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

Cuándo utilizar L2:
- Datos continuos de baja a media dimensión
- Cuando las escalas de características son comparables
- Distancias físicas (datos espaciales, lecturas de sensores)
- Similaridad de imagen a nivel de píxeles

Conexión a la regularización L2 (Ridge): añadir $\lVert w \rVert_2^2$La función de pérdida de la carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga de carga

Conexión a funciones de pérdida: El error cuadrado medio (MSE) es el promedio de las distancias L2 al cuadrado.

```math
\begin{aligned}
\text{MAE (L1 loss):} \quad & |y - \hat{y}| && \text{Linear penalty. Robust to outliers.} \\
\text{MSE (L2 loss):} \quad & (y - \hat{y})^2 && \text{Quadratic penalty. Sensitive to outliers.}
\end{aligned}
```

### Normas de la familia general

L1 y L2 son casos especiales de la norma Lp:

```math
\lVert x \rVert_p = (|x_1|^p + |x_2|^p + \cdots + |x_n|^p)^{1/p}
```

Diferentes valores de $p$producen "bolas de unidad" de diferentes formas (el conjunto de todos los puntos a una distancia máxima de 1 del origen; las formas siguientes son sus límites):

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### Norma de infinidad L (distancia de Chebyshev)

Como$p$se acerca al infinito, la norma de Lp converge al componente absoluto máximo.

```math
\lVert x \rVert_\infty = \max(|x_1|, |x_2|, \ldots, |x_n|)
```

La distancia entre dos puntos se determina por la dimensión única en la que difieren más.

```math
\begin{aligned}
\text{Point } A &= (1, 1) \\
\text{Point } B &= (4, 5) \\[6pt]
L_\infty \text{ distance} &= \max(|4-1|, |5-1|) = \max(3, 4) = 4
\end{aligned}
```

Cuándo utilizar L-infinity:
- Cuando la peor desviación en cualquier dimensión es importante
- Tablas de juego (un rey en ajedrez se mueve en L-infinito: un paso en cualquier dirección cuesta 1)
- Las tolerancias de fabricación (cada dimensión debe estar dentro de las especificaciones)

### Similaridad cosina y distancia cosina

La similitud cosínica mide el ángulo entre dos vectores, ignorando sus magnitudes.

```math
\text{cos\_sim}(a, b) = \frac{a \cdot b}{\lVert a \rVert_2 \, \lVert b \rVert_2}
```

Se extiende desde -1 (direcciones opuestas) hasta +1 (la misma dirección).

La distancia cosínica la convierte en una distancia: cosínico_distancia = 1 - cosínico_similaridad.

```math
\begin{aligned}
& a = (1, 0) \qquad b = (1, 1) \\[6pt]
& \text{cos\_sim} = \frac{1 \cdot 1 + 0 \cdot 1}{1 \cdot \sqrt{2}} = \frac{1}{\sqrt{2}} = 0.707 \\
& \text{cos\_dist} = 1 - 0.707 = 0.293
\end{aligned}
```

Por qué el cosino domina la PNL y las incorporaciones: en el texto, la longitud del documento no debe afectar a la similitud. Un documento sobre gatos que es el doble de largo que otro documento sobre gatos debe seguir siendo "similar". La similitud cosina ignora la magnitud (longitud) y solo se preocupa por la dirección. Dos documentos con la misma distribución de palabras pero diferentes longitudes apuntan en la misma dirección y obtienen similitud cosínica 1.0.

Cuando se utilice la similitud cosinosa:
- Similaridad de texto (vectores TF-IDF, palabras incrustadas, frases incrustadas)
- Cualquier dominio donde la magnitud es ruido y la dirección es señal
- Sistemas de recomendación (vectores de preferencia del usuario)
- Embedding search (bases de datos vectoriales casi siempre utilizan cosino o producto punto)

### Similaridad de producto de punto vs. semejanza de cosino

El producto de puntos de dos vectores es:

```math
\begin{aligned}
a \cdot b &= a_1 b_1 + a_2 b_2 + \cdots + a_n b_n \\
&= \lVert a \rVert \, \lVert b \rVert \cos(\text{angle})
\end{aligned}
```

La similitud cosina es el producto de puntos normalizado por ambas magnitudes. Cuando ambos vectores ya están normalizados en unidad (magnitud = 1), el producto de puntos y la similitud cosina son idénticos.

```math
\text{If } \lVert a \rVert = 1 \text{ and } \lVert b \rVert = 1: \quad a \cdot b = \cos(\text{angle between } a \text{ and } b)
```

Cuando difieren: el producto de puntos incluye información de magnitud. Un vector con mayor magnitud obtiene una puntuación de producto de puntos más alta. Esto importa en algunos sistemas de recuperación donde se quiere que los elementos "populares" clasifiquen más alto. La magnitud actúa como una señal implícita de calidad o importancia.

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

En la práctica:
- Utilice la similitud cosina cuando desea una similitud direccional pura
- Utilice el producto punto cuando las magnitudes llevan información significativa
- Muchas bases de datos vectoriales (Pinecone, Weaviate, Qdrant) le permiten elegir entre ellas
- Si sus embebidos están L2-normalizados, la elección no importa

### Distancia de Mahalanobis

La distancia euclidiana trata todas las dimensiones de manera igual, pero si sus características están correlacionadas o tienen escalas diferentes, L2 da resultados engañosos.

La distancia de Mahalanobis explica la estructura de covarianza de los datos.

```math
d_M(x, y) = \sqrt{(x - y)^T S^{-1} (x - y)}
```

donde$S$es la matriz de covarianza de los datos.

Intuitivamente: la distancia de Mahalanobis primero descorrela y normaliza los datos (blanqueamiento), luego calcula la distancia L2 en ese espacio transformado.$S$es la matriz de identidad (incorrelación, características de varianza unitaria), la distancia de Mahalanobis se reduce a la distancia euclidiana.

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

Cuándo utilizar la distancia Mahalanobis:
- Detección de anomalías (los puntos con una gran distancia de Mahalanobis de la media son anomalías)
- Clasificación cuando las características tienen diferentes escalas y correlaciones
- Cuando usted tiene suficiente datos para estimar una matriz de covarianza confiable
- Control de calidad en la fabricación (monitoreo de procesos multivariados)

### Similaridad de jaccard (para conjuntos)

Las medidas de similitud de Jaccard se superponen entre dos conjuntos.

```math
J(A, B) = \frac{|A \cap B|}{|A \cup B|}
```

Se extiende desde 0 (sin superposición) hasta 1 (ensamblajes idénticos).

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

Cuándo utilizar Jaccard:
- Comparar conjuntos de etiquetas, categorías o características
- Documento similar a la presencia de la palabra (no a la frecuencia)
- Detección de casi duplicados (aproximación MinHash de Jaccard)
- Comparación de vectores de características binarias (datos de presencia/ausencia)
- Modelos de segmentación de evaluación (intersección de la Unión = Jaccard)

### Edición de distancia (Distancia Levenshtein)

La distancia de edición cuenta el número mínimo de operaciones de un solo carácter necesarias para transformar una cadena en otra.

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

Computación utilizando programación dinámica. llena una matriz donde entrada $(i, j)$es la distancia de edición entre la primera $i$caracteres de la cadena A y la primera $j$caracteres de la cadena B.

```
        ""  s  i  t  t  i  n  g
    ""   0  1  2  3  4  5  6  7
    k    1  1  2  3  4  5  6  7
    i    2  2  1  2  3  4  5  6
    t    3  3  2  1  2  3  4  5
    t    4  4  3  2  1  2  3  4
    e    5  5  4  3  2  2  3  4
    n    6  6  5  4  3  3  2  3
```

Cuándo utilizar la distancia de edición:
- Verificación y corrección de ortografía
- Alineación de secuencias de ADN (con operaciones ponderadas)
- Aparecimiento de cuerdas
- Desduplicación de datos de texto desordenados

### KL Divergencia (no es una distancia, pero se utiliza como una)

La divergencia KL mide cómo una distribución de probabilidades difiere de otra.

```math
D_{KL}(P \,\|\, Q) = \sum_x p(x) \log\frac{p(x)}{q(x)}
```

Propiedad crítica: la divergencia KL no es simétrica.

```math
D_{KL}(P \,\|\, Q) \ne D_{KL}(Q \,\|\, P)
```

Esto significa que no cumple con el requisito básico de una métrica de distancia.

Avanti KL $(D_{KL}(P \Vert Q))$es "buscar el significado": $Q$trata de cubrir todos los modos de $P$¿ Qué ?
Reverso KL $(D_{KL}(Q \Vert P))$es "buscar modalidad": $Q$se centra en un único modo de$P$¿ Qué ?

Cuando ves la divergencia KL:
- VAEs (el término KL en el ELBO empuja la distribución latente hacia un anterior)
- Destilación del conocimiento (el estudiante intenta igualar la distribución del profesor)
- RLHF (la pena KL mantiene el modelo ajustado cerca del modelo base)
- Métodos de gradiente de las políticas (actualizaciones restrictivas de las políticas)

### Distancia de Wasserstein (Distancia del Mover de la Tierra)

La distancia de Wasserstein mide el "trabajo" mínimo necesario para transformar una distribución de probabilidades en otra. Piense en ello como: si una distribución es una pila de tierra y la otra es un agujero, ¿cuánto tierra tienes que mover y hasta dónde?

```math
W(P, Q) = \inf_{\gamma} \mathbb{E}[d(x, y)] \quad \text{(over all transport plans } \gamma\text{)}
```

Para las distribuciones 1D, simplifica a la integral de la diferencia absoluta de las funciones de distribución acumulativa:

```math
W_1(P, Q) = \int |\text{CDF}_P(x) - \text{CDF}_Q(x)| \, dx
```

Por qué Wasserstein importa:
- Es una métrica verdadera (simétrica, satisface la desigualdad del triángulo)
- Proporciona gradientes incluso cuando las distribuciones no se superponen (la divergencia de KL va al infinito)
- Esta propiedad la convirtió en el centro de los GAN de Wasserstein (WGAN), que resolvieron la inestabilidad de entrenamiento de los GAN originales

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

Cuándo utilizar Wasserstein:
- Formación en GAN (WGAN, WGAN-GP)
- Comparación de distribuciones que no pueden superponerse
- Problemas de transporte óptimos
- Recuperación de imágenes (comparación de histogramas de color)

### Por qué las tareas diferentes necesitan distancias diferentes

| Task | Best distance | Why |
|------|--------------|-----|
| Text similarity | Cosine | Magnitude is noise, direction is meaning |
| Image pixel comparison | L2 | Spatial relationships matter, features are comparable scale |
| Sparse high-dim features | L1 | Robust, does not amplify rare large differences |
| Set overlap (tags, categories) | Jaccard | Data is naturally set-valued, not vectorial |
| String matching | Edit distance | Operations map to human editing intuition |
| Outlier detection | Mahalanobis | Accounts for feature correlations and scales |
| Comparing distributions | KL divergence | Measures information lost by using $Q$ instead of $P$ |
| GAN training | Wasserstein | Provides gradients even when distributions do not overlap |
| Embeddings (vector DB) | Cosine or dot product | Embeddings are trained to encode meaning in direction |
| Recommendation | Dot product | Magnitude can encode popularity or confidence |
| DNA sequences | Weighted edit distance | Substitution costs vary by nucleotide pair |
| Manufacturing QC | L-infinity | Worst-case deviation in any dimension matters |

### Conexión con las funciones de pérdida

Las funciones de pérdida son funciones de distancia aplicadas a las predicciones frente a objetivos.

```
Loss function       Distance it uses       Behavior
MSE                 L2 squared             Penalizes large errors heavily
MAE                 L1                     Penalizes all errors equally
Huber loss          L1 for large errors,   Best of both: robust to outliers,
                    L2 for small errors    smooth gradient near zero
Cross-entropy       KL divergence          Measures distribution mismatch
Hinge loss          max(0, margin - d)     Only penalizes below margin
Triplet loss        L2 (typically)         Pulls positives close, pushes
                                           negatives away
Contrastive loss    L2                     Similar pairs close, dissimilar
                                           pairs beyond margin
```

### Conexión con la regularización

La regularización añade una penalidad de norma en los pesos a la función de pérdida.

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> Sparse weights. Some weights become exactly zero.
  -> Automatic feature selection.
  -> Solution has corners (non-differentiable at zero).

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> Small weights. All weights shrink toward zero.
  -> No feature selection (nothing goes to exactly zero).
  -> Smooth solution everywhere.

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combines sparsity of L1 with stability of L2.
  -> Groups of correlated features are kept or dropped together.
```

Por qué L1 produce esparcia pero L2 no: imagen la región de restricción en el espacio de peso 2D. L1 es un diamante, L2 es un círculo. Los contornos de la función de pérdida (elípsias) son más propensos a tocar el diamante en una esquina, donde un peso es cero. Tocan el círculo en un punto liso, donde ambos pesos no son cero.

### Buscar al vecino más cercano

Cada función de distancia implica un problema de búsqueda de vecino más cercano: dado un punto de consulta, encontrar los puntos más cercanos en un conjunto de datos.

La búsqueda de vecino más cercana es exactamente$O(n \cdot d)$por consulta en un conjunto de datos de $n$puntos con $d$Para grandes conjuntos de datos, esto es demasiado lento.

Los algoritmos de vecino más cercano (ANN) intercambian una pequeña cantidad de precisión para obtener grandes ganancias de velocidad:

```
Algorithm         Approach                      Used by
KD-trees          Axis-aligned space partition   scikit-learn (low-dim)
Ball trees        Nested hyperspheres            scikit-learn (medium-dim)
LSH               Random hash projections        Near-duplicate detection
HNSW              Hierarchical navigable         FAISS, Qdrant, Weaviate
                  small-world graph
IVF               Inverted file index with       FAISS (billion-scale)
                  cluster-based search
Product quant.    Compress vectors, search       FAISS (memory-constrained)
                  in compressed space
```

HNSW (Hierárquico Mundo Navigativo Pequeño) es el algoritmo dominante en las bases de datos vectoriales modernas. Construye un gráfico de múltiples capas donde cada nodo se conecta con sus vecinos más cercanos aproximados. La búsqueda comienza en la capa superior (sparse, saltos largos) y desciende a la capa inferior (salto denso, corto).

```figure
norm-unit-balls
```

## Construye el mismo

### Paso 1: Todas las funciones normales y de distancia

¿ Qué ?`code/distances.py`Cada función se construye desde cero utilizando sólo matemáticas básicas Python.`code/distances.ts`es un puerto TypeScript con las mismas funciones y demos.

### Paso 2: Los mismos datos, distancias diferentes, vecinos diferentes

La demostración en `distances.py`crea un conjunto de datos, elige un punto de consulta y muestra cómo cambia el vecino más cercano dependiendo de la métrica de distancia.

### Paso 3: Incorporar búsqueda de similitudes

El código incluye una búsqueda de similitud simulada que encuentra los "documentos" más similares a una consulta utilizando similitud cosina vs distancia L2, lo que muestra que las clasificaciones pueden diferir.

## Usalo

El uso práctico más común: encontrar elementos similares en una base de datos vectorial.

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T

embeddings = np.random.randn(1000, 768)

sim_matrix = cosine_similarity_matrix(embeddings)

query_idx = 0
similarities = sim_matrix[query_idx]
top_k = np.argsort(similarities)[::-1][1:6]
print(f"Top 5 most similar to item 0: {top_k}")
print(f"Similarities: {similarities[top_k]}")
```

Cuando llames .`model.encode(text)`y luego buscar una base de datos vectorial, esto es lo que sucede bajo la capucha. El modelo de incorporación mapea el texto a los vectores. La base de datos vectorial calcula la similitud cosina (o producto de puntos) entre su vector de consulta y cada vector almacenado, utilizando algoritmos ANN para evitar verificar todos ellos.

## Los ejercicios

1. Calcule las distancias L1, L2 y L-infinity entre (1, 2, 3) y (4, 0, 6). Verifique que $L_\infty \le L_2 \le L_1$Siempre vale para cualquier par de puntos.

2. Crear dos vectores donde la similitud cosinosa es alta (> 0,9) pero la distancia L2 es grande (> 10). Explicar geométricamente lo que está sucediendo. Luego crear dos vectores donde la similitud cosinosa es baja (< 0,3) pero la distancia L2 es pequeña (< 0,5).

3. Implemente una función que toma un conjunto de datos y un punto de consulta y devuelve al vecino más cercano bajo la distancia L1, L2, cosino y Mahalanobis.

4. Calcule la distancia de Wasserstein entre [0,5, 0,5, 0,0] y [0, 0, 0,5, 0,5] a mano utilizando el método CDF. Luego, cálcala entre [0,25, 0.25, 0.25, 0.25] y [0, 0, 0, 0,5, 0.5]. ¿Cuál es mayor y por qué?

5. Implemente MinHash para obtener una similitud aproximada con Jaccard. Generar 100 conjuntos aleatorios, calcular el Jaccard exacto para todos los pares y comparar con la aproximación de MinHash utilizando funciones de hash 50, 100 y 200.

### Indicios

**Exercise 1.**El vector de diferencia es (-3, 2, -3), así que calcular las tres normas de ese vector con `l1_norm`¿ Qué ?`l2_norm`, y `linf_norm`Para la prueba, comparar el mayor$\lvert d_i \rvert$con la suma de cuadrados, y comparar la suma de cuadrados con el cuadrado de la suma de valores absolutos.

**Exercise 2.**La similitud cosínica ignora la longitud, así que comience con dos vectores que apuntan casi en la misma dirección y haga que uno de ellos sea mucho más largo. Para el segundo caso, use dos vectores cortos cerca del origen que apuntan en direcciones diferentes, luego compruebe ambas condiciones con `cosine_similarity`y `l2_distance`¿ Qué ?

**Exercise 3.**Llamé`find_nearest_neighbor(query, dataset, distance_fn)`una vez por cada uno de ellos `l1_distance`¿ Qué ?`l2_distance`¿ Qué ?`cosine_distance`, y `mahalanobis_distance`- ¿ Qué ?`demo_different_neighbors`muestra un conjunto de datos donde las métricas no están de acuerdo, así que léelo primero y luego cambie los puntos hasta que las cuatro respuestas difieran.

**Exercise 4.**Escriba la suma acumulada de cada distribución, luego suma las diferencias absolutas de las dos sumas acumuladas.`wasserstein_1d(p, q)`, luego explicar el valor más grande por lo lejos que la masa de probabilidad debe moverse.

**Exercise 5.**Para cada función hash, la firma MinHash de un conjunto es el valor mínimo de hash sobre sus elementos, y la fracción de funciones hash donde dos conjuntos obtienen la misma estimación mínima de su similitud Jaccard.`jaccard_similarity`El error debe caer aproximadamente en $1/\sqrt{k}$por$k$funciones de hash.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Norm | "Size of a vector" | A function that maps a vector to a non-negative scalar, satisfying triangle inequality, absolute homogeneity, and zero only for the zero vector |
| L1 norm | "Manhattan distance" | Sum of absolute component values. Produces sparsity in optimization. Robust to outliers |
| L2 norm | "Euclidean distance" | Square root of sum of squared components. The straight-line distance in Euclidean space |
| Lp norm | "Generalized norm" | The $p$-th root of the sum of $p$-th powers of absolute components. L1 and L2 are special cases |
| L-infinity norm | "Max norm" or "Chebyshev distance" | The maximum absolute component value. The limit of Lp as $p$ approaches infinity |
| Cosine similarity | "Angle between vectors" | Dot product normalized by both magnitudes. Ranges from -1 to +1. Ignores vector length |
| Cosine distance | "1 minus cosine similarity" | Converts cosine similarity to a distance. Ranges from 0 to 2 |
| Dot product | "Unnormalized cosine" | Sum of component-wise products. Equals cosine similarity times both magnitudes |
| Mahalanobis distance | "Correlation-aware distance" | L2 distance in a space that has been whitened (decorrelated and normalized) using the data covariance matrix |
| Jaccard similarity | "Set overlap" | Size of intersection divided by size of union. For sets, not vectors |
| Edit distance | "Levenshtein distance" | Minimum insertions, deletions, and substitutions to transform one string into another |
| KL divergence | "Distance between distributions" | Not a true distance (not symmetric). Measures extra bits from using $Q$ to encode $P$ |
| Wasserstein distance | "Earth mover's distance" | Minimum work to transport mass from one distribution to another. A true metric |
| Approximate nearest neighbor | "ANN search" | Algorithms (HNSW, LSH, IVF) that find approximately closest points much faster than exact search |
| HNSW | "The vector DB algorithm" | Hierarchical Navigable Small World graph. Multi-layer graph for fast approximate nearest neighbor search |
| L1 regularization | "Lasso" | Adding the L1 norm of weights to the loss. Drives weights to zero (sparsity) |
| L2 regularization | "Ridge" or "weight decay" | Adding the squared L2 norm of weights to the loss. Shrinks weights toward zero without sparsity |
| Elastic Net | "L1 + L2" | Combines L1 and L2 regularization. Handles correlated feature groups better than either alone |

## Leer más

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)- La biblioteca de Meta para la búsqueda de ANN a escala de miles de millones
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)- el papel que introdujo la distancia de la Tierra Mover a las GAN
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876)- algoritmo ANN fundamental
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)- Word2Vec, donde la similitud cosínica se convirtió en el predeterminado para las incorporaciones
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html)- Guía práctica de métricas de distancia y algoritmos de vecinos en scikit-learn
