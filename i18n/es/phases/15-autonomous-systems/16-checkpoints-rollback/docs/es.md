# Puntos de control y retroceso

> Cada transición del estado gráfico persiste. Cuando un trabajador se estrella, su contrato de arrendamiento expira y otro trabajador se lleva al último punto de control. Objetos duraderos de Cloudflare mantienen el estado durante horas o semanas. Proponer y luego comprometerse (lección 15) define un plan de retroceso por acción. La verificación post-acción cierra el ciclo. El artículo 14 de la Ley de IA de la UE obliga a la supervisión humana efectiva de los sistemas de alto riesgo  en la práctica, esto significa que los puestos de control deben ser consultables, los rollbacks deben ser ensayados y la pista de auditoría debe sobrevivir a una implementación. El modo de falla aguda: sin claves de impotencia y controles de precondiciones, un retiro después de un fallo transitorio puede duplicar una acción ya aprobada. La verificación después de la acción es lo que lo captura.

**Type:** Learn
**Languages:** Python (stdlib, checkpoint and rollback state machine), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 15 (Propose-then-commit)
**Time:** ~60 minutes

## El problema

La ejecución duradera (lección 12) hace que un agente accidentado sea reiniciable. Proponer-then-commit (lección 15) hace que una acción aprobada sea auditable. Esta lección se une a ellos: ¿qué sucede cuando una acción aprobada se ejecuta parcialmente, se estrella y se reanúa? ¿Cuándo se ejecuta el rollback y contra qué estado?

Los sistemas reales lo hacen de manera diferente:

- **LangGraph**Los controles de los trabajadores se realizan en el último punto de control.`interrupt()`, que en sí misma persiste.
- **Cloudflare Durable Objects**Mantenga el estado de cada llave durante horas o semanas.
- **Microsoft Agent Framework**expone `Checkpoint`Primitivos en la API de flujo de trabajo; replay más idempotency cubre retemptantes.

En cada caso, la combinación que realmente funciona es: clave de impotencia (previene la doble ejecución) + control de condiciones previas (el estado es todavía lo que aprobamos) + verificación post-acción (el efecto secundario realmente ocurrió) + retroceso en el verificación-fallo.

## El concepto

### Cada transición persiste

Una transición de estado gráfico es cualquier paso que mueve el flujo de trabajo de un estado llamado a otro. Las implementaciones ingenuas persisten solo en puntos de compromiso específicos; las implementaciones de producción persisten en cada transición. El costo (algunos escriben más) es pequeño en relación con la ganancia de fiabilidad (la repetición aterriza en cualquier lugar, la recuperación de arrendamiento es precisa).

### Recuperación de arrendamiento

Cuando un trabajador se estrella, el flujo de trabajo no se pierde; el contrato de arrendamiento (una afirmación de corta duración de que este trabajador está ejecutando esta carrera) simplemente expira. Otro trabajador toma el último punto de control y reanuda. El mecanismo de arrendamiento es lo que permite que los sistemas de producción sobrevivan a los despliegues sin perder el trabajo en vuelo.

### Idempotencia más condiciones previas

La capacidad de trabajo no es suficiente.$100 from A to B when balance > $1000. " El flujo de trabajo se compromete, se desploma en medio de la ejecución y se reanuda. Si solo se verifica la clave de desimpedencia y se reanuda la ejecución, la transferencia se ejecuta una vez (correcto). Pero considere que entre el desplome y el reanudación, el saldo de A cae a $ 500 a través de un flujo de trabajo diferente. La verificación de desimpedencia aún pasa; la condición previa no. Sin una verificación de condición previa, enviamos un sobregiro.

Cada acción consecuente requiere de ambas cosas:

- **Idempotency key**: evita la doble ejecución.
- **Precondition check**El informe de la Comisión de Asuntos Exteriores de la Comisión de Asuntos Exteriores de la Unión Europea (UEA) confirma que el Estado sigue siendo coherente con lo aprobado.

### Verificación posterior a la acción

"La herramienta devuelta 200" no es verificación. La verificación real vuelve a leer el estado objetivo y confirma que el efecto secundario realmente ocurrió.

- Actualización de la base de datos: `UPDATE ... RETURNING *`a continuación, afirmen el estado previsto de las partidas de fila devueltas.
- Envío de correo electrónico: compruebe la carpeta de envío para la identificación del mensaje después de la presentación.
- Escribir archivos: leer el archivo y hasharlo.
- Llamada de la API: seguimiento `GET`en el recurso objetivo.

Si la verificación falla, el flujo de trabajo está en un estado conocido.

