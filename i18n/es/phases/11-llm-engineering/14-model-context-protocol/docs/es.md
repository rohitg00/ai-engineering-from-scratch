# Modelo de protocolo de contexto (MCP)

> MCP le da a un host de IA un protocolo para descubrir e invocar herramientas, recursos y instrucciones. La revisión 2026-07-28 hace que ese protocolo sea estatal: la capacidad y el contexto de la versión viajan con cada solicitud, no en un apretón de manos vinculado a la conexión.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Distinguir un host MCP, cliente, servidor, transporte y servidor primitivo.
- Construir una solicitud JSON-RPC con los metadatos requeridos por MCP 2026-07-28.
- Usar`server/discover`para inspeccionar versiones, identidad y capacidades.
- Retorna los resultados de las herramientas, recursos y instrucciones.
- Explica cómo el MCP sin estado moderno interactúa con los servidores de la era de apretones de manos.
- Elija el estado seguro, el transporte y los límites de aprobación para un servidor.

## El problema

Su aplicación necesita una consulta de base de datos, una operación de calendario y un lector de archivos. Sin un protocolo compartido, cada host de IA necesita descubrimiento personalizado, invocación, errores, transporte y pegamento de autorización para esas mismas capacidades.

MCP reduce esa matriz de integración. Un servidor publica una superficie JSON-RPC estándar. Un cliente compatible puede descubrir la superficie, presentarla a un modelo o usuario, invocarla e interpretar el resultado sin un adaptador específico para el servidor.

El MCP estándariza la comunicación. No decide a qué herramienta debe llamar el modelo, hacer que el contenido no confiable sea seguro o convertir una solicitud sin estado en un estado de aplicación duradero.

## El concepto

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### Los tres servidores primitivos

1. **Tools**Cada herramienta tiene un nombre, descripción, entrada de esquema JSON y manipulador.
2. **Resources**se nombran, contenido dirigido a URI que un cliente puede leer.
3. **Prompts**son plantillas reutilizables que un host puede exponer a un usuario.

El host es la aplicación de IA. Un cliente MCP dentro de ese host habla a un servidor. El transporte lleva mensajes JSON-RPC entre ellos.

### Las solicitudes de apatridia reemplazan el apretón de manos

MCP 2026-07-28 se elimina `initialize`y `notifications/initialized`También elimina las sesiones a nivel de protocolo.`params._meta`¿Qué es esto ?

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

