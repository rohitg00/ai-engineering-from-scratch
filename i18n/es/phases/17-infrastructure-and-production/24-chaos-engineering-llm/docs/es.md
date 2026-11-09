# Ingeniería del caos para la producción de LLM

> La ingeniería del caos para LLM es su propia disciplina en 2026. Requisitos previos a la ejecución de experimentos en producción: SLI/SLO definido, observabilidad de traza+metría+registro, retroceso automático, libretas de ejecución, en llamada. La arquitectura tiene cuatro planos: control (programador de experimentos), objetivo (servicios, infra, almacenes de datos), seguridad (garda + abortar + filtros de tráfico), observabilidad (metricas + rastros + registros), retroalimentación (a ajustes SLO). Las barandillas de seguridad son obligatorias: las alertas de velocidad de quemadura interrumpen los experimentos si se espera que se produzca una quemadura de error-ordenario diario > 2 veces; ventanas de supresión + correlación de identificación de rastreo deducir ruido de alerta. Cadencia: revisión semanal de los pequeños canarios + SLO; día de juego mensual + postmortem; auditoría trimestral de resiliencia entre equipos + mapeo de dependencia. Experimentos específicos de LLM: sobrecarga de memoria, fallas de red, interrupciones de proveedores, instrucciones malformadas, tormentas de desalojo de caché KV. Herramientas: Ingeniería del Caos de aprovechamiento (recomendaciones derivadas del LLM, reducción de radio de explosión, integración de herramientas MCP); LitmusChaos (CNCF); Chaos Mesh (nativa de Kubernetes de la CNCF).

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy chaos experiment runner)
**Prerequisites:** Phase 17 · 23 (SRE for AI), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre de los cinco requisitos previos de la ingeniería del caos (SLI/SLO, observabilidad, retroceso, libros de ejecución, en llamada) y explica por qué saltar cualquier práctica rompe la práctica.
- Diagrama los cuatro planos (control, objetivo, seguridad, observabilidad) y el bucle de retroalimentación en SLO.
- Enumere cinco experimentos específicos de LLM (supercarga de memoria, falla de red, interrupción del proveedor, respuesta incorrecta, tormenta de desalojo de KV).
- Elige una herramienta  Arnes, LitmusChaos, Chaos Mesh  dada pila.

## El problema

Se establece la prueba de caos en las pilas tradicionales. LLM pilas añaden nuevos modos de falla. Un aviso de token 4K con un carácter venenoso detiene el tokenizador durante 12 segundos. Un proveedor de agua arriba 429s; su puerta de entrada retenta; sus OOMs de servicio en simultánea amplificada retenta. Una tormenta de desalojo de caché KV bajo carga de explosión causa cascadas de reposición que saturan la computación.

Ninguno de estos aparecen en las pruebas de unidad.

## El concepto

### Pre-requisitos

No hay caos en la producción sin:

1. **SLI/SLO** definidos indicadores y objetivos de nivel de servicio.
2. **Observability** rastros, métricas, registros, conectados a los paneles.
3. **Automated rollback** Fase 17 · 20 Rollo de la bandera política.
4. **Runbooks** estructurados, fase 17 · 23.
5. **On-call** alguien que responda.

Faltando cualquier medio el caos se convierte en un incidente real.

### Cuatro aviones + retroalimentación

**Control plane** programador de experimentos (flujo de trabajo de Litmus, programación de Chaos Mesh, UI de Arnes).

**Target plane** servicios, capsules, nodos, balanceadores de carga, almacenamiento de datos.

**Safety plane** interruptor de apagado, ventanas de supresión, límites de radio de explosión, puertas de error de presupuesto.

**Observability plane** métricas normales + correlación de identificación de rastro para distinguir los fallos inducidos por el caos de los fallos naturales.

**Feedback loop** los resultados se reflejan en el ajuste de SLO, las actualizaciones de los directorios de ejecución, las correcciones de código.

### Las barandillas de vigilancia son obligatorias

- **Burn-rate alert**: experimentar en pausa si el presupuesto de errores diario excede el 2 veces el esperado.
- **Suppression windows**: silenciar las alertas no experimentales en el radio de la explosión durante el experimento.
- **Trace-ID correlation**: todos los errores inducidos por el experimento llevan una etiqueta para que la llamada pueda deducirse.

