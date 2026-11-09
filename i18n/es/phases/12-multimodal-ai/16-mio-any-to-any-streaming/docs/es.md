# MIO y modelos multimodal de transmisión de cualquier persona a cualquier persona

> GPT-4o envía un producto que los modelos más abiertos no pueden replicar: un agente que escucha voz, ve video y habla en tiempo real. La respuesta del ecosistema abierto para finales de 2024 fue MIO (Wang et al., septiembre 2024). MIO tokeniza texto, imagen, habla y música, entrena a un transformador causal sobre las secuencias entrelazadas y genera cualquier modalidad a cualquier modalidad. AnyGPT (Zhan et al., febrero 2024) fue la prueba del concepto; MIO es la escalada; Unified-IO 2 (Allen AI, diciembre 2023) es el primo con visión + acción de tierra. Esta lección lee el patrón de cualquier a cualquier  cuatro tokenizers, un transformador, decodificación amigable para streaming.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, four-modality token allocator + streaming decode loop)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 6 (Speech and Audio)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Diseñe un vocabulario compartido que albergue textos, imágenes, voz y fichas de música sin colisiones.
- Comparar SEED-Tokenizer (imágenes) y SpeechTokenizer residual-VQ (habla) en compresión + reconstrucción trade-offs.
- Explica el plan de estudios de cuatro etapas que construye a cualquier generación.
- Nombrar las tres recetas abiertas a cualquier persona y sus principales compensaciones: MIO, AnyGPT, Unified-IO 2.

## El problema

Un modelo multimodal unificado es fácil de reclamar y difícil de construir a escala. La mayoría de los sistemas "de cualquier a cualquier" hasta 2024 fueron enducidos: modelo de visión → representación de texto → modelo de habla → audio. Cada espera pierde información, agrega latencia y complica el entrenamiento.

Los retos de ingeniería:

- Los tokenizers deben existir para cada modalidad, comprimir sin pérdidas - lo suficiente para la reconstrucción, y producir tokens a las tasas que el transformador puede consumir.
- Un vocabulario único debe asignar espacio para texto (32k+), imagen (8k+), habla (4k+), música (8k+).
- Los datos de formación deben cubrir cada par de entradas y salidas (texto→imagen, imagen→habla, habla→imagen, etc.) o el modelo debe componerse.
- La inferencia debe transmitir tokens de salida lo suficientemente rápido como para la latencia de conversación (<500ms tiempo-a-primero-byte de audio).

## El concepto

### Cuatro tokenizers para cuatro modalidades

La pila de tokenizadores de MIO:

- Texto: BPE estándar, vocabulario ~32000.
- Imagen: SEED-Tokenizer (2023), un tokenizador de imagen discreto con un código de 8192 entradas que emite 32 tokens por imagen.
- Discurso: SpeechTokenizer residual-VQ (2023), que codifica una forma de onda de 16 kHz en 8 libros de código jerárquicos; el primer nivel es contenido grueso, los niveles posteriores agregan prosodia e identidad del altavoz. MIO mantiene el nivel de contenido más los primeros tres niveles de timbre, 1024 códigos cada uno, por lo que 4096 ID de voz.
- Música: similar residual-VQ (familia de MusicGen / Encodec de Meta), 4-8 libros de código. MIO no envía un tokenizer de música (su cuarta modalidad es el video, como los marcos a través del tokenizer de imagen); el juguete de esta lección agrega música para mostrar cómo una nueva modalidad reclama un rango de ID.

Cada modalidad produce tokens de números enteros. Los tokens obtienen rangos de ID desarticulados en el vocabulario compartido:

```
text:   0..31999
image:  32000..40191  (8192 image tokens)
speech: 40192..44287  (4 codebooks x 1024 speech tokens)
music:  44288..52479  (8192 music tokens, the toy's extension)
sep:    52480..52485  (<image>, <speech>, <music>, </...>)
```

Total: ~ 52k vocabulario. La entrada de inserción y la proyección de salida abarcan todo ello.

### Descódigo de transmisión

La generación de voz utiliza residual-VQ. El transformador predice las fichas de voz de base (capas 0); un cuantificador residual decodificado en paralelo predice las capas posteriores. Cada token de capas 0 es aproximadamente 50 ms de audio a 16 kHz.

El patrón de transmisión:

1. El usuario habla en el micrófono; el tokenizer de audio en tiempo real emite tokens de voz cada 50 ms.
2. MIO consume tokens a su llegada (precarga inmediata + adelanto incremental).
3. Los tokens de salida se transmiten como generados; un decodificador de voz paralelo los convierte en muestras de audio con ~50-150ms de latencia.
4. Tiempo a primer byte de audio: el documento MIO no informa de número de latencia. El presupuesto de abajo pone este diseño en aproximadamente 300ms en el mejor de los casos, en comparación con ~250ms de GPT-4o.

Mini-Omni (arXiv:2408.16725), GLM-4-Voice (arXiv:2412.02612), y Moshi (arXiv:2410.00037) son diseños complementarios de transmisión de voz-LLM. Moshi en particular logra 160ms de ida y vuelta en una sola GPU.

### Currículo de cuatro etapas

Programa de formación del MIO:

