# Chatbots  Reglas basadas en Neural para LLM Agentes

> ELIZA respondió con patrones de coincidencias. DialogFlow mapeó las intenciones. GPT respondió desde pesas. Claude ejecuta herramientas y verifica. Cada era resolvió el peor fracaso de la anterior.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## El problema

Un usuario dice "Quiero cambiar mi vuelo". El sistema tiene que averiguar lo que quiere, qué información le falta, cómo obtenerla y cómo completar la acción. Luego el usuario dice "esperar, ¿qué pasa si cancelo en su lugar?" y el sistema tiene que recordar el contexto, cambiar las tareas y preservar el estado.

La conversación es difícil para un sistema ML. La entrada es abierta. La salida tiene que ser coherente en muchos giros. El sistema puede necesitar actuar sobre el mundo (cambiar un vuelo, cargar una tarjeta). Cada paso equivocado es visible para el usuario.

Las arquitecturas de chatbot han recorrido cuatro paradigmas, cada uno introducido porque el anterior falló demasiado visiblemente. Esta lección los lleva en orden. El panorama de producción de 2026 es un híbrido de los dos últimos.

## El concepto

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### El medio siglo escrito, 1950-2001

El primer paradigma no duró cinco años. Duró cincuenta. Saber su arco importa porque cada sistema en él es la misma máquina  coincide con la entrada, emite una respuesta enlatada, actualiza un pequeño estado  y cincuenta años de agregar reglas a esa máquina nunca produjo el caso general. Ese techo es por qué existen paradigmas de dos a cuatro.

**1950.**Turing evita "¿pueden pensar las máquinas?" al proponer un reemplazo operativo: si un interrogador no puede distinguir la máquina de una persona a través de un teletipo, la pregunta filosófica es discutida.

**1956.**El nombre llega a un taller de verano en Dartmouth con monedas de "inteligencia artificial" en la conjetura de que cada característica de la inteligencia "puede ser descrita en principio con tanta precisión que se puede hacer una máquina para simularla".

**1966.**ELIZA envía el truco de reflexión que construye en el paso 1: las reglas de descomposición extraen fragmentos de la entrada, las reglas de reensamblaje se hacen eco como preguntas. Alrededor de 200 patrones totales, estado cero, entendimiento cero  y los usuarios confiaron en ello de todos modos. Weizenbaum pasó el resto de su carrera alarmado por lo poca maquinaria que tomó.

**1972.**PARRY, construido en Stanford para modelar la paranoia, agrega la pieza que ELIZA carecía: el estado interno. Las variables numéricas para el miedo, la ira y la desconfianza se actualizan en cada giro y puerta que el guión dispara a continuación, por lo que las entradas idénticas producen diferentes respuestas dependiendo de la conversación hasta ahora. En una prueba de transcripción ciega, los psiquiatras distinguían a PARRY de los pacientes humanos por casualidad. Es el antepasado directo del condicionamiento de persona  un sistema de instancia implementado como tres flotadores. Ese mismo año, los dos bots se apuntaron entre sí a través de ARPANET: un guión de terapeuta entrevistando a una máquina de estado paranoico, la primera conversación bot-to-bot en una red.

**1995.**ALICE escala la receta ELIZA con AIML, un dialecto XML para pares de patrones y plantillas. Aproximadamente 40.000 categorías escritas a mano, tres premios Loebner ganan. Probó la ley de escala de los sistemas basados en reglas: más reglas compran cobertura, nunca generalidad. Cada regla es un pasivo que alguien debe mantener.

**2001.**SmarterChild pone la receta delante de 30 millones de usuarios de mensajería instantánea y añade búsquedas de fondo  clima, acciones, horarios de películas  en plantillas.

El paradigma terminó no porque alguien lo refurió sino porque el costo de mantenimiento de las máquinas de estado escritas a mano crece linealmente con la cobertura mientras que las expectativas de los usuarios crecen con lo que vieron la semana pasada.

```figure
chatbot-lineage
```

**Rule-based (ELIZA, AIML, DialogFlow).**Los patrones escritos a mano coinciden con las entradas del usuario y producen respuestas. Los clasificadores de intenciones se dirigen a flujos predefinidos. Las máquinas de llenado de ranura recopilan la información requerida. Funciona brillantemente dentro del escopo estrecho para el que fue diseñado. Fallece inmediatamente fuera de él. Aún navega en dominios críticos para la seguridad (autenticación bancaria, reserva de aerolíneas) donde no se tolera la alucinación.

**Retrieval-based.**Un sistema de estilo FAQ. Encifre cada par de (expresión, respuesta). En el tiempo de ejecución, codifica el mensaje del usuario y recupera la respuesta almacenada más cercana. Piensa en la característica clásica de "artículos similares" de Zendesk. Maneja parafrazas mejor que reglas.

**Neural (seq2seq).**El codificador-decodificador está entrenado en registros de conversaciones. Genera respuestas desde cero. Fluido pero propenso a las salidas genéricas ("no sé") y la deriva factual. Nunca confiable en el tema. La razón por la que Google, Facebook y Microsoft tuvieron chatbots decepcionantes en 2016-2019.

