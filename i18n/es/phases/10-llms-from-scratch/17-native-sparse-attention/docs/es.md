# Atención de la escasez nativa (NSA)

> En los tokens 64k, la atención consume 70-80% de la latencia de decodificación. Cada laboratorio abierto tiene un plan para arreglarlo. La NSA de DeepSeek (el mejor documento de ACL 2025) es la que se quedó pegada: tres ramas de atención paralelas  tokens de grano grueso comprimidos, tokens de grano fino retenidos selectivamente, y ventanas deslizantes para el contexto local  combinadas a través de una puerta de entrada aprendida. Es alineado con hardware (friendly-kernel), nativamente entrenable (trabaja en pre-entrenamiento, no se enciende en la inferencia), y en 64k decodifica se ejecuta más rápido que FlashAttention mientras que coincide o supera la calidad de atención completa. Esta lección construye las tres ramas de extremo a extremo y muestra por qué la escasez es diferenciable de extremo a extremo.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 12 (KV cache, flash-attention), Phase 7 · 15 (attention variants), Phase 10 · 16 (differential attention)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Cuéntanos las tres ramas de atención de la NSA y lo que captura cada una.
- Explica por qué la NSA es "naturalmente entrenable" cuando los métodos previos de atención escasa eran sólo inferenciales.
- Computa los ahorros de atención de la NSA frente a la atención completa en el contexto de 64k como función del tamaño del bloque de compresión y la selección de top-k.
- Implemente la combinación de tres ramas en stdlib Python en una secuencia sintética corta y verifique el comportamiento de los pesos de gating.

## El problema

Atención total en la longitud de secuencia N costos `O(N^2)`tiempo y `O(N)`El caché KV por capa. En los tokens 64k, los números de ancho de banda de computación y memoria son catastróficos. Estimado teóricamente desde el documento de la NSA: la atención representa el 70-80% de la latencia total de decodificación en 64k. Todo a la baja  TTFT, tokens/sec, costo por millón de tokens  está dominado por el costo de la atención.

La escasa atención es la respuesta obvia. Los intentos anteriores se dividen en dos cubo. La esparcia de patrones fijos (ventana deslizante, paso a paso, bloque local) arroja la información y falla en las tareas de recuerdo a largo alcance. La esparcia de tiempo de inferencia (KV cache pruning, H2O, StreamingLLM) se aplica a un modelo pre-entrenado en atención densa y recupera solo una fracción del potencial aceleramiento porque nunca se le pidió al modelo que enrutara la información a través del patrón esparcido.

Native Sparse Attention (Yuan et al., DeepSeek + PKU + UW, ACL 2025 mejor documento, arXiv:2502.11089) hace ambas cosas: un patrón de esparcia que el modelo aprende durante el pre-entrenamiento, implementado como un algoritmo alineado con el núcleo que realmente entrega los ahorros de computación a la inferencia.

## El concepto

### Tres ramas paralelas

Para cada consulta, la NSA ejecuta la atención tres veces, contra tres vistas diferentes de la caché KV:

1. **Compressed branch.**Los tokens se agrupan en bloques de tamaño `l`Cada bloque se comprime en un solo token de resumen a través de un pequeño MLP aprendido.

2. **Selected branch.**Usando las puntuaciones de atención de la rama comprimida, se identifican los bloques top-k más relevantes para la consulta actual. Se leen los tokens de granos finos (no comprimidos) de esos bloques y la consulta se atiende sobre todos ellos. Piense en la atención de la rama comprimida como la señal de enrutamiento para la selección.

3. **Sliding-window branch.**La consulta se ocupa de los más recientes `W`Los símbolos de la estructura de la base de datos (normalmente 512) para el contexto local. Esta rama captura los patrones de corto alcance de estructura pesada (sintaxis, coreferencia local) que los otros dos podrían perder.

Las tres salidas de la rama se combinan a través de una puerta de posición aprendida:

```math
\text{out} = g_{\text{cmp}} \cdot \text{out}_{\text{cmp}} + g_{\text{sel}} \cdot \text{out}_{\text{sel}} + g_{\text{win}} \cdot \text{out}_{\text{win}}
```

`g_cmp, g_sel, g_win`No tienen que sumar a 1  pueden pesar ramas de forma independiente.

### Por qué esto es "naturalmente entrenable"

El paso de selección (bloques de la parte superior de la K) es discreto. Las operaciones discretas rompen el flujo de gradiente.

