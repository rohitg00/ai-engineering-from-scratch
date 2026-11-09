# Inferencia de borde  Apple Neural Engine, Qualcomm Hexagon, WebGPU/WebLLM, Jetson

> La limitación de borde principal es el ancho de banda de memoria, no el cálculo. El DRAM móvil se sitúa a 50-90 GB/s; el centro de datos HBM3 elimina 2-3 TB/s  una brecha de 30-50x. El decodificación está ligada a la memoria así que la brecha es decisiva. En 2026 el paisaje se divide en cuatro partes. El motor neuronal Apple M4/A18 alcanza 38 TOPS con memoria unificada (sin copia de CPUNPU). Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon alcanza 45 TOPS. WebGPU + WebLLM ejecuta Llama 3.1 8B (Q4) a ~ 41 tok/s en M3 Max (aproximadamente 70-80% de nativos); 17.6k estrellas de GitHub, API compatible con OpenAI, ~70-75% de cobertura móvil. NVIDIA Jetson Orin Nano Super (8GB) se ajusta a Llama 3.2 3B / Phi-3; AGX Orin ejecuta gpt-oss-20b a través de vLLM a ~40 tok/s; Jetson T4000 (JetPack 7.1) es 2x AGX Orin. TensorRT Edge-LLM admite EAGLE-3, NVFP4, preempleo en pedazos  mostrado en CES 2026 por Bosch, ThunderSoft, MediaTek.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy bandwidth-bound decode simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 09 (Production Quantization)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Explica por qué la inferencia de LLM móvil está limitada al ancho de banda de memoria y la computación es secundaria.
- Enumera los cuatro objetivos de borde (Apple ANE, Qualcomm Hexagon, WebGPU/WebLLM, NVIDIA Jetson) y ajuste cada uno a un caso de uso.
- Nombre la brecha de cobertura de 2026 WebGPU (Firefox Android se pone al día) y el aterrizaje de Safari iOS 26.
- Seleccione un formato de cuantificación por objetivo (Core ML INT4 + FP16 para ANE, QNN INT8/INT4 para Hexagon, WebGPU Q4 para el navegador, NVFP4 para Jetson Thor).

## El problema

Un cliente quiere un chatbot en el dispositivo: voz-primero, privado por defecto, funciona fuera de línea. En un MacBook Pro M3 Max, Llama 3.1 8B Q4 funciona a ~55 tok/s  bien. En un iPhone 16 Pro, el mismo modelo funciona a 3 tok/s  no está bien. En un Android de gama media con Snapdragon 8 Gen 3, 7 tok/s. En el navegador a través de WebGPU en Chrome Android v121+, 4-8 tok/s dependiendo del dispositivo.

La variación de rendimiento no es un problema de portación. Es la brecha de ancho de banda veces el formato de cuantización veces si la NPU es accesible desde el espacio del usuario.

## El concepto

### El ancho de banda es el verdadero techo

El decode lee el conjunto completo de pesas para cada token. Un modelo 7B en el Q4 es de 3.5 GB. Leer 3.5 GB a 50 GB/s toma 70 ms  un teórico techo de ~14 tok/s. A 90 GB/s (DRAM móvil de gama alta) el techo se mueve a ~25 tok/s. Ninguna cantidad de computación ayuda por debajo de este número.

Datacenter HBM3 a 3 TB/s elimina el mismo 3,5 GB en 1,2 ms  el techo es 830 tok/s. El mismo modelo, los mismos pesos.

### El motor neuronal de Apple (M4 / A18)

- Hasta 38 TOPS. Memoria unificada (CPU y ANE comparten el mismo pool)  sin gastos generales de copia.
- Acceso a través de Core ML + `.mlmodel`Modelos compilados, o mediante Shaders de rendimiento de metal (MPS) a través de PyTorch.
- Llama.cpp Metal backend utiliza MPS, no ANE directamente; ANE nativo requiere la conversión de Core ML.
- Mejor camino práctico para las aplicaciones iOS en 2026: Core ML con pesos INT4 + activaciones FP16.

### Qualcomm Hexagon (Snapdragon X Elite / 8 Gen 4)

- Hasta 45 TOPS. Integrado con CPU y GPU en el SoC pero dominio de memoria separado.
- El SDK de QNN (Qualcomm Neural Network) y el AI Hub proporcionan la conversión desde PyTorch/ONNX.
- Las plantillas de chat, Llama 3.2, Phi-3 todos enviados como artefactos de primera clase en AI Hub.

### NPUs Intel / AMD (Lunar Lake, Ryzen AI 300)

- 40-50 TOPS. El software se queda atrás de Apple/Qualcomm; OpenVINO está mejorando pero es un nicho.
- Mejor para aplicaciones de copiloto de Windows ARM; nativo en escritorios AMD/Intel para local-first.

### WebGPU + WebLLM

