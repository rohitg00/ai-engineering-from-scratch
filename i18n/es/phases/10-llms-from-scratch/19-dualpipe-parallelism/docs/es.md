# Paralelamente de doble tubo

> DeepSeek-V3 fue entrenado en 2.048 GPU H800 con expertos de MoE repartidos en nodos. El experto en comunicación transnodo-a-todo cuesta 1 hora de GPU de comunicación por cada hora de GPU de computación. Las GPU estaban inactivas la mitad del tiempo. DualPipe (DeepSeek, Dec 2024) es un pipeline bidireccional que se superpone a la computación hacia adelante y hacia atrás con las comunicaciones todo a todo que desencadenan. La caída de las burbujas, el aumento de rendimiento y la conservación de dos copias de parámetros de modelo (el "dual" que da el nombre) es barata una vez que Experto Paralelo ya está distribuyendo expertos en todas las filas de todos modos. Esta lección es una muestra de lo que hace realmente DualPipe y por qué el refinamiento de Sea AI Lab DualPipeV reduce el costo del parámetro 2x a expensas de una burbuja marginalmente más apretada.

**Type:** Learn
**Languages:** Python (stdlib, schedule simulator), Rust
**Prerequisites:** Phase 10 · 05 (distributed training, FSDP, DeepSpeed), Phase 10 · 14 (open-model architectures and MoE)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre de los cuatro componentes de una pieza DualPipe hacia adelante y hacia atrás y por qué cada uno tiene su propia ventana de superposición.
- Explica el problema de la burbuja de tuberías a escala, y lo que significa "libre de burbujas" en la práctica en comparación con el marketing.
- Trazar un cronograma de DualPipe a mano para 8 filas de PP y 16 micro-partidos y confirmar las corrientes hacia adelante y hacia atrás llenan las ranuras ociosas de cada uno.
- Explique la compensación que hace DualPipeV (Sea AI Lab, 2025): deja caer la replicación de parámetros 2x al costo de una burbuja ligeramente más grande cuando Expert Parallelism está inactivo.

## El problema

El entrenamiento de un modelo 671B MoE en GPU H800 de 2k se encuentra en tres cuellos de botella:

1. **Memory pressure.**Cada GPU contiene una rebanada del modelo. La memoria de activación en secuencia 8k a través de 61 capas en 128 cabezas es enorme.
2. **Pipeline bubbles.**El paralelismo tradicional de la tubería (GPipe, 1F1B) deja las GPU en marcha mientras esperan la entrada o el gradiente de su etapa.
3. **Cross-node all-to-all.**El MoE con paralelismo experto dispersa a los expertos a través de los nodos. Cada pase avanzado activa un todo-a-todo para enviar tokens a sus expertos, y otro para combinar. En GPUs de 2k esto se convierte fácilmente en una relación 1:1 computación-comm.

Cada una de ellas tiene soluciones separadas: control de gradientes para la memoria, burbuja cero (Sea AI Lab, 2023) para burbujas de tuberías, núcleos de comunicación expertos paralelas para todo. Lo que hace DualPipe es hacer que toquen juntos. El horario se superpone a la computación y la comunicación dentro de una sola pieza hacia adelante y hacia atrás, inyecta micro-parches desde ambos extremos de la tubería simultáneamente, y utiliza el horario resultante para ocultar todo a todos dentro de las ventanas de computación.

Resultado reportado: casi eliminación de las burbujas de tubería, más del 95% de utilización de GPU en el entrenamiento de tokens de DeepSeek-V3 de 14.8T.

## El concepto

### Refrescar el paralelismo de las tuberías

Dividir un modelo de capa N en dispositivos P. Dispositivo `i`Tiene capas.`i * N/P .. (i+1) * N/P - 1`. Un micro lote fluye hacia adelante a través de los dispositivos 0 a P-1, luego hacia atrás de P-1 a 0. Cada dispositivo solo puede iniciar su etapa hacia adelante cuando el dispositivo anterior envía su salida y solo puede comenzar hacia atrás cuando el dispositivo aguas abajo envía el gradiente aguas arriba.

GPipe (Huang et al., 2019) agrupa un micro lote a la vez, lo que desperdicia la mayor parte del tiempo de la GPU. El 1F1B (Narayanan et al., 2021) interlea pases hacia adelante y hacia atrás para múltiples micro-parches. La burbuja cero (Qi et al., 2023) divide el paso hacia atrás en dos partes  hacia atrás-por-entrada (B) y hacia atrás-por-pesos (W)  y las agrupa para llenar la burbuja. Después de la burbuja cero, el oleoducto está casi apretado.

DualPipe es el siguiente paso. Agrega dos ideas en la parte superior:

### Idea 1: Descomposición en pedazos

Cada pieza delantera se divide en cuatro componentes:

- **Attention.**Proyecciones Q/K/V, atención, proyección de salida.
- **All-to-all dispatch.**Comunicación entre nodos que envía tokens a sus expertos.
- **MLP.**El cálculo experto del Ministerio de Educación.
- **All-to-all combine.**La comunicación entre nodos que trae resultados expertos de vuelta.

