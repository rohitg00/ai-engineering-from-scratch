# SRE para IA  Respuesta a incidentes multi-agentes, libros de ejecución, detección predictiva

> AI SRE utiliza LLM basados en datos de infraestructura (logs, libretas de ejecución, topología de servicios) a través de RAG para automatizar las fases de investigación, documentación y coordinación. El patrón de arquitectura de 2026 es la orquestación de múltiples agentes  agentes especializados (logs, métricas, libretas de ejecución) coordinados por un supervisor; la IA propone hipótesis y consultas, los humanos aprueban las llamadas de juicio. Datadog Bits AI y Azure SRE Agent envían esto como productos gestionados. Los libros de ejecución están evolucionando: NeuBird Hawkeye utiliza la evaluación adversarial (dos modelos analizan el mismo incidente; acuerdo = confianza, desacuerdo = incertidumbre); la memoria operativa persiste a través de los cambios en el equipo. La auto-remediación se mantiene cautelosa: la IA sugiere, los humanos aprueban. La acción totalmente autónoma es estrecha (capsula de reinicio, despliegue específico de retroceso) con barandillas ajustadas  cualquier persona que venda "establezca y olvídate" está sobrevendendo. Frontera emergente: predicción previa al incidente. La investigación del MIT informa que un LLM entrenado en registros históricos + tiempos de GPU + patrones de error de API predijo que el 89% de las interrupciones se producirían 10-15 minutos antes. Proyección: el 95% de las LLM empresariales han automatizado el fallo a finales de 2026.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy multi-agent incident triage simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 24 (Chaos Engineering)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Diagrama la arquitectura de SRE AI multiagente: supervisor + agentes especializados (logs, métricas, libretas de ejecución) + puerta de aprobación humana.
- Explicar por qué la reparación automática es estrecha (capsula de reinicio, reversión de implementación) en lugar de amplia (servicio de rearquitetura).
- Nombre el patrón de evaluación adversarial (NeuBird Hawkeye): dos modelos coinciden = confianza; discrepan = escalada.
- Cita el resultado de detección temprana del MIT del 89% y la restricción operativa: las predicciones sin accionamiento son solo tablas de control.

## El problema

Un ingeniero en llamada recibe una llamada a las 3 a.m. "Alta tasa de error en la caja". Verifican Datadog, Loki, tres libretas de ejecución, el registro de implementación. 30 minutos después se dan cuenta de que la causa es una OOM de vLLM de un caché de KV. Reinician la cápsula; el error se limpia.

En 2026 los primeros 20 minutos de esa investigación son automatizados. Grupar registros por servicio, correlacionando con los despliegues recientes, coincidiendo con los libretas de ejecución  todos son RAG + uso de herramientas. Un agente supervisado puede hacer triaje de primer paso y presentar una hipótesis antes de que el humano abra Datadog.

La reparación totalmente autónoma es un problema diferente. Reiniciar la capsula: seguro. Pondería de GPU: seguro si la política lo permite. Rearquetar el servicio: absolutamente no. La disciplina está dibujando la línea estrecha.

## El concepto

### Arquitectura multiagente

```
          Incident
             │
             ▼
        Supervisor
        /    |    \
       ▼     ▼     ▼
  Log agent  Metric agent  Runbook agent
       │     │     │
       └─────┴─────┘
             │
             ▼
        Hypothesis + evidence
             │
             ▼
        Human approval
             │
             ▼
        Action (narrow set)
```

El supervisor divide el incidente en subcuestiones. Los agentes especializados tienen acceso a herramientas (busca de registro, PromQL, recuperación de documentos).

### El alcance de la reparación automática

**Safe (narrow)**: reiniciar la capsula, revertir el despliegue específico, combinar escala dentro de los límites previamente aprobados, habilitar la bandera de la característica previamente aprobada.

**Not safe (broad)**: cambiar la topología del servicio, modificar los límites de recursos, implementar un nuevo código, cambiar el IAM, alterar las bases de datos.

