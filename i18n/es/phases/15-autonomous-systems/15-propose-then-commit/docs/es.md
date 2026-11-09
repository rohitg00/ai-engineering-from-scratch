# El hombre en el círculo: proponer y luego comprometerse

> El consenso de 2026 sobre HITL es específico. No es "el agente pregunta, el usuario hace clic en Aprobar". Es proponer-entonces-comprometer: la acción propuesta se persiste a una tienda duradera con una clave de idempotencia; aparece ante un revisor con intención, linaje de datos, permisos tocados, radio de explosión y un plan de retroceso; se comete solo después de un reconocimiento positivo; verificado después de la ejecución para confirmar que el efecto secundario realmente ocurrió. El de LangGraph `interrupt()`Además de la verificación PostgreSQL, el marco de Microsoft Agent `RequestInfoEvent`, y Cloudflare's `waitForApproval()`El modo de falla canónica es la aprobación de sello de goma: "Aplicar?" se hace clic sin revisión. La mitigación documentada es el reto y la respuesta con una lista de verificación explícita.

**Type:** Learn
**Languages:** Python (stdlib, propose-then-commit state machine with idempotency), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 14 (Tripwires)
**Time:** ~60 minutes

## El problema

El usuario debe decidir: aprobar o no. Si la decisión es instantánea, probablemente no sea una revisión. Si la decisión está estructurada, es lenta pero confiable. La pregunta de ingeniería es cómo hacer una revisión estructurada el camino de menor resistencia.

El patrón HITL de la era 2023 era una solicitud sincrónica: "¿El agente quiere enviar correo electrónico a X con el cuerpo Y  aprobar?" El usuario hace clic en Aprobar. Todo el mundo siente que el sistema es seguro. En la práctica esta superficie está fuertemente marcada con goma: los usuarios aprueban rápidamente, las aprobaciones predicen poco, y cuando el agente falla, la pista de auditoría muestra un largo historial de aprobaciones que el usuario no puede recordar.

El patrón 2026  proponer-then-commit  traslada HITL a un sustrato duradero, adjunta metadatos estructurados y requiere un compromiso positivo.`interrupt()`, Microsoft Agent Framework `RequestInfoEvent`, Cloudflare `waitForApproval()`Los nombres de las API difieren; la forma no.

## El concepto

### La máquina del Estado de proponer y luego de comprometerse

1. **Propose.**El agente produce una acción propuesta. Persistido a un almacén duradero (PostgreSQL, Redis, Objeto Durable). Incluye:
   - Intención (por qué el agente está haciendo esto)
   - linaje de datos (de qué fuente se derivó la propuesta)
   - permisos tocados (que es el alcance / archivos / puntos finales)
   - radio de explosión (cuál es el peor caso)
   - plan de retroceso (si se ha cometido, cómo lo deshacemos)
   - clave de independencia (única por propuesta; la reaprobación devuelve el mismo registro)
2. **Surface.**El revisor ve la propuesta con todos los metadatos.
3. **Commit.**El reconocimiento positivo.
4. **Verify.**Después de la ejecución, el efecto secundario se lee de nuevo y se confirma. Si el paso de verificación falla, el sistema está en un estado conocido de mala calidad y la alerta se activa.

### La clave de la impotencia

Sin una clave de idempotencia, un retiro después de un fallo transitorio puede duplicar la ejecución de una acción aprobada. Ejemplo concreto: el usuario aprueba "transferir $100 de A a B". Blip de red. El flujo de trabajo vuelve a intentar. El usuario ha aprobado una vez, pero la transferencia se ejecuta dos veces. La clave de idempotencia une la aprobación a un solo efecto secundario único; la segunda ejecución es una no-op.

Este es el mismo patrón de idempotencia que utilizan las API de Stripe y AWS.

### Durabilidad: por qué los procesos de aprobación duran más que el de los demás

La sala de espera de la aprobación es un estado que el agente no posee. El flujo de trabajo se detiene (lección 12).`interrupt()`con el punto de control PostgreSQL y no sólo en estado de memoria  una aprobación dos días después todavía encuentra el flujo de trabajo intacto.

### Aprobaciones de sello de caucho y la mitigación de los retos y respuestas

La interfaz de usuario predeterminada para HITL ("Aplicar" / "Rechazar" botones) produce aprobaciones rápidas sin revisión genuina. Mitigation documentada: una lista de verificación de desafíos y respuestas que requiere respuestas positivas a preguntas específicas antes de que se habilite el botón Aprobar.