**LLM agents.**Un modelo de lenguaje envuelto en un bucle que planifica, llama a herramientas y verifica los resultados. No un chatbot con un prompt largo. Un bucle de agente: planificar → llamar herramienta → observar el resultado → decidir el siguiente paso. La tierración de la recuperación primero (RAG) lo impide alucinar. Las llamadas de herramientas le permiten hacer cosas. Esta es la arquitectura de 2026.

Los cuatro paradigmas no son reemplazos secuenciales. Un chatbot de producción 2026 recorre los cuatro rutas: basado en reglas para la autenticación y acciones destructivas, recuperación para preguntas frecuentes, generación neuronal para la fraseo natural, agente LLM para consultas abiertas ambiguas.

## Construye el mismo

### Paso 1: emparejamiento de patrones basado en reglas

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(.*)", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "I don't understand."
```

ELIZA en 20 líneas. El truco de reflexión ("Me siento triste" → "Por qué te sientes triste") es la demostración canónica del psicoterapeuta de Weizenbaum 1966.

### Paso 2: basado en la recuperación (FAQ)

Este fragmento ilustrativo requiere`pip install sentence-transformers`El ejecutivo .`code/main.py`para esta lección utiliza una similitud de Stdlib Jaccard en su lugar, por lo que la lección se ejecuta sin dependencias externas.

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items, original packaging."),
]


encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
faq_questions = [q for q, _ in FAQ]
faq_embeddings = encoder.encode(faq_questions, normalize_embeddings=True)


def faq_respond(user_input, threshold=0.5):
    q_emb = encoder.encode([user_input], normalize_embeddings=True)[0]
    sims = faq_embeddings @ q_emb
    best = int(np.argmax(sims))
    if sims[best] < threshold:
        return None
    return FAQ[best][1]
```

El rechazo basado en el umbral es la elección clave del diseño.`None`y dejar que el sistema se intensifique.

### Paso 3: generación neuronal (línea de base)

Utilice un pequeño codificador-decodificador con ajuste de instrucciones (FLAN-T5) o un modelo de conversación con ajuste fino. Producción-inutilible por sí sola en 2026 (contradición, deriva fuera de tema, disparate de hecho), pero barcos dentro de sistemas híbridos para la fraseo natural. Los modelos con decodificador solo de estilo DialoGPT necesitan separadores de giro explícitos y manejo EOS para producir respuestas coherentes; un modelo de texto de texto FLAN-T5 funciona de la caja para un ejemplo de enseñanza.

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### Paso 4: Lugar de agentes de LLM

La forma de producción de 2026:

```python
def agent_loop(user_message, tools, llm, max_steps=5):
    history = [{"role": "user", "content": user_message}]
    for _ in range(max_steps):
        response = llm(history, tools=tools)
        tool_call = response.get("tool_call")
        if tool_call:
            tool_name = tool_call.get("name")
            args = tool_call.get("arguments")
            if not isinstance(tool_name, str) or tool_name not in tools:
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": str(tool_name), "content": f"error: unknown tool {tool_name!r}"})
                continue
            if not isinstance(args, dict):
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": tool_name, "content": f"error: arguments must be a dict, got {type(args).__name__}"})
                continue
            fn = tools[tool_name]
            result = fn(**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

Las herramientas son funciones llamables que el LLM puede invocar. El ciclo termina cuando el LLM devuelve una respuesta final en lugar de una llamada de herramienta. El presupuesto de paso evita bucles infinitos en tareas ambigüas.

La producción real añade: la primera toma de tierra (injectar documentos relevantes antes de cada llamada de LLM), barandillas (rechazar acciones destructivas sin confirmación), observabilidad (logar cada paso) y evaluaciones (comprobas automatizadas de que el comportamiento del agente se mantiene en la especificación).

### Paso 5: Enrutamiento híbrido

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)
```

El patrón: reglas deterministas para cualquier cosa destructiva, recuperación para las preguntas frecuentes enlatadas, agentes de LLM para todo lo demás. Esto es lo que se lanza en 2026 sistemas de soporte al cliente.

## Usalo

La pila de 2026:

| Use case | Architecture |
|---------|---------------|
| Booking, payment, authentication | Rule-based state machines + slot filling |
| Customer support FAQs | Retrieval over curated answers |
| Open-ended help chat | LLM agent with RAG + tool calls |
| Internal tools / IDE assistants | LLM agent with tool calls (search, read, write) |
| Companion / character chatbots | Tuned LLM with persona system prompt, retrieval on knowledge |

Siempre utilice el enrutamiento híbrido en la producción. Ninguna arquitectura única maneja bien todas las solicitudes. La capa de enrutamiento en sí misma es típicamente un clasificador de intenciones pequeño.

## Modo de falla que todavía se envíe