1. Estadio 1  Alineación. Corporación de pareja de modalidad a gran escala: imagen de texto, discurso de texto, música de texto. Cada pareja utiliza su propio segmento de vocabulario token. Entrena el vocabulario compartido.
2. Esta etapa 2  interconectado. Documentación interconectada de múltiples modalidades (blogs con imágenes + video, podcasts con transcripciones, etc.).
3. Etapa 3  mejorado con voz. Datos de audio adicionales para elevar la calidad del habla sin perder la capacidad del texto.
4. Fase 4  FIS. La instrucción se ajusta a través de modalidades: VQA, subtítulos, narración, diálogo discurso a discurso.

El hecho de que no haya una etapa degrada las capacidades específicas: omitir la etapa 2 y el modelo pierde el contexto de modalidad cruzada; omitir la etapa 3 y el habla es pobre.

### La cadena del pensamiento visual

MIO introduce la cadena de pensamiento visual: el modelo emite fichas de imagen intermedias como un paso de razonamiento.

1. Emite`<image>`fichas que renten la escena (desde la imagen de entrada o un boceto).
2. Emite un texto analizando el boceto.
3. Emite la respuesta final.

La imagen intermedia que se hace servir de raspad. Los puntos de referencia mejoran las tareas de razonamiento espacial. La idea refleja la cadena de pensamiento para el razonamiento de texto.

### Los competidores en cualquier

- AnyGPT (arXiv:2402.12226): 4 modalidades (texto, imagen, habla, música), diseño similar.
- Unified-IO 2 (arXiv:2312.17172): añade resultados de acción de visión, profundidad, normales. Más diversidad de tareas, menor escala.
- NExT-GPT (arXiv:2309.05519): LLM + decodificadores de difusión específicos de modalidad. No es un enfoque de modelo único.
- CoDi (arXiv:2305.11846): difusión composible; cualquiera a cualquiera a través de latencia compartida.

MIO es el más cercano a la señal pura de cualquier-a-algo. AnyGPT es su antepasado conceptual.

### Presupuesto de la latencia

Para un producto de conversación, la latencia de cada componente importa:

- Micrófono a tokens de audio: ~ 50 ms.
- Preemplaje (tokens de audio + historial): ~ 100 ms en un modelo 8B.
- El primer token de salida: ~ 50ms.
- Descóder de voz paralelo residual-VQ + ~ 100-150 ms.

El tiempo total de audio hasta el primer byte: ~300ms mínimo. GPT-4o afirma ~250ms. Moshi afirma 160ms. Ni MIO ni AnyGPT publican una cifra medida, así que trate este presupuesto como una estimación, no un punto de referencia.

### ¿Por qué cualquiera a cualquiera se mantiene duro

Incluso en 2026, los modelos abiertos a cualquier modelo siguen a los cerrados en dos ejes:

- La calidad del habla. El tokenizador residual-VQ es perdedor; el habla conversacional suena robótica en comparación con las voces de la clase ElevenLabs.
- El razonamiento de modalidad cruzada. "Cantar sobre lo que ves" sigue fracasando más a menudo que las tareas de visión pura.

Estos son problemas de investigación abiertos. Qwen3-Omni (Lección 12.20) es el intento abierto más avanzado en 2025.

```figure
any-to-any-stream
```

## Usalo

`code/main.py`¿Qué es esto ?

- Define la asignación de vocabulario de cuatro modalidades y lo imprime.
- Envía una lista de entradas multimodal (texto, imagen, audio, música) a través del router del tokenizer.
- Simula el decodificación de transmisión para una respuesta de texto a voz con recuento de latencia.
- Computa el tiempo esperado de primer byte de audio dado en codificador, preempleo y latencias de decodificador.

## Envío

Esta lección produce`outputs/skill-any-to-any-pipeline-auditor.md`. Dado un producto de conversación (modalidades de entrada, modalidades de salida, objetivo de latencia), audita las opciones de diseño de la familia MIO y calcula el presupuesto de latencia.

## Los ejercicios

1. El producto acepta la entrada de voz y devuelve la salida de voz. ¿Cuál es el objetivo del presupuesto de latencia de extremo a extremo?

2. El SpeechTokenizer residual-VQ utiliza 8 libros de código. Propón por qué es necesario decodificar los niveles residuales en paralelo (vs secuenciales) y qué ahorros de latencia trae.

3. Su vocabulario tiene 32k texto + 8k imagen + 4k habla. Añadir 8k música y ~10 separadores. ¿Cuál es el costo del parámetro de matrices de embebido en dim 4096 oculto?

4. ¿Qué tipo de preguntas son beneficiosas? ¿Qué tipos son perjudicados por los tokens adicionales?

5. Leer Moshi (arXiv:2410.00037). Describa su técnica de "monólogo interno" y compare con la cadena de pensamiento visual de MIO.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Any-to-any | "Multimodal in/out" | A single model that accepts and emits text, image, speech, and music in any direction |
| Residual-VQ | "Speech tokenizer stack" | Multi-codebook tokenization where each layer adds information; base layer is content, later layers are prosody |
| SEED-Tokenizer | "Image codes" | Discrete image tokenizer with an 8192-entry codebook and 32 tokens per image, used by MIO |
| Chain-of-visual-thought | "Visual scratchpad" | The model generates an intermediate image as a reasoning step before its final answer |
| Time-to-first-audio-byte | "TTFAB" | Latency from user voice to first audio output; <500ms for conversational feel |
| Four-stage curriculum | "Training recipe" | Alignment -> interleaved -> speech-enhanced -> SFT, in that order |

## Leer más

- [Wang et al. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu et al. — Unified-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu et al. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang et al. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