- "¿Entiendes qué recurso se refiere a esto?
- "¿Ha verificado que el radio de la explosión es aceptable?
- "¿Tienes un plan de retroceso si esto falla?"

La investigación sobre la seguridad de los agentes antropóficos cita explícitamente el HITL basado en la lista de verificación como una mitigación para los patrones de aprobación de sello de goma.

### Lo que cuenta como consecuencia

No todas las acciones necesitan propuestas y luego compromisos.

- **Consequential actions**(siempre HITL): escritos irreversibles, transacciones financieras, comunicación de salida, cambios en la base de datos de producción, operaciones destructivas del sistema de archivos.
- **Reversible actions**(a veces HITL): modificaciones de archivos locales, cambios de env de puesta en escena, escritos reversibles con retroceso claro.
- **Reads and inspections**(nunca HITL): leer un archivo, listar recursos, llamar a una API de sólo lectura.

### Verificación posterior a la acción

"La ejecución de compromisos" no es lo mismo que "el efecto secundario ocurrió". Las condiciones de partición de red y carrera pueden producir un flujo de trabajo que cree que tuvo éxito mientras que el backend no persistió.`RETURNING`cláusulas o AWS `GetObject`después de`PutObject`¿ Qué ?

### Artículo 14 de la Ley de IA de la UE

El artículo 14 exige una supervisión humana efectiva de los sistemas de IA de alto riesgo en la UE. "Eficaz" no es decorativo. El lenguaje regulador excluye específicamente los patrones de sello de goma. Proponer-a continuación, comprometerse con desafío y respuesta es la forma que sobrevive al escrutinio del artículo 14 en los documentos de cumplimiento del Kit de herramientas de gobernanza de agentes de Microsoft.

```figure
mx-propose-then-commit
```

## Usalo

`code/main.py`Implementa una máquina de estado de proponer y luego realizar en stdlib Python. El almacén duradero es un archivo JSON. La clave de idempotency es un hash de (thread_id, action_signature). El controlador simula tres casos: un flujo de aprobación limpio, un retiro después de un fallo transitorio (que no debe ejecutarse en doble), y un sello de goma por defecto frente a un flujo de desafío y respuesta.

## Envío

`outputs/skill-hitl-design.md`revisa un flujo de trabajo de HITL propuesto para proponer y luego comprometer formas y señales de las capas de metadatos faltantes, de idempotencia, de verificación o de desafío y respuesta.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Confirmar que una nueva prueba de una propuesta aprobada utiliza el registro duradero y no reejecuta.

2. Extenda el registro de las propuestas con un `rollback`Simula una ejecución cuyo paso de verificación falla. Muestre el tiro de retroceso automáticamente.

3. Lea el marco de Microsoft Agent `RequestInfoEvent`Identificar un campo de metadatos que la API incluye que el motor de juguete está faltando. Añade y explique contra lo que protege.

4. Diseñar una lista de comprobación de retos y respuestas para una acción específica (por ejemplo, "postar a una cuenta pública de Twitter"). ¿Qué tres preguntas debe responder el revisor? ¿Por qué esas tres?

5. Seleccione un caso en el que una solicitud sincrónica de "¿Aplicar?" sea suficiente (no se necesita almacenamiento duradero). Explica por qué y nombra la clase de riesgo que está aceptando.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Propose-then-commit | "Two-phase approval" | Persisted proposal + positive commit + verify |
| Idempotency key | "Retry-safe token" | Unique per proposal; second execution no-ops |
| Data lineage | "Where it came from" | The specific source content that led to the proposal |
| Blast radius | "Worst case" | Scope of effect if the action goes wrong |
| Rubber-stamp | "Fast approval" | "Approve" clicked without genuine review |
| Challenge-and-response | "Forcing checklist" | Reviewer must positively acknowledge specific questions |
| RequestInfoEvent | "MS Agent Framework primitive" | Durable HITL request with structured metadata |
| `interrupt()` / `waitForApproval()` | "Framework primitives" | LangGraph / Cloudflare equivalents of the same shape |

## Leer más

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop)¿ Qué es esto ?`RequestInfoEvent`, aprobaciones duraderas.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/)¿ Qué es esto ?`waitForApproval()`y objetos duraderos.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) HITL como mitigación del riesgo a largo plazo.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) base de regulación para los sistemas de alto riesgo.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) marco constitucional en torno a la supervisión.