- **Confident fabrication.**El agente de la LLM afirma que completó una acción que no hizo.
- **Prompt injection.**El usuario inserta texto que anula el pedido del sistema. LLM01 clasificado en el Top 10 de OWASP para aplicaciones LLM 2025. Dos sabores: inyección directa (pesteada en el chat) e inyección indirecta (oculta en documentos, correos electrónicos o salidas de herramientas que el agente lee).

  Las tasas de ataque varían según el escenario. Las tasas de éxito medidas varían entre ~0,5-8,5% en los modelos fronterizos en los índices de referencia generales de uso de herramientas y codificación. Las configuraciones específicas de alto riesgo (ataques adaptativos contra agentes de codificación de IA, orquestación vulnerable) han alcanzado el ~84%. Los CVEs de producción incluyen EchoLeak (CVE-2025-32711, CVSS 9.3)  un error de exfiltración de datos con clic cero en Microsoft 365 Copilot desencadenado por un correo electrónico controlado por el atacante.

  Mitigations: tratar la entrada del usuario como no confiable a lo largo del bucle; desinfectar antes de las llamadas de la herramienta; aislar las salidas de la herramienta del prompt principal; utilizar el patrón Plan-Verify-Execute (PVE) donde el agente planea primero, luego verifica cada acción contra ese plan antes de ejecutar (esto detiene los resultados de la herramienta de inyectar nuevas acciones no planificadas); requiere la confirmación del usuario para acciones destructivas; aplicar menos privilegios a los ámbitos de la herramienta.

  No hay una cantidad de ingeniería rápida que elimine completamente este riesgo.
- **Scope creep.**El agente se va fuera de la tarea porque una llamada de herramienta devuelve información tangencialmente relacionada. Mitigation: estrechos contratos de herramientas; mantener el sistema en contacto enfocado; agregar evaluaciones para la tasa fuera de la tarea.
- **Infinite loops.**El agente sigue llamando a la misma herramienta, la mitigación: presupuesto de paso, la deduplicación de la llamada de herramienta, el juez de LLM sobre "estamos haciendo progresos".
- **Context window exhaustion.**Las conversaciones largas empujan los primeros turnos fuera del contexto. La mitigación: resumir los turnos más antiguos, recuperar los turnos anteriores relevantes por similitud o usar un modelo de contexto largo.

## Envío

Salvo como`outputs/skill-chatbot-architect.md`¿Qué es esto ?

```markdown
---
name: chatbot-architect
description: Design a chatbot stack for a given use case.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Given a product context (user need, compliance constraints, available tools, data volume), output:

1. Architecture. Rule-based, retrieval, neural, LLM agent, or hybrid (specify which paths go where).
2. LLM choice if applicable. Name the model family (Claude, GPT-4, Llama-3.1, Mixtral). Match to tool-use quality and cost.
3. Grounding strategy. RAG sources, retrieval method (see lesson 14), tool contracts.
4. Evaluation plan. Task success rate, tool-call correctness, off-task rate, hallucination rate on held-out dialogs.

Refuse to recommend a pure-LLM agent for any destructive action (payments, account deletion, data modification) without a structured confirmation flow. Refuse to skip the prompt-injection audit if the agent has write access to anything.
```

## Los ejercicios

1. **Easy.**Implemente la respuesta basada en reglas arriba con 10 patrones para un bot de pedidos de cafetería.
2. **Medium.**Construir una FAQ híbrida + fallback LLM. 50 entradas de FAQ enlatadas para un producto SaaS, fallback LLM con recuperación en el sitio de documentos. Medir la tasa de rechazo y la precisión en 100 preguntas de soporte reales.
3. **Hard.**Implemente el bucle de agente de arriba con tres herramientas (búsqueda, datos de usuario-lectura, envío de correo electrónico). Realice una evaluación con 50 escenarios de prueba, incluidos los intentos de inyección rápida.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Intent | What the user wants | Categorical label (book_flight, reset_password). Routed to a handler. |
| Slot | A piece of info | Parameter the bot needs (date, destination). Slot filling is the sequence of asks. |
| RAG | Retrieval plus generation | Retrieve relevant docs, then ground the LLM's response. |
| Tool call | Function invocation | LLM emits a structured call with name + args. Runtime executes, returns result. |
| Agent loop | Plan, act, verify | Controller that runs LLM calls interleaved with tool calls until task complete. |
| Prompt injection | User attacks prompt | Malicious input that tries to override the system prompt. |

## Leer más

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) el documento que hizo de la conversación el punto de referencia del campo.
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) el papel original basado en reglas chatbot.
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6)  La arquitectura de variantes de efecto de PARRY, el primer chatbot con estado.
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239) El artículo de Google sobre chatbot neuronal, justo antes de que los agentes del LLM tomaran el control.
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) el papel que nombró el patrón de bucle del agente.
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) 2024 de la producción de la orientación que todavía se mantiene en 2026.
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) el papel de inyección rápida.
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) el ranking que hizo que la inyección rápida fuera la principal preocupación de seguridad.
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) Defiencias prácticas en la capa de orquestación, incluidos los flujos de Plan-Verificar-Ejecutar y de confirmación por parte del usuario.
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) el CVE canónico de exfiltración de datos con clic cero de inyección directa indirecta.