La NSA evita esto: la atención de ramas comprimidas es una atención de granos gruesos diferenciables en toda la secuencia. La operación top-k sólo reutiliza las puntuaciones de atención de la rama comprimida para elegir qué bloques de granos finos cargar. Los gradientes alcanzan las puntuaciones de las ramas comprimidas a través de la propia salida de la rama comprimida, no a través de la elección de bloques. Dentro de los bloques elegidos, la atención sobre las claves y valores seleccionados es la atención ordinaria, por lo que su contribución al resultado final también es diferenciable. El `top_k`La elección del índice en sí no obtiene ningún gradiente: solo controla qué bloques se cargan de la memoria.

Esta es la razón por la cual la NSA puede ser utilizada en el pre-entrenamiento de extremo a extremo. El modelo aprende a dirigir la información a través de las tres ramas conjuntamente, produciendo un patrón escaso que en inferencia realmente entrega el acelerado prometido.

### Núcleo alineado con el hardware

El kernel de la NSA está diseñado para las jerarquías de memoria GPU modernas. El kernel carga consultas por grupos GQA (bucle externo), recoge los bloques KV escasos correspondientes por grupo (bucle interno) y dirige la atención a SRAM. Debido a que cada grupo de consulta ve los mismos bloques seleccionados (la selección es por grupo de consulta, no por cabeza de consulta), las cargas KV se amortizan en todo el grupo.

El documento informa que los kernels de Triton se ejecutan 9 veces más rápido que FlashAttention en decodificadores 64k, con la relación de aceleración creciendo con la longitud de la secuencia.

### El presupuesto de cálculo

