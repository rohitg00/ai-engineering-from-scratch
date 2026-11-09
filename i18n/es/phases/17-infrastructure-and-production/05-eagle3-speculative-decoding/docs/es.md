# EAGLE-3 Descodage especulativo en producción

> La descifrado especulativo combina un modelo de proyecto rápido con el modelo objetivo. El proyecto propone tokens K; el objetivo se verifica en un solo plazo; los tokens aceptados son gratuitos. En 2026, EAGLE-3 es la variante de grado de producción  que entrena a un draft head en los estados ocultos del modelo objetivo en lugar de en tokens crudos, empujando la tasa de aceptación alfa en la banda de 0.6-0.8 en el chat general. La pregunta correcta no es "qué tan rápido es el borrador" sino "qué es el alfa en mi tráfico?" Si el alfa cae por debajo de ~0.55, la descifrado especulativo es negativo neto a alta concurrencia porque cada borrador rechazado cuesta un segundo pase al frente objetivo. Esta lección te enseña a medir el alfa primero y a voltear la bandera segundo.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy acceptance-rate simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 18 (Multi-Token Prediction)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre de las tres generaciones de descifrado especulativo y explicar qué cambios EAGLE-3 de EAGLE-2 y de un modelo clásico de proyecto.
- Definir la tasa de aceptación alfa, calcular la velocidad esperada de alfa y K (duración del borrador), e identificar el alfa de equilibrio para su concurrencia objetivo.
- Explica por qué la descodificación especulativa es opt-in (no por defecto) en vLLM 2026 y por qué activarla sin medir alfa es un antipatrón de producción.
- Escriba un plan de medición: qué índice de referencia, qué distribución de datos, qué punto de concurrencia, qué métrica para entrar.

## El problema

El decodificación es de memoria. En un H100 que ejecuta Llama 3.3 70B FP8, cada paso de decodificación lee todos los ~70 GB de pesos de HBM y emite un token por secuencia. El cálculo de la GPU es casi ocioso durante el decodificación.

La descifrado especulativo explota la brecha. Generar tokens candidatos K con un modelo de borrador barato, luego pedir al modelo objetivo para verificar todos K en un solo pase hacia adelante. Cada token verificado es efectivamente libre (amortizado en un lote de K hacia adelante el objetivo habría tenido que hacer de todos modos).

El enfoque clásico del modelo de proyecto utiliza un modelo más pequeño de la misma familia (Llama 3.2 1B redacción para Llama 3.3 70B). Funciona pero la tasa de aceptación es mediocre  la distribución del modelo más pequeña difiere del objetivo. EAGLE, luego EAGLE-2, luego EAGLE-3 entrenan una cabeza de proyección ligera directamente en los estados internos del modelo objetivo, por lo que la distribución del proyección rastrea el objetivo mucho más de cerca. Por eso el alfa pasa de 0.4 con el modelo de proyecto a 0.6-0.8 con EAGLE-3.

El objetivo: EAGLE-3 se ha optado por el VLLM 2026. `speculative_config`Los equipos que lo encienden sin medir el tráfico real a menudo ven que la latencia de cola empeora, no mejora.

## El concepto

### ¿Qué es la descifrado especulativo realmente compra

Sin el decodificación de especificaciones, el costo por token es un objetivo hacia adelante.`1 + K * alpha`El acelerador es`(1 + K * alpha) / (1 + epsilon)`donde epsilon es el costo general de la verificación de proyectos. para K=5, alfa=0.7: `(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`Los números del mundo real se agrupan alrededor de 2-3 veces porque el alfa rara vez es tan alto en el tráfico de producción y el epsilon crece en grandes cantidades de lote.

### ¿Por qué alfa es la única métrica que importa?

Los tokens rechazados no desaparecen  obligan a un segundo objetivo a avanzar para el primer token rechazado. En una carga de trabajo donde el alfa baja a 0,4, pagas gastos generales de proyecto más verificación más re-roll. En alta concurrencia (digamos 256 concurrencias), el lote de decodificación ya es lo suficientemente grande como para que la brecha de ancho de banda de memoria entre "target solo" y "target con verificar" se reduzca. Por debajo de alfa 0.55 en la mayoría de los equipos de 2026, el código de especificaciones es negativo neto.

Alfa varía según la carga de trabajo. En el chat general de estilo ShareGPT, EAGLE-3 entrenado en ShareGPT alcanza 0.6-0.8. En el tráfico específico de dominio (código, médico, legal) el jefe de proyecto entrenado en datos generales cae a 0,4-0,6. El entrenamiento de un jefe de recarga específico de dominio recupera alfa  es un trabajo de entrenamiento ligero y rápido en comparación con la finalización de objetivos. La fase 7 · 16 y la fase 10 · 15 citan valores más altos (0,85 y superior). Esas son tasas por token en los puntos de referencia de chat que coinciden con los datos de entrenamiento del borrador. Planifique con las bandas de esta página y mide el alfa en su propio tráfico.

### Las generaciones de águila en un vistazo

- **Classic draft model**Alfabeto 0.3-0.5 Infraestructura simple  dos modelos cargados, proyecto de ejecuciones K hacia adelante por objetivo hacia adelante.
- **EAGLE-1 (2024)**Alfa ~ 0,5-0,6 . Un pequeño parámetro sobre la parte superior del objetivo.
- **EAGLE-2 (2025)**Alfabeto de la línea de referencia: longitud de borrador adaptativa y borradores basados en árboles (verifique múltiples ramas en un solo paso objetivo).
- **EAGLE-3 (2025-2026)**Allí se puede encontrar un equipo de entrenamiento de la cabeza de proyecto en múltiples capas de objetivo (no sólo las últimas), mejor alineación.

