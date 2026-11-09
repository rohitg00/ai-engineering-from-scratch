# El seguimiento del estado del diálogo

> "Quiero un restaurante barato en el norte... en realidad hacer moderado... y añadir italiano". Tres vueltas, tres actualizaciones estatales.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## El problema

En un sistema de diálogo orientado a tareas, el objetivo del usuario se codifica como un conjunto de pares de valores de ranura: `{cuisine: italian, area: north, price: moderate}`Cada turno de usuario puede añadir, cambiar o eliminar una ranura. El sistema debe leer toda la conversación y emitir el estado actual correctamente.

Si se comete un error en un solo espacio, el sistema reserva el restaurante equivocado, programa el vuelo equivocado o carga la tarjeta equivocada.

Por qué todavía importa en 2026 a pesar de los LLM:

- Los dominios sensibles al cumplimiento (banco, salud, reservas de aerolíneas) requieren valores deterministas de ranuras, no generación de forma libre.
- Los agentes de uso de herramientas aún necesitan resolución de ranura antes de llamar a las API.
- La corrección de varios giros es más difícil de lo que parece: "en realidad no, hazlo el jueves".

El oleoducto moderno: conceptos clásicos de DST + extractores de LLM + barandillas de salida estructuradas.

## El concepto

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.**Un esquema define dominios (restaurante, hotel, taxi) y sus ranuras (cucina, área, precio, personas). Cada ranura puede ser vacía, llena con un valor de un conjunto cerrado (precio: {barato, moderado, caro}), o un valor de forma libre (nombre: "The Copper Kettle").

**Two DST formulations.**

- **Classification.**Para cada par (slot, candidate_value), predecir sí/no. Funciona para slots de vocabulario cerrado. Estándar pre-2020.
- **Generation.**Dado el diálogo, generar valores de ranura como texto libre. Funciona para ranuras de vocabulario abierto.

**Metric.**Precisión de objetivos conjuntos (JGA)  la fracción de vueltas en las que * cada * ranura es correcta. Todo o nada. MultiWOZ 2.4 encabeza el ranking alrededor del 83% en 2026.

**Architectures.**

1. **Rule-based (slot regex + keyword).**Un punto de partida fuerte para dominios estrechos.
2. **TripPy / BERT-DST.**Generación basada en copias con codificación BERT.
3. **LDST (LLaMA + LoRA).**LLM con instrucción ajustada con dominio-slot. Llega a la calidad de nivel ChatGPT en MultiWOZ 2.4.
4. **Ontology-free (2024–26).**Salta el esquema, genera nombres y valores de ranuras directamente.
5. **Prompt + structured output (2024–26).**LLM con esquema Pydantic + decodificación limitada. 5 líneas de código, listo para producción.

### Los modos de falla clásicos

- **Co-reference across turns.**"Vamos a quedar con la primera opción". Necesita resolver cuál opción.
- **Over-write vs append.**El usuario dice "agrega italiano". ¿Sustituye la cocina o añade?
- **Implicit confirmations.**"OK, genial". ¿Acceptó la reserva ofrecida?
- **Correction.**"De hecho, es a las 7 p.m". Debe actualizar la hora sin despejar otras ranuras.
- **Coreference to previous system utterance.**"Sí, esa". ¿Qué "eso"?

```figure
n5-slot-tracker
```

## Construye el mismo

### Paso 1: Extractor de ranuras basado en reglas

¿ Qué ?`code/main.py`. Los diccionarios de regex + sinónimos cubren el 70% de las declaraciones canónicas en dominios estrechos:

```python
CUISINE_SYNONYMS = {
    "italian": ["italian", "pasta", "pizza", "italy"],
    "chinese": ["chinese", "chow mein", "noodles"],
}


def extract_cuisine(utterance):
    for canonical, synonyms in CUISINE_SYNONYMS.items():
        if any(syn in utterance.lower() for syn in synonyms):
            return canonical
    return None
```

Es un poco más que el vocabulario canónico, funciona para las confirmaciones de ranuras deterministas.

### Paso 2: ciclo de actualización de estado

```python
def update_state(state, utterance):
    new_state = dict(state)
    for slot, extractor in SLOT_EXTRACTORS.items():
        value = extractor(utterance)
        if value is not None:
            new_state[slot] = value
    for slot in NEGATION_CLEARS:
        if is_negated(utterance, slot):
            new_state[slot] = None
    return new_state
```

Tres invariantes:

