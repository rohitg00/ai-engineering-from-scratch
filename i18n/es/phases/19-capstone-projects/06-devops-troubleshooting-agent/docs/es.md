# Capstone 06  DevOps Agente de solución de problemas para Kubernetes

> El agente DevOps de AWS fue GA, Resolve AI publicó sus libros de jugadas K8s, NeuBird demostró el monitoreo semántico y Metoro vinculó AI SRE a SLOs por servicio. La forma de producción está establecida: un aviso webhook se dispara, un agente lee la telemetría, camina un gráfico de objetos K8, clasifica las hipótesis de causa raíz y publica un breve Slack con botones de aprobación. Solo para lectura por defecto. Cada remedio cerrado por un humano. Esta piedra angular es ese agente, evaluado en 20 incidentes sintéticos y comparado con el agente de AWS en tres casos compartidos.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration, agent scaffold)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## El problema

La narrativa de SRE 2025-2026 se convirtió en: "Los agentes de IA tria incidentes, los humanos aprueban remedios". AWS DevOps Agent, Resolve AI, NeuBird, Metoro, PagerDuty AIOps todos envían esta forma en producción. El agente lee métricas de Prometeo, registros de Loki, rastros de Tempo, métricas de estado kube y un gráfico de conocimiento de los objetos de K8. Produce una hipótesis de raíz clasificada con citas de telemetría en menos de cinco minutos. Nunca ejecuta órdenes destructivas sin la aprobación humana explícita a través de Slack.

La mayor parte del trabajo duro es el alcance y la seguridad, no el razonamiento. El agente necesita una superficie RBAC de lectura por defecto, un servidor de herramientas MCP endurecido y registros de auditoría de cada comando considerado vs ejecutado. Necesita saber cuándo está fuera de su profundidad y escalada. Y tiene que funcionar lo suficientemente barato como para que las cascadas de OOM-kill no generen una factura de agente de $ 5k.

## Concepto

El agente opera sobre un gráfico de conocimiento. Los nodos son objetos K8s (Pods, Despliegues, Servicios, Nodos, HPAs, PVC) más fuentes de telemetría (serie Prometeus, flujos Loki, rastros Tempo). Los bordes codifican la propiedad (Pod -> ReplicaSet -> Despliegue), la programación (Pod -> Node) y la observación (Serie Pod -> Prometheus). El gráfico se mantiene fresco mediante una sincronización de métricas kube-estado y se muestre nuevamente en cada alerta.

Cuando una alerta dispara, el agente causa raíces del objeto afectado. Caminará por los bordes, sacará las partidas de telemetría relevantes (last 15 minutos) y redactará una hipótesis. La hipótesis se clasifica por evidencia: cuántas citas de telemetría la respaldan, cuán recientes, cuán específicas. Las 3 hipótesis principales van a Slack con visualizaciones de la ruta gráfica y botones de aprobación para acciones de reparación.

Las acciones destructivas (descalificar, volver a rolar, eliminar Pods) requieren la aprobación de Slack; los ganchos de retroceso de ArgoCD requieren un token de autor que el agente nunca posee. El registro de auditoría registra cada comando que el agente *consideró*  no solo ejecutó  por lo que el proceso de revisión atrapa casi faltas.

## Arquitectura

```
PagerDuty / Alertmanager webhook
           |
           v
     FastAPI receiver
           |
           v
   LangGraph root-cause agent
           |
           +---- read-only MCP tools ----+
           |                             |
           v                             v
   K8s knowledge graph              telemetry slices
     (Neo4j / kuzu)              Prometheus, Loki, Tempo
   ownership + scheduling          last 15m, scoped
           |
           v
   hypothesis ranking (evidence weight)
           |
           v
   Slack brief + approval buttons
           |
           v (approved)
   ArgoCD rollback hook / PagerDuty escalate
           |
           v
   audit log: considered vs executed, every command
```

## El establo

- Fuentes de observabilidad: Prometheus, Loki, Tempo, cube-estado-metricas
- Gráfico de conocimientos: Neo4j (administrado) o kuzu (embedded) de objetos K8s + bordes de telemetría
- LangGraph con lista de permisos por herramienta, sólo para lectura por defecto
- Transporte de herramientas: FastMCP sobre StreamableHTTP; servidor separado para herramientas destructivas detrás de la puerta de aprobación
- Modelos: Claude Sonnet 4.7 para el razonamiento de la causa raíz, Gemini 2.5 Flash para la resumen de registro
- Remedición: ArgoCD rollback webhook, PagerDuty escalate, tarjeta de aprobación Slack
- Auditoría: registro estructurado sólo en apéndice (considerado, ejecutado, aprobado, resultado)
- Despliegue: Despliegue de K8 con su propio papel de RBAC estrecho; espacio de nombres separado

```figure
ce-rootcause-walk
```

## Construye el mismo

