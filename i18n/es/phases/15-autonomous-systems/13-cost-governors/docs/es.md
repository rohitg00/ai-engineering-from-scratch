# Presupuestos de acción, límites de iteración y gobernadores de costes

> El coste mensual de un agente de comercio electrónico de tamaño medio se ha disparado de $1,200 to $El equipo de Microsoft habilitó la habilidad de "tracking de pedidos". Eso no es un error de precios. Es un agente que encontró un nuevo bucle y mantuvo el gasto dentro de él.`max_tokens`, tokens por tarea y presupuestos en dólares, límites diarios / mes, límites de iteración, enrutamiento de modelos en niveles, caché de instantes, ventanas de contexto, puntos de control HITL en acciones costosas, interruptores de muerte en violación de presupuesto.

**Type:** Learn
**Languages:** Python (stdlib, layered cost-governor simulator), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 12 (Durable execution)
**Time:** ~60 minutes

## El problema

Los agentes autónomos gastan dinero real en cada turno. La mala salida de un chatbot es una mala respuesta; el mal bucle de un agente es una factura. El término documentado en la industria para el modo de falla es "Denial of Wallet"

La solución no es un número, sino una pila de límites en diferentes escalas de tiempo y granularidades: por solicitud, por tarea, por hora, por día, por mes. Una pila bien diseñada atrapa un bucle que se va en fuga en minutos, una fuga lenta en horas y una mala liberación en un día. La misma pila mantiene un presupuesto cuando el agente es de largo horizonte y autónomo.

Esta es una lección de ingeniería: las matemáticas son triviales, la disciplina es donde los equipos fallan. La lista de límites a continuación está nombrada en el kit de herramientas de gobernanza de agentes de Microsoft o en los documentos SDK de agente de código antropico Claude.

## El concepto

### La pila de los gastos de gobierno

1. **`max_tokens` per request.**Simplemente, impide que una sola llamada emita una terminación ilimitada.
2. **Per-task token budget.**En toda la carrera, no exceda los tokens N. Detente duro en el tope.
3. **Per-task dollar budget.**Lo mismo que los tokens pero en moneda.`max_budget_usd`en el código de Claude.
4. **Per-tool call cap.**No más de N `WebFetch`llamadas, N `shell_exec`llamadas, etc.
5. **Iteration cap (`max_turns`).**Iteraciones de bucles de agente totales; evita bucles de razonamiento infinitos.
6. **Per-minute / per-hour / per-day / per-month cap.**Las ventanas rodantes, las filtraciones en diferentes escalas de tiempo.
7. **Financial velocity limit.**Por ejemplo, "si el gasto excede los $50 en 10 minutos, corta el acceso". Captura quemaduras basadas en bucles antes de que las tapas mensuales se disparan.
8. **Tiered model routing.**Default a un modelo más pequeño; escala a uno más grande sólo cuando un clasificador juzgue que la tarea lo justifica.
9. **Prompt caching.**Contexto de sistema rápido y estable almacenado en la caché del proveedor; el costo de token de la re-envío es cercano a cero.
10. **Context windowing.**Compacción / resumen para mantener el contexto activo por debajo de un umbral; reducción directa de los costos de los tokens.
11. **HITL checkpoints on expensive actions.**Antes de que una acción conocida como costosa (llamada de herramientas larga, descarga grande, una costosa actualización del modelo), requiere un toque humano.
12. **Kill switch on budget breach.**La sesión se aborta cuando se dispara cualquier cap. Se registra el cap; requiere un camino separado de reactivación.

### ¿Por qué la pila, no un solo gorro?

Un único límite mensual sólo captura a un agente fugitivo después de que la cartera se haya ido. Un único límite por solicitud no captura nada a nivel de sesión.

- **Runaway loop**(agente atrapado en un retiro de 5 segundos): atrapado por el límite de velocidad.
- **Slow leak**(agente que hace ~ 2 veces el trabajo esperado por tarea): capturado por el límite diario.
- **Bad release**(nueva versión utiliza fichas 5x): capturado por límite semanal / mensual.
- **Legitimate surge**(demanda real, no un error): atrapado por el límite hora / día con registro claro.