- ¿ Qué ?`N`ser longitud de secuencia, `l`el tamaño del bloque de compresión, `k`el recuento de selección de la parte superior de k, `w`la ventana deslizante, `b`el tamaño de bloque seleccionado (normalmente es igual `l`¿Qué es lo que se hace?

- Ramo comprimido: `O(N/l)`llaves por consulta, así que `O(N * N / l)`- ¿Qué?
- Se seleccionó la rama: `O(k * b)`llaves por consulta, así que `O(N * k * b)`¿ Qué ?
- Ramo deslizante: `O(w)`llaves por consulta, así que `O(N * w)`¿ Qué ?

Total: `O(N * (N/l + k*b + w))`¿ Qué ?

Con `N = 64k, l = 64, k = 16, b = 64, w = 512`: el coste por solicitud es `1000 + 1024 + 512 = 2536 keys`Toda la atención es`64000 keys`. 25 veces reducción de cálculo.

Con `N = 128k, l = 64, k = 16, b = 64, w = 512`: el coste por solicitud es `2000 + 1024 + 512 = 3536 keys`Toda la atención es`128000 keys`El beneficio aumenta con la longitud de la secuencia, que es todo el punto.

### ¿Cómo se compara

| Method | Differentiable | Real inference speedup | Long-range recall |
|--------|---------------|----------------------|-------------------|
| Sliding window only | yes | yes | fails |
| Strided / block-sparse | yes | yes | partial |
| KV pruning (H2O, StreamingLLM) | N/A (inference-time) | yes | partial |
| MoBA (Moonshot) | partial | yes | good |
| NSA | yes (natively) | yes (9x at 64k) | matches full attention |

MoBA (Moonshot, arXiv:2502.13189) fue publicado simultáneamente y adopta un enfoque similar de tres es mejor que uno, aplicando el principio de MoE a los bloques de atención. NSA y MoBA son las dos arquitecturas que se conocen para la pre-entrenamiento de contexto largo de 2026.

```figure
sliding-window-attention
```

## Construye el mismo

`code/main.py`Implementa las tres ramas en una secuencia sintética corta y muestra:

- La MLP de compresión (se utiliza una línea de base simple de la media para la claridad pedagógica; la NSA real utiliza una MLP aprendida).
- La selección de bloques de la parte superior de k impulsada por puntajes de ramas comprimidas.
- La atención de la ventana deslizante en el último `w`- ¿Qué es eso?
- La combinación cerrada.
- Una impresión de recuento computacional comparando la atención completa.

### Paso 1: comprimir los tokens en bloques

```python
def compress(K, l):
    n = len(K)
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[d] for row in block) / len(block) for d in range(len(K[0]))]
        out.append(summary)
    return out
```

### Paso 2: Atención a las ramas comprimidas

ejecuta la atención de la consulta en la máxima medida contra las teclas comprimidas.

### Paso 3: Selección de bloque de la parte superior

Seleccione los índices de la `k`Los bloques comprimidos con más puntuaciones cargar los tokens originales sin comprimir de esos bloques y prestar atención a ellos.

### Paso 4: Atención a las ventanas deslizantes

Toma el último .`w`las fichas y ejecutar la atención estándar contra ellos.

### Paso 5: puerta + combinación

Una pequeña MLP en la consulta produce tres pesos de puerta. La salida final es una suma ponderada de las tres salidas de rama.

### Paso 6: Cuenta de cálculo

Imprima el número de teclas consultadas por consulta para cada rama y el total.`N`En una sintética de 1024 tokens con`l = 32, k = 4, w = 128`, la NSA ve .`32 + 128 + 128 = 288`Las claves por consulta en comparación con 1024 para la atención completa  3,5 veces menos.

## Usalo

La NSA está enviando en DeepSeek su propia línea de pre-entrenamiento de largo contexto.

- **DeepSeek internal**: pesos nativos, publicados utilizan NSA o su sucesor DSA (Deepseek Sparse Attention).
- **vLLM**: soporte experimental de la NSA en desarrollo para pesos de DeepSeek-V3.x.
- **SGLang**: Se publican los índices de referencia de la NSA; el camino de producción sigue el VLLM.
- **llama.cpp / CPU**: no se admite; el gasto general de la descomposición del núcleo no vale la pena en el rendimiento de la CPU.

Cuándo contactar a la NSA:

- Las actividades de formación previa o de formación continua dirigidas a más de 64 000 personas con un presupuesto de cálculo serio.
- La inferencia de los propios puestos de control de DeepSeek en el contexto largo.

Cuando no:

- No puedes adaptar la NSA sin entrenamiento continuo.
- El gasto general de tres ramas domina los ahorros.
- Chat interactivo de batch 1. Beneficios de decodificación sensibles a la latencia, pero sólo en contextos largos.

## Envío

Esta lección produce`outputs/skill-nsa-integrator.md`. Dado una especificación de ejecución previa a la capacitación en largo contexto, produce un plan de integración de la NSA: tamaño de bloque de compresión, top-k, ventana deslizante, ancho de puerta MLP, elección del núcleo y las evaluaciones específicas en largo contexto que justifican el cambio de arquitectura.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`En un 1024-token sintético.`(l, k, w)`Identificar el predefinido que consigue el menor número de claves por consulta manteniendo un recuento del 95% frente a la atención total en una prueba de aguja en haystack.

2. Reemplazar el compresor de la base media con un pequeño MLP aprendido (2 capas, oculto 32). Entrenarlo en una tarea sintética donde la señal es el promedio de un bloque. Medir la brecha de perplejidad con la línea de base de la base media en los datos retenidos.

3. Implemente la puerta MLP. Toma la consulta como entrada y saca tres escalares. Muestre que la puerta se comporta sensatamente: ponderación casi uniforme en consultas aleatorias, peso pesado en la rama seleccionada cuando la consulta golpea un bloque de fondo.

4. Compute el presupuesto de memoria de caché KV para un modelo 70B habilitado por la NSA en un contexto de 128k. Las cabezas de KV son 8, la cabeza es de 128, BF16. Compara con la atención completa y con MLA (fase 10 · 14 mostró los números de MLA).

5. Lea la sección 4 del documento de la NSA (arXiv:2502.11089) y explique en tres frases por qué los puntajes de atención de la rama comprimida se reutilizan para la selección de top-k en lugar de calcular un puntaje de enrutamiento separado.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Compressed branch | "Coarse view" | Attention over block-averaged keys that provides global context in $O(N/l)$ keys per query |
| Selected branch | "Top-k blocks" | Fine-grained attention over the `k` blocks with highest compressed-branch scores |
| Sliding window | "Local context" | Attention over the last `W` tokens for short-range patterns |
| Native trainability | "Pre-train with the sparsity on" | The sparsity pattern is learned during pre-training, not bolted on at inference |
| Compression block size l | "Group size for coarse view" | How many tokens get merged into one summary; 32-64 typical |
| Top-k | "Blocks to keep" | Number of compressed blocks whose uncompressed tokens get read; 16 typical |
| Sliding window W | "Local attention radius" | Typically 512; shorter hurts local coherence, longer wastes compute |
| Branch gate | "How to mix the three" | Per-position MLP output that weights the three branches' contributions |
| Hardware alignment | "Kernel-friendly sparsity" | Sparse pattern chosen so that the actual GPU kernel achieves the theoretical speedup |
| DSA | "NSA's successor" | Deepseek Sparse Attention, the architecture that followed NSA in DeepSeek's lineage |

## Leer más

- [Yuan et al. — Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, ACL 2025 Best Paper)](https://arxiv.org/abs/2502.11089) el papel
- [DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) la familia de arquitecturas de los objetivos de la NSA
- [Moonshot AI — MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) trabajo simultáneo, atención al estilo de la MOE sobre bloques
- [Beltagy et al. — Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) Origen de las ventanas deslizantes
- [Xiao et al. — StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) La línea de base de la escasez de tiempo de inferencia
- [Dao et al. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) la línea de base de atención completa de los núcleos de la NSA golpeó en 64k
