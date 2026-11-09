# Resultados estructurados y decodificación limitada

> En la producción, "la mayoría" es el problema. La decodificación restringida se convierte en "la mayoría" en "siempre" mediante la edición de los logits antes de la muestreo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## El problema

Un clasificador le pide un LLM: "Retorna uno de {positivo, negativo, neutral}." El modelo devuelve "El sentimiento es positivo  esta revisión es abrumadoramente favorable porque el cliente afirma explícitamente que ...". Su parser se estrella.

La generación de formas libres no es un contrato, es una sugerencia.

Tres capas existen en 2026.

1. **Prompting.**Pregunte bien. "Retorna sólo el objeto JSON". Funciona alrededor del 80% en modelos fronterizos, menos en los más pequeños.
2. **Native structured output APIs.**OpenAI `response_format`, uso de herramientas antropológicas, modo Gemini JSON, confiable en esquemas compatibles, bloqueado por el proveedor.
3. **Constrained decoding.**Modifique los logits en cada paso de generación para que el modelo *no pueda* emitir tokens inválidos. 100% válidos por construcción. Funciona en cualquier modelo local.

Esta lección construye la intuición para los tres y nombres para cuándo alcanzar.

## El concepto

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**How constrained decoding works.**En cada paso de generación, el LLM produce un vector logit sobre el vocabulario completo (~ 100k tokens). Un procesador de logit se encuentra entre el modelo y el muestreo. Computa qué fichas son válidas dada la posición actual en la gramática objetivo  JSON Schema, regex, gramática libre de contexto  y establece las logitas de todas las fichas invalidas a infinito negativo. La masa de probabilidad de la máxima de la cantidad de logits restantes sólo se aplica a continuas válidas.

Implementaciones en 2026:

- **Outlines.**Compila JSON Schema o regex en una máquina de estado finito.$O(1)$Se basan en el FSM, por lo que los esquemas recursivos necesitan aplanamiento.
- **XGrammar / llguidance.**Los motores de gramática sin contexto. manejan esquema JSON recurrente. Descifrado casi cero. OpenAI acreditó la guía en su implementación de salida estructurada de 2025.
- **vLLM guided decoding.**Constructado en`guided_json`¿ Qué ?`guided_regex`¿ Qué ?`guided_choice`¿ Qué ?`guided_grammar`a través de esquemas, XGrammar, o Im formato-enforcer backends.
- **Instructor.**Envase basado en Pydantic sobre cualquier LLM. Retrasa en fallas de validación.

### El resultado contrario a la intuición

El decodificación limitada es a menudo más rápida que la generación sin restricciones. Dos razones. Primero, reduce el espacio de búsqueda de los siguientes tokens. Segundo, las implementaciones inteligentes omiten la generación de tokens por completo para tokens forzados (establo como `{"name": "` cada byte se determina).

### El engaño que te cuesta

El orden del campo es importante.`answer`antes de`reasoning`, y el modelo se compromete a una respuesta antes de que piense. JSON es válido. respuesta es incorrecta. Ninguna validación lo capta.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

El orden de campo de esquema es lógica, no formato.

```figure
constrained-decoder
```

## Construye el mismo

### Paso 1: generación regex-constrain desde cero

¿ Qué ?`code/main.py`La idea central en 30 líneas:

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

El FSM rastrea qué partes de la gramática hemos satisfecho hasta ahora. `valid_tokens(state, tokenizer)`Computa qué fichas de vocabulario pueden avanzar en el FSM sin dejar un camino de aceptación.

### Paso 2: Esbozos para el esquema JSON

```python
from pydantic import BaseModel
from typing import Literal
import outlines


class Review(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    evidence_span: str


model = outlines.models.transformers("meta-llama/Llama-3.2-3B-Instruct")
generator = outlines.generate.json(model, Review)

result = generator("Classify: 'The wait staff was attentive and the food arrived hot.'")
print(result)
# Review(sentiment='positive', confidence=0.93, evidence_span='attentive ... hot')
```

El FSM hace inaccesible la salida inválida.

### Paso 3: Instructor para Pydantic, que no sabe qué proveer

```python
import instructor
from anthropic import Anthropic
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)
    line_items: list[str]


client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,
    messages=[{"role": "user", "content": "Extract from: 'Acme Corp $420. Widget, Gizmo.'"}],
)
```

