# GPU Autoscaling en Kubernetes  Karpenter, programador KAI, programación de pandillas

> Tres capas, no una. Los nodos de provisiones de Karpenter se ejecutan dinámicamente (menos de un minuto, un 40% más rápido que el Cluster Autoscaler). KAI Scheduler maneja la programación de pandillas, la conciencia de la topología y las colas jerárquicas  evita la trampa de asignación parcial de 7 de 8 donde siete nodos esperan y se queman en una GPU faltante. Autoscalers de nivel de aplicación (NVIDIA Dynamo Planner, llm-d Workload Variant Autoscaler) escala en señales específicas de inferencia  profundidad de cola, utilización de caché KV  no ciclo de trabajo de CPU / DCGM. La trampa clásica de la HPA es que`DCGM_FI_DEV_GPU_UTIL`es una medición del ciclo de tarea: 100% podría ser 10 solicitudes o 100. vLLM asigna previamente memoria de caché KV, por lo que la memoria nunca activa la escalada.`WhenEmptyOrUnderutilized`política que termina con la ejecución de trabajos de GPU en mitad de la inferencia.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Diagrafía de las tres capas de autoescalado (provisión de nodos, programación de grupos, nivel de aplicación) y nombra la herramienta utilizada en cada capa.
- ¿ Por qué ?`DCGM_FI_DEV_GPU_UTIL`es la señal HPA incorrecta para vLLM y nombrar dos reemplazos (profundidad de cola, utilización de caché KV).
- Describa la programación de banda y el modo de falla de asignación parcial que KAI Scheduler impide (7 de las 8 GPUs inactivas).
- Nombre de la política de consolidación de Karpenter (`WhenEmptyOrUnderutilized`) que cese la ejecución de trabajos de GPU y establece la alternativa segura para 2026.

## El problema

Tu equipo envía un servicio de LLM en Kubernetes.`DCGM_FI_DEV_GPU_UTIL`El HPA nunca aumenta  ya piensa que estás lleno. añade una réplica manualmente; TTFT cae. HPA todavía no escala. La señal te está mintiendo.

Separadamente, se utiliza Cluster Autoscaler para nodos. Una solicitud de 1M-token llega a las 2 a.m.; el cluster pasa 3 minutos proporcionando un nodo, y los tiempos de solicitud fuera.

Separadamente, se implementa un modelo 70B que requiere 8 GPU en 2 nodos. El grupo tiene 7 GPUs libres, dispersas en 3 nodos, y necesita 1 más. Cluster Autoscaler proporciona un nodo para la GPU 1 faltante.

Tres capas, tres modos de falla diferentes. La autoescalación consciente de la GPU en 2026 no es "inclivar HPA". Es componer el provisioning de nodos, la programación de banda y la autoescalación de señales de aplicación.

## El concepto

### Capas 1  Provisión de nodos (Carpenter)

Karpenter observa los módulos pendientes y los nodos de provisión en ~ 45-60 segundos (Cluster Autoscaler normalmente toma 90-120 segundos para los nodos de GPU).`NodePool`restricción  si su cápsula necesita 8 H100 y el grupo no tiene un nodo correspondiente, Karpenter proporciona uno directamente en lugar de escalar un grupo existente.

**The consolidation trap**: El defecto de Karpenter `consolidationPolicy: WhenEmptyOrUnderutilized`Es peligroso para los grupos de GPU. Terminará un nodo de GPU en ejecución para migrar las capsules a una instancia de tamaño correcto más barata. Para las cargas de trabajo de inferencia que significa desalojar las solicitudes en ejecución y recargar un modelo 70B en el nuevo nodo. La pérdida es minutos de capacidad más fallos de solicitud.

Configuración segura para las redes de GPU:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

Permite a Karpenter consolidar nodos verdaderamente vacíos después de una hora pero nunca desalojar un trabajo en marcha.

### Capas 2  Programación de pandillas (KAI Scheduler)

KAI Scheduler (proyecto "Karp" entonces renombrado) maneja lo que el kube-scheduler predeterminado no hace:

**Gang scheduling**Una capsula de inferencia distribuida que requiere 8 GPU o todos los 8 comienzan juntos o ninguno lo hace. sin esto, obtienes la trampa de asignación parcial: 7 de 8 capsules comienzan, esperan indefinidamente, queman dinero.

**Topology awareness** saber qué GPU comparten NVLink, que se sientan en el mismo estante, que tienen InfiniBand entre ellos. Colocar las pods en consecuencia. Una carga de trabajo tensor-paralelo DeepSeek-V3 67B debe permanecer en un dominio NVLink; KAI Scheduler respeta eso.

**Hierarchical queues** varios equipos compiten por la misma GPU con prioridad y cuota.

KAI se implementa junto con kube-scheduler como un cronómetro secundario; se anota las cargas de trabajo para usarlo.

### Capas 3  señales de nivel de aplicación

