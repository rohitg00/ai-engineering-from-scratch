# El caché rápido y el caché del contexto

> Su sistema de solicitud de inicio es de 4.000 tokens. Su contexto RAG es de 20.000 tokens. Se envían ambos con cada solicitud. También se paga por ambos  cada vez. El caché de inicio permite al proveedor mantener ese prefijo caliente en su lado y facturarle el 10% de la tasa normal en la reutilización. Se utiliza correctamente, reduce el costo de inferencia en 5090% y la latencia de la primera señal en 4085%.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## El problema

Un agente de codificación envía el mismo aviso de sistema de 15,000 tokens a Claude en cada giro de una conversación.$3/M input tokens is $El costo de entrada solo es de 0,90 antes de cualquier mensaje real del usuario. Multiplica por 10,000 conversaciones diarias y la factura alcanza $9,000 / día por texto que nunca cambia.

No se puede reducir el aviso sin perjudicar la calidad. No se puede evitar enviarlo  el modelo lo necesita en cada turno. El único movimiento es dejar de pagar el precio completo por un prefijo que el proveedor ya ha visto.

La aplicación fue lanzada en agosto de 2024 por Anthropic (con una variante de 1 hora de TTL extendida en 2025), OpenAI la automatizó más tarde ese año, Google lanzó la caché de contexto explícito junto con Gemini 1.5, y los tres ahora la ofrecen como una característica de primera clase en sus modelos fronterizos.

## El concepto

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.**Cuando el prefijo de una solicitud coincide con uno de una solicitud reciente, el proveedor sirve el caché KV de la ejecución anterior en lugar de volver a codificar los tokens.

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.**Si algún token difiere entre las solicitudes, todo después del primer token diferente es un error. Coloque las partes *estables* en la parte superior, las partes *variables* en la parte inferior.

### El diseño de la caché

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

Viola el orden  poner el mensaje del usuario por encima del aviso del sistema, intercalar las recuperaciones dinámicas entre unas pocas tomas  y el caché nunca golpea.

### El cálculo del equilibrio

La prima de escritura del 25% de Anthropic (5 minutos TTL) se paga por sí misma en la primera lectura, porque una lectura de caché cuesta 0.1x. 1 escriba + 1 lee promedio de 0,675x costo por solicitud (ahorra 32%); 1 escriba + 10 lee promedio de 0,205x (ahorra 80%). El TTL de 1 hora cobra 2x por la escritura, por lo que ese bloque necesita dos lecturas para salir adelante. Regla de oro: almacenar en caché cualquier cosa que espera reutilizar al menos 3 veces dentro del TTL; que elimina el equilibrio en cualquiera de los TTL.

```figure
prompt-cache-hit
```

## Construye el mismo

### Paso 1: Caching de la llamada antropópica con marcadores explícitos

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM = [
    {
        "type": "text",
        "text": "You are a senior Python reviewer. Follow the rubric exactly.\n\n" + RUBRIC_15K_TOKENS,
        "cache_control": {"type": "ephemeral"},
    }
]

def review(code: str):
    return client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": code}],
    )
```

El `cache_control`el marcador le dice a Anthropic que almacene el bloque durante 5 minutos.

**Response usage fields:**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # paid at 1.25x
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # paid at 0.1x
```

Verifique ambos campos en CI  si `cache_read_input_tokens`se mantiene en cero en todas las solicitudes, sus claves de caché están a la deriva.

### Paso 2: TTL extendido por una hora

Para los trabajos de larga duración, el plazo de 5 minutos de incumplimiento expira entre los trabajos.`ttl`¿Qué es esto ?

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

El TTL de una hora cuesta el doble de la prima de escritura (50% sobre el límite de referencia en lugar de 25%) pero se devuelve rápidamente en cualquier lote que reutilice el prefijo más de 5 veces.

### Paso 3: Caché automático de OpenAI

OpenAI no le da nada para configurar. Cualquier prefijo de más de 1.024 tokens que coincida con una solicitud reciente obtiene un descuento del 50% automáticamente.

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # long and stable
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # the discounted portion
```

La misma regla de diseño amigable con la caché se aplica. Dos cosas matan la caché de OpenAI que no matan la de Anthropic: cambiar la `user`campo (utilizado como componente de clave de caché) y herramientas de reordenamiento.

### Paso 4: Gemini caché de contexto explícito

Gemini trata el caché como un objeto de primera clase que se crea y nombra:

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3.8-flash",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=["Review this code:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

Gemini carga almacenamiento por token·hora durante el tiempo que la caché vive, y se lee a ~25% de la tasa de entrada normal. Esta es la forma correcta cuando se reutiliza el mismo prompt gigante en muchas sesiones durante días.

### Paso 5: medición de la tasa de impacto en la producción

¿ Qué ?`code/main.py`para un contador simulado de tres proveedores que rastrea el conteo de escritura/lectura/falta y calcula el costo combinado por 1K solicitudes.

## Las trampas que todavía se envían en 2026

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"`En la parte superior del sistema de la llamada. cada solicitud se pierde. Mover las marcas de tiempo por debajo del punto de ruptura de caché.
- **Tool reordering.**Serializa las herramientas en un orden estable  un reajuste dictado entre los despliegues rompe cada golpe.
- **Free-text near-duplicates.**"Eres útil". vs "Eres un asistente útil".  una diferencia de un byte = falta total.
- **Too-small blocks.**Anthropic impone un piso de 1.024 tokens (2.048 para Haiku).
- **Blind cost dashboards.**Divide "tokens de entrada" en caché vs no caché. de lo contrario una caída de tráfico se parece a una ganancia caché.

