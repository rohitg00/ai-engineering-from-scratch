# Economía de la plataforma de inferencia  Fuegos artificiales, juntos, baseten, modal, replicado, en cualquier escala

> El mercado de inferencias de 2026 ya no es alquiler de tiempo de GPU. Se bifurca en silicio personalizado (Groq, Cerebras, SambaNova), plataformas de GPU (Baseten, Together, Fireworks, Modal) y mercados de primer nivel de API (Replicate, DeepInfra).$1/hr per GPU on May 1, 2026, and $La valoración 4B en tokens 10T+/día indica el modelo de trabajo basado en el volumen.$300M Series E at $La regla de posicionamiento competitivo es simple: Fuegos artificiales optimiza la latencia, Juntos optimiza la amplitud del catálogo, Baseten optimiza el pulido empresarial, Modal optimiza Python-nativo DX, Replicate optimiza el alcance multimodal, Anyscale optimiza distribuido Python. Esta lección le da una matriz que puede entregar a un fundador.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy per-call economics comparator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre de los tres segmentos de mercado (sílicio personalizado, plataformas GPU, API-first) y mapa de cada proveedor a un segmento.
- Explica por qué el modelo de precios de la API "por token" se comprime hacia la curva de costos del motor de servicio, no la del hardware.
- Calcule el costo efectivo por solicitud en al menos tres proveedores y explique cuándo el precio por minuto (Baseten, Modal) supera el precio por token.
- Identificar qué plataforma es la opción predeterminada para una carga de trabajo determinada (desbordador sin servidor, alta potencia constante, variantes ajustadas, multimodal).

## El problema

Usted evaluó las plataformas de hiperescalado administradas. Usted decidió que necesita un proveedor más estrecho y más rápido  Fuegos artificiales para la latencia, juntos para la amplitud, Baseten para un modelo personalizado afinado. Ahora usted tiene seis opciones reales y las páginas de precios no se alinean. Fuegos artificiales muestra $/M tokens; Baseten shows $/minuto; Muestras de moda$/second; Replicate shows $No se pueden comparar cara a cara sin modelar la carga de trabajo.

Peor aún, el modelo de negocio detrás de cada página de precios es diferente. Los fuegos artificiales ejecutan su propio motor personalizado (FireAttention) en GPU compartidas; la tasa por token refleja su curva de utilización. Baseten le da GPUs dedicadas Truss +; por minuto refleja exclusividad. Modal es verdadero Python sin servidor  por segundo de facturación con subsegundo comienzos en frío. La misma salida (una respuesta de LLM), tres funciones de coste diferentes.

Esta lección muestra a los seis y te dice cuándo ganan cada uno.

## El concepto

### Los tres segmentos

**Custom silicon** Groq (LPU), Cerebras (WSE), SambaNova (RDU). Típicamente 5-10 veces más rápido que un cluster basado en GPU en el mismo modelo. Precio por token más alto (Groq fue ~ $ 0.99 / M en Llama-70B a finales de 2025) pero inmejorable para casos de uso sensibles a la latencia. Groq es la elección de producción para agentes de voz y traducción en tiempo real.

**GPU platforms** Baseten, Together, Fireworks, Modal, Anyscale. Se ejecuta en NVIDIA (H100, H200, B200 en 2026) o a veces AMD. La capa económica entre "arrendamiento de GPU crudo" (RunPod, Lambda) y "servicio administrado hipercaler" (Bedrock).

**API-first marketplaces** Replicar, DeepInfra, OpenRouter, Fal. Catálogo amplio, pago por predicción o pago por segundo, enfatizar el tiempo de la primera llamada.

### Fuegos artificiales  plataforma de GPU optimizada para la latencia

- Motor FireAttention (custom); comercializado como 4 veces menor latencia que vLLM en configuraciones equivalentes.
- Lugar de lote en ~50% de tasa sin servidor para cargas de trabajo no interactivas.
- El modelo ajustado sirve al mismo ritmo que el modelo base  un diferenciador real frente a los proveedores que cobran una prima por su LoRA.
- Mediados de 2026: aumento del alquiler de GPU bajo demanda de $1/hora a partir del 1 de mayo de 2026.
- Señal financiero: valoración de $ 4B, 10T + tokens / día manejados.

### Juntos  amplitud optimizada

- 200+ modelos, incluidos los lanzamientos de código abierto dentro de los días siguientes a la publicación en línea.
- 50-70% más barato que Replicate en modelos LLM equivalentes  el posicionamiento de "AI Native Cloud" es volumen y catálogo.
- Inferencia + ajuste fino + capacitación en una API.

### Baseten  optimizado para empresas

- Marco de la Truss: envases de modelos con dependencias, secretos, servidores config en un manifiesto.
- GPU de T4 a B200. facturación por minuto con una mitigación razonable de arranque en frío.
- SOC 2 Tipo II, HIPAA-pronto.
- $5B valuation, January 2026 Series E ($300 millones de dólares de CapitalG, IVP, NVIDIA).

### Modal  Python nativo optimizado

