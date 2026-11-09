# Jamba  Transformador híbrido SSM

> Los modelos espaciales de estado (SSM) y transformadores quieren cosas diferentes. Los transformadores compran calidad a través de la atención a un costo cuadrático. Los SSM compran inferencia en tiempo lineal y memoria constante a través de una recurrencia pero calidad de retraso. Jamba (marzo 2024) y Jamba 1.5 (agosto 2024) de AI21 los ponen en el mismo modelo: 1 capa transformadora por cada 7 capas de Mamba, MoE en cada otro bloque, y una ventana de contexto de 256k que se ajusta a una sola GPU de 80 GB. Mamba-3 (ICLR 2026) aprueba el lado de SSM con espacios de estado de valor complejo y proyecciones MIMO. Esta lección lee ambas arquitecturas de extremo a extremo y explica por qué la receta híbrida ha sobrevivido tres años de escalado cuando los intentos de largo contexto de pure-SSM y pure-Transformer no lo han hecho.

**Type:** Learn
**Languages:** Python (stdlib, layer-mix calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Explica las tres primitivas en un bloque Jamba  capas de transformador, capas de Mamba, MoE  y la receta 1:7: incluso interdependiendo.
- En el caso de los sistemas de memoria de base, el sistema de memoria de base debe tener una función de referencia.
- Computa la huella de caché KV de un modelo Jamba en un contexto de 256k y compara con lo que un modelo puro-transformer necesitaría.
- Nombrar las tres innovaciones de Mamba-3 (discretizamiento exponencial-trapezoidal, actualización de estado de valor complejo, MIMO) y el problema que cada uno tiene como objetivo.

## El problema

La atención es cuadrada en longitud de la secuencia. Los modelos de espacio de estado son lineales. Esa diferencia es compuesta: en 256k tokens, un mapa de atención de transformador es de 65B entradas por cabeza; el estado recurrente de un SSM es de tamaño fijo independientemente de la longitud de la secuencia.

Los modelos de SSM puros (Mamba, Mamba-2) coinciden con la perplejidad de los transformadores a pequeñas escalas, pero se retrasan en las tareas de seguimiento de estado y fallan en algunas categorías de recuperación dentro del contexto.

La solución obvia: usar ambas. Ponga las capas de Transformer donde importa el recuerdo exacto. Usa las capas de SSM en otro lugar. Ajusta la relación. Jamba es el primer modelo de producción en enviar esta receta híbrida a escala (52B total, 12B activo, contexto de 256k, GPU de 80GB). Jamba 1.5 extiende la familia a 398B total / 94B activo. Mamba-3 (ICLR 2026) es la mejor línea de base de SSM pura actual en la que los híbridos pueden ser reconstruidos.

Esta lección lee los tres artículos y produce el modelo mental para "garanse la relación correcta".

## El concepto

### Un SSM en una página

Un modelo espacial de estado procesa una secuencia `x_1, ..., x_N`a través de un estado de tamaño fijo `h`¿Qué es esto ?

```math
\begin{aligned}
h_t &= A h_{t-1} + B x_t \\
y_t &= C h_t
\end{aligned}
```

En cada paso el estado evoluciona a través de una dinámica lineal `A`, toma información `B x_t`, y emite la salida `C h_t`- ¿ Qué ?`A, B, C`No se puede aprender.`y_t`sólo necesita`h_{t-1}`y `x_t`, no antes .`x`La memoria es constante, la inferencia es constante.$O(1)$por símbolo.

El truco para la calidad de la modelación es la estructura de`A`. S4 (Gu 2021) utilizó una matriz altamente estructurada que podía evaluarse de manera eficiente como una larga convolución durante el entrenamiento.`A, B, C`Mamba-2 (2024) simplificó aún más la estructura. Mamba-3 (2026) reaparece la complejidad en lugares específicos.

La propiedad clave: para un decodificador LLM, una capa SSM es un reemplazo drop-in para una capa de atención, con estado de tamaño fijo por capa en lugar de un caché KV creciente.

### El bloque de Jamba

Un bloque de Jamba interlea capas de acuerdo con dos números:

- `l`El uso de Jamba en el estudio de la relación entre la atención y la Mamba`l = 8`, es decir, 1 capa de transformador por cada 7 capas de Mamba (7 Mamba + 1 Atención = 8 capas por grupo).
- `e`La frecuencia de la MoE.`e = 2`, lo que significa que cada otra capa aplica MoE.

La secuencia de capas dentro de un bloque:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

Cada bloque Jamba tiene 8 capas. A 4 bloques de profundidad (32 capas en total), obtienes 28 Mamba y 4 capas de atención. 16 de ellas utilizan MoE.

### ¿Por qué la proporción 1:7

AI21 ejecutó ablaciones: ¿qué relación de atención a mamba da la mejor perplejidad por parámetro Y recuerdo en contexto en sus evaluaciones de largo contexto?

- Demasiada atención (1:1): la calidad aumenta pero la memoria y la velocidad se degradan.
- Demasiada poca atención (1:15): la memoria es grande pero la recuperación en contexto falla.
- Lugar dulce: 1:7 o 1:8.

La intuición: las capas del Transformer manejan el retorno exacto y el seguimiento del estado.

### Codificación de posición

Las capas de Mamba son ellas mismas conscientes de la posición (a través de la recurrencia). Las capas de atención en los híbridos originales basados en Mamba no utilizaron RoPE  las capas SSM proporcionaron información de posición. Jamba 1.5 agrega RoPE a las capas de atención para generalización de contexto más largo, una refinación post-hoc basada en la evaluación empírica de contexto largo.

### El presupuesto de memoria

Para una forma Jamba-1 (32 capas: 28 Mamba + 4 Atención, oculta 4096, 32 cabezas de atención):

- Caché KV (sólo capas de atención): `2 * 4 * 32 * 128 * 256k * 2 = 16 GB`El Jamba liberado utiliza GQA con 8 cabezas de KV en esas capas, lo que lleva a 4 GB, la cifra en el papel Jamba.
- Estado del MSS: `28 * hidden * state_size`El estado típico de Mamba es de 16 por característica, oculto 4096: `28 * 4096 * 16 * 2 = 3.7 MB`- ¿Qué?

Comparar con un transformador puro en 32 capas, la misma oculta, MHA completo en 32 cabezas: `2 * 32 * 32 * 128 * 256k * 2 = 128 GB`La reducción de 8 veces en el caché de KV.`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`), un híbrido 1:7 con 32 cabezas de KV en 16 GB es todavía 2 veces más pequeño.