**The HPA trap**¿ Qué es esto ?`DCGM_FI_DEV_GPU_UTIL`es una métrica de ciclo de trabajo  mide si la GPU estaba haciendo el trabajo en cada intervalo de muestreo. El 100% de utilización podría significar 10 solicitudes simultáneas o 100; la GPU estaba ocupada de cualquier manera.

Peor aún, los motores vLLM y similares asignan previamente la memoria caché KV (hasta `--gpu-memory-utilization`El uso de memoria se mantiene cerca del 90% incluso en una sola solicitud.

**2026 replacement signals**¿Qué es esto ?

- Profundidad de la cola (número de solicitudes que esperan preempleo).
- Utilización de la caché KV (cuál es la fracción de bloques asignados a las secuencias activas).
- Por réplica P99 TTFT (su señal de SLA).
- Producción de producto (solicitudes de satisfacción de todos los SLOs por segundo).

NVIDIA Dynamo Planner y llm-d Workload Variant Autoscaler consumen estas señales y réplicas de escala.

### ¿Cuándo utilizar qué

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### El preempleo/decodificación desglosado lo complica todo

Si ejecuta una preemplaza/decodificación desagregada (fase 17 · 17), tiene dos clases de capsules con diferentes desencadenantes de escala: escala de capsules de preemplaza en profundidad de cola, escala de capsules de decodificación en presión de caché KV. llm-d expone estos como separados `Services`No trate de poner un solo HPA frente a ambos.

### El inicio frío también importa aquí

La mitigación de arranque en frío (fase 17 · 10) es cuando el tiempo de provisión de nodos se vuelve visible para el usuario.`min_workers=1`) para las rutas críticas de SLO, o utilizar puntos de control de estilo Modal en la capa de aplicación.

### Números que debes recordar

- Provisión de nodos de carpenter: ~ 45-60s vs Cluster Autoscaler ~ 90-120s (nodos GPU).
- El programa KAI evita la trampa de 7 de 8 residuos de asignación parcial.
- `DCGM_FI_DEV_GPU_UTIL`como señal HPA: rotada; utilizar profundidad de cola o utilización de KV.
- Carpenter `WhenEmptyOrUnderutilized`: termina ejecutando trabajos de GPU.`WhenEmpty + consolidateAfter: 1h`para inferir.

```figure
autoscaling
```

## Usalo

`code/main.py`Simula una autoescalada de tres capas en una carga de trabajo de GPU quebrada. Compara HPA ingenuo (ciclo de trabajo), HPA de profundidad de cola y escalada programada por la banda KAI. Reporta solicitudes no satisfechas, minutos de GPU inactivos y una puntuación compuesta.

## Envío

Esta lección produce`outputs/skill-gpu-autoscaler-plan.md`. Dada la topología del grupo, la forma de la carga de trabajo y el SLO, diseña un plan de autoescalado de tres capas.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Cuántas solicitudes de HPA en el ciclo de trabajo naívo caen que capturan HPA en la cola? ¿De dónde viene la diferencia?
2. Diseñar un NodePool de Karpenter para un grupo que sirve Llama 3.3 70B FP8 en H100 SXM5. Especificar `capacity-type`¿ Qué ?`disruption.consolidationPolicy`¿ Qué ?`consolidateAfter`, y una mancha que mantiene las cargas de trabajo no GPU fuera de estos nodos.
3. Su equipo informa que las implementaciones están atascadas en espera porque "GPUs disponibles pero la cápsula no programará". Diagnóstico ¿es este Karpenter, kube-scheduler, o KAI Scheduler? ¿Qué métricas confirman?
4. Elige una señal para las cápsulas de preempleo desglosadas a escala automática y otra señal para las cápsulas de decodificación.
5. Calcule el coste de la `WhenEmptyOrUnderutilized`trampa de consolidación en un servicio de producción 24x7 que promedia 60 eventos de caída de solicitudes por día en P99 TTFT > 10s.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler; sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler predecessor; slower, group-based |
| KAI Scheduler | "the GPU scheduler" | Secondary scheduler for gang + topology + queues |
| Gang scheduling | "all or nothing" | Schedule N pods atomically or defer all of them |
| Topology awareness | "rack-aware" | Place pods based on NVLink/IB/rack placement |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | Duty-cycle metric; NOT a scaling signal for LLMs |
| Queue depth | "waiting requests" | Correct HPA signal for prefill-bound scaling |
| KV cache utilization | "memory pressure" | Correct HPA signal for decode-bound scaling |
| Consolidation | "Karpenter consolidation" | Node termination to cheaper instance type |
| `WhenEmpty + 1h` | "safe consolidation" | Policy that doesn't evict running GPU jobs |

## Leer más

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) documentos de diseño y ejemplos de configuración.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) semántica de la política de consolidación y las deficiencias de seguridad de la GPU.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) Dinamo Planner escala señales.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) Patrón de integración de rayos.
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) Guía específica de Kubernetes gestionada.
- [llm-d GitHub](https://github.com/llm-d/llm-d) Diseño de la variante de autoescalador de carga de trabajo.
