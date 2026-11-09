# Modos de fracaso  MAST, pensamiento grupal, monocultura, errores en cascada

> La taxonomía de referencia para 2026 es **MAST**(Cemri et al., NeurIPS 2025, arXiv:2503.13657), derivado de 1642 rastros de ejecución en 7 MAS de código abierto de última generación que muestran **41–86.7% failure rate**. Tres categorías raíces: **Specification Problems**(41,77%)  ambigüedad de rol, definiciones poco claras de tareas; **Coordination Failures**(36,94%)  fallos de comunicación, dessincronización de estado; **Verification Gaps**(21,30%)  falta de validación, falta de controles de calidad.**Groupthink**La familia (arXiv:2508.05687) añade: colapso de la monocultura (el mismo modelo base → fallos correlacionados), sesgo de conformidad (los agentes refuerzan los errores de los demás), teoría de la mente deficiente, dinámica de motivos mixtos, fallos de fiabilidad en cascada. Ejemplo en cascada: tormentas de retoma en las que un fallo de pago desencadena retomas de pedidos, que desencadena retomas de inventario, que abruman el servicio de inventario (10 veces la carga en segundos  necesita interruptores de circuito). Envenenamiento de la memoria: la alucinación de un agente entra en la memoria compartida, los agentes aguas abajo la tratan como un hecho; la precisión se descompone gradualmente, haciendo doloroso el diagnóstico de la causa raíz.**STRATUS**(NeurIPS 2025) informa una mejora de 1.5 veces en la mitigación y el éxito a través de agentes especializados de detección / diagnóstico / validación.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 13 (Shared Memory), Phase 16 · 14 (Consensus and BFT), Phase 16 · 15 (Voting and Debate Topology)
**Time:** ~75 minutes

## El problema

Los sistemas multi-agentes fallan en 41-86,7% del tiempo en tareas reales (Cemri et al. 2025 midió esto en 7 MAS de código abierto). Eso no se puede deshacer por "solo agregar más agentes". Los fallos tienen causas estructurales. La taxonomía MAST le da las categorías. Esta lección mapea cada categoría a un patrón concreto de detección, diagnóstico y mitigación para que los números dejen de parecer arbitrarios.

La práctica de producción 2026 es tratar los modos de falla como entradas de diseño.

## Concepto

### Categorías de MAST

**Specification Problems (41.77% of failures).**La tarea del agente no fue definida lo suficientemente estrictamente.

- Ambigüedad de rol: dos agentes piensan que son los revisores.
- La tarea se especificó: "resumir esto" cuando el usuario quería un ángulo específico.
- Criterios de éxito implícitos: el agente no puede decir si ha tenido éxito.

Mitigación:
- Escriba contratos de rol explícitos. El aviso de cada agente indica lo que hace *y lo que no hace*.
- Pruebas de aceptación por tarea. Antes de que el agente comience, define "hacido parece X".
- Verificación de especificaciones antes del vuelo: un agente separado revisa la definición de tarea antes de su expedición.

**Coordination Failures (36.94%).**Comunicación o averías de estado.

Ejemplos:
- Dos agentes actualizan el estado compartido sin sincronización.
- Mensaje perdido entre agentes (fallo de cola, tiempo de espera).
- Drift de estado: el agente A cree que la tarea está hecha; el agente B todavía está ejecutando.

Mitigación:
- Estado compartido con una concurrencia optimista.
- Reconocimiento explícito de los mensajes críticos (retrasar hasta que se haya aclarado).
- Puntos de control periódicos de sincronización de estado; detecta la deriva temprano.

**Verification Gaps (21.30%).**No hay control independiente de las salidas.

Ejemplos:
- Un agente afirma el éxito; nadie lo verifica.
- Cada cadena de agentes confía en la producción del prior.
- La cobertura de pruebas faltan en el comportamiento compuesto emergente.

Mitigación:
- Agente de verificación independiente (lección 13). Acceso de fuente independiente, sólo para lectura.
- Contrato de entrega explícito: "La salida de A debe pasar el control C antes de que comience B".
- Registro de resultados para análisis post hoc.