Una pieza retrógrada añade versiones de gradiente de cada una de estas. DualPipe las agrupa de manera que el despacho todo a todo ocurra en paralelo con el cálculo de la atención de la pieza siguiente, y la combinación todo a todo ocurre en paralelo con el cálculo MLP de la pieza siguiente.

### Idea 2: programación bidireccional

La mayoría de los horarios de tuberías inyectan micro-parches desde la etapa 0 y fluyen hacia la etapa P-1. DualPipe inyecta micro-parches desde ambos extremos.

Para que esto funcione, dispositivo `i`debe mantener ambas capas de la tubería temprana `i`Y la capa de la tubería tardía.`P - 1 - i`. Esa es la parte "dual" de DualPipe: cada dispositivo guarda dos copias de las capas de modelo que necesita para servir (una para cada dirección). En la escala de DeepSeek-V3, este es un costo de replicación de parámetros 2x. Es asequible porque Expert Parallelism ya distribuye a los expertos de MoE tan delgados que replicar las capas no expertas dos veces es pequeñas papas.

Crucialmente, la corriente hacia adelante en una dirección y la corriente hacia atrás en la otra se superponen exactamente donde las burbujas estarían en un horario de una sola dirección.

### Un calendario rastreado a mano

Consideremos que P = 4 filas, 8 micro-partidos, divididos 4 hacia adelante / 4 hacia atrás. El tiempo se mueve de izquierda a derecha; las filas son filas de dispositivos.

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

Leyendo la notación "F4/F5R": la posición 1 está avanzando hacia delante del micro lote 4 (que va de izquierda a derecha en la tubería) Y hacia delante del micro lote 5 (que va de derecha a izquierda) en el mismo intervalo de tiempo.

En la fila 2 las corrientes cruciales se superponen más pronto, en la fila 0 y P-1 se superponen más tarde. En la fase media estable del cronograma, cada fila se superpone hacia adelante en dirección X con dirección Y hacia atrás. La computación está ocupada.

### Contabilidad de burbujas

La burbuja de tuberías estándar 1F1B (tiempo perdido por rango):

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

El refinamiento de la burbuja cero la reduce pero no a cero. DualPipe, en la fase estable, tiene burbuja cero si el recuento de micro-partidos es divisible por 2 veces la profundidad del oleoducto. Fuera de la fase estable (calentamiento y enfriamiento), hay alguna burbuja, pero no crece con el número de micro-partidos  una propiedad clave que destaca el papel.

En términos de marketing: "sin burbujas". En términos técnicos: las burbujas no crecen con el número de micro lotes. El análisis de seguimiento de Sea AI Lab (DualPipeV / Cut-in-half) muestra la burbuja cero completa solo cuando Expert Parallelism no es el cuello de botella; con EP impulsado todo a todo, siempre hay algún compromiso de programación.

### DualPipeV  el refinamiento

Sea AI Lab (2025) observó que la replicación de parámetros 2x es inútil cuando la superposición de la comunicación EP no es el punto. Su programa DualPipeV dobla la inyección bidireccional en un programa "de forma V" que se ejecuta en una sola copia de parámetro. La burbuja es ligeramente más grande que la de DualPipe, pero el ahorro de memoria es sustancial. DeepSeek adoptó DualPipeV en su implementación de DualPipe de código abierto como modo de descarga de EP.

El acuerdo:

| Feature | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| Param copies per device | 2 | 1 | 1 | 1 |
| Bubble vs micro-batches | constant | small growth | grows | grows |
| Compute-comm overlap | full | partial | minimal | partial |
| Use when | EP-heavy MoE | dense or EP-light | baseline | any pipeline |

### Lo que significa para una ejecución de 14.8T-token

El entrenamiento previo de DeepSeek-V3 consumió 14.8T de tokens en 2.048 H800 GPU en aproximadamente 2.8M horas de GPU. Con 1F1B ingenuo, habrían perdido 12-15% de eso a las burbujas de tubería  340-420K GPU-hora, suficiente para entrenar un modelo completo 70B. DualPipe recuperó la mayor parte de eso. Cuantificar directamente la contribución es difícil sin los registros internos, pero la afirmación en el artículo es de más del 95% de la utilización de GPU en promedio en toda la formación.

Para ejecuciones más pequeñas (menores de 1k GPUs), DualPipe es sobrecargado  burbujas de tubería son más pequeñas en relación con el costo total, y el entrenamiento de modelo denso rara vez golpea el cuello de botella.

### Donde se encuentra en la pila

- Complementario de **FSDP**(Fase 10 · 05). FSDP abrevia los parámetros del modelo a través de filas; DualPipe programa el cálculo a través de filas.
- Compatible con **ZeRO-3**La contabilidad de la replicación de dos copias necesita cooperar con los gradientes fragmentados de ZeRO.
- Requiere**custom all-to-all kernels**Los núcleos de código abierto de DeepSeek son la implementación de referencia.

