# Cuantificación de la producción  AWQ, GPTQ, GGUF K-quants, FP8, MXFP4/NVFP4

> El formato de cuantización no es una opción universal  es una función del hardware, el motor de servicio y la carga de trabajo. GGUF Q4_K_M o Q5_K_M posee CPU y borde, entregados a través de llama.cpp y Ollama. GPTQ gana dentro de VLLM cuando necesitas multi-LoRA en la misma base. AWQ con kernels Marlin-AWQ ofrece ~741 tok/s en un modelo de clase 7B con el mejor Pass@1 en INT4  el 2026 por defecto para la producción de centros de datos. FP8 se mantiene en el centro de Hopper, Ada y Blackwell  casi sin pérdidas y ampliamente apoyado. NVFP4 y MXFP4 (microscalación Blackwell) son agresivos y requieren validación por bloque. Dos equipos de trampas: el conjunto de datos de calibración debe coincidir con el dominio de implementación, y la caché KV está separada de la cuantización de peso  la lección AWQ "mi modelo es de 4 GB ahora" olvida la caché KV de 10-30 GB en los tamaños de lote de producción.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy memory and throughput comparison across formats)
**Prerequisites:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Nombre de los seis formatos de cuantización de producción y sus puntos dulces en 2026.
- Seleccione un formato dado al hardware (CPU vs GPU, Hopper vs Blackwell), motor (vLLM, TRT-LLM, llama.cpp) y carga de trabajo (chat de rutina, razonamiento, multi-LoRA).
- Computa la memoria de peso guardada y el caché KV dejado intacto para un formato elegido.
- Nombre la trampa del conjunto de datos de calibración que degrada los modelos cuantizados en el tráfico de dominio.

## El problema

La cuantización reduce la memoria y el ancho de banda HBM, que es exactamente lo que necesita el decodificación. Un modelo FP16 70B es de 140 GB de pesos. Cuantice los pesos a INT4 (AWQ o GPTQ) y el modelo es de 35 GB  se ajusta a un H100 con espacio para el caché KV, lo que importa porque en 128 secuencias simultáneas con contexto 2k, el caché KV solo es de 20-30 GB.

Pero la cuantización no es gratuita. La cuantización agresiva degrada la calidad, especialmente en tareas pesadas de razonamiento. Diferentes formatos funcionan con diferentes motores. Diferentes hardware soportan diferentes precisiones nativamente. El zoológico de formato 2026 es real y no se puede copiar la elección de otra persona.

## El concepto

### Los seis formatos

| Format | Bits | Sweet spot | Engines |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU, edge, laptops | llama.cpp, Ollama |
| GPTQ | 4-8 | Multi-LoRA on vLLM | vLLM, TGI |
| AWQ | 4 | Datacenter GPU production | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Hopper/Ada/Blackwell datacenter | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell multi-user | TRT-LLM |
| NVFP4 | 4 | Blackwell multi-user | TRT-LLM |

### GGUF  el CPU/edge por defecto

GGUF es un formato de archivo, no un esquema de cuantización en sí mismo  agrupan variantes K-cuánticas (Q2_K, Q3_K_M, Q4_K_M, Q5_K_M, Q6_K, Q8_0) en un solo recipiente. Q4_K_M y Q5_K_M son los valores predeterminados de producción  cerca de la calidad BF16 en 4-5 bits. La mejor opción para la CPU o el servicio de borde porque llama.cpp es el motor de inferencia de CPU más rápido.

Penalties de rendimiento en vLLM: ~93 tok/s en 7B  el formato no está optimizado para los núcleos de GPU.

### GPTQ  multi-LoRA en VLLM

GPTQ es un algoritmo de cuantización post-entrenamiento con un paso de calibración.

La victoria única: GPTQ-Int4 admite adaptadores LoRA en vLLM. Si está sirviendo un modelo base más 10-50 variantes afinadas (cada una como un LoRA), GPTQ es su camino. NVFP4 no admite LoRA todavía a principios de 2026.

### AWQ  el GPU por defecto del centro de datos

Cuantización de peso consciente de activación. Protege los ~1% de los pesos más destacados durante la cuantización. núcleos Marlin-AWQ: 10.9x velocidad vs ingenuidad. ~741 tok/s en 7B, mejor Pass@1 entre los formatos INT4.

Elija AWQ para nuevo GPU de servicio a menos que necesite multi-LoRA (GPTQ) o agresivo Blackwell FP4 (NVFP4).

### FP8  el medio fiable

El punto flotante de 8 bits. Casi sin pérdidas. Amplio soporte. Cores de tensión de Hopper aceleran FP8 de forma nativa. Blackwell hereda. FP8 es el seguro por defecto 2026 cuando la calidad no es negociable (razón, médico, gen de código).

### MXFP4 / NVFP4  Blackwell agresivo

Microescalado FP4. Cada bloque de pesas tiene su propio factor de escala. Agresivos pero acelerados por hardware en los núcleos de tensores Blackwell.

