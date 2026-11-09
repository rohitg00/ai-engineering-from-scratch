# Agentes de navegador y tareas web de largo plazo

> El agente ChatGPT (julio 2025) fusionó Operador y investigación profunda en un solo agente de navegador / terminal y estableció BrowseComp SOTA en el 68.9%. OpenAI cerró Operator el 31 de agosto de 2025  consolidación en la capa de producto. La adquisición de Vercept de Anthropic movió a Claude Sonnet en OSWorld de menos del 15% a 72,5%. WebArena-Verified (ServiceNow, ICLR 2026) fijó la tasa de falsos negativos del ~11.3% en el WebArena original y envió el subconjunto Hard de 258 tareas. Los números son reales. Así también es la superficie del ataque: el jefe de preparación de OpenAI declaró públicamente que la inyección indirecta de respuesta rápida en los agentes del navegador "no es un error que pueda ser completamente solucionado". Documentados 20252026 ataques: Memorias contaminadas (Atlas CSRF), HashJack (Red Cato), y secuestros de un solo clic en Perplexity Comet.

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## El problema

Un agente de navegador es un agente de largo horizonte que lee contenido no confiable y toma acciones consecuentes. Cada página que visita el agente es una entrada que el usuario no escribió. Cada formulario en cada página es un canal de comando potencial. El corpus de ataque 20252026 muestra que esto no es hipotético: Memorias contaminadas permite a un atacante vincular instrucciones maliciosas a la memoria del agente a través de una página elaborada; HashJack oculta comandos en fragmentos de URL que visita el agente; Perplexity Comet hijacks toman un solo clic.

El cuadro defensivo es incómodo. El jefe de preparación de OpenAI dijo que la parte silenciosa en voz alta: la inyección indirecta inmediata "no es un error que pueda ser completamente arreglado". Esto se debe a que el ataque vive en el límite de lectura-acción del agente, que es arquitectónicamente confuso.

Esta lección nombra la superficie de ataque, nombra el panorama de referencia (BrowseComp, OSWorld, WebArena-Verified), y modela un escenario mínimo de inyección indirecta inmediata para que pueda razonar sobre las defensas reales en las lecciones 14 y 18.

## El concepto

### El panorama de 2026, en un párrafo por sistema

**ChatGPT agent (OpenAI).**Se lanzó en julio de 2025. Unifica Operador (navegación) y Investigación profunda (investigación de varias horas). Cierra el Operador independiente el 31 de agosto de 2025. SOTA en BrowseComp en el 68.9%; fuertes números en OSWorld y WebArena-Verified.

**Claude Sonnet + Vercept (Anthropic).**La adquisición de Vercept de Anthropic se centró en las capacidades de uso de computadoras. Movió Claude Sonnet en OSWorld de <15% a 72,5%.

**Gemini 3 Pro with Browser Use (DeepMind).**La integración de uso del navegador permite controlar el uso de computadoras; FSF v3 (abril de 2026, lección 20) rastrea la autonomía en el dominio de I+D de ML específicamente.

**WebArena-Verified (ServiceNow, ICLR 2026).**Se solucionó un problema bien documentado: el WebArena original tenía ~11.3% tasa de falsos negativos (tareas marcadas que no se resolvieron). La versión verificada se reevalúa con criterios de éxito seleccionados por humanos y agrega un subconjunto Hard de 258 tareas (documento ICLR 2026, openreview.net/forum?id=94tlGxmqkN).

### BrowseComp vs OSWorld vs WebArena

| Benchmark | What it measures | Horizon |
|---|---|---|
| BrowseComp | Finding specific facts on the open web under time pressure | minutes |
| OSWorld | Agent operating a full desktop (mouse, keyboard, shell) | tens of minutes |
| WebArena-Verified | Transactional web tasks in simulated sites | minutes |
| Hard subset | WebArena-Verified tasks with multi-page state transitions | tens of minutes |

Los resultados de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de

### La superficie de ataque, llamada

1. **Indirect prompt injection.**El contenido de la página no confiable contiene instrucciones. El agente las lee. El agente las ejecuta. Ejemplos públicos: 2024 Kai Greshake et al., 2025 Tainted Memories paper, 2026 HashJack (Cato Networks).
2. **URL fragment / query injection.**El `#fragment`o una cadena de consulta de una URL rastreada contiene comandos. Nunca se ha renderizado visiblemente; todavía dentro del contexto del agente.
3. **Memory-binding attacks.**Page instruye al agente a escribir una memoria persistente (la lección 12 abarca el estado duradero).
4. **CSRF-shaped attacks on authenticated sessions.**Clase de Memorias contaminadas: el agente está conectado en algún lugar; la página del atacante emite solicitudes de cambio de estado que el agente ejecuta con las cookies del usuario.
5. **One-click hijack.**Un botón visualmente inofensivo conduce una carga útil que el agente sigue.
6. **Content-Security-Policy holes in the agent's host surface.**Las capas de renderización y herramientas pueden ser vetores de ataque; la pila de agente de navegador en navegador es amplia.