```figure
expert-capacity
```

## Usalo

`code/main.py`Es un simulador de horarios de tuberías.`(P, n_micro_batches, schedule)`y imprime la utilización de fase estable para cada uno de 1F1B, Zero Bubble, DualPipe y DualPipeV. Es una herramienta de enseñanza  los números coinciden con las afirmaciones cualitativas en los documentos, no son una afirmación sobre la producción medido de velocidad.

El valor del simulador: ejecutarlo con diferentes números de P y micro-partidos y ver cómo crece la fracción de burbuja para 1F1B pero no para DualPipe.

Considerancias de integración para una formación real:

- Elija una profundidad paralela de tubería que se divide en su recuento de micro-partidos.
- Asegúrate de que tu red experta paralela soporte bidireccionales todo a todo.
- Espera quemar una semana de tiempo de depuración en el propio horario la primera vez.
- Monitorear la utilización de la GPU por rango, no sólo agregado.

## Envío

Esta lección produce`outputs/skill-dualpipe-planner.md`. Dado que se especifica un grupo de formación (conto de CPU, topología, interconexión, forma del modelo), se recomienda una estrategia de paralelismo de tuberías, el algoritmo de programación que se utilizará y la fracción de burbuja esperada en la escala objetivo.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`En el`(P=8, micro_batches=16, schedule=dualpipe)`y `(P=8, micro_batches=16, schedule=1f1b)`Calcule la diferencia de utilización de la GPU y expresala como horas de GPU recuperadas por millón de tokens de entrenamiento.

2. Esbozar la tabla de horarios para `(P=4, micro_batches=8, schedule=dualpipe)`Marque cada espacio horario con la identificación y dirección del micro lote. Identifique el primer espacio horario donde las burbujas están ausentes.

3. Lea la figura 5 del informe técnico de DeepSeek-V3 (arXiv:2412.19437). Identifique la ventana de superposición para el envío total dentro de una pieza delantera de DualPipe.

4. Calcule el costo de dos veces del parámetro de DualPipe para un modelo denso de 70B con etapas de tubería P=8 y un modelo de MoE de 671B con etapas de tubería P=16. Muestre por qué el costo de la caja de MoE es proporcionalmente menor (la mayoría de los parámetros son expertos, divididos en un grupo de EP grande).

5. Comparar DualPipe con Chimera (un programador bidireccional en competencia desde 2021). Identifique las dos propiedades específicas que DualPipe agregó que Chimera no tenía, utilizando la Sección 3.4 del documento como referencia.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Pipeline bubble | "Idle time per rank" | GPU cycles wasted because a pipeline stage is waiting for its input or gradient |
| 1F1B | "Default pipeline schedule" | One forward / one backward interleaved scheduling; the baseline DualPipe beats |
| Zero Bubble | "Sea AI Lab 2023" | Splits backward into B (input gradient) and W (weight gradient); almost fully tightens the pipeline |
| DualPipe | "DeepSeek-V3 schedule" | Bidirectional pipeline + compute-comm overlap; bubbles do not grow with micro-batch count |
| DualPipeV | "Cut-in-half" | V-shape refinement that drops the 2x parameter replication at the cost of slightly larger bubbles |
| Chunk | "Unit of pipeline work" | A forward or backward pass of one micro-batch through one pipeline stage |
| All-to-all dispatch | "Send tokens to experts" | Cross-node comm that routes tokens to their assigned MoE experts |
| All-to-all combine | "Bring expert outputs back" | Cross-node comm that gathers expert outputs after the MLP |
| Expert Parallelism (EP) | "Experts across GPUs" | Shards MoE experts across ranks so different GPUs hold different experts |
| Pipeline Parallelism (PP) | "Layers across GPUs" | Shards model layers across ranks; the dimension DualPipe schedules |
| Bubble fraction | "Wasted GPU time" | (bubble_time / total_time); the fraction DualPipe drives toward zero |

## Leer más

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437), Section 3.3.2 and Figure 5](https://arxiv.org/abs/2412.19437) la referencia principal de DualPipe
- [DeepSeek — DualPipe GitHub repository](https://github.com/deepseek-ai/DualPipe) la aplicación de referencia de código abierto, incluido el modo DualPipeV (Cut-in-half)
- [Qi et al. — Zero Bubble Pipeline Parallelism (arXiv:2401.10241, Sea AI Lab 2023)](https://arxiv.org/abs/2401.10241) el predecesor de la burbuja cero
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) el análisis DualPipeV que informó el modo de apagado de EP de DeepSeek
- [Narayanan et al. — PipeDream / 1F1B (arXiv:1806.03377, 2018-2021)](https://arxiv.org/abs/1806.03377) el calendario 1F1B comparado por DualPipe con
- [Huang et al. — GPipe (arXiv:1811.06965, 2018)](https://arxiv.org/abs/1811.06965) el problema original de paralelismo de tuberías de papel y burbuja