- Infraestructura como código en Python puro. Decorar una función con `@modal.function(gpu="A100")`y desplegar con un solo comando.
- El frío comienza en 2-4 segundos con precalentamiento; < 1s para modelos pequeños.
- $87M Series B at $1.1B valoración (2025). La mejor puntuación de experiencia de los desarrolladores en encuestas independientes.

### Replicación  ancho multimodal

- Pagos por predicción. La plataforma predeterminada para modelos de imágenes, video y audio.
- Ecosistema de integración (Zapier, Vercel, plugins CMS).
- Menos competitivo en las tasas de LLM por token, pero gana en la variedad multimodal.

### En cualquier escala  Radial nativo

- Construido en Ray; RayTurbo es el motor de inferencia patentado de Anyscale (competir con vLLM).
- Lo mejor para cargas de trabajo distribuidas de Python donde el paso de inferencia es un nodo en un gráfico más grande.
- Gestionó los racimos de Ray; integración estrecha con Ray AIR y Ray Serve.

### Por token versus por minuto  cuando cada uno gana

Per-token tiene sentido cuando la carga de trabajo es insensible a la latencia y estallar  sólo paga por lo que usa. Por minuto tiene sentido cuando la utilización es alta y predecible  se supera por-token una vez que está saturando la GPU.

Regla dura: para cargas de trabajo superiores al 30% de utilización sostenida de una GPU dedicada, por minuto (Baseten, Modal) comienza a superar por token (Fireworks, Together).

### El motor personalizado es el verdadero foso

Cada plataforma que se encuentra por encima de vLLM y SGLang reclama un motor personalizado. FireAttention, RayTurbo, la pila de inferencias de Baseten.

### Números que debes recordar

- Alquiler de GPU de fuegos artificiales: $1/hora de aumento a partir del 1 de mayo de 2026.
- Reclamo de fuegos artificiales: 4 veces menor latencia que vLLM en configuraciones equivalentes.
- En conjunto: 50-70% más barato que Replicate en LLM.
- Valoración de base: $5B (Series E, Jan 2026, $300M de ronda).
- Valoración de los activos: $1.1B (Sería B, 2025).
- Los ritmos por minuto por token por encima de ~ 30% de utilización sostenida.

```figure
cost-per-token
```

## Usalo

`code/main.py`Comparación de los seis proveedores en una carga de trabajo sintética en los modelos de precios.$/day and effective $- M tokens. Ejecutarlo para encontrar el equilibrio entre por token y por minuto.

## Envío

Esta lección produce`outputs/skill-inference-platform-picker.md`. Dado el perfil de carga de trabajo, SLA y presupuesto, elige la plataforma de inferencia principal y nombra al segundo.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿En qué uso sostenido Baseten (por minuto) supera a Fireworks (por token) para un modelo 70B en un H100?
2. Su producto sirve para la generación de imágenes más chat más habla-texto.
3. Los fuegos artificiales aumentan los precios en $1/hora en su modelo principal. Modela el impacto de costos combinados si el 40% de su tráfico se mueve a la categoría de lote (50% de descuento).
4. Un cliente regulado requiere GPUs SOC 2 Tipo II + HIPAA + dedicadas. ¿Cuáles de las tres plataformas son viables y cuál gana en FinOps?
5. Comparar el costo por 1.000 predicciones para Llama 3.1 70B en Fireworks sin servidor, juntos a pedido, Baseten dedicado y Replicate API. ¿Cuál es más barato a 10 predicciones por día? a 10.000?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Custom silicon | "non-GPU chips" | Groq LPU, Cerebras WSE, SambaNova RDU — optimized for decode |
| FireAttention | "Fireworks engine" | Custom attention kernel; marketed at 4x lower latency than vLLM |
| Truss | "Baseten's format" | Model packaging manifest; dependencies + secrets + serving config |
| Per-token | "API pricing" | Charge by tokens consumed; pay for no idle |
| Per-minute | "dedicated pricing" | Charge by wall-clock GPU time; wins at high utilization |
| Per-prediction | "Replicate pricing" | Charge per model invocation; common for image/video |
| RayTurbo | "Anyscale engine" | Proprietary inference on Ray; competes with vLLM on Ray clusters |
| Batch tier | "50% off" | Non-interactive queue at reduced rate; common on Fireworks, OpenAI |
| Fine-tuned at base rate | "Fireworks LoRA" | Charge LoRA-served requests at base model's rate (differentiator) |

## Leer más

- [Fireworks Pricing](https://fireworks.ai/pricing) Tarifas por token, nivel de lote, alquiler de GPU.
- [Baseten Pricing](https://www.baseten.co/pricing/) tasas por minuto, capacidad comprometida, niveles de empresa.
- [Modal Pricing](https://modal.com/pricing) velocidades de GPU por segundo y nivel libre.
- [Together AI Pricing](https://www.together.ai/pricing) catálogo de modelos y tarifas por token.
- [Anyscale Pricing](https://www.anyscale.com/pricing) RayTurbo y gestionó el precio de Ray.
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) evaluación comparativa.
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) paisaje de vendedores.