### ¿Por qué "no es completamente reparable"

El ataque es isomorfo a la capacidad del agente. El agente debe leer contenido no confiable para hacer su trabajo. Cualquier contenido que el agente lea podría contener instrucciones. Cualquier instrucción que el agente siga podría estar desalineada con la solicitud real del usuario. Las defensas (fronteras de confianza, clasificadores, listados de herramientas, HITL sobre acciones consecuentes) aumentan el costo del ataque y reducen su radio de explosión. No cierran la clase.

Este es el mismo patrón de razonamiento que el teorema de Lob (lección 8): el agente no puede probar que el siguiente token es seguro; sólo puede establecer un sistema donde los tokens inseguros son más detectables.

### La postura de defensa que realmente navega

- **Read / write boundary.**La lectura nunca es consecuente. Escribir (enviar un formulario, publicar contenido, llamar a una herramienta con efectos secundarios) requiere una nueva aprobación humana si el contenido iniciante provino de fuera de los límites de confianza.
- **Tool allowlist per task.**El agente puede navegar; no puede iniciar una transferencia bancaria a menos que esa herramienta esté explícitamente habilitada para la tarea.
- **Session isolation.**Las sesiones de agente de navegador se ejecutan con credenciales escogidas sólo. No hay autor de producción, no hay correo electrónico personal.
- **Content sanitizer.**El HTML extraído se deshace de los conocidos patrones malos antes de ser concatena en el contexto del modelo. (Reduce los ataques fáciles; no detiene cargas útiles sofisticadas.)
- **HITL on consequential actions.**Modelo de proposición y luego compromiso (lección 15).
- **Canary tokens on memory.**Si se dispara una entrada de memoria, el usuario la ve (lección 14).

```figure
injection-boundary
```

## Usalo

`code/main.py`El guión muestra (a) lo que haría un agente ingenuo, (b) lo que captura un límite de lectura/escritura, (c) lo que captura un desinfectante, (d) lo que ninguna captura.

## Envío

`outputs/skill-browser-agent-trust-boundary.md`El objetivo de la evaluación de los resultados de la evaluación de los resultados de la evaluación de los resultados de la evaluación de los resultados de la evaluación de los resultados de la evaluación de los resultados de la evaluación de los resultados de la evaluación de los resultados de la evaluación de los resultados de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de los resultados de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la cuento es es es es es es es es es es es es es una evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Identificar qué ataque captura el desinfectante pero no el límite de lectura/escritura y qué ataque sólo captura el límite de lectura/escritura.

2. Extenda el desinfectante para detectar una clase de inyección de fragmentos de URL al estilo HashJack. Mide la tasa de falsos positivos en URL benignos con fragmentos legítimos.

3. Seleccione un flujo de trabajo de agente de navegador real que conozca (por ejemplo, "reserva un vuelo").

4. Lea el documento ICLR 2026 de WebArena Verified. Identifique una categoría de tarea en la que la puntuación original de WebArena no era confiable y explique cómo el subconjunto Verified lo resuelve.

5. Diseñar un canario de memoria para un navegador. ¿Qué almacenarías, dónde y qué activa la alarma?

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Indirect prompt injection | "Bad page text" | Untrusted content in a page the agent reads contains instructions the agent executes |
| Tainted Memories | "Memory attack" | Agent writes an attacker-supplied instruction to durable memory; triggered next session |
| HashJack | "URL fragment attack" | Payload hidden in URL fragment / query string is in the agent's context but not visibly rendered |
| One-click hijack | "Bad button" | Visible affordance rides a follow-on payload the agent executes |
| BrowseComp | "Web search benchmark" | Finding specific facts on the open web; minute-scale horizon |
| OSWorld | "Desktop benchmark" | Full OS control; multi-step GUI tasks |
| WebArena-Verified | "Fixed web-task benchmark" | ServiceNow's regraded WebArena with Hard subset |
| Read/write boundary | "Side-effect gate" | Reading never consequential; writing requires fresh approval if content is out-of-trust |

## Leer más

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) fusionar el operador y la investigación profunda; BrowseComp SOTA.
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) el linaje del Operador y la arquitectura que se convirtió en el agente de ChatGPT.
- [Zhou et al. — WebArena](https://webarena.dev/) el índice de referencia original.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) Papel ICLR 2026 de subconjunto fijo.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) incluye la discusión sobre la superficie de ataque para agentes de uso informático.