Eso es lo que AI21 significa por "contexto de 256k en una GPU de 80 GB". El caché KV de un transformador puro de MHA completo no encajaría; incluso una línea de base GQA no deja espacio para pesos y activaciones; Jamba sí.

### Mamba-3: el límite de referencia de la MSS pura en 2026

Mamba-3 (ICLR 2026, arXiv:2603.15569) introduce tres innovaciones en el lado del SSM puro:

1. **Exponential-trapezoidal discretization.**Replace la discretization del método de Euler en Mamba-2 con una recurrencia más expressiva.`x_t`¿ Qué ?

2. **Complex-valued state update.**Mamba-3 re-agrega valores complejos  equivalentes a una incorporación rotativa dependiente de datos en el estado. Esto restaura las capacidades de seguimiento de estado que costaron las simplificaciones anteriores de valor real.

3. **Multi-input multi-output (MIMO) projections.**En lugar de proyecciones escalares por característica, utilice proyecciones con valor de matriz. Mejora el poder de modelado y la utilización del hardware de tiempo de inferencia sin aumentar la latencia de decodificación.

En parámetros 1.5B, Mamba-3 mejora la precisión media en el torrente inferior en 0,6 puntos sobre el Gated DeltaNet; la variante MIMO agrega 1,2 más para una ganancia total de 1,8 puntos.

Mamba-3 aún no está enviando en un híbrido de producción a escala  pero es el candidato obvio para el lado SSM del próximo modelo de la clase Jamba.

### Cuando se busca un híbrido

Los híbridos ganan cuando:

- El contexto es lo suficientemente largo como para que el caché KV de Transformer puro se vuelva doloroso (64k +).
- Las tareas mezclan la estructura de corto alcance (buena para el SSM) con el retiro a largo alcance (necesidades de Transformer).
- Quieres desplegar en presupuestos de memoria de un solo GPU donde la caché KV del Transformer por sí solo no encajaría.

Los híbridos pierden cuando:

- El contexto es corto (menos de 16k). La carga de SSM es desperdiciada; el transformador puro está bien.
- Las tareas requieren atención en todas partes (razón profundo, referencia cruzada de varios documentos).
- Se está escalado a modelos fronterizos de billones de parámetros. Pure-Transformer + MLA + MoE (estilo DeepSeek-V3) está ganando actualmente la carrera de capacidad.

### El panorama competitivo