Se requiere la versión del protocolo y las capacidades del cliente.`_meta`, un campo requerido faltante, o un campo requerido con el tipo incorrecto se malforma y devuelve Parámetros inválidos (`-32602`). Una cadena de versiones bien formada que el servidor no admite devuelve `UnsupportedProtocolVersionError`(El artículo`-32022`Un servidor puede procesar una solicitud válida sin recuperar un registro de negociación previo.

Estatal no significa que una aplicación nunca pueda mantener el estado.`Mcp-Session-Id`Si un flujo de trabajo necesita continuidad, el servidor acuña un mango opaco y el cliente pasa ese mango como un argumento de herramienta ordinario en llamadas posteriores.

### Descubrimiento y selección de versiones

Cada servidor moderno implementa`server/discover`. El resultado anuncia las versiones, capacidades y identidad del servidor:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

Un cliente puede llamar a otro método directamente y manejar un error de versión, pero el descubrimiento hace que la visualización de la capacidad y la selección de la versión sean explícitas. Una versión no soportada devuelve `UnsupportedProtocolVersionError`con código `-32022`Sus datos contienen`supported`, una serie de revisiones del servidor, y `requested`, la revisión rechazada.

En el estudio, un cliente de doble era investiga con`server/discover`Un resultado de descubrimiento o un error moderno reconocido como`UnsupportedProtocolVersionError`Cualquier error o tiempo de espera que no sea reconocido como moderno permite regresar al 2025-11-25`initialize`El comportamiento heredado es código de compatibilidad, no el estándar moderno.

### Los resultados son explícitos

Cada núcleo de 2026-07-28 resultado tiene`resultType`¿Qué es esto ?

- `complete`significa que la operación ha terminado.
- `input_required`significa que el servidor necesita otra vuelta a través del patrón de solicitudes de viaje múltiple. los servidores centrales pueden devolverlo sólo desde `tools/call`¿ Qué ?`resources/read`, o`prompts/get`¿ Qué ?

Los clientes deben tratar un resultado heredado que omita `resultType`tan completo.

Los servidores deben incluir `io.modelcontextprotocol/serverInfo`en cada resultado `_meta`Esta identidad es auto-relatada y es para visualización, registro y depuración, no para decisiones de seguridad.

También se incluyen la lista y los resultados de lectura `ttlMs`y `cacheScope`- Un determinista .`tools/list`orden más un indicio de frescura permite a los clientes almacenar el descubrimiento en caché de forma segura y mejora la estabilidad de caché rápido. `cacheScope: public`Permiten almacenamiento en caché compartido; `private`La aplicación de la ley de la información en el mercado interior se limita a la reutilización en el contexto de la llamada.

### El formato del cable y el transporte

MCP utiliza JSON-RPC 2.0 en stdio o HTTP transmitible.

- Una solicitud tiene `jsonrpc`¿ Qué ?`id`¿ Qué ?`method`, y `params`¿ Qué ?
- Una respuesta tiene la coincidencia`id`y de cualquier otro`result`o `error`¿ Qué ?
- Una notificación no tiene `id`y no espera ninguna respuesta.

Un POST de solicitud recibe un objeto JSON o un flujo de eventos enviados por servidor con escala de solicitud que termina con la respuesta final. Una notificación aceptada POST recibe HTTP 202 sin cuerpo de respuesta; esta revisión central no define notificaciones de cliente a servidor sobre HTTP de transmisión.

No hay un flujo de MCP GET independiente, DELETE punto final de sesión, `Mcp-Session-Id`, o`Last-Event-ID`Las notificaciones de cambios de larga duración utilizan una`subscriptions/listen`POST cuya respuesta permanece abierta como un flujo de SSE.

### Entrada del cliente sin solicitudes iniciadas por el servidor

Las revisiones anteriores permiten que un servidor envíe solicitudes como `sampling/createMessage`¿ Qué ?`roots/list`, o`elicitation/create`El protocolo actual utiliza solicitudes de viajes múltiples en lugar de una llamada de herramienta elegible, lectura de recursos o solicitud de devoluciones.`resultType: input_required`con al menos uno de los `inputRequests`o `requestState`. El cliente recoge cualquier entrada solicitada, vuelve a probar el método original con un nuevo ID JSON-RPC y el correspondiente `inputResponses`, y se hace eco de la exacta`requestState`Cuando se proporcionó uno.`inputRequests`Si estaban presentes, el retiro omite.`inputResponses`¿ Qué ?

Las raíces, muestras y registro siguen funcionando pero están desactualizadas, por lo que las nuevas implementaciones no deben adoptarlas.`inputRequests`, nunca como solicitudes independientes de servidor a cliente JSON-RPC. Prefiere parámetros de archivo o directorio explícitos, URIs de recursos, configuración de servidor e integración directa entre proveedor de modelos. Utilice stderr para el diagnóstico de estudio y OpenTelemetry para la telemetría de producción.

```figure
mcp-nxm-collapse
```

## Construye el mismo

### Paso 1: registrar una superficie del servidor

El registro se mantiene sencillo a pesar de que el contrato de solicitud ha cambiado:

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

La aplicación enviada en `code/main.py`También registra un recurso y un prompt. utiliza deliberadamente la biblioteca estándar para que pueda ver cada sobre en lugar de delegar el protocolo a un SDK.

### Paso 2: adjuntar metadatos a cada solicitud

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

No almacenes estos metadatos en caché solo en un objeto de conexión. El servidor los valida en cada solicitud.

### Paso 3: opcionalmente, descubra antes de la lista

Llamé`server/discover`, elige una versión compatible, luego llame `tools/list`- Un directo .`tools/list`También es válido si ya conoce la versión y puede manejarla `-32022`¿ Qué ?

La demostración devuelve listas de herramientas en orden de nombres y adjunta `ttlMs`¿ Qué ?`cacheScope`¿ Qué ?`resultType`Una llamada de herramienta devuelve un resultado completo, no caché porque su salida puede depender del estado actual.

### Paso 4: mapear la misma solicitud a HTTP

Un control remoto .`tools/call`POST incluye encabezados que reflejan el cuerpo JSON-RPC:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

El `MCP-Protocol-Version`El encabezado debe coincidir con la versión en `_meta`- ¿ Qué ?`Mcp-Method`Se requiere en cada solicitud de JSON-RPC y debe coincidir `method`- ¿ Qué ?`Mcp-Name`sólo se requiere para `tools/call`¿ Qué ?`resources/read`, y `prompts/get`, donde debe coincidir con el nombre de la herramienta, URI de recurso o nombre de solicitud. Un encabezado requerido faltante o una incompatibilidad devuelve HTTP 400 con `HeaderMismatch`código `-32020`¿ Qué ?

### Paso 5: hacer cumplir la seguridad fuera del estado del protocolo

- Valida la autorización y la audiencia en cada solicitud HTTP.
- Conectar los servidores locales a localhost y validar `Origin`en HTTP transmitible.
- Marque las herramientas mutantes con `destructiveHint: true`y requieren la aprobación del anfitrión.
- Pasar directorio y alcance de archivo explícitamente en lugar de depender de raíces obsoletas.
- Trate los recursos y la salida de herramientas como datos no confiables.
- Mantenga el stdout reservado para JSON-RPC bajo stdio; escriba diagnósticos a stderr.

## Usalo

Ejecutar la lección de su directorio:

```bash
python3 code/main.py
npx tsx code/main.ts
cd code
python3 -m unittest discover tests -v
```

La primera línea debe informar sobre el descubrimiento de `demo-server`en el protocolo `2026-07-28`- Entonces inspeccionar .`MCPClient.request`: se reconstruye `_meta`Eliminar los metadatos de una solicitud y observar que el servidor lo rechaza.

## Envío

`outputs/skill-mcp-server-designer.md`El portal de aceptación requiere un resultado de descubrimiento, una política de metadatos por solicitud, listas deterministas de caché, manejos de estado explícitos, encabezados de transporte, autorización y reglas de aprobación.

## Continúa con la inmersión profunda MCP

Esta lección te da el modelo de protocolo. la fase 13 convierte cuatro límites de producción en lecciones separadas de construcción y verificación:

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md)cubre esquemas de entrada cerrados, contenido estructurado, metadatos de enrutamiento, paginado opaco, autorización de finalización y la diferencia entre errores de protocolo y dominio de herramienta.
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md)cubre la cancelación de solicitudes, la cancelación de tareas duraderas, plazos, idempotencia, retropresión, amortiguamiento de proxy y comportamiento de reconexión.
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md)cubre la prueba del espacio de nombres, la procedencia de los artefactos, los pines inmutables, la deriva en vivo, el estado del Registro, la evidencia de admisión y el retroceso.
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md)cubre transcripciones de cable dorado y negativo, épocas de versiones estrictas, diferenciales SDK, pruebas de proxy, redacción, puertas de salud y retroceso de liberación.