### La receta de producción para 2026

1. Modelo de navegación objetivo claro. Medir el TTFT de referencia, ITL, rendimiento en la concurrencia objetivo.
2. Habilitar el borrador EAGLE-3 a través de vLLM `speculative_config`- Re-examinar el índice de referencia.
3. Taxa de aceptación de registros alfa. vLLM V1 informa esto como `spec_decode_metrics.accepted_tokens_per_request`Dividir por la longitud del borrador solicitado para obtener el alfa.
4. Si el alfa < 0,55 en la distribución del tráfico de producción, deshabilitar la descifrado de especificaciones o entrenar un borrador EAGLE-3 específico de dominio.
5. Con la producción simultánea, vuelva a ejecutarse.

### El punto de pérdida de producción: cola P99

El P99 puede empeorar si no se sintoniza. Los proyectos rechazados desencadenan una secuencia de dos pases (proyecto + verificación-fallo + re-rollo).

### Cuando EAGLE-3 ya esté desplegado

Google desplegó la descodificación especulativa en AI Overviews en 2025 (la misma calidad, respuesta más rápida). vLLM V1 barcos `speculative_config`SGLang admite EAGLE-3 como la ruta de proyecto recomendada para cargas de trabajo pesadas de prefijos.

### Matemáticas de equilibrio en una línea

Aceleración esperada: `S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`- Configuración .`S = 1`soluciones para alfa: `alpha_breakeven = verify_overhead / K`. Para los gastos de verificación típicos ~0.15 y K=5: `alpha_breakeven = 0.03`Pero eso es la matemática de decodificación crudo. A alta concurrencia el overhead de verificación aumenta y el lote de decodificación ya amortiza las lecturas de memoria a través de las secuencias, por lo que el alfa_breakeven efectivo sube a ~0.45-0.55 en la práctica.

### Cuando no utilizar la descifrado especulativo

- Generación de batch-1 sin conexión donde la latencia no importa.
- Los resultados son muy cortos (menos de 50 tokens).
- Dominio especializado sin un jefe de reclutamiento entrenado.
- Suponiendo que cada par de características compone. Compruebe la matriz de compatibilidad vLLM para su versión: v0.18.0 marca la descifrado especulativo compatible con preempleo en pedazos.

```figure
mx-speculative-tree
```

## Usalo

`code/main.py`simula un bucle de decodificación con y sin decodificación especulativa en una gama de valores alfa y longitudes de borrador K. Imprime el break-even alfa, la velocidad medida y el comportamiento de cola.

## Envío

Esta lección produce`outputs/skill-eagle3-rollout.md`. Dado un modelo objetivo, una descripción de la distribución del tráfico y un objetivo de concurrencia, produce un plan de implementación EAGLE-3 en etapas  referencia de referencia, habilita la configuración, la medida alfa, la puerta en alfa >= 0.55, ver P99 ITL.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Qué alfa necesitas para un 2x de aceleración? ¿Para un 3x de aceleración? ¿Qué tan sensible es eso para verificar_overhead?
2. Imagínese que el tráfico de producción divide el 70% de chat general, el 30% de código. El chat general alcanza el alfa 0.7 con EAGLE-3 entrenado en ShareGPT; el código alcanza el alfa 0.4. ¿Qué es alfa mezclado y es el código de descodación de especificaciones net-positivo?
3. Lea el VLLM `speculative_config`Nombrar los tres modos (modelo de borrador, EAGLE, N-gram) y comprobar cuáles son las características de cada uno de ellos en su versión vLLM.
4. Vemos que la media ITL cayó un 25% después de habilitar EAGLE-3 pero P99 ITL subió un 15%.
5. Calcule el costo de memoria de la cabeza de proyección EAGLE-3 para Llama 3.3 70B. ¿Cómo se compara con ejecutar Llama 3.2 1B como un proyecto clásico?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speculative decoding | "draft plus verify" | Propose K tokens with a cheap model, verify all K in one target forward |
| Acceptance rate alpha | "spec accept rate" | Fraction of draft tokens accepted by the target; the only metric that matters |
| Draft length K | "spec k" | How many tokens the draft proposes per target forward; typical 4-8 |
| Verify overhead epsilon | "spec overhead" | Extra cost to verify-and-reroll vs a plain target forward; grows with batch |
| EAGLE-3 | "latest EAGLE" | 2025-2026 variant; trains draft head on multiple target layers; alpha 0.6-0.8 on general chat |
| `speculative_config` | "vLLM spec config" | The explicit opt-in in vLLM V1; no default means no acceleration |
| N-gram spec decode | "N-gram draft" | GPU-side draft using N-gram lookups in the prompt; chunked-prefill-compatible |
| Break-even alpha | "no-op alpha" | Alpha at which spec decode gives zero speedup; watch this at production concurrency |
| Rejected-draft two-pass | "reroll cost" | Two target forwards when drafts reject; drives P99 tail |

## Leer más

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) fuente autorizada en `speculative_config`y compatibilidad de preempleo en V1.
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) el conjunto exacto de campos.
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) formulación original de la cabeza de proyecto de EAGLE.
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) proyectos y árboles adaptativos.
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) Sistema de LLM eficiente con decodificación especulativa.
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) Lista de control de la implementación de la producción.
