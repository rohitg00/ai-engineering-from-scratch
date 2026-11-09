# Modelos omni: Qwen2.5-Omni y el pensador-hablante dividido

> La demostración del producto de GPT-4o en mayo de 2024 fue disruptiva no por el modelo subyacente sino por la forma del producto  una interfaz de voz donde se habla, el modelo ve lo que ve la cámara, y habla de nuevo en menos de 250 ms. El ecosistema abierto pasó el resto de 2024 y 2025 corriendo para alcanzar esa superficie de producto. Qwen2.5-Omni (marzo 2025) es el diseño abierto de referencia: un Thinker (gran transformador generador de texto) más un Talker (transformador generador de voz paralelo), unido por tokens de voz de transmisión. Mini-Omni lo simplificó, Moshi coincidió con su latencia, GLM-4-Voice lo extendió a chino. Esta lección lee la arquitectura de Thinker-Talker y el presupuesto de latencia que hace que el diálogo en tiempo real funcione.

**Type:** Build
**Languages:** Python (stdlib, streaming pipeline latency simulator + VAD loop), TypeScript
**Prerequisites:** Phase 12 · 19 (audio-LLMs), Phase 12 · 16 (any-to-any)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Divide la línea de inferencia en Pensador (razón del texto) y Hablador (sintesis del habla) y explique por qué funciona la transmisión paralela.
- Calcular el presupuesto de tiempo a primer byte de audio (TTFAB) para una interacción de conversación, componente por componente.
- Describa la posición de TMRoPE en línea con el tiempo codificando en la visión, el audio y el texto dentro del Pensador.
- Nombre los dos patrones de conversación en tiempo real, medio duplex y doble completo, y explicar cómo el cambio de turno de VAD impulsa la transmisión de medio duplex.

## El problema

Un asistente de voz en tiempo real tiene que hacer mucho, rápido:

1. Escucha al usuario. Tokenización de voz en tiempo real, detección de actividad de voz (VAD) para saber cuando terminan de hablar.
2. Opcionalmente, la entrada de la cámara a 2-4 FPS, fluye al Thinker junto con el audio.
3. Piensa, compone una respuesta condicionada al historial de conversación.
4. Sintéese tokens de audio, decodifique a forma de onda, transmita a los altavoces del usuario.

Cada paso añade latencia. La sensación de conversación requiere un total de ida y vuelta < 500ms  por debajo de eso, el usuario deja de notar el retraso. GPT-4o reclama ~250ms. Moshi ~160ms. Qwen2.5-Omni ~350-500ms.

Todo componente tiene que ser transmitido. Nada puede ser "parcela todo y luego decodificar".

## El concepto

### Pensador y hablador

La descomposición de Qwen2.5 Omni:

- Pensador: un transformador de generación de texto 7B-80B. Consume tokens de texto + imagen + audio entrelazados. Saque tokens de texto que representan lo que se dice.
- Hablante: un transformador generador de voz más pequeño (200M-1B). Consume los tokens de salida de texto de Thinker más los tokens recientes de contexto de habla.
- Decodificador de voz: un decodificador de forma de onda de transmisión (SNAC, familia MoVQGAN) que lleva tokens de voz a muestras de audio en tiempo real.

La separación es importante. El pensador tiene que ser grande para un buen razonamiento. El hablante puede ser pequeño porque su trabajo es local  convertir texto en tokens de habla. El hablante más grande no es más expresivamente; es más lento.

Correr ambos en paralelo:

1. El pensador emite un token de texto .$t_i$¿ Qué ?
2. El hablador consume .$t_i$(a través de transmisión) y emite tokens de voz $s_i, s_{i+1}, \ldots, s_{i+k}$¿ Qué ?
3. El decodificador de voz consume tokens de voz a medida que vienen y emite muestras de audio.
4. Para cuando el Pensador esté en el token de texto .$t_{i+3}$, Talker ya ha transmitido audio para$t_0, \ldots, t_{i+2}$¿ Qué ?

### Posiciones multimodal TMRoPE  alineadas en el tiempo

El pensador necesita integrar marcos de imagen (alcanzando, digamos, 4 FPS), marcos de audio (alcanzando a 50 marcos/segundo) y texto del historial de conversaciones.

TMRoPE asigna sellos de tiempo absolutos a cada token. El token de visión en t=2.3s. El token de audio en t=2.32s. El token de texto del usuario "detenta" en t=2.35s. RoPE gira la atención por sello de tiempo; el modelo los ve como temporalmente simultáneos.

Esta es la infraestructura para "el saludaba mientras saludaba" para que funcione  el modelo ve el marco de vídeo y el audio en el mismo momento conceptual.

### Sintesis de habla en streaming