El seguro crece a medida que la IA SRE madura, pero el límite es real.

### Evaluamiento adversario (NeuBird Hawkeye)

Dos modelos analizan de forma independiente el mismo incidente. Si coinciden en la causa raíz, la confianza es alta. Si no coinciden, escalar a humanos con ambas hipótesis visibles. patrón simple, filtro eficaz contra las causas raíz alucinadas.

### Memoria de operación

El cambio de equipo es el asesinato silencioso de las hojas tradicionales de conocimiento tribal SRE . AI SRE almacena libros de ejecución + post mortem en un DB vectorial; los agentes se recuperan en cada nuevo incidente. Cuando nuevos ingenieros se unen, la IA tiene una historia completa.

### Previsión de los incidentes

Investigación del MIT 2025: LLM entrenado en registros históricos, temperaturas de GPU, patrones de error de API predijo el 89% de las interrupciones 10-15 minutos antes de que ocurrieran en el conjunto de pruebas.

Verificación de realidad: las predicciones sin accionamiento son tablas de control. La pregunta operativa es "¿cuando predicemos, qué hacemos?" Desagüe preventivo? Pager? Auto-escala? La respuesta es específica de la política.

### Productos en 2026

- **Datadog Bits AI** manejó el copiloto de SRE dentro de Datadog.
- **Azure SRE Agent**- Nativo de Azure.
- **NeuBird Hawkeye** evaluación adversaria + memoria operativa.
- **PagerDuty AIOps** triaje + deduplicación.
- **Incident.io Autopilot** Comandante de incidentes + coordinación.

### Los libros de ejecución como código

Los runbooks evolucionan desde las páginas de Confluence hasta la marcación de versiones con secciones estructuradas (síntomo, hipótesis, verificación, acción).

### Números que debes recordar

- Detección temprana del MIT: 89% de interrupciones, tiempo de entrega de 10-15 minutos.
- Triaje multiagente: supervisor + (registros, métricas, libretas de ejecución) + humano.
- Set de reparación automática segura: reiniciar la cápsula, volver a desplegar, escalar dentro de los límites.
- Evaluar adversariamente: dos modelos independientes; acuerdo = confianza.

```figure
i4-incident-agents
```

## Usalo

`code/main.py`simula una triaje multi-agente: el agente de registro encuentra el error, el agente métrico encuentra el pico de la CPU, el agente de la libreta de ejecución coincide con el problema conocido.

## Envío

Esta lección produce`outputs/skill-ai-sre-plan.md`Dado el volumen actual de llamadas, incidentes, madurez del equipo, diseña un despliegue de AI SRE.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Y si los agentes de registro y métrica no están de acuerdo?
2. Defina tres acciones de auto-remediación "seguras" para tu servicio.
3. Escriba una plantilla estructurada de libretas de ejecución: secciones, campos requeridos, comandos de verificación.
4. ¿Cuál es tu política de búsqueda, pre-desagüe o ambas?
5. Deben discutir si un equipo de 3 personas debe adoptar AI SRE en 2026 o esperar.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| AI SRE | "agent for on-call" | LLM-backed incident investigation + coordination |
| Supervisor agent | "the orchestrator" | Top-level agent breaking incidents into sub-queries |
| Specialized agent | "domain agent" | Sub-agent with tool access (logs, metrics, runbooks) |
| Auto-remediation | "AI fixes it" | Narrow pre-approved action; NOT broad re-architecture |
| Operational memory | "vector runbooks" | Post-mortems + runbooks in vector DB for RAG |
| Adversarial eval | "two-model check" | Independent analyses; agreement = confidence |
| NeuBird Hawkeye | "the adversarial one" | Product with adversarial-eval + memory pattern |
| Bits AI | "Datadog's SRE agent" | Datadog-managed AI SRE |
| Pre-incident prediction | "early detection" | 10-15 min lead time on outage prediction |

## Leer más

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
