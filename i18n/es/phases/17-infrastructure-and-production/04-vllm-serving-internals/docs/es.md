# Servicio de los motores internos  PagedAttención, Batch continuo, preempleo en pedazos

> El rendimiento moderno del motor de servicio se basa en tres fallos de composición, no en un solo truco. PagedAttention siempre está en. El batch continuo inyecta nuevas solicitudes en el batch activo entre las iteraciones de decodificación. Las rebanadas de preempleo en pedazos hacen que los tokens nunca mueran de hambre. Enciende los tres y un Llama 3.3 70B FP8 en un H100 SXM5 empuja 2.200-2.400 tok/s a 128 simultáneos  aproximadamente 25% por encima del propio estándar de vLLM y 3-4 veces un ciclo PyTorch ingenuo. Esta lección lee el programa y el núcleo de atención de vLLM  el motor de referencia para las tres técnicas  en un nivel que puede diagramar, y termina con un juego continuo batcher en `code/main.py`que los horarios preemplen y decodan de la manera que vLLM hace.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy continuous batching scheduler)
**Prerequisites:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Explica PagedAttention como un alocador de caché KV: bloques, tablas de bloques y por qué la fragmentación se mantiene por debajo del 4% en la carga de producción.
- Diagrama de la partición continua a nivel de iteración: cómo las secuencias terminadas salen del lote y las nuevas se unen sin drenar.
- Describa el preempleo en fragmentos en una frase y nombre qué métrica de latencia protege (indicación: es la cola de ITL de los decodificadores simultáneos, no el promedio de rendimiento).
- Compruebe una combinación de funciones vLLM con la matriz de compatibilidad de su versión antes de habilitar cada optimización a la vez.

## El problema

Un ciclo de servicio PyTorch ingenuo ejecuta una solicitud a la vez: tokenizar, preemplir, decodificar hasta EOS, devolver. En un usuario esto funciona. A cien, es una cola de pacientes. La solución obvia  lotamiento estático  empapa cada solicitud al prompt más largo de la ventana, empapa cada decodificación a la salida esperada más larga, y detiene todo el lote en la secuencia más lenta. Pagas por relleno que nunca usas, y las solicitudes rápidas esperan las lentas.

VLLM resuelve tres problemas a la vez. PagedAttention detiene la fragmentación de la caché de KV de consumir 60-80% de la memoria de la GPU de la manera que lo hace la asignación contiguosa clásica. El batch continuo permite que las solicitudes se unan y salgan del lote entre cada iteración de decodificación, por lo que el lote siempre está lleno de trabajo real. El preempleo en pedazos rompe una señal de 32k en 512 tokens que se interponen con el decodificación, por lo que una señal larga no congela cada token de decodificación en la GPU.

El modelo de producción 2026 está activado por defecto. Necesitas entender lo que cada uno hace porque los modos de falla están todos en el programador, no en el modelo.

## El concepto

### PagedAttention como un sistema de memoria virtual

Un caché KV es`num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`Para Llama 3.3 70B a 8192 tokens, es aproximadamente 1.25 GB por secuencia en BF16. Si reservas 8192 ranuras por adelantado para cada solicitud pero la solicitud promedio solo utiliza 1500 tokens, desperdicias aproximadamente el 82% del HBM reservado.

PagedAttention toma la idea de la memoria virtual del sistema operativo. El caché KV no es contiguo por secuencia. Se asigna en bloques de tamaño fijo (tokens predeterminados 16). Cada secuencia tiene una tabla de bloques que mapea sus posiciones lógicas de tokens a los ID de bloques físicos. Cuando una secuencia se expande más allá de sus bloques asignados, se agrega un bloque más. Cuando termina, sus bloques regresan al grupo.

La fragmentación cae del 60-80% (clásico) a menos del 4% (Attención pagada).`--gpu-memory-utilization`(default 0.9), que indica a vLLM cuánto HBM debe reservar para los bloques KV después de cargar pesos y activaciones.

### Participación continua en el nivel de iteración

El antiguo "batch dinámico" esperaba una ventana (digamos 10 ms) para llenar un lote, luego ejecuta prefill + decode + decode + decode hasta que cada secuencia terminara.

El batch continuo se opera entre cada paso de decodificación.`RUNNING`En cada iteración:

1. Cualquier secuencia en `RUNNING`que acaba de golpear EOS o max_tokens se elimina.
2. El programador mira la cola de espera. Si hay bloques KV libres, admite nuevas secuencias (preencher o reanudar).
3. El pase hacia adelante se ejecuta en lo que sea que ahora está en .`RUNNING`, emitiendo un nuevo token por secuencia.

El tamaño del lote nunca se empolga a un número fijo. Secuencias en diferentes posiciones en su salida comparten una fusionada hacia adelante.`V1 scheduler`. La invariante clave: el programador se ejecuta una vez por iteración de decodificación, no una vez por solicitud.

### El precarga en pedazos protege la cola del ITL

Prefill es computacional. Una solicitud de 32k-token en Llama 3.3 70B toma ~800 ms de prefill puro en un H100. Mientras que la solicitud de prefill se ejecuta, decodifica las fichas para cada otra secuencia en el lote de espera. En un bucle de servicio, la latencia de primer token (TTFT) de un pedido largo se convierte en la latencia de intertoken (ITL) para docenas de otros usuarios.

El preenrollo en piezas se divide en piezas de tamaño fijo (tokens predeterminados 512) y se programa cada pieza como una unidad. Entre los trozos el programador puede avanzar las secuencias de decodificación por un token.

