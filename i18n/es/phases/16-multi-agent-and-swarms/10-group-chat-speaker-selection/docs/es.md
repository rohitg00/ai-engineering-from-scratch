# Selección de grupos y hablantes

> La orquestación de conversación compartida pone a N agentes en una conversación; una función selectora (LLM, round-robin o custom) elige quién habla después. Este es el arquetipo de conversación emergente multi-agente  los agentes no saben su papel en un gráfico estático, simplemente reaccionan a la piscina compartida. AutoGen GroupChat y AG2 GroupChat son las implementaciones de referencia: la semántica de GroupChat de AutoGen v0.2 se conservó en el tenedor AG2; AutoGen v0.4 lo reescribió como un modelo de actor impulsado por eventos. Microsoft puso AutoGen en modo de mantenimiento en febrero de 2026 y lo fusionó con el Kernel Semántico en Microsoft Agent Framework (RC febrero de 2026). El primitivo de GroupChat sobrevive tanto en AG2 como en Microsoft Agent Framework  apréndelo una vez, usalo en todas partes.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## El problema

Los gráficos estáticos (LangGraph) son excelentes cuando se conoce el flujo de trabajo. Las conversaciones reales no son estáticas: a veces el codificador pregunta al revisor, a veces al investigador, a veces al escritor. El codificación dura de cada posible entrega produce una explosión de borde.

Eso es exactamente lo que hace AutoGen GroupChat.

## Concepto

### La forma

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

Cada agente ve cada mensaje y en cada turno se invoca una función de selector para elegir quién habla después.

### Los tres sabores selectores

**Round-robin.**Ciclo fijo. Determinista. Escala linealmente en N pero ignora el contexto  un codificador obtiene el turno incluso cuando el tema es revisión legal.

**LLM-selected.**Una llamada a un LLM que lee el grupo reciente y devuelve el mejor próximo orador. Contexto consciente pero lento: cada turno añade una llamada de LLM. AutoGen es predeterminado.

**Custom.**Una función Python con cualquier lógica que desee. Típico: LLM-seleccionado con reglas de retroceso (por ejemplo, "siempre dar al verificador el turno después del codificador").

### La API de Agente Conversable

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager`Cuando un agente completa un turno, el gerente llama al selector, que devuelve al siguiente agente.

### Terminado

Tres patrones comunes:

- **Max rounds.**Tape fuerte en giros totales.
- **"TERMINATE" token.**Los agentes pueden emitir un mensaje de sentinela; el gerente se detiene cuando aparece uno.
- **Goal-reached check.**Un verificador ligero corre cada turno y detiene la charla cuando lo haga.

### Líneas de linaje: bifurcaciones y fusiones

A principios de 2025, Microsoft comenzó una reescritura importante de AutoGen (v0.4) en torno a un modelo de actores impulsado por eventos.

En febrero de 2026, Microsoft anunció que AutoGen pasaría al modo de mantenimiento, con el modelo de actores impulsado por eventos fusionándose en **Microsoft Agent Framework**El concepto de GroupChat sobrevive en ambas pistas; los detalles de implementación difieren. AG2 es el código preferido en el ascensor para el código compatible con v0.2.

### Cuando GroupChat se ajusta

- **Emergent conversations.**No quieres pre-cable cada posible próximo altavoz.
- **Role-mixing tasks.**El codificador pregunta al investigador, el investigador pregunta al archivista, el archivista pregunta al codificador.
- **Exploratory problem-solving.**Piensa en "reunión de tormenta cerebral", no en "línea de montaje".

### Cuando falla

- **Strict determinism.**El selector de LLM puede ser inconsistente, el mismo prompt, diferentes ejecuciones, diferentes oradores siguientes.
- **Sycophancy cascades.**Los agentes se aplazan a quien hable con más confianza.
- **Context bloat.**Cada agente lee cada mensaje; después de 10 vueltas el contexto es enorme.
- **Hot speakers.**Un agente domina la conversación porque el selector favorece sus especialidades.

### El chat de grupo vs supervisor

Las mismas primitivas, diferentes valores predeterminados:

- Supervisor: un agente planea y otros ejecutan.
- Chat de grupo: todos los agentes son pares; selector es una función sobre el pool compartido.

Ambos usan las cuatro primitivas de la Lección 04.

```figure
swarm-speaker
```

## Construye el mismo

`code/main.py`La aplicación de un grupo de chat desde cero en stdlib. tres agentes (codificador, revisor, gerente), variantes rotundas y LLM seleccionadas, y una terminación en un`TERMINATE`- Sí, es un símbolo.

La demostración imprime la transcripción de la conversación más el rastro de decisión del selector para ambas variantes.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

## Usalo

`outputs/skill-groupchat-selector.md`Configura un selector de GroupChat para una tarea dada  round-robin vs LLM-select vs custom, y qué entradas selector (mensajes recientes, especialidades de agente, recuentos de turno) utilizar.

## Envío

Lista de control:

- **Max rounds cap.**Siempre. 10-20 para tareas típicas.
- **Speaker-balance metric.**Las curvas de pista por agente; alerta cuando el desequilibrio exceda un umbral.
- **Termination token.** `TERMINATE`o un agente verificador dedicado.
- **Projection or scoped memory.**Después de ~ 10 mensajes, considere dar a cada agente solo una vista de alcance para evitar la hinchazón de contexto.
- **Selector logging.**Para las variantes seleccionadas en el LLM, registre tanto la entrada del selector como su elección.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Comparar la conversación entre el round-robin y el LLM. ¿Cuál agente domina en cada uno?
2. Añadir una regla de "máximo habla por agente" en el selector. ¿Cómo afecta a la transcripción?
3. Implementar una terminación alcanzada: detenerse cuando el revisor regrese "aprobado". ¿Con qué frecuencia se activa antes del límite redondo?
4. Lea los documentos estables de AutoGen en GroupChat (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html ). Identifique el selector predeterminado utilizado por `GroupChatManager`¿ Qué ?
5. Leer el recuento de AG2 (https://github.com/ag2ai/ag2¿Qué propiedades concretas (transmisión, tolerancia a fallos, composibilidad) añade la versión v0.4?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## Leer más

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) la aplicación de referencia
- [AG2 repo](https://github.com/ag2ai/ag2) comunidad AutoGen v0.2 continuación
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) el sucesor fusionado, RC febrero 2026
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) Detalles de reescribir el modelo de actor impulsado por eventos
