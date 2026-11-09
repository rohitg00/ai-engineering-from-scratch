# El patrimonio de las leyes FIPA-ACL y de discursos

> Antes de MCP, antes de A2A, había FIPA-ACL. En el año 2000 la Fundación para Agentes Físicos Inteligentes (FIPA, que se convirtió en un comité de normas de la Sociedad de Computación IEEE en 2005) ratificó un lenguaje de comunicación de agentes con veinte performativos, dos lenguajes de contenido y un conjunto de protocolos de interacción  contrato net, suscripción/notificación, solicitud-cuando. Se desvaneció de la industria porque la carga general de ontología era demasiado pesada para la web, pero el revival de LLM de sistemas multiagentes está reimplementando silenciosamente las mismas ideas sin la semántica formal: los contratos JSON representan los performativos, el lenguaje natural representa las ontologías. Esta lección lee en serio la FIPA-ACL para que pueda ver qué decisiones del protocolo 2026 son reinvenciones, qué son novedades, y dónde la ola actual va a redescubrir los problemas que ya resolvieron los años 2000.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## El problema

El panorama del protocolo de agentes para 2026 está ocupado: MCP para herramientas, A2A para agentes, ACP para auditoría empresarial, ANP para confianza descentralizada, NLIP para contenido en lenguaje natural, además de CA-MCP y dos docenas de propuestas de investigación.

La lectura honesta es que la mayoría de ellos están redescubriendo un árbol de decisión muy específico de veinte años. La teoría del habla-acto de Austin (1962) y Searle (1969) nos dio "las declaraciones son acciones". KQML (1993) convirtió eso en un protocolo por cable. FIPA-ACL (ratificado en 2000) produjo la normalización de referencia: veinte performativos, lenguajes de contenido SL0/SL1, protocolos de interacción para la red de contratos y suscripción-notificación. JADE y JACK fueron las plataformas de referencia de Java. El esfuerzo se desvaneció alrededor de 2010 porque la carga de ontología era demasiado pesada y la web estaba ganando.

Cuando miras a MCP's `tools/call`En el ciclo de vida de las tareas de A2A, o en el almacén de contexto compartido de CA-MCP, se observa una reaparición más suave y nativa de las decisiones de FIPA.

## Concepto

### Acta de discusión, en un párrafo

Austin notó que algunas frases no describen el mundo, lo cambian. "Lo prometo". "Pido". "Declaro". Llamó a estas declaraciones performativas. Searle formalizó cinco categorías: asertivo, directivo, comisionado, expreso y declarativo. KQML (Finin et al., 1993) hizo que esto funcione para los agentes de software: un mensaje es un performativo (la acción) más contenido (de qué se trata la acción). FIPA-ACL limpió las lagunas de KQML y estandarizó alrededor de veinte performativos.

### Los veinte performativos de la FIPA (lista parcial)

| Performative | Intent |
|---|---|
| `inform` | "I tell you P is true" |
| `request` | "I ask you to do X" |
| `query-if` | "Is P true?" |
| `query-ref` | "What is the value of X?" |
| `propose` | "I propose we do X" |
| `accept-proposal` | "I accept the proposal" |
| `reject-proposal` | "I reject the proposal" |
| `agree` | "I agree to do X" |
| `refuse` | "I refuse to do X" |
| `confirm` | "I confirm P is true" |
| `disconfirm` | "I deny P" |
| `not-understood` | "Your message did not parse" |
| `cfp` | "Call for proposals on X" |
| `subscribe` | "Notify me when X changes" |
| `cancel` | "Cancel the ongoing X" |
| `failure` | "I tried X and failed" |

La lista completa está en `fipa00037.pdf`El punto no es memorizarlo. El punto es que cada uno de estos corresponde a un protocolo primitivo que un LLM eventualmente re-agrega.

### Mensaje canónico FIPA-ACL

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