Las cuevas:
- No hay apoyo de la LRA todavía (a principios de 2026).
- La disminución de la calidad es visible en las cargas de trabajo pesadas.
- Valida en su conjunto de evaluaciones por modelo.

### La trampa de calibración

AWQ y GPTQ requieren un conjunto de datos de calibración  típicamente C4 o WikiText. Para modelos de dominio (código, médico, legal), calibrar en texto web genérico permite que el algoritmo tome decisiones erróneas sobre qué pesos proteger. Pass@1 en HumanEval puede caer varios puntos.

La solución: calibrar en datos dentro del dominio. Cientos de muestras de dominio suelen ser suficientes. Prueba en el conjunto de eval antes de enviar.

### La trampa de caché KV

AWQ reduce los pesos a 4 bits. El caché KV es separado y se mantiene en FP16/FP8. Para un modelo 70B con AWQ:

- Peso: ~ 35 GB (INT4 desde 140 GB).
- Caché KV en 128 contextos simultáneos × 2k: ~ 20 GB.
- Actividades: ~ 5 GB.
- Total: ~ 60 GB  se ajusta a H100 80 GB.

Ingenuamente "cuantice mi modelo a 4 GB" olvida los otros 30-50 GB.

Por separado, la cuantización de caché de KV (FP8 KV o INT8 KV) es una opción diferente con sus propias compensaciones  afecta directamente a la precisión de la atención y no es una victoria libre.

### AWQ INT4 es peligroso para el razonamiento

En el caso de la cadena de pensamiento, matemáticas, código-gen con contexto largo, estos sufren visiblemente de cuantización agresiva. AWQ INT4 pierde ~ 3-5 puntos en MATH. Para cargas de trabajo pesadas de razonamiento, envíe FP8 o BF16; acepta el costo de memoria.

### Guía de selección 2026

- Servicio de CPU/ borde: GGUF Q4_K_M. Terminado.
- Servicio de GPU, chat de rutina, sin LRA.
- GPU servicio, multi-LoRA: GPTQ con Marlin.
- Carga de trabajo de razonamiento: PQ8.
- Centro de datos Blackwell, calidad validada: NVFP4 + FP8 KV.
- Ambigua: ejecutar una evaluación de 1000 muestras en cada formato de candidato.

```figure
gpu-memory-breakdown
```

## Usalo

`code/main.py`Computa la huella de memoria (pesos + KV + activaciones) y el rendimiento relativo en los seis formatos para una gama de tamaños de modelos. muestra dónde domina el caché KV, dónde paga la compresión de peso y dónde FP8 es la opción segura.

El [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?dtype=fp8&users=64)La máquina muestra FP8 en un NVIDIA L4. Los pesos caen de 15.28 GB a 8.81 GB, el grupo de KV crece de 24.094 a 142.369 tokens, y la salida medida en 64 usuarios va de 250.85 a 735.91 tokens por segundo.

## Envío

Esta lección produce`outputs/skill-quantization-picker.md`. Dado el hardware, el tamaño del modelo, el tipo de carga de trabajo y la tolerancia de calidad, elige un formato y produce un plan de calibración/validación.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Para un modelo 70B a 128 simultáneos con 2k contexto, calcular el total de HBM para cada formato. ¿Qué formato permite caber en un H100 80GB?
2. Si se equivocó en cuanto a la tolerancia de calidad, ¿cuál es el camino de recuperación?
3. Computa el tamaño del conjunto de datos de calibración necesario para calibrar AWQ para un modelo de dominio médico. ¿Por qué más datos no siempre son mejores?
4. Lea el documento del núcleo de Marlin-AWQ o las notas de liberación. Explique en tres frases por qué AWQ alcanza 741 tok/s en 7B mientras que el GPTQ crudo alcanza ~712.
5. ¿Cuándo tiene sentido combinar los pesos AWQ con el caché KV FP8 vs mantener KV en BF16?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GGUF | "llama.cpp format" | File format bundling K-quant variants; CPU/edge default |
| Q4_K_M | "Q4 K M" | 4-bit K-quant medium; the production GGUF default |
| GPTQ | "gee pee tee q" | Post-train INT4 with calibration; supports LoRA in vLLM |
| AWQ | "a w q" | Activation-aware INT4; Marlin kernels; best Pass@1 at INT4 |
| Marlin kernels | "fast INT4 kernels" | Custom CUDA kernels for INT4 on Hopper; 10x speedup |
| FP8 | "eight-bit float" | Safe precision default on Hopper/Ada/Blackwell |
| MXFP4 / NVFP4 | "microscaling four" | Blackwell 4-bit FP with per-block scale factors |
| Calibration dataset | "cal data" | Input text used to pick quantization parameters; must match domain |
| KV cache quantization | "KV INT8" | Separate choice from weights; affects attention accuracy |

## Leer más

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) índices de referencia comparativos.
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) Números de rendimiento por formato.
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) Selección por formato.
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) formatos y banderas compatibles.
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) formulación original de la AWQ.
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) formulación original de GPTQ.
