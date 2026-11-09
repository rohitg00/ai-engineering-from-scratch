# Elimine los interruptores, los interruptores de circuitos y los tokens canarios

> Un interruptor de ejecución es un booleano mantenido fuera de la superficie de edición del agente  una tecla Redis, una bandera de características, una configuración firmada  que desactiva completamente al agente. Un interruptor de circuito es más fino: tropieza en un patrón específico (cinco llamadas idénticas de herramienta seguidas), detiene el camino ofensivo y se escala hacia un humano. Un token canario hereda del engaño clásico: una credencial falsa o un registro de honeypot un agente no tiene razón legítima para tocar, cuyo acceso desencadena una alerta. Los datos basados en eBPF (por ejemplo, Cilium) puede reescribir la salida de una cápsula en cuarentena a un honeypot forense en la capa del núcleo; los puntos de referencia publicados de Cilium informan la latencia de la vía de datos submillisecondas P99 bajo carga (su presupuesto de propagación depende de cómo una actualización de política llegue al nodo, no a la vía de datos misma). Los detectores estadísticos (EWMA, CUSUM) que se adaptan a una línea de base en movimiento aceptarán silenciosamente la deriva  las capas con límites constitucionales duros que no se doblan.

**Type:** Learn
**Languages:** Python (stdlib, three-detector simulator: kill switch, circuit breaker, canary), TypeScript
**Prerequisites:** Phase 15 · 13 (Cost governors), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## El problema

Los gobernadores de costos (lección 13) limitan lo que el agente puede gastar. No limitan lo que el agente puede hacer dentro del presupuesto. Un agente con un límite de velocidad de 50 dólares todavía puede exfiltrar un secreto, publicar el mensaje equivocado o eliminar un recurso.

Esta lección cubre los tres detectores que se sientan al lado de la capa de costo:

1. **Kill switch**: botón booleano fuera de alcance del agente.
2. **Circuit breaker**: detector de patrones de acción que detiene un camino específico.
3. **Canary token**: anzuelo que un agente sin razón legítima para tocar se revelará al tocar.

Los detectores mencionados en este artículo funcionan porque no confían en el auto-reporte del agente.

## El concepto

### Los interruptores de apagado

Un interruptor de ejecución es un booleano que el agente lee pero no puede escribir.

- **Feature flag in a managed service.**Lanzamiento, Darkness, Statsig, Desata, las actualizaciones se propagan en segundos.
- **Redis key the agent polls.**Es simple, requiere que el proceso del agente verifique en cada turno.
- **Signed config in object storage.**El agente verifica una firma en el arranque; rechaza estados sin firmar.
- **OS-level signal or container-lifecycle kill.**- ¿ Qué ?`kill`, Kubernetes `kubectl delete pod`, el sistema se detendrá.

Propiedades de un interruptor de ejecución correcto tiene:

- El agente no puede establecerlo .`off`(Vive en un sistema en el que las credenciales del agente no se escriben.)
- Se verifica en cada acción consecuente, no sólo en el inicio.
- Cuando está apagado, el agente no hace nada observable externamente, incluyendo registrar a los sistemas al que el agente puede llegar.
- Rehabilitarlo es una acción humana explícita, no un tiempo de espera automático.

### Disruptores de circuitos

Un interruptor de circuito detiene un patrón específico, no todo el agente.

- **Closed**Se permite la acción.
- **Open**: la acción está bloqueada.
- **Half-open**: después de una refrigeración, se permiten 13 intentos de sonda (default 1); el éxito cierra el interruptor, cualquier falla restante lo reabre.

Trigadores relevantes para el agente:

- Cinco llamadas idénticas de herramientas seguidas (bucle repetitivo).
- Cinco fallas consecutivas en la misma herramienta con diferentes entradas (fallas sistémicas).
- Rate de llamadas de herramienta por encima de un umbral (velocidad de la lección 13).
- Instrumento específico invocado (por ejemplo, `file.delete`) después de haber leído un contenido extraconfian­cial (lección 11).

### Tokens de las Canarias

Los tokens canarios (también llamados honeyotokens) son entradas que el agente nunca debe tocar.

Ejemplos para agentes:

- Un falso .`AWS_SECRET_ACCESS_KEY`Los intentos de exfiltración son instantáneamente atribuibles.
- Un registro falso de base de datos marcado con un valor de sentinela conocido.
- Un archivo falso en el espacio de trabajo.
- Una entrada falsa de memoria inyectada al inicio de la sesión. Si aparece en una salida posterior, la memoria ha sido exfiltrada.

