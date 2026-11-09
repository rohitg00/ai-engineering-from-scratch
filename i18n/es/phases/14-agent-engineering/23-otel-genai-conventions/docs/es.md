# OpenTelemetry GenAI Convenciones semánticas

> El SIG GenAI de OpenTelemetry (lanzado en abril de 2024) define el esquema estándar para la telemetría de agentes. Los nombres de espacios, atributos y reglas de captura de contenido convergen entre los proveedores, por lo que los rastros de agentes significan lo mismo en Datadog, Grafana, Jaeger y Honeycomb.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre de las categorías de género de genAI: modelo/cliente, agente, herramienta.
- Distinguir`invoke_agent`CLIENT vs INTERNAL y cuando cada uno se aplica.
- Enumera los atributos de nivel superior de GenAI: nombre del proveedor, modelo de solicitud, ID de fuente de datos.
- Explica el contrato de captura de contenido: optar por participar, `OTEL_SEMCONV_STABILITY_OPT_IN`, recomendación de referencia externa.

## El problema

Cada proveedor inventa sus propios nombres de espacio. los equipos de operaciones terminan construyendo paneles de control por marco. el SIG GenAI de OpenTelemetry corrige esto definiendo un estándar para todos los objetivos del ecosistema.

## El concepto

### Categorías de extensión

1. **Model / client spans.**Cubre las llamadas de LLM crudas. Emitidas por los SDKs (Antropic, OpenAI, Bedrock) y adaptadores de modelos de marco.
2. **Agent spans.** `create_agent`(cuando se construye el agente) y `invoke_agent`(cuando se ejecuta).
3. **Tool spans.**Una por invocación de herramienta; conectada a la franja de agentes por relación padre-hijo.

### Nombramiento del agente span

- Nombre español: `invoke_agent {gen_ai.agent.name}`si se nombra; regreso a `invoke_agent`¿ Qué ?
- Tipo de espán:
  - **CLIENT** para los servicios de agentes remotos (OpenAI Assistants API, Bedrock Agents).
  - **INTERNAL** para los marcos de agentes en proceso (LangChain, CrewAI, local ReAct).

### Los atributos clave

- `gen_ai.provider.name`¿ Qué es esto ?`anthropic`¿ Qué ?`openai`¿ Qué ?`aws.bedrock`¿ Qué ?`google.vertex`¿ Qué ?
- `gen_ai.request.model` el modelo de identificación.
- `gen_ai.response.model` el modelo resuelto (puede diferir de la solicitud debido al enrutamiento).
- `gen_ai.agent.name`Identificación del agente.
- `gen_ai.operation.name`¿ Qué es esto ?`chat`¿ Qué ?`completion`¿ Qué ?`invoke_agent`¿ Qué ?`tool_call`¿ Qué ?
- `gen_ai.data_source.id` para RAG: qué cuerpo o almacén se consultó.

Existen convenciones específicas de tecnología para Anthropic, Azure AI Inference, AWS Bedrock, OpenAI.

### Captura de contenido

La regla predeterminada: las instrumentaciones NO DEVEN capturar entradas/salidas por defecto.

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

El patrón de producción recomendado: almacenar contenido externamente (S3, su registro de almacenamiento), registrar referencias en intervalos (ID de puntero, no en prosa). Esta es la Lección 27 de la defensa contra la intoxicación de contenido cableada en observabilidad.

### Estabilidad

La mayoría de las convenciones son experimentales a partir de marzo de 2026.

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ mapas GenAI atribuye nativamente a su esquema de observabilidad LLM. Otros fondos (Grafana, Honeycomb, Jaeger) apoyan los atributos crudos.

### Cuando este patrón va mal

- **Capturing full prompts in spans.**Información personal, secretos, datos de clientes en rastros que las operaciones pueden leer.
- **No `gen_ai.provider.name`.**Los tableros de múltiples proveedores se rompen cuando falta la atribución.
- **Spans without parent links.**Las herramientas huérfanas se extienden, siempre propagan el contexto.
- **Not setting stability opt-in.**Sus atributos pueden ser renombrados en la actualización de backend.

```figure
ae-genai-span-tree
```

## Construye el mismo

`code/main.py`Implementa un emisor de espacio de duración stdlib que coincida con las convenciones de GenAI:

- `Span`con el esquema de atributos GenAI.
- `Tracer`con`start_span`, contextos anidados.
- Un agente guionado que emite:`create_agent`¿ Qué ?`invoke_agent`(INTERNAL), extensiones por herramienta, `chat`Las llamadas de LLM.
- Un modo de captura de contenido que almacena las instrucciones externamente y registra las identidades en los intervalos.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: un árbol de extensión con todos los atributos GenAI requeridos y una "tienda externa" que muestra las referencias de contenido de opción.

## Usalo

- **Datadog LLM Observability**(v1.37+) los atributos de mapas nativos.
- **Langfuse / Phoenix / Opik**(Lección 24)  auto-instrumentos del ecosistema.
- **Jaeger / Honeycomb / Grafana Tempo** rastros OTel crudos; construir tablas de control a partir de los atributos GenAI.
- **Self-hosted** ejecutar el Colector OTel con un procesador GenAI.

## Envío

`outputs/skill-otel-genai.md`los cables OTel GenAI se extienden a un agente existente con capturas de contenido por defecto y almacenamiento de referencias externos.

## Los ejercicios

1. Instrumenta su Lección 01 Reacta el bucle con `invoke_agent`Envía a una instancia Jaeger.
2. Añadir captura de contenido en modo "sólo referencias": las instrucciones a SQLite, los atributos span solo llevan ID de fila.
3. Lea la especificación para `gen_ai.data_source.id`Envíala a tu búsqueda de Memorías de la Lección 09
4. Se ha establecido`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`y verificar que sus atributos no sean renombrados por el coleccionista.
5. Construir un tablero de control: "qué errores de herramienta se correlacionan con qué modelos" de los atributos de GenAI solamente.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI group" | OTel working group defining the schema |
| invoke_agent | "Agent span" | Name of the span representing an agent run |
| CLIENT span | "Remote call" | Span for a call to a remote agent service |
| INTERNAL span | "In-process" | Span for an in-process agent run |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG source" | Which corpus/store a retrieval hit |
| Content capture | "Prompt logging" | Opt-in capture of messages; store externally in prod |
| Stability opt-in | "Preview mode" | Env var to pin experimental conventions |

## Leer más

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) la especificación
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) GenAI se extiende por defecto
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Espacios de OTel incorporados
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) Profundización del contexto de las huellas de W3C