## Usalo

La pila de almacenamiento en caché de 2026:

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

Combina con el caché semántico (fase 11 · 11) para la capa de mensaje de usuario: mantulas de caché de inmediato *utilización idéntica a los tokens*, mantulas de caché semántico *utilización idéntica a los significados*

## Envío

Salva .`outputs/skill-prompt-caching-planner.md`¿Qué es esto ?

```markdown
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

Given a prompt (system + tools + few-shot + retrieval + history + user) and a usage profile (requests per hour, TTL needed, provider), output:

1. Layout. Reordered sections with a single cache breakpoint marked; explain which sections are stable, which are volatile.
2. Provider mode. Anthropic cache_control, OpenAI automatic, or Gemini CachedContent. Justify from TTL and reuse pattern.
3. Break-even. Expected reads per write within TTL; net cost vs no-cache with math.
4. Verification plan. CI assertion that cache_read_input_tokens > 0 on the second identical request; dashboard split by cached vs uncached tokens.
5. Failure modes. List the three most likely reasons the cache will miss in this setup (dynamic timestamp, tool reorder, near-duplicate text) and how you will prevent each.

Refuse to ship a cache plan that places a dynamic field above the breakpoint. Refuse to enable 1h TTL without a reuse count that makes the 2x write premium pay back.
```

## Los ejercicios

1. **Easy.**Haga una conversación de 10 vueltas con un sistema de 5,000 tokens contra Claude.`cache_control`y luego con. Reporte la factura de los tokens de entrada para cada uno.
2. **Medium.**Escriba un arnés de prueba que, dado una plantilla de solicitud y un registro de solicitud, compute la tasa de éxito esperada y el ahorro en dólares por proveedor (Antropic 5m, Anthropic 1h, OpenAI automático, Gemini explícito).
3. **Hard.**Construir un optimizador de diseño: se le da una respuesta y una lista de campos marcados `stable=True/False`, reescribir el prompt para poner un solo punto de ruptura de caché en la posición máxima amigable con la caché sin perder información. Verificar en un punto final real de Antropic.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Prompt caching | "Makes long prompts cheap" | Reusing a provider-side KV-cache for matching prefixes; 50-90% discount on repeated input tokens. |
| `cache_control` | "The Anthropic marker" | Content-block attribute that declares "everything up to here is cacheable"; `{"type": "ephemeral"}`. |
| Cache write | "Paying the premium" | The first request that populates the cache; billed at ~1.25x input rate on Anthropic, free on OpenAI. |
| Cache read | "The discount" | Subsequent requests matching the prefix; billed at 10% (Anthropic), 50% (OpenAI), ~25% (Gemini). |
| TTL | "How long it lives" | Seconds the cache stays warm; Anthropic 5m default (extendable 1h), OpenAI best-effort up to 1h, Gemini user-set. |
| Extended TTL | "1-hour Anthropic cache" | `{"type": "ephemeral", "ttl": "1h"}`; 2x write premium but worth it for batch reuse. |
| Prefix match | "Why my cache missed" | Caches only hit when every token from the start up to the breakpoint is byte-identical. |
| Context caching (Gemini) | "The explicit one" | Google's named, storage-billed cache object; best for multi-day reuse of large corpora. |

## Leer más

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)¿ Qué es esto ?`cache_control`, 1 hora TTL, la mesa de equilibrio.
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) Aparición automática de prefijos.
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching)¿ Qué es esto ?`CachedContent`API y precios de almacenamiento.
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) puesto de lanzamiento original con números de latencia.
- Fase 11 · 05 (Ingeniería de contexto)  donde cortar el prompt para que la caché pueda aterrizar.
- Fase 11 · 11 (Caching y Cost)  pareja de caché de la solicitud con una caché semántica en los mensajes del usuario.
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) el modelo de memoria de caché KV que solicita el almacenamiento en caché expone a los usuarios; explica por qué un prefijo almacenado en caché es ~ 10 veces más barato de volver a leer que de recombutar.
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) prefill es el acorta de caché de fase de prompt; este artículo explica por qué TTFT cae dramáticamente en el caché golpeado mientras que TPOT no se ve afectado.
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) el caché rápido se encuentra junto al descifrado especulativo, Flash Attention y MQA/GQA como palancas que doblan la curva de costo de inferencia; lea esto para los otros tres.