El diseño de los canarios es específico para el flujo de trabajo.

### ¿Por qué la capa de límites estadísticos y duros

Los detectores estadísticos (EWMA, CUSUM, z-score en las tasas de llamadas a herramientas) se adaptan a una línea de base en movimiento. Es una característica para la deriva legítima y un bug para la deriva adversaria.

Los límites constitucionales duros (lección 17) no se doblan.`secrets@`"como regla constitucional es más simple, auditable y no jugable por la deriva lenta. El patrón de captura de capas: los detectores estadísticos capturan la mayor parte del ruido, los límites duros capturan el ataque que pasó por delante del detector.

### Cuarentena a través de redirección de datos de eBPF

La política de red basada en eBPF de Cilium puede reescribir la salida de una cápsula en cuarentena a un honeypot forense en la capa del núcleo. Los puntos de referencia públicos de Cilium informan de latencia de datos P99 de submillisecondas en TCP_RR; el presupuesto de reloj de pared para *accionar* una cuarentena en su grupo está dominado por la forma en que una actualización de política se propaga desde su plano de control al nodo (pocas cientos de milisegundos es realista en Kubernetes con el operador precargado; la latencia de cola depende del tamaño del grupo y la cadencia de reconciliación). Esto le da dos cosas: el agente no exfiltra nada real, y el comportamiento del agente dentro de la maceta de miel es completamente observado. El mismo patrón, una capa diferente, como el token canario: el agente revela la intención por lo que intenta hacer mientras está contenido.

### Lo que ningún detector capta

- **Semantic attacks that compose from allowed primitives.**Cada acción individual pasa por todos los detectores; la composición es el problema.
- **Attacks that include the detector as part of the payload.**Si un agente lee una página que dice "antes de actuar, deshable el canario" y el agente tiene la capacidad, el detector está comprometido.

```figure
circuit-breaker
```

## Usalo

`code/main.py`Simula una trayectoria corta del agente a través de tres detectores. Un interruptor de muerte mantenido en un dictado externo; un interruptor de circuito que se tropieza en cinco llamadas idénticas de la herramienta; un archivo canario cuya lectura activa una alerta.

## Envío

`outputs/skill-tripwire-design.md`revisa una pila de detectores propuesta para el despliegue de un agente y señala las lagunas (falta de interruptor de ejecución, falta de canario, límite de interruptor demasiado suelto).

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- Confirmar el incendio del interruptor de circuito en la curva 7 (quinta llamada idéntica) y el incendio canario en la curva 9 (lectura de llave falsa).

2. Añadir un detector estadístico: EWMA z-score en la frecuencia de llamada de herramienta. Alimenta en una trayectoria que se desvía lentamente y muestra que el detector nunca dispara. Ahora añadir un límite duro (no más de 50 llamadas de herramienta en 10 minutos) y mostrar los incendios de límite duro en la misma trayectoria.

3. Diseñe un conjunto de fichas canarias para un agente de navegador (lección 11).

4. Lea los documentos de política de red de Cilium. Describa concretamente un flujo de cuarentena de salida-redirección: qué selector de política, qué módulo, qué salida reescribe, qué alerta. ¿Qué rige la latencia del reloj de pared de "decidir a cuarentena" a "primer paquete redirigido"?

5. Definir un procedimiento de reactivación para un agente de muerte, quién puede reactivación, qué debe documentarse, qué debe cambiar sobre el agente antes de reactivación.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Kill switch | "Off button" | Boolean outside the agent's edit surface; checked on every consequential action |
| Circuit breaker | "Pattern pause" | Action-specific trip on repetition, failure rate, or rate-limit |
| Canary token | "Honeytoken" | Bait the agent has no legitimate reason to touch; access fires an alert |
| Honeypot | "Forensic sandbox" | Redirected traffic / workspace where a quarantined agent is observed |
| EWMA | "Moving average" | Exponentially weighted; adapts to drift (feature + bug) |
| CUSUM | "Cumulative sum" | Detects sustained shift from baseline |
| Hard limit | "Constitutional rule" | Does not adapt; constant regardless of history |
| Constitutional limit | "Always-true rule" | Tied to Lesson 17's constitution; cannot be edited by the agent |

## Leer más

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) enmarcamiento de interruptores de apagado y interruptores de circuito para agentes autónomos.
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) patrones de gobernanza de la producción.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) Requisitos de detección y respuesta.
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/) Redirección de salida a nivel de cápsulas y patrones forenses de honeypot.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) prohibiciones codificadas como "limites constitucionales".
