# SDK de agentes OpenAI: transferencias, vigilancia, rastreo

> OpenAI Agents SDK es el marco multi-agente ligero construido sobre la API de Respuestas. Cinco primitivas: Agente, Handoff, Guardrail, Sesión, Tracing.`transfer_to_<agent>`Los guardrails se bloquean en entrada o salida.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Nombre de las cinco primitivas del OpenAI Agents SDK.
- Explica las entregas: por qué se modelan como herramientas, qué forma de nombre ve el modelo y cómo se transfiere el contexto.
- Distinguir entre barandillas de entrada, barandillas de salida y barandillas de herramientas; explicar `run_in_parallel`en modo de bloqueo.
- Implementar un tiempo de ejecución de stdlib con remesas + barandillas + rastreo de estilo span.

## El problema

Los agentes que no pueden delegar limpiamente terminan llenando todo en un solo instante. Los agentes sin barandillas envían PII, salida que viola las políticas o bucle para siempre.

## El concepto

### Cinco primitivos

1. **Agent.**LLM + instrucciones + herramientas + entregas.
2. **Handoff.**Delegación a otro agente. Representado en el modelo como una herramienta llamada `transfer_to_<agent_name>`¿ Qué ?
3. **Guardrail.**Validación en entrada (solo el primer agente), salida (solo el último agente) o invocación de herramienta (por herramienta de función).
4. **Session.**Historial de conversaciones automático a través de los giros.
5. **Tracing.**Esparcidas para generaciones de LLM, llamadas de herramientas, entregas, barandillas.

### Las entregas como herramientas

El modelo ve .`transfer_to_billing_agent`En su lista de herramientas.

1. Copie el contexto de la conversación (o colapse a través de `nest_handoff_history`beta).
2. Inicializa el agente objetivo con sus instrucciones.
3. Continúe la carrera con el agente objetivo.

Este es el patrón de supervisión (lección 13 / lección 28) producido.

### Barras de seguridad

Tres sabores:

- **Input guardrails.**Rechazar las solicitudes inseguras o fuera de alcance antes de cualquier llamada de LLM.
- **Output guardrails.**Busca la salida del último agente, detecta filtraciones de PII, violaciones de políticas, respuestas malformadas.
- **Tool guardrails.**Ejecutar por herramienta de función, validar argumentos, verificar permisos, ejecutar auditorías.

Modo de trabajo:

- **Parallel**(por defecto). Guardrail LLM se ejecuta junto con el LLM principal.
- **Blocking**(El artículo`run_in_parallel=False`Guardrail LLM se ejecuta primero. si se tropieza, no se desperdician fichas en la llamada principal.

Los trifiles se elevan .`InputGuardrailTripwireTriggered`- ¿ Qué ?`OutputGuardrailTripwireTriggered`¿ Qué ?

### Trazación

Cada generación de LLM, llamada de herramientas, entrega y baranda emite un tiempo.`OPENAI_AGENTS_DISABLE_TRACING=1`Opta por salir.`add_trace_processor(processor)`Los fans se extienden a su propio backend junto con OpenAI.

### Sesiones

`Session`almacena el historial de conversaciones en un backend (SQLite, Redis, personalizado). `Runner.run(agent, input, session=session)`cargas automáticas y apéndices.

### Cuando este patrón va mal

- **Handoff drift.**Agente A se entrega al Agente B que se entrega al Agente A. Añade un contador de saltos.
- **Guardrail bypass.**Las barandillas de herramientas solo disparan a herramientas de función; las herramientas incorporadas (lector de archivos, recoger web) necesitan una política separada.
- **Over-tracing.**Contenido sensible en intervalos. empareja con las reglas de captura de contenido de OTel GenAI (lección 23)  almacenaje externo, referencia por ID.

```figure
ae-agent-handoff
```

## Construye el mismo

`code/main.py`Implementa la forma SDK en stdlib:

- `Agent`¿ Qué ?`FunctionTool`¿ Qué ?`Handoff`(como herramienta de función con semántica de transferencia).
- `Runner`con barandillas de entrada/salida/herramienta, despacho de entrega y contador de salto.
- Un simple emisor de espacio para mostrar la forma de la huella.
- Un agente de triaje que entrega a la facturación o soporte basado en la consulta del usuario; viajes de baranda de seguridad en una entrada.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra dos entregas exitosas, un viaje de entrada en el barranco de seguridad y un árbol de espalda que refleja lo que emite el SDK real.

## Usalo

- **OpenAI Agents SDK**para los productos OpenAI-first.
- **Claude Agent SDK**(Ley 17) para los productos de primera clase.
- **LangGraph**(Lección 13) cuando quieres un estado explícito y un currículum duradero.
- **Custom**cuando se necesita un control exacto (voz, multi-proveedor, implementaciones federadas).

## Envío

`outputs/skill-agents-sdk-scaffold.md`plancha una aplicación de Agents SDK con un agente de triaje, manchas, barandillas de entrada/salida/herramienta, almacenamiento de sesiones y un procesador de rastreo.

## Los ejercicios

1. Añadir un contador de saltos de entrega: rechazar después de N transferencias.
2. Implementación `nest_handoff_history`como opción  desglosar los mensajes anteriores en un resumen antes de transferirlos.
3. Escribe un barranco de salida bloqueador. Compara la latencia en las instrucciones que lo tropezarían con las que pasan.
4. El cable`add_trace_processor`¿Qué forma emite por período?
5. Lea los documentos del SDK y porta su juguete a SDK.`openai-agents-python`¿Qué modelo mal ha dado?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "LLM + instructions" | Agent type in the SDK; owns tools and handoffs |
| Handoff | "Transfer" | Tool the model calls to delegate to another agent |
| Guardrail | "Policy check" | Validation on input / output / tool invocation |
| Tripwire | "Guardrail trip" | Exception raised when guardrail rejects |
| Session | "History store" | Conversation memory persisted between runs |
| Tracing | "Spans" | Built-in observability over LLM + tool + handoff + guardrail |
| Blocking guardrail | "Sequential check" | Guardrail runs first; no token waste on trip |
| Parallel guardrail | "Concurrent check" | Guardrail runs alongside; lower latency, wastes tokens on trip |

## Leer más

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) primitivos, entregas, barandillas, rastreo
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) Colega con sabor a claudio
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) Cuando se llegan a las ofertas
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) el SDK estándar de Agents abarca el mapa a