Se trata de siete campos que contienen el envase del protocolo; un campo (`content`El resto de campos son exactamente lo que reinventas cada vez que puestas retemplajes, threading y ontología en un protocolo JSON.

### Las dos plataformas heredadas

**JADE**(Java Agent DEvelopment framework, 19992020s) fue el tiempo de ejecución más utilizado de conformidad con FIPA. Los agentes extendieron una clase base, intercambiaron mensajes ACL, se ejecutaron dentro de contenedores y se coordinaron utilizando "comportamientos".

**JACK**(Software orientado a agentes, comercial) enfatizó el razonamiento BDI (Creencia-Deseo-Intención) en la parte superior de los mensajes FIPA.

Ambos disminuyeron una vez que la pila web comió casos de uso de múltiples agentes. MCP y A2A son los "contenedores" de tiempo de ejecución de 2026.

### Por qué la FIPA se desvaneció

- **Ontology overhead.**La FIPA requirió una ontología compartida para analizar `content`El acuerdo sobre ontologías es un proceso de estándares de años.
- **Formal semantics nobody used.**SL (Lenguaje Semántico) dio condiciones de verdad rigurosas, pero la mayoría de los sistemas de producción utilizaban contenido de forma libre e ignoraba el formalismo.
- **Tooling lock-in.**JADE era solo para Java, JACK era comercial, y los equipos poliglotes se desplazaban alrededor de ambos.
- **The internet won the stack.**REST, luego JSON-RPC, luego gRPC reemplazó el transporte de ACL.

### El revival de la LLM es FIPA-lite

Comparar una FIPA `request`a un MCP `tools/call`¿Qué es esto ?

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

El mismo sobre, diferente sintaxis. Ambos llevan: quién, quién, intención, carga útil, correlación id. Ninguno es una revolución sobre el otro  son diferentes compromisos en el mismo diseño.

La encuesta de 2025 de Liu et al. ("Una encuesta de protocolos de interoperabilidad de agentes: MCP, ACP, A2A, ANP", arXiv:2505.02279) hace que este linaje sea explícito: MCP corresponde a actos de habla de uso de herramientas, A2A a actos de habla de agentes-peer, ACP a actos de habla de auditoria, ANP a extensiones de identidad descentralizada.

### El compromiso, declarado claramente

**What FIPA gave you and modern specs drop:**

- Semántica formal  puedes probar `inform`implica que el remitente cree el contenido.
- Un catálogo canónico de performativos  no tienes que volver a argumentar "deberíamos tener un `cancel`¿Qué es eso?
- Décadas de patrones de interacción-protocolo  contrato-red, suscripción-notificación, propuesta-acepción  con propiedades de corrección conocidas.

**What modern specs give you and FIPA did not:**

- Cargas útiles nativas de JSON compatibles con todas las herramientas modernas.
- Contenido en lenguaje natural que los LLM puedan interpretar sin una ontología codificada a mano.
- Transporte de la pila web (HTTP, SSE, WebSocket).
- Descubrimiento de la capacidad a través de MCP en vivo `server/discover`y las tarjetas de agente A2A.

Se trata de una semántica de intención más flexible para una implementación más fácil.

### Protocolos de interacción que valgan la pena llevar

FIPA envió ~ 15 protocolos de interacción. Tres son dignos de llevar adelante en sistemas multi-agentes LLM:

1. **Contract Net Protocol (CNP).**Cuestiones de gerente `cfp`(llamada a presentar propuestas); los licitadores responden con `propose`El director acepta/rechaza. Este es el patrón canónico del mercado de tareas (fase 16 · 16 de negociación).
2. **Subscribe/Notify.**El suscriptor envía `subscribe`El editor envía `inform`Esto es cada evento-bus en 2026.
3. **Request-When.**"Hacer X cuando la condición Y se mantiene". Acción retrasada con condiciones previas. El analógico 2026 es tareas diferidas en motores de flujo de trabajo duraderos (Fase 16 · 22 Escalado de producción).

Cada uno de ellos hace un mapa limpio en las colas de mensajes modernas, encuestas HTTP + o streaming SSE.

### ¿Qué se rompe cuando dejas de lado la ontología

Sin una ontología compartida, los agentes deducen el significado del contenido del lenguaje natural.**semantic drift**: dos agentes usan la misma palabra (`"customer"`En el caso de los conceptos sutilmente diferentes, el agente del receptor actúa sobre la interpretación errónea, ningún validador de esquema lo capta.

Mitigations sin entrar en ontología completa:

- Esquema JSON en `content` rechaza los errores estructurales en el cable.
- Los artefactos de tipo (A2A)  rechazan la modalidad incorrecta.
- El performativo explícito en el sobre  hace que la intención sea inequívoca incluso cuando el contenido es lenguaje natural.

### Las especificaciones de 2026, mapeadas a la herencia del habla-acto

| Modern spec | FIPA analog | What it keeps | What it drops |
|---|---|---|---|
| MCP `tools/call` | `request` | explicit intent, correlation id | formal semantics, ontology |
| MCP `resources/read` | `query-ref` | explicit intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle, state transitions | formal completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| CA-MCP shared context | blackboard (Hayes-Roth 1985) | multi-writer shared memory | logical consistency model |
| NLIP | natural-language content | LLM-native | schema |

Leyendo la tabla de arriba a abajo, el patrón es: mantener la estructura primitiva, dejar el formalismo, dejar que LLM se sobrepongan a la ambigüedad.

```figure
sw-contract-net
```

## Construye el mismo

`code/main.py`Implementa un traductor FIPA-ACL de pure-stdlib. Encodifica y decodifica el envase ACL canónico y muestra cómo cada forma de mensaje MCP / A2A se reduce a los mismos siete campos.

- Enciende cinco mensajes de estilo MCP y A2A como FIPA-ACL.
- Decodifica FIPA-ACL de nuevo al equivalente moderno.
- Se ejecuta un contrato de juguete Negociación de red entre un gerente y tres licitadores utilizando `cfp`¿ Qué ?`propose`¿ Qué ?`accept-proposal`¿ Qué ?`reject-proposal`¿ Qué ?

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La salida es una pista lado a lado que muestra cada mensaje moderno tanto en su forma JSON 2026 como en su forma FIPA-ACL, luego una vuelta de una oferta de red de contrato. Los mismos protocolos primitivos sobreviven a la vuelta de viaje; solo la sintaxis difiere.

## Usalo

`outputs/skill-fipa-mapper.md`La técnica de la información de base de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de`inform`¿Con la sintaxis JSON?"

## Envío

No traiga a FIPA-ACL de vuelta.

- ¿Cuál es la intención primitiva (performativa) de cada mensaje?
- ¿Hay una identificación de correlación para la solicitud-respuesta y cancelación?
- ¿Existe un lenguaje de contenido explícito (JSON-RPC, texto plano, artefacto de tipografía estructurado)?
- ¿Son los protocolos de interacción de primera clase, o están re-implementando el contrato-net desde cero?
- ¿Qué sucede cuando dos agentes no están de acuerdo sobre el significado del contenido (drift semántico)?

Documenta estas cinco preguntas para cualquier nuevo protocolo antes de enviarlo a la producción.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Observar la codificación de ida y vuelta. Identificar qué performativo FIPA corresponde a `tools/call`¿ Qué ?`resources/read`, y la creación de tareas A2A.
2. Extenda la demostración de la red de contratos con un `cancel`El ejecutivo puede retirar la tarea en medio de la oferta.`cancel`¿No resolverá eso por sí solo?
3. Leer la estructura de mensajes de la FIPA ACL (http://www.fipa.org/specs/fipa00037/) secciones 4.14.3. escoge una performativa no cubierta en esta lección y describa su análogo moderno JSON-RPC.
4. Lee Liu et al., arXiv:2505.02279. Para cada uno de los MCP, A2A, ACP, ANP, enumere las familias performativas FIPA que mantienen y dejan.
5. Diseñar un esquema JSON mínimo para el `content`campo de una `request`¿Qué es lo que ese esquema te da que el lenguaje natural puro no, y cuánto cuesta?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speech act | "An utterance that does something" | Austin/Searle: utterances as actions. The theoretical parent of ACL. |
| FIPA | "That old XML thing" | Foundation for Intelligent Physical Agents. Standardized ACL in 2000; became an IEEE Computer Society standards committee in 2005. |
| ACL | "Agent Communication Language" | FIPA's envelope format: performative + content + metadata. |
| Performative | "The verb" | The intent class of a message: `inform`, `request`, `propose`, `cfp`, etc. |
| KQML | "FIPA's predecessor" | Knowledge Query and Manipulation Language (1993). Simpler, narrower. |
| Ontology | "Shared vocabulary" | A formal definition of the concepts the content language talks about. |
| SL0 / SL1 | "FIPA content languages" | Semantic Language levels 0 and 1 — the formal content language family. |
| Contract Net | "Task market" | Manager issues cfp; bidders propose; manager accepts. The canonical interaction protocol. |
| Interaction protocol | "Pattern of messages" | A sequence of performatives with known correctness: request-when, subscribe-notify, etc. |

## Leer más

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) la encuesta canónica de 2025 que conecta las especificaciones modernas con el patrimonio de la FIPA
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) el formato del envase 2000 ratificado
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) el catálogo completo de la interpretación
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) el equivalente actual de uso de herramientas sin estado de `request`- ¿ Qué ?`query-ref`
- [A2A specification](https://a2a-protocol.org/latest/specification/) el equivalente moderno de agente-para-par de contrato-net y suscriptor-notificar