El instructor no toca los logits. Formata el esquema en el prompt, analiza la salida y vuelve a intentar el fallo de validación (por defecto 3 veces). Funciona con cualquier proveedor.

### Paso 4: API de proveedor nativo

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Classify: 'The food was cold.'"}],
    text={"format": {"type": "json_schema", "name": "sentiment",
          "schema": {"type": "object", "required": ["sentiment"],
                     "properties": {"sentiment": {"type": "string",
                                                  "enum": ["positive", "negative", "neutral"]}}}}},
)
print(response.output_parsed)
```

Descifrado limitado del lado del servidor. Paridad de fiabilidad con esquemas compatibles. No hay gestión de modelos locales. Lo bloquea al proveedor.

## Las trampas

- **Recursive schemas.**Los resultados estructurados en árboles (comentarios anidados, AST) necesitan XGrammar o llguidación (basada en CFG).
- **Huge enums.**Enum de 10,000 opciones se compiló lentamente o se descompuso.
- **Grammar too strict.**Fuerza .`date: "YYYY-MM-DD"`Regex y el modelo no pueden emitirse `"unknown"`El modelo compensa inventando una fecha.`null`o un sentinela.
- **Premature commitment.**Mira el trampaje de orden de campo arriba.
- **Vendor JSON mode without schema.**El modo JSON puro solo garantiza JSON válido, no válido *para su caso de uso*. Siempre proporcione un esquema completo.

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| OpenAI/Anthropic/Google model, simple schema | Native vendor structured output |
| Any provider, Pydantic workflow, can tolerate retries | Instructor |
| Local model, need 100% validity, flat schema | Outlines (FSM) |
| Local model, recursive schema | XGrammar or llguidance |
| Self-hosted inference server | vLLM guided decoding |
| Batch processing with retries acceptable | Instructor + cheapest model |

## Envío

Salvo como`outputs/skill-structured-output-picker.md`¿Qué es esto ?

```markdown
---
name: structured-output-picker
description: Choose a structured output approach, schema design, and validation plan.
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

Given a use case (provider, latency budget, schema complexity, failure tolerance), output:

1. Mechanism. Native vendor structured output, Instructor retries, Outlines FSM, or XGrammar CFG. One-sentence reason.
2. Schema design. Field order (reasoning first, answer last), nullable fields for "unknown", enum vs regex, required fields.
3. Failure strategy. Max retries, fallback model, graceful `null` handling, out-of-distribution refusal.
4. Validation plan. Schema compliance rate (target 100%), semantic validity (LLM-judge), field-coverage rate, latency p50/p99.

Refuse any design that puts `answer` or `decision` before reasoning fields. Refuse to use bare JSON mode without a schema. Flag recursive schemas behind an FSM-only library.
```

## Los ejercicios

1. **Easy.**Promete un pequeño modelo de pesos abiertos (por ejemplo, Llama-3.2-3B) sin descifrar con restricciones para `Review(sentiment, confidence, evidence_span)`. Medir la fracción que se analiza como JSON válido en 100 revisiones.
2. **Medium.**El mismo corpus con el modo JSON del esquema. Compara la tasa de cumplimiento, la latencia y la precisión semántica.
3. **Hard.**Implementar un decodificador con restricción de regex desde cero para números de teléfono (`\d{3}-\d{3}-\d{4}`Revisa 0 resultados no válidos en 1000 muestras.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Constrained decoding | Force valid output | Mask invalid-token logits at every generation step. |
| Logit processor | The thing that constrains | Function: `(logits, state) -> masked_logits`. |
| FSM | Finite-state machine | Compiled grammar representation; $O(1)$ valid-next-token lookup. |
| CFG | Context-free grammar | Grammar that handles recursion; slower but more expressive than FSM. |
| Schema field order | Does it matter? | Yes — first field commits; always put reasoning before answer. |
| Guided decoding | vLLM's name for it | Same concept, integrated into the inference server. |
| JSON mode | OpenAI's early version | Guarantees JSON syntax; does NOT guarantee schema match. |

## Leer más

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) el documento Outlines.
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) Descripción limitada rápida basada en CFG.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) Integración del servidor de inferencias.
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) Referencia de la API + gotchas.
- [Instructor library](https://python.useinstructor.com/) Pydantic + vuelve a intentar en todos los proveedores.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) evaluación comparativa 6 marcos de decodificación restringidos.