### Cinco experimentos específicos de la LLM

1. **Memory overload** forzar una tormenta de prevención de caché KV enviando solicitudes de contexto largo con alta concurrencia. Observe: ¿el servicio se desprende graciosamente o se estrella?

2. **Network failure** cortar la conectividad entre la puerta de entrada de inferencia y el proveedor.

3. **Provider outage simulation** 100% 429 de OpenAI. Observación: ¿ha fallado el enrutamiento a Anthropic? (fase 17 · 16, 19)

4. **Malformed prompt** inyectar la carga útil de instalar tokenizadores (por ejemplo, unicode profundamente anidado, un enorme punto de código UTF-8). Observa: ¿una sola solicitud bloquea a un trabajador?

5. **KV eviction storm** desalojo forzoso mediante la saturación del presupuesto del bloque de VLLM. Observe: ¿se recupera el LMCache o se degrada el servicio?

### Cadencia

- **Weekly** pequeños experimentos de canarios en la puesta en escena, tal vez un 5% de pro.
- **Monthly** el día de juego programado en un escenario específico; asistencia entre equipos; post mortem.
- **Quarterly** Auditoría de la resiliencia entre equipos; actualización del mapa de dependencias.

### Equipamiento

- **Harness Chaos Engineering** comercial; recomendaciones de experimentos derivados de IA; reducción de la escala del radio de explosión; integración de herramientas MCP.
- **LitmusChaos** Graduado en CNCF; basado en el flujo de trabajo de Kubernetes.
- **Chaos Mesh** Sandbox CNCF; estilo CRD nativo de Kubernetes.
- **Gremlin** comercial; apoyo amplio.
- **AWS FIS**- ¿ Qué ?**Azure Chaos Studio** Ofertas administradas en la nube.

### Comenzando pequeño

Primero experimento: un pod para matar una réplica de decodificación bajo tráfico constante. Observa el redireccionamiento y la recuperación. Si esto funciona y parece seguro, graduarse en el caos de la red.

Primero experimento específico de LLM: inyectar a un proveedor 429 durante 5 minutos. Observa la caída. La mayoría de los equipos descubren que su caída no fue completamente probada.

### Números que debes recordar

- Cuatro aviones: control, objetivo, seguridad, observabilidad.
- Pausa de la tasa de quemaduras: 2 veces el presupuesto diario esperado.
- Cadencia: canario semanal, día de juego mensual, auditoría trimestral.
- Cinco experimentos de LLM: memoria, red, proveedor, respuesta defectuosa, tormenta KV.

```figure
i4-chaos-guard
```

## Usalo

`code/main.py`Simula tres experimentos de caos con puertas de seguridad de aviones.

## Envío

Esta lección produce`outputs/skill-chaos-plan.md`Dado su tamaño y madurez, elige los tres primeros experimentos y las herramientas.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Qué experimento desactiva la puerta de la velocidad de quemadura y por qué?
2. Diseñar los primeros cinco experimentos de caos para un servicio RAG basado en vLLM. Incluye criterios de éxito.
3. Su alerta de la tasa de quemaduras interrumpió un experimento. ¿Cómo determina la causa raíz  caos o natural?
4. ¿Cuándo es la producción la respuesta correcta?
5. Nombre de tres modos de falla específicos de la LLM que el caos de red genérico no puede reproducir.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SLI / SLO | "service targets" | Indicator + objective; required prerequisite |
| Blast radius | "scope" | Set of services / users affected by experiment |
| Burn-rate alert | "budget gate" | Fires when error-budget burn rate > 2x expected |
| Game day | "monthly drill" | Scheduled cross-team chaos exercise |
| LitmusChaos | "CNCF workflow" | Graduated CNCF Kubernetes chaos tool |
| Chaos Mesh | "CNCF CRD" | CNCF sandbox Kubernetes-native chaos |
| Harness CE | "commercial AI-assisted" | Harness chaos with AI recommendations |
| Malformed prompt | "tokenizer bomb" | Input that stalls tokenization |
| KV eviction storm | "preemption cascade" | Mass eviction triggering re-prefills |

## Leer más

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for Large Language Models (Apress, 2026)](https://link.springer.com/book/10.1007/979-8-8688-2827-0)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