Los tokens de voz deben transmitirse. Mini-Omni (Xie & Wu, 2024) introdujo "modelos de lenguaje pueden escuchar, hablar mientras piensan en transmisión": los tokens de salida de pensador y los tokens de salida de conversador se intercaudan en la misma secuencia.

Moshi (Défossez et al., octubre 2024) es la implementación abierta más rápida. 160ms TTFAB en un solo A100. Arquitectura: un único transformador 7B que emite tokens de texto y habla en posiciones alternadas, con un "monólogo interno" que separa el flujo de pensamiento del flujo de habla. Esto es efectivamente Thinker + Talker fusionado en un modelo con un entrenamiento cuidadoso.

### VAD y la toma de vueltas

La detección de la actividad de voz se ejecuta en el lado de entrada.

- Medio dúplex: el usuario habla, el modelo escucha. El modelo habla, el usuario escucha.
- Duplex completo: ambos pueden hablar simultáneamente. El modelo puede retrocanicular ("uh-huh") o interrumpir.

Qwen2.5 Omni admite medio duplex por defecto, con la toma de vueltas a través del umbral de silencio.

### Qwen3-Omni (novembre 2025)

El sucesor. Qwen3-80B Thinker, más grande Talker, mejoró TMRoPE-v2. La latencia cerca de 250ms de GPT-4o. Pesos abiertos.

### Presupuesto de latencia de producción

Para una interacción de transmisión típica:

- Mic -> fichas de audio: 40-80 ms.
- Preempleo (prompt + historial): 100-200 ms en 7B, mucho más en 70B.
- Primero token de texto de pensador: 40ms.
- El hablador procesa el primer token de texto: 20 ms.
- Los primeros tokens de voz se comprometen: 40 ms.
- Descodificación residual-VQ: 30 ms.
- Descodificación de la forma de onda de habla: 50-80 ms.

TTFAB total: 320-490 ms en 7B, 600-900 ms en 70B. La calidad fronteriza generalmente significa 70B +; de ahí la brecha de latencia fronteriza.

### Matemáticas de la tasa de tokens

En 16 kHz de habla con 50 Hz de tokens de voz base, se necesitan 50 tokens de voz por segundo de salida. El hablante debe emitir ≥50 tok/s para mantenerse al día. En un rendimiento típico de LLM de 30-80 tok/s en un H100, un pequeño 200-300M de hablante es lo suficientemente rápido; un 7B de hablante quedaría atrás.

Esta es la razón por la cual existen pequeños modelos dedicados Talker en lugar de "sólo usar el modelo principal".

```figure
l5-thinker-talker
```

## Usalo

`code/main.py`¿Qué es esto ?

- Simula una línea de pensadores-hablantes con tasas falsas de emisión de tokens.
- Computa TTFAB para los tamaños de modelos configurables y las tasas de muestra de micrófono.
- Demuestra medio doble giro con umbral de silencio VAD.

## Envío

Esta lección produce`outputs/skill-omni-streaming-budget.md`. Dado el objetivo TTFAB y el conjunto de características (vision-in, bilingüe, duplex completo) de un producto de voz en tiempo real, elige Qwen2.5-Omni, Qwen3-Omni, Moshi o Mini-Omni y mide el Thinker/Talker.

## Los ejercicios

1. Su objetivo TTFAB es de 300ms. En un pensador 7B y 300M Talker, escriba la latencia de cada componente.

2. Qwen2.5 Omni utiliza TMRoPE. Describa lo que el modelo ve para un prompt donde el usuario comienza a hablar a t=1s y la cámara capta un gesto a t=1.2s.

3. El soporte de doble completo requiere que el modelo emita audio mientras escucha. Proponga un formato de datos de entrenamiento que enseñe esto.

4. Lea el artículo de Moshi, sección 4. Describa la separación del "monólogo interno" y por qué evita la división Pensador-Hablador.

5. Calcule el presupuesto de rendimiento: ¿a qué velocidad debe emitir un Talker tokens para mantenerse al día con el habla de 16 kHz a 50 tokens de capa base/segundo?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Thinker | "Reasoning brain" | Large text-generating transformer producing what to say |
| Talker | "Speech-generating mouth" | Small transformer producing discrete speech tokens from Thinker's text |
| TTFAB | "Latency budget" | Time-to-first-audio-byte: from user speech end to first audio sample out |
| TMRoPE | "Time-aligned RoPE" | Position encoding using absolute timestamps across vision, audio, text |
| Half-duplex | "Turn-taking" | User and model alternate; VAD silence detects user-done |
| Full-duplex | "Simultaneous" | Model can speak and listen at the same time; backchannel capable |
| Inner monologue | "Moshi separation" | Single-model design where thinking-stream and speaking-stream interleave |

## Leer más

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
