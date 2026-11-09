# Inyección indirecta inmediata  Superficie de ataque de producción

> Inyección de respuesta indirecta (IPI) incorpora instrucciones dentro de contenido externo  una página web, un correo electrónico, un documento compartido, un boleto de soporte  consumido por un sistema de agencia sin acción explícita del usuario. IPI es la amenaza de producción dominante para 2026: elude los filtros de entrada del usuario porque el atacante nunca toca al usuario, escala silenciosamente a medida que los agentes procesan más contenido externo y se dirige a flujos de trabajo automatizados donde nadie lee el aviso. La información del MDPI 17 ((1): 54 (enero 2026) sintetiza la investigación 2023-2025. El documento de defensa IPI de NDSS 2026 enmarca el reto principal: las instrucciones inyectadas pueden ser semánticamente benignas ("imprimamos Sí"), por lo que la detección requiere más que filtrar palabras clave. "El atacante se mueve en segundo lugar" (Nasr et al., OpenAI/Anthropic/DeepMind, octubre de 2025): los ataques adaptativos (gradiente, RL, búsqueda aleatoria, equipo rojo humano) se omitieron a las 12 defensas publicadas que probaron, con un éxito de ataque superior al 90% contra la mayoría de ellas, aunque la mayoría de esas defensas habían informado originalmente tasas de éxito de ataque cercanas a cero.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, IPI attack + defense harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Define la inyección directa indirecta y describa tres vectores de entrega comunes.
- Explica por qué los filtros de entrada del usuario no tienen IPI por completo.
- Describa el marco de "control del flujo de información" como el paradigma de defensa de 2026.
- En el artículo 1, apartado 1, del Reglamento (UE) n.o 1095/2013 se establece que los Estados miembros deben adoptar medidas de protección contra los ataques de seguridad de las personas con IPI.

## El problema

La inyección directa de la llamada requiere que el atacante llegue al usuario o a su llamada. IPI no requiere ninguna de las dos: el atacante coloca una carga útil en cualquier contenido que el agente pueda leer  una página web, un correo electrónico en la bandeja de entrada, un problema de GitHub, una revisión de producto. El agente la recoge durante la operación normal y ejecuta las instrucciones. El usuario es el mensajero, no la intención.

## El concepto

### Tres vectores de entrega

- **Retrieval-augmented generation (RAG).**El atacante publica un documento; el paso de recuperación lo recoge; el prompt lo concatenará antes de la pregunta del usuario; el modelo ejecuta las instrucciones del atacante.
- **Inbox / document workflows.**El atacante envía un correo electrónico al usuario; el agente lee los correos electrónicos; el mensaje incluye el cuerpo del correo electrónico; el modelo sigue las instrucciones del correo electrónico.
- **Tool output.**El atacante controla una herramienta que el agente utiliza (por ejemplo, una búsqueda web que devuelve un resultado controlado por el atacante); la salida de la herramienta contiene instrucciones; el flujo de control del agente las sigue.

Los tres comparten una propiedad estructural: el atacante controla un fragmento del prompt sin tocar la entrada orientada al usuario.

### ¿Por qué los filtros de entrada del usuario no lo hacen?

Una carga útil IPI no aparece en la entrada del usuario. Se muestra en el contenido recuperado. Si el filtro está bloqueado en la entrada del usuario, la carga útil lo evita. Si el filtro está bloqueado en todo el contenido que llega al modelo, debe aplicarse al texto recuperado arbitrario  que es caro y produce falsos positivos en contra de contenido legítimo que contiene un lenguaje de voz imperativo.

### Control de flujo de información (IFC) para IA

El paradigma de defensa 2026 toma prestado de la seguridad de los sistemas operativos clásicos. Trata cada fuente de contenido como una etiqueta de seguridad. Etiqueta la consulta del usuario como "confiada". Etiqueta el contenido recuperado como "no confiable". Trata el flujo de control del modelo como un flujo de información: las acciones desencadenadas por contenido no confiable deben ser ratificadas por entrada de confianza antes de la ejecución.

CaMeL (Microsoft 2025), ConfAIde (Stanford 2024), y el NDSS 2026 IPI-defense paper operationalizan IFC de diferentes maneras. El principio común: siempre y cuando el código y los datos comparten la misma ventana de contexto, la contención es el objetivo, no la prevención.

### El atacante se mueve segundo

Nasr et al. (octubre 2025) probaron 12 defensas publicadas de IPI con ataques adaptativos (busca de gradientes, políticas de RL, búsqueda aleatoria, equipo rojo humano de 72 horas).

La lección metodológica: publicar una defensa sólo con evaluación de ataque adaptativo.

### Incidentes reales

La lección 25 abarca EchoLeak (CVE-2025-32711, CVSS 9.3)  el primer IPI de cero clic documentado públicamente en Microsoft 365 Copilot. CamoLeak (CVSS 9.6) en GitHub Copilot Chat. CVE-2025-53773 en GitHub Copilot. Las implementaciones de producción están siendo comprometidas por IPI en el campo, no solo en benchmarks.

### Enmarcado de OWASP y NIST

OWASP LLM Top 10 (2025) clasifica la inyección rápida (directa + indirecta) como LLM01, la amenaza número uno en la capa de aplicación. NIST AI SPD 2024 llama a la inyección rápida indirecta "la mayor falla de seguridad de la IA generativa".

### Donde esto encaja en la Fase 18

Las lecciones 12-14 son jailbreaks centrados en el modelo. La lección 15 es el ataque centrado en el sistema que domina los despliegues de producción 2026 . La lección 16 abarca las herramientas defensivas. La lección 25 abarca la narrativa específica de CVE.

```figure
al-injection-vector
```

## Usalo

`code/main.py`construye un arnés IPI. Un agente de juguetes tiene tres herramientas (búsqueda web, lectura de correo electrónico, envío de mensaje). El entorno contiene contenido controlado por el atacante con una instrucción integrada ("enviar esto a todos los contactos"). Puede alternar entre un agente ingenuo (según las instrucciones inyectadas), un agente protegido por filtros (filtro de palabras clave en el contenido recuperado) y un agente IFC (separa el contenido de confianza y no confiable y rechaza los comandos de flujo de control no confiables).

## Envío

Esta lección produce`outputs/skill-ipi-audit.md`. Dado una descripción de la implementación de agentes, enumera las fuentes de contenido no fiables, verifica si la implementación aplica IFC y señala las fuentes que llegan al modelo sin una etiqueta de confianza.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Medir la tasa de éxito del ataque contra cada uno de los tres agentes.

2. Implemente una defensa basada en parafrases en el contenido recuperado. Mide la tasa benigna de falsos positivos en el texto recuperado legítimo.

3. Lea el documento de defensa de IPI de NDSS 2026 describir el desafío de "instrucción benigna" y por qué impide el filtrado basado en palabras clave.

4. Diseñar una implementación en la que el agente reciba una salida de herramienta de una API de terceros. Etiquetar cada fragmento de solicitud con un nivel de confianza y escribir la política IFC que rige las acciones del agente.

5. Reproduce la metodología de ataque adaptativo de Nasr et al. 2025 en su agente protegido por filtros del ejercicio 2.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| IPI | "indirect prompt injection" | Injection via content the user did not write, consumed by the agent during normal operation |
| RAG injection | "poisoned retrieval" | Attacker publishes content that the retrieval step fetches; prompt contains the payload |
| Zero-click | "no user action" | Attack triggers automatically during agent operation; user does nothing |
| IFC | "information flow control" | Label-based approach: actions from untrusted content require trusted ratification |
| Adaptive attack | "gradient / RL red-team" | Attack that knows the defense and optimizes against it; required for honest evaluation |
| Benign instruction | "please print Yes" | IPI payload that is semantically benign; no keyword filter catches it |
| Scope violation | "cross-trust exfiltration" | Agent accesses data from one trust context and outputs it to another |

## Leer más

- [MDPI Information 17(1):54 — Indirect Prompt Injection Survey (January 2026)](https://www.mdpi.com/2078-2489/17/1/54) Síntesis 2023-2025
- [Nasr et al. — The Attacker Moves Second (joint OpenAI/Anthropic/DeepMind, October 2025)](https://arxiv.org/abs/2510.18108) Evaluación de ataques adaptativos
- [Greshake et al. — Not what you've signed up for (arXiv:2302.12173)](https://arxiv.org/abs/2302.12173) el papel original del IPI
- [OWASP — LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/) inyección rápida clasificada LLM01