### La familia de pensamiento de grupo (arXiv:2508.05687)

Cinco fallas relacionadas cuando los agentes se homogenizan o se imitan entre sí:

**Monoculture collapse.**El mismo modelo base o datos de formación → errores correlacionados. Cuando tres agentes comparten un LLM, comparten sus alucinaciones.

**Conformity bias.**Los agentes se adaptan al compañero más fuerte o más seguro, incluso cuando están equivocados.

**Deficient ToM.**Los agentes no pueden modelar las creencias de los demás; la coordinación se desmorona (lección 18).

**Mixed-motive dynamics.**Los agentes con incentivos parcialmente alineados se mueven hacia el medio de compromiso, lo que no satisface a nadie.

**Cascading reliability failures.**El patrón de error de un componente desencadena patrones de error en componentes dependientes.

### Ejemplo en cascada  la tormenta de retiro

Un patrón clásico de incidentes de 2026:

```
payment service fails 10% of requests
   ↓
order agent retries payment (exponential backoff but naive)
   ↓
each retry is a new order-inventory check
   ↓
inventory service sees 2x normal load
   ↓
inventory service starts timing out
   ↓
every order retries inventory check
   ↓
inventory service sees 10x normal load
   ↓
cluster goes down
```

La solución es clásica:**circuit breakers**Cuando la tasa de error en el torrente inferior exceda el umbral, cortocircuito con resultados almacenados en caché o por defecto.

Los interruptores de circuito son una de las pocas mitigantes de fallas multi-agentes que tomas prestadas directamente de sistemas distribuidos sin modificaciones.

### Envenenamiento por memoria (revisado)

Desde la lección 13: la alucinación de un agente se convierte en un hecho de memoria compartida; los agentes en aguas posteriores razonan sobre el hecho envenenado.

El síntoma es una degradación gradual de la precisión.

Mitigation: sólo adjunta registro, procedencia, verificador no escriturable. ya cubierto en la lección 13.

### STRATUS  agentes especializados para la detección de fallos

STRATUS (NeurIPS 2025) informa una mejora de 1,5 veces en el éxito de mitigación cuando se implementa:

- **Detection agent.**Reloj para patrones de síntomas (alto desacuerdo, picos de retoma, deriva de precisión).
- **Diagnosis agent.**Dados los síntomas, se deduce la causa raíz probable de la taxonomía MAST.
- **Validation agent.**Después de aplicar una mitigación, compruebe si los síntomas desaparecen.

Esta es una respuesta a incidentes de estilo SRE, aplicada a los sistemas de agentes.

### La auditoría en modo de falla

Una mejor práctica para 2026 es una auditoría trimestral (y por lanzamiento mayor) en modo de falla:

1. **Trace sample.**Recoge 1000 huellas reales de ejecución.
2. **Categorize.**Para los fallos de cada rastro, mapa a las categorías MAST + Groupthink.
3. **Compute failure-by-category rate.**¿Qué categorías dominan su sistema?
4. **Rank mitigations.**¿Cuál solución eliminaría la mayoría de los fracasos?
5. **Pick 2-3 mitigations.**Implementación; reevaluación en el próximo trimestre.

La disciplina es más importante que las elecciones específicas. sin auditorías, los fracasos se mezclan en ruido y nunca se abordan sistemáticamente.

### Cuando los sistemas fallan silenciosamente

La categoría de fallas más peligrosa es la falla de corrección silenciosa. Un sistema que falla en voz alta (crash, excepción, alerta) se puede monitorear. Un sistema que produce resultados plausibles pero incorrectos no se puede detectar por registros de excepciones. Esta es la razón por la cual las lagunas de verificación son la categoría más cara por fallo aunque son solo del 21,30% en cuenta.

Invertir en:
- Revisas humanas basadas en muestras.
- Pruebas de regresión de conjunto de datos dorados.
- Controlo entre agentes de resultados importantes.

### El fracaso vs el fracaso lento

Algunos fallos son inmediatos; otros son lentos. Los fallos inmediatos (tiempo de espera, desajuste de esquema, error de autor) son baratos de detectar. Los fallos lentos (intoxicación de memoria, deriva de monocultura, ambigüedad de rol) son costosos de detectar y prevenir.