### Las tres configuraciones interactúan

Las tres características se asumen mutuamente. PagedAttention le da al programador un recurso de KV de granos finos para negociar con.`RUNNING`En el caso de los Estados miembros, el sistema de programación de programas de programación es un sistema de programación más, no un sistema separado.

No es necesario conocer cada bandera, es necesario saber lo que el programador optimiza: un buen rendimiento bajo el presupuesto del bloque KV, sujeto a la recorte de preempleo en pedazos.

### Verifique la matriz de compatibilidad

Compruebe cada combinación de características contra la matriz de compatibilidad para su versión exacta de vLLM antes de habilitarlas todas a la vez, porque lo que compone cambia entre las versiones. En la matriz de características de v0.18.0 marca la descodificación especulativa como compatible con el preempleo y el caching de prefijos en pedazos, y la página de descodificación especulativa enumera dos incompatibilidades conocidas: paralelismo de tubería a través de v0.15.0, y especulación de modelo de proyecto a través de v0.10.0. Para el proyecto de método en sí, el estándar de 2026 es a menudo EAGLE-3 (`"method": "eagle3"`), incluida en la fase 17 · 05.

### Números que debes recordar

- Llama 3.3 70B FP8, H100 SXM5, 128 simultáneos, todos los tres en: 2.200-2.400 tok/s.
- El mismo modelo, VLLM predeterminado (sin precarga en pedazos): ~1.800 tok/s.
- El mismo modelo, el ciclo PyTorch hacia adelante ingenuo: ~600 tok/s.
- Residuos de fragmentación de KV bajo PagedAttention a carga de producción: < 4%.
- P99 ITL bajo carga mixta: ~ 15 ms con precarga en pedazos, ~ 50 ms sin.

### Cómo se ve el programador

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # schedule prefill chunks + decode in one batch
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # e.g. 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # one fused GPU call
```

`code/main.py`Es exactamente este bucle en stdlib Python con recuentos falsos de tokens y latencia avanzada falsa. ejecutándolo muestra cómo el preempleo en pedazos mantiene las secuencias de decodificación vivas durante un largo preempleo.

```figure
tensor-parallel
```

## Usalo

`code/main.py`simula un programador de estilo vLLM con características alternativas. ejecuta para ver:

- `NAIVE`modo: una solicitud a la vez, sin lotes.
- `STATIC`modo: pad y espera, batch clásico.
- `CONTINUOUS`modo: admisión y liberación a nivel de iteración.
- `CONTINUOUS + CHUNKED`modo: preemplar las recetas entrelazadas con decodificación.

La salida muestra el rendimiento total (tokens por segundo virtual), el TTFT medio y P99 ITL.`CONTINUOUS + CHUNKED`La fila debe ser la principal en el tráfico mixto.

## Envío

Esta lección produce`outputs/skill-vllm-scheduler-reader.md`. Dado un formato de servicio (tamaño de lote, utilización de memoria KV, tamaño de preenrollo en pedazos, configuración especulativa), produce un diagnóstico de cronometrista que nombra cuál de las tres anomalías es el cuello de botella y qué sintonizar.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Comparar .`STATIC`¿ Qué ?`CONTINUOUS`¿De dónde viene la brecha de rendimiento de la eficiencia de preempleo, la eficiencia de decodificación o la latencia de cola?
2. Modificar el programador de juguetes para agregar `--max-num-batched-tokens`. ¿Cuál es el valor correcto para un H100 con Llama 3.3 70B FP8? (Intención: es una función del tamaño de bloque KV y el número de bloques libres, no HBM crudo).
3. Re-leer las notas de vLLM v0.18.0. ¿Qué combinaciones de banderas son mutuamente excluyentes?
4. Calcule el desperdicio de fragmentación de la caché KV para un rastro de 1.000 solicitudes con promedio de 1.500 tokens de salida, std 600 tokens, bajo (a) asignación contiguosa por solicitud a 8192 max, (b) PagedAttention con bloques de 16 tokens.
5. Explique en un párrafo por qué el precarga en piezas ayuda a la P99 ITL pero no a la capacidad de producción en forma aislada.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PagedAttention | "the KV trick" | Fixed-size block allocator for KV cache; fragmentation <4% |
| Block table | "the page table" | Per-sequence map from logical token position to physical KV block |
| Continuous batching | "dynamic batching, but right" | Admit/release decisions made every decode iteration |
| Chunked prefill | "prefill splitting" | Break long prefill into 512-token slices interleaved with decode |
| TTFT | "first token time" | Prefill + queue + network; dominated by prefill at long prompts |
| ITL | "inter-token latency" | Time between consecutive decode tokens; dominated by batch size |
| Goodput | "throughput that meets SLO" | Requests/sec that still hit TTFT and ITL targets (Phase 17 · 08 reports it as the share of requests) |
| V1 scheduler | "the new scheduler" | vLLM's 2026 scheduler; runs continuous batching with chunked prefill |
| `--gpu-memory-utilization` | "the memory knob" | Fraction of HBM reserved for KV blocks after weights and activations |

## Leer más

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) fuente oficial sobre compatibilidad entre preemplazos en pedazos y decodificación especulativa.
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) 2026 libera cadencia y comportamiento específico de la versión.
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) la redacción original que todavía define cómo pensar sobre el asignador.
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) análisis de fragmentación y diseño de los programadores.
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) detallado V1 programador paseo con gráficos de llama.