Los seguimos en el orden en que el servidor cruzará un límite de equipo o confianza. Juntos se mueven de el método funciona a el contrato permanece seguro y diagnosticable a través de la implementación.

## Los ejercicios

1. Añadir un`subtract`herramienta y confirmación `tools/list`se mantiene ordenado alfabéticamente.
2. Eliminar la clave de versión del protocolo y verificar Parámetros inválidos (`-32602`Entonces envíe la versión bien formada pero sin soporte `2025-11-25`, verificar`-32022`, confirme`requested`se hace eco de esa revisión, y elegir entre `supported`¿ Qué ?
3. Añadir un servidor-minted `draftId`Explique por qué ese es el estado de aplicación en lugar de una sesión de protocolo.
4. Regreso .`input_required`Reutilice la llamada original con un nuevo ID, un `inputResponses`la entrada, y el exacto `requestState`en lugar de inventar una solicitud JSON-RPC de servidor a cliente.
5. Esbozar un cliente de estudio de doble época. Tratar un resultado o un error moderno reconocido como moderno, y permitir la retroceso a `initialize`Sólo por un error no reconocido o un tiempo de espera.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MCP | "Tool protocol for LLMs" | JSON-RPC protocol for server discovery, tools, resources, prompts, and extensions |
| Host | "The AI app" | Owns the model and UI and mounts one or more MCP clients |
| Client | "The connector" | Speaks MCP to one server on behalf of a host |
| Stateless MCP | "No session" | Every request carries version and capabilities; no protocol state is keyed by a connection |
| `server/discover` | "Capability probe" | Required server method advertising versions, capabilities, and identity |
| `resultType` | "Result state" | Marks a result as `complete` or `input_required` |
| State handle | "Workflow id" | Server-minted application identifier passed as an ordinary argument |
| Streamable HTTP | "Remote transport" | One POST endpoint with JSON or request-scoped SSE responses |
| MRTR | "Ask and retry" | Input request embedded in a result, followed by a retry of the original operation |

## Leer más

- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