El movimiento de ingeniería 2026: los proxies de fallos lentos de los instrumentos para que pueda capturar la deriva antes de que se convierta en un error visible.

```figure
a5-retry-cascade
```

## Construye el mismo

`code/main.py`los instrumentos:

- `FailureTaxonomy` categorizará los incidentes simulados en categorías de MAST + Groupthink.
- `CircuitBreaker` patrón clásico; se abre cuando la tasa de error excede el umbral.
- `RetryStormSimulator` muestra el fallo en cascada; enciende o apaga el interruptor.
- `DetectionAgent` matching de síntomas de estilo STRATUS.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Producción esperada:
- Tormenta de nuevo sin interruptor de circuito: los errores de inventario explotan (simulados).
- con interruptor de circuito: tapa en el umbral; se sirven respuestas en modo degradado.
- el agente de detección marca el patrón y nombra la categoría MAST.

## Usalo

`outputs/skill-mast-auditor.md`ejecuta una auditoría de modo de falla de estilo MAST en un sistema multiagente.

## Envío

Disciplina en el modo de fallo en la producción:

- **MAST audit per quarter.**Las categorías cambian a medida que tu sistema crece.
- **Circuit breakers everywhere.**Cada llamada de salida a cualquier servicio dependiente.
- **Golden datasets.**Pequeña, de alta calidad, auditada a mano, prueba de regresión contra ellos semanalmente.
- **STRATUS trio.**Detección + diagnóstico + agentes de validación que monitorean la producción.
- **Failure budget.**Explicito SLO para la tasa de fracaso por categoría.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar el interruptor de circuito, volver a intentar la tormenta, cambiar el umbral de falla y observar el cambio.
2. Implementar una **slow-failure proxy**Cuando cae de forma brusca, activa una alerta Simula una deriva de monocultivo correlacionando gradualmente las salidas de los agentes.
3. Leer Cemri et al. (arXiv:2503.13657). elige uno de sus 7 sistemas MAS y mapea sus 3 principales categorías de fallos. ¿Cómo se comparan estos con lo que predice MAST?
4. En el artículo de GrupoTexto (arXiv:2508.05687) se indica cuál de los cinco patrones es más difícil de detectar en la producción.
5. Diseñar un trio de detección-diagnóstico-validación al estilo STRATUS para un sistema multi-agente específico que usted conoce. ¿Qué síntomas vigila la detección? ¿Qué mitigantes recomienda el diagnóstico? ¿Cómo confirma la validación que funcionan?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MAST | "The 2026 taxonomy" | Cemri 2025; 3 root categories + 14 sub-types of failures. |
| Specification Problem | "Role ambiguity" | Task or role under-defined; agents do not know what to do. |
| Coordination Failure | "State drift" | Communication or sync breakdown between agents. |
| Verification Gap | "No one checked" | Outputs accepted without independent validation. |
| Groupthink family | "Homogeneity failures" | Monoculture, conformity, deficient ToM, mixed-motive, cascading. |
| Monoculture collapse | "Same model, same hallucinations" | Correlated errors from shared base model or training data. |
| Retry storm | "Cascading error amplification" | One failure triggers retries which amplify load downstream. |
| Circuit breaker | "Fail fast on error rate" | Open when error rate exceeds threshold; short-circuit with default. |
| STRATUS | "Incident response trio" | Detection + diagnosis + validation agents. 1.5x mitigation success. |
| Memory poisoning | "Hallucinations propagate" | Shared-memory fact tainted; downstream agents reason on poison. |

## Leer más

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomía MAST, NeurIPS 2025
- [Groupthink failures in multi-agent LLMs](https://arxiv.org/abs/2508.05687) monocultura, conformidad y taxonomía de cinco familias
- [STRATUS — specialized agents for MAS incident response](https://neurips.cc/) Entrada en el procedimiento NeurIPS 2025 (detección + diagnóstico + validación)
- [Release It! — stability patterns (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) la referencia canónica del interruptor de circuitos
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Notas de fallas de producción