### Superficie de presupuesto de arnés

El SDK de Claude Code Agent expone (documentos públicos):

- `max_turns` Cap de iteración.
- `max_budget_usd` límite de dólar; aborto en sesión por incumplimiento.
- `allowed_tools`- ¿ Qué ?`disallowed_tools` alojador de herramientas y denilista.
- Puntos de gancho antes de utilizar la herramienta para la contabilidad de costes personalizada.

Combinar con la escalera de modo de permiso (lección 10).`autoMode`sesión sin`max_budget_usd`La Antropic enmarca explícitamente el modo automático como que requiere controles presupuestarios; el clasificador es ortogonal al costo.

### Ley de IA de la UE, Agencia OWASP Top 10

El conjunto de herramientas de gobernanza de agentes de Microsoft cubre los requisitos del Top 10 de la OWASP y del artículo 14 de la Ley de IA de la UE (supervisión humana).

### Lo observado .$1,200 → $4.800 casos

El caso real en los documentos de Microsoft: un agente de comercio electrónico cuyo costo mensual se cuadruplicó después de que se añadió una nueva herramienta. La herramienta permitió al agente hacer encuestas sobre el estado de los pedidos durante cada sesión. No detectamos bucles. No hay gorra por herramienta. No hay alerta sobre el crecimiento semana tras semana. La solución era una tapa por herramienta más una alerta diaria de crecimiento. Esta es una plantilla: cada nueva superficie de herramienta es un nuevo bucle potencial; cada nueva herramienta necesita su propio límite y su propia alerta.

```figure
cost-governor-stack
```

## Usalo

`code/main.py`La simulación de un agente se ejecuta con y sin una pila de costos de gobierno de capas. El agente simulado se desvía a un bucle de votación después de algunos giros; la pila de capas la atrapa dentro de la ventana de velocidad mientras que un solo límite mensual no dispararía hasta días después.

## Envío

`outputs/skill-agent-budget-audit.md`Audita la pila de gastos de un agente propuesto y señala las capas faltantes.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar el límite de velocidad antes de que el límite de iteración se dispare en una trayectoria de circuito de votación.

2. Diseñar un conjunto de tapas por herramienta para un agente de navegador (lección 11). ¿Qué herramienta necesita el tapa más ajustado? ¿Qué herramienta puede funcionar sin límites sin riesgo?

3. Lea los documentos de la herramienta de gobierno de los agentes de Microsoft. Enumera cada tipo de tapa los nombres de la herramienta. Mapa cada uno de los modos de falla (bucle de fuga, fuga lenta, mala liberación, aumento).

4. Precio de una operación sin vigilancia durante la noche para una tarea realista (por ejemplo, "triar 50 emisiones en un repo").`max_budget_usd`justificar el 2x.

5. El código de Claude `max_budget_usd`¿Qué es lo que provoca el corte y cómo se ve el re-habilitar?

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Denial of Wallet | "Runaway bill" | Agent loop generating spend with no cap to stop it |
| max_tokens | "Per-request cap" | Ceiling on a single completion's size |
| max_turns | "Iteration cap" | Ceiling on agent loop iterations in a session |
| max_budget_usd | "Dollar kill switch" | Session cost cap; aborts on breach |
| Velocity limit | "Rate cap" | Limit on spend per short window (e.g., $50 / 10 min) |
| Tiered routing | "Small model first" | Cheap model default; escalate only when classifier warrants |
| Prompt caching | "Cached system prompt" | Provider-side cache reduces re-send token cost to near zero |
| HITL checkpoint | "Human approval gate" | Human tap required before expensive action |

## Leer más

- [Anthropic Claude Code Agent SDK — agent loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop)¿ Qué es esto ?`max_turns`¿ Qué ?`max_budget_usd`, los herramientas de la ayuda.
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) puntos de control de los administradores de costes.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) control de costes del proveedor.
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) Mecánica de almacenamiento en caché.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) perfil de costes para agentes de largo horizonte.