- Nunca restablezca una ranura que el usuario no haya tocado.
- La negación explícita ("no importa la cocina") debe ser clara.
- La corrección de usuario ("actualmente...") debe sobrescribirse, no añadirse.

### Paso 3: DST impulsado por el LLM con salida estructurada

```python
from pydantic import BaseModel
from typing import Literal, Optional
import instructor

class RestaurantState(BaseModel):
    cuisine: Optional[Literal["italian", "chinese", "indian", "thai", "any"]] = None
    area: Optional[Literal["north", "south", "east", "west", "center"]] = None
    price: Optional[Literal["cheap", "moderate", "expensive"]] = None
    people: Optional[int] = None
    day: Optional[str] = None


def llm_dst(history, llm):
    prompt = f"""You track the slot values of a restaurant booking across turns.
Dialogue so far:
{render(history)}

Update the state based on the latest user turn. Output only the JSON state."""
    return llm(prompt, response_model=RestaurantState)
```

Instructor + Pydantic garantiza un objeto de estado válido.

### Paso 4: Evaluación de las AAC

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

Calibración: ¿qué fracción de vueltas obtiene el sistema TODAS las ranuras correctas? para MultiWOZ 2.4, los mejores sistemas 2026: 80-83%.

### Paso 5: corrección de manipulación

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

En una corrección detectada, sobrescriba la ranura última actualizada en lugar de agregar. Es difícil de conseguir sin la ayuda del LLM. El patrón moderno: siempre deje que el LLM regenere todo el estado de la historia en lugar de actualizar gradualmente.

## Las trampas

- **Full-history regeneration cost.**Permitir que el MLL se regenere cada vez más .$O(n^2)$Los tokens totales. historial de cap o resumen de los giros más antiguos.
- **Schema drift.**Añadir nuevas ranuras después del hoc rompe los datos de entrenamiento antiguos.
- **Case sensitivity.**"Italiano" vs "italiano" vs "italiano"  se normalizan en todas partes.
- **Implicit inheritance.**Si el usuario ha especificado previamente "para 4 personas", una nueva solicitud para un tiempo diferente no debe eliminar a las personas.
- **Free-form vs closed-set.**Los nombres, horas y direcciones necesitan espacios libres; las cocinas y áreas están cerradas.

## Usalo

La pila de 2026:

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## Envío

Salvo como`outputs/skill-dst-designer.md`¿Qué es esto ?

```markdown
---
name: dst-designer
description: Design a dialogue state tracker — schema, extractor, update policy, evaluation.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Given a use case (domain, languages, vocab openness, compliance needs), output:

1. Schema. Domain list, slots per domain, open vs closed vocabulary per slot.
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic. Reason.
3. Update policy. Regenerate-whole-state / incremental; correction handling; negation handling.
4. Evaluation. Joint Goal Accuracy on a held-out dialogue set, slot-level precision/recall, confusion on the hardest slot.
5. Confirmation flow. When to explicitly ask the user to confirm (destructive actions, low-confidence extractions).

Refuse LLM-only DST for compliance-sensitive slots without a rule-based secondary check. Refuse any DST that cannot roll back a slot on user correction. Flag schemas without version tags.
```

## Los ejercicios

1. **Easy.**Construir el rastreador de estado basado en reglas en `code/main.py`Para 3 ranuras (cucina, área, precio) Prueba en 10 diálogos hechos a mano.
2. **Medium.**El mismo conjunto de datos con Instructor + Pydantic + un LLM pequeño. Comparar JGA. Inspeccionar las curvas más duras.
3. **Hard.**Implementar tanto como la ruta: primaria basada en reglas, LLM fallback cuando la regla basada emite < 2 ranuras con confianza.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking | Maintain the slot-value dict across dialogue turns. |
| Slot | Unit of user intent | Named parameter the backend needs (cuisine, date). |
| Domain | The task area | Restaurant, hotel, taxi — sets of slots. |
| JGA | Joint Goal Accuracy | Fraction of turns where every slot is correct. All-or-nothing. |
| MultiWOZ | The benchmark | Multi-domain WOZ dataset; standard DST evaluation. |
| Ontology-free DST | No schema | Generate slot names and values directly, no fixed list. |
| Correction | "Actually..." | Turn that overwrites a previously-filled slot. |

## Leer más

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) el índice de referencia canónico.
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) La LLaMA + LoRA para la instrucción de DST.
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) el caballo de trabajo DST basado en copias.
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) TOD no supervisado basado en EM.
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) resultados canónicos de DST.