### Planificaciones de retroceso

Cada acción consecuente en la propuesta-entonces-compromiso (lección 15) tiene un plan de retroceso.

- **In-band rollback**: revertir directamente el efecto secundario (`DELETE`después de`INSERT`¿ Qué ?`Send-correction-email`después de enviar).
- **Compensating transaction**: una nueva acción que neutraliza el original (patrón SAGA estándar).
- **Out-of-band rollback**Alerta a un humano, detiene el flujo de trabajo, deja el mal estado para la investigación.

Las acciones sin retroceso requieren un mayor HITL en el tiempo de compromiso (lección 15 de desafío y respuesta).

### Ley de IA de la UE Artículo 14 Lectura operativa

El artículo 14 requiere una "supervisión humana efectiva" de los sistemas de alto riesgo.

- Los puntos de control son consultables por un auditor.
- Se ensayan los rollbacks (se prueban de extremo a extremo al menos una vez).
- El rastro de auditoría sobrevive a un despliegue (el backend del checkpoint no es efímero).
- Las verificaciones fallidas son alertadas, no registradas en silencio.

Un flujo de trabajo que se estropee en medio del compromiso, reanude y complete el efecto secundario sin una vía de verificación + retroceso no sobrevive al ensayo del artículo 14.

### El modo de falla aguda: el doble ejecutor

El incidente de producción más común en este espacio:

1. Acción aprobada, clave de la inmunidad k.
2. Compromiso comienza, ejecuta, devuelve 200.
3. El flujo de trabajo se desploma antes de que persista el estado de "compromiso".
4. El flujo de trabajo se reanuda; ve "aprobado pero no comprometido"; se reejecuta.
5. El efecto secundario dispara dos veces.

Mitigación: persiste una intención "en vuelo" antes de la ejecución, ejecuta con una clave de idempotencia, luego marca "compromete" solo después de que la verificación post-acción tenga éxito. Si los disparos de acción y la escritura de estado fallan, usted sabe verificar y (si es necesario) volver a disparar. Si la escritura de estado tiene éxito y la acción falla, verifica y dispara exactamente una vez a través del camino de recuperación.

```figure
checkpoint-replay
```

## Usalo

`code/main.py`El conductor simula cuatro escenarios: ejecución limpia, retiro después del accidente (captura de la idempotencia), falla de la condición previa (aborto de flujo de trabajo sin disparar), falla de verificación (incendios de retroceso).

## Envío

`outputs/skill-rollback-rehearsal.md`diseña un ensayo de ensayo de retroceso para un flujo de trabajo propuesto y audita el punto de control de retroceso para determinar la persistencia de la pista de auditoría.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Para el caso de accidente durante el cometido, confirme los disparos de acción exactamente una vez en los retos.

2. Modifique el patrón "marcar como hecho primero, luego hacerlo" para que el estado escriba incendios después de la acción. Repite el escenario de choque. Medir cuántas acciones duplicadas disparar.

3. Diseñar un plan de retroceso para una acción de producción específica (por ejemplo, "post a un canal Slack"). Clasificar como dentro de banda, compensando o fuera de banda. Justificar la elección.

4. Tome un flujo de trabajo que conozca. Identifique cada transición de estado. Marque cada uno con un requisito de durabilidad (persistir / no persistir). Cuente los que actualmente no persisten.

5. Prueba de retroceso repetida: diseñar una prueba de extremo a extremo que ejecute un flujo de trabajo real, lo estropee y confirme los incendios de la ruta de retroceso. ¿Qué afirma la prueba?

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Checkpoint | "Save point" | Every graph-state transition persists to a durable store |
| Lease | "Worker claim" | Short-lived claim that a worker is executing a run; expires on crash |
| Precondition | "State gate" | Assertion that the state is still consistent with the approved action |
| Post-action verify | "Re-read check" | Confirm the side effect actually happened in the target system |
| In-band rollback | "Direct undo" | Reverse the side effect with the inverse operation |
| Compensating transaction | "SAGA undo" | A new action that neutralizes the original |
| Mark-as-done-first | "Status write order" | Persist the committed status before returning from commit |
| Article 14 | "EU AI Act human oversight" | Operational: queryable checkpoints, rehearsed rollbacks, auditable trail |

## Leer más

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) Primitivas de los puntos de control y recuperación de arrendamientos.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) Objetos duraderos como sustrato de estado.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) línea de base regulatoria.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Enmarcamiento de fiabilidad para los flujos de trabajo de largo horizonte.
- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) forma del flujo de trabajo para las rutinas de código de Claude.