| Model | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | linear time, constant memory |
| Jamba | hybrid | 52B/12B | 256k on 80GB |
| Jamba 1.5 Large | hybrid | 398B/94B | enterprise-grade long-context |
| Mamba-3 | pure SSM | 1.5B (paper) | state-tracking restored |
| DeepSeek-V3 | pure Transformer + MoE | 671B/37B | frontier capability |

El panorama de 2026: el MoE de transformador puro domina la frontera, pero los híbridos poseen el nicho de contexto de 256k más.

```figure
swiglu-ffn
```

## Usalo

`code/main.py`Es una calculadora de memoria para arquitecturas híbridas. Dada una relación SSM-Transformer y una configuración de tamaño oculto / recuento de capas, calcula:

- El caché KV en el contexto objetivo.
- Memoria de estado de SSM.
- Memoria total en contexto N para una gama de formas de modelo.

La calculadora admite:

- Línea de base de Pure-Transformer (la caché de KV crece con N).
- El estilo Jamba 1: 7 híbrido.
- Pure-SSM (no hay caché KV en absoluto).

Los números son directamente de los documentos Jamba-1 y Jamba-1.5 para formas publicadas y extrapolados para variantes hipotéticas.

Considerancias de integración para un despliegue real:

- La mayoría de los servidores de inferencia de producción (vLLM, SGLang) admiten Jamba y Mamba.
- En el contexto de 256k, la ventaja de la memoria de Jamba se muestra en el rendimiento de solicitud simultánea.
- Mamba-3 como modelo independiente aún no está en producción  investigación preview en 1.5B.

## Envío

Esta lección produce`outputs/skill-hybrid-picker.md`. Dado un perfil de longitud de contexto, mezcla de tareas, presupuesto de memoria, el documento recomienda una combinación entre un transformador puro, un híbrido de estilo Jamba y un SSM puro, con razonamiento explícito sobre las diferencias de memoria y calidad.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Para calcular la caché KV en un contexto de 256k para un transformador puro de 32 capas (oculto 4096, 32 cabezas) y para un híbrido Jamba-1 de la misma forma.

2. Modificar la calculadora para modelar un híbrido 1:3 (4 Mamba: 1 Atención) y un híbrido 1:15 (14 Mamba: 1 Atención).

3. Leer la sección 3 del documento Jamba (arXiv:2403.19887). Explica por qué AI21 utiliza Mamba-1 en lugar de Mamba-2 a pesar de que Mamba-2 es más rápido.

4. Compute el parámetro de la carga de MoE-cada otra capa en Jamba 1.5 Large (398B total, 94B activo). Compara la relación activa con DeepSeek-V3 (37B/671B) y explique por qué la arquitectura de Jamba empuja la relación activa más alto.

5. Lea la sección 3 del documento Mamba-3 (arXiv:2603.15569). Explique en tres frases por qué una actualización de estado de valor complejo es equivalente a una incorporación rotativa dependiente de datos.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State space model (SSM) | "Recurrence with a fixed state" | A layer with a learned recurrence `h_t = A h_{t-1} + B x_t`; constant memory per token |
| Selective SSM | "Mamba's trick" | Data-dependent A, B, C parameters that give the model gating-like selectivity at linear time |
| Attention-to-Mamba ratio | "How many attention layers" | In Jamba, `l = 8` means 1 attention layer per 7 Mamba layers |
| Jamba block | "The 8-layer group" | One attention + seven Mamba + MoE on alternate positions |
| SSM state | "The hidden buffer" | Fixed-size per-layer state that replaces the KV cache for Mamba layers |
| 256k context | "Jamba's flagship number" | The sequence length Jamba-1 fits on a single 80GB GPU; pure Transformer cannot at that size |
| Mamba-3 | "2026 pure SSM" | Current-best pure-SSM architecture with complex state + MIMO; the baseline hybrids rebuild around |
| MIMO | "Multi-input multi-output" | Mamba-3 innovation using matrix-valued projections instead of scalar per-feature |
| Exponential-trapezoidal discretization | "Mamba-3's recurrence" | More expressive recurrence that subsumes Mamba-2's Euler-method discretization |
| Hybrid architecture | "Mix attention and SSM" | Any model that interleaves Transformer and SSM layers; Jamba is the production archetype |

## Leer más

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) el papel original de Jamba, ablaciones de ratio, reclamo de contexto de 256k
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) la familia ampliada, 398B/94B y 12B/52B publicaciones
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) el papel selectivo del MSS sobre el que se basa Jamba
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) el sucesor del espacio estructurado-estado-espacio simplificado
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) Estado de valor complejo, MIMO, la frontera de 2026 con SSM puro
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) el documento S4, punto de partida de la genealogía del MSS para los LLM