1. **Graph ingestion.**Sincronizar los datos de estado de kube en Neo4j/kuzu cada 30 años. Nodos: Pod, Despliegue, Nodo, Servicio, PVC, HPA. Edges: OWNED_BY, SCHEDULED_ON, EXPOSES, MOUNTS, SCALES.

2. **Alert receiver.**Endpoint FastAPI que acepta PagerDuty o Alertmanager webhooks. Extraer el objeto afectado y la violación de SLO.

3. **Read-only tool surface.**Envuelve kubectl, consulta Prometheus, Loki logql, Tempo traceql a través de FastMCP. Cada herramienta tiene un verbo RBAC estrecho ("obtener", "lista", "describir"). No hay "eliminar", "exec", "escala" en el servidor predeterminado.

4. **Root-cause agent.**LangGraph con tres nodos: `sample`tira la parte de telemetría de los últimos 15 minutos,`walk`hace consultas en el gráfico para objetos vecinos, `hypothesize`Los proyectos clasificaron a los candidatos por causas raíces con citas de telemetría.

5. **Evidence scoring.**Cada hipótesis tiene un puntaje = reciencia * especificidad * longitud del trazado de gráfico inverso * recuento de citas.

6. **Slack brief.**Publice un anexo con la hipótesis, la visualización de la ruta gráfica (una imagen subgrafica que se hace en el lado del servidor) y los botones de aprobación para una acción de reparación como máximo.

7. **Remediation gate.**Las herramientas destructivas (descenso, retroceso, eliminación) viven en un segundo servidor MCP detrás de un token de aprobación.

8. **Audit log.**JSONL sólo para añadir: para cada comando candidato, registra si se consideró, si se ejecutó, quién lo aprobó.

9. **Synthetic incident suite.**Construir 20 escenarios: cascada OOMKill, flap DNS, thrash HPA, PVC llenado, vecino ruidoso, coche lateral defectuoso, mal despliegue de ConfigMap, rotación de certificado, retiro de imagen, etc. Poner el agente en la exactitud de la causa raíz y el tiempo-a-hipótesis.

## Usalo

```
webhook: alert.pagerduty.com -> checkout-api SLO breach, error rate 14%
[graph]   affected: Deployment checkout-api (3 Pods, Node ip-10-2-3-4)
[walk]    neighbors: ReplicaSet checkout-api-abc, Service checkout-api,
           recent rollout 14m ago
[sample]  prometheus error_rate 14%, up-trend; loki 500s on /api/v2/pay
[hypo]    #1 bad rollout: latest image checkout-api:v2.41 fails /healthz
          citations: deploy.yaml (rev 42), prometheus errorRate, loki 500 stack
[slack]   [ROLL BACK to v2.40]  [ESCALATE]  [IGNORE]
          (approval required; agent does not roll back unilaterally)
```

## Envío

`outputs/skill-devops-agent.md`Dado un grupo de K8s y la fuente de alerta, el agente produce hipótesis de raíz clasificadas y un flujo de remediación por Slack-gated.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | ≥80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |
| **100** | | |

## Los ejercicios

1. Lleve a su agente en los mismos tres incidentes en que el agente DevOps de AWS está demo'd. Publica el lado a lado.

2. Añadir una auditoría "casi perdida" que señala cualquier comando que el agente *considera* que hubiera sido destructivo sin su aprobación.

3. Cambiar el modelo de hipótesis de Claude Sonnet 4.7 a un Llama 3.3 70B auto-hosted. Medir la precisión RCA delta y dólares por incidente.

4. Construir un filtro causal: distinguir los picos de telemetría correlacionados de una causa raíz real.

5. Añadir un rollback dry run: ArgoCD rollback contra un grupo de etapas con el mismo manifiesto. Verifique el plan de rollback en un grupo en vivo antes del botón de aprobación Slack.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | Nodes = K8s objects + telemetry series; edges = ownership, scheduling, observation |
| Read-only-by-default | "Scoped RBAC" | Agent's service account has only get/list/describe verbs; destructive verbs live in a separate server behind approval |
| Audit log | "Considered vs executed" | Append-only record of every candidate command, whether it ran, who approved |
| Hypothesis ranking | "Evidence score" | Recency × specificity × graph-path length inverse × citation count |
| Slack approval card | "HITL gate" | Interactive Slack message with remediation buttons; agent cannot proceed until a human clicks |
| Telemetry citation | "Evidence pointer" | A Prometheus query, Loki selector, or Tempo trace URL that supports a claim |
| MTTR | "Time to resolution" | Wall-clock from alert fire to SLO recovery |

## Leer más

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/): la referencia canónica 2026
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) la referencia del competidor
- [NeuBird semantic monitoring](https://www.neubird.ai) Abordaje semántico-grafico
- [Metoro AI SRE](https://metoro.io) Enmarcado de producción SLO-first
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) la fuente del estado del grupo
- [LangGraph](https://langchain-ai.github.io/langgraph/) Orquestación de agentes de referencia
- [FastMCP](https://github.com/jlowin/fastmcp) Framework de servidores Python MCP
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) el objetivo de reparación cerrado