- Ejecutar modelos en el navegador a través de los shaders de computación WebGPU; no se instala.
- Llama 3.1 8B Q4 a ~ 41 tok/s en M3 Max  aproximadamente 70-80% de nativo a través del mismo backend.
- 17.6k GitHub estrellas en WebLLM; OpenAI compatible API JS; Apache 2.0.
- 2026 cobertura: Chrome Android v121+, Safari iOS 26 GA, Firefox Android todavía alcanzando.

### NVIDIA La familia Jetson

- Orin Nano Super (8GB): se ajusta a Llama 3.2 3B, Phi-3 a buen tiempo/s.
- AGX Orin: ejecuta gpt-oss-20b a través de vLLM a ~ 40 tok/s.
- Thor / T4000 (JetPack 7.1): 2x rendimiento AGX Orin, EAGLE-3 y NVFP4 compatibles.
- TensorRT Edge-LLM (2026) admite la descifrado especulativo EAGLE-3, pesos NVFP4, preempleo en pedazos  las optimizaciones del centro de datos portadas a borde.

### La elección de la cuantificación por objetivo

| Target | Format | Notes |
|--------|--------|-------|
| Apple ANE | INT4 weights + FP16 activations | Core ML conversion path |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub converters |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | Use `mlc_llm convert_weight` + compiled `.wasm`; GGUF is not supported |
| Jetson Orin Nano | Q4 GGUF or TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM path |

### La trampa de largo contexto en el borde

El contexto 128K de Llama 3.1 es una característica del centro de datos. En un teléfono con 8 GB de RAM, modelo de 4 GB + caché KV de 2 GB para tokens de 32K + OS overhead = OOM.

### La voz es la aplicación asesina

Los agentes de voz son sensibles a la latencia (el primer token < 500 ms). La inferencia local elimina por completo la latencia de la red. Combinada con el habla a texto (variantes de Whisper Turbo se ejecutan en el borde) y la inferencia de borde se convierte en el bucle de voz de calidad de producción.

### Números que debes recordar

- Apple M4 / A18 ANE: 38 TOPS.
- Qualcomm Hexagon SD X Elite: 45 TOPS.
- WebLLM M3 Max: ~ 41 tok/s en Llama 3.1 8B Q4.
- AGX Orin: ~ 40 tok/s en gpt-oss-20b a través de VLLM.
- La brecha de ancho de banda del centro de datos: 30-50x.
- Cobertura móvil de WebGPU: ~ 70-75% (de retraso en Firefox Android).

```figure
edge-bandwidth-pipe
```

## Usalo

`code/main.py`Computa límites teóricos de descifrado de rendimiento de la banda ancha de la matemática de límites de ancho de banda a través de objetivos de borde.

## Envío

Esta lección produce`outputs/skill-edge-target-picker.md`. En función de la plataforma (iOS/Android/browser/Jetson), el modelo y el presupuesto de latencia/memoria, elige un formato de cuantificación y una línea de conversión.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Para un modelo 7B en el Q4 en un Snapdragon 8 Gen 3 (~ 77 GB / s ancho de banda), calcular el techo de decodificación. Comparar con 6-8 tok / s observados  ¿Es el tiempo de ejecución eficiente?
2. WebGPU en Android requiere Chrome v121+. Diseñar un fallback para navegadores más antiguos  el lado del servidor a través de la misma API compatible con OpenAI.
3. Su aplicación iOS necesita streaming de contexto 4K. ¿Qué combinación de modelo/formato le permite mantenerse bajo 4 GB de memoria activa en un iPhone 16?
4. Jetson AGX Orin ejecuta Gpt-oss-20b a 40 tok/s. Jetson Nano encaja sólo en un 3B. Si su producto se dirige a ambos, ¿cómo unificar la pila de inferencias?
5. Argumentar si "WebLLM está listo para la producción en 2026". Cita la cobertura, el rendimiento y la brecha de Firefox Android.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ANE | "Apple neural engine" | On-device NPU in M-series and A-series; unified memory |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU; QNN SDK for access |
| WebGPU | "browser GPU" | W3C-standardized browser GPU API; Chrome/Safari 2026 |
| WebLLM | "browser LLM runtime" | MLC-LLM project; Apache 2.0; OpenAI-compatible JS |
| Jetson | "NVIDIA edge" | Orin Nano / AGX / Thor / T4000 family |
| TRT Edge-LLM | "edge TensorRT" | 2026 edge port of TensorRT-LLM; EAGLE-3 + NVFP4 |
| Unified memory | "shared pool" | CPU and NPU see same RAM; no copy overhead |
| Bandwidth-bound | "memory limited" | Decode gated by bytes/sec reading weights |
| Core ML | "Apple conversion" | Apple framework for ANE-native models |
| QNN | "Qualcomm stack" | Qualcomm Neural Network SDK |

## Leer más

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) paisaje y puntos de referencia.
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) Orin / AGX / Thor.
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) Anuncio del puerto de borde 2026
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) diseño y valores de referencia.
- [Apple Core ML](https://developer.apple.com/documentation/coreml) Conversión de origen.
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) Modelos preconvertidos para Hexagon.
