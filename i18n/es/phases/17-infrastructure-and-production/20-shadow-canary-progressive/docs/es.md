# El tráfico de sombras, la implementación de las Canarias y el despliegue progresivo de las MLL

> Los despliegues de LLM combinan las partes más difíciles de la implementación de software: no hay pruebas unitarias, modos de falla difusos, señales retrasadas. La secuencia es (1) modo sombra  solicitudes de prod duplicadas al modelo candidato, registro, comparación con impacto de usuario cero; captura problemas obvios de distribución pero no es una garantía de calidad; (2) lanzamiento canario  cambio progresivo de tráfico 10% → 25% → 50% → 75% → 100% con puertas en cada paso; percentil de latencia de seguimiento, costo / solicitud, tasa de error / rechazo, distribución de longitud de salida, tasa de retroalimentación del usuario; (3) pruebas A / B para alternativas distintas después de que se confirme la estabilidad. El no determinismo es irreducible  hasta una variación de precisión del 15% en las carreras con entradas idénticas debido a la no-asociabilidad de la GPU FP más la variación del tamaño del lote. El costo es variable, no constante  un modelo mejor del 20% puede ser 3 veces más caro por llamada. La velocidad de retroceso es decisiva: si el retroceso requiere una nueva implementación, usted es demasiado lento. La política se vive en configuración/banderas; el modelo se vive en el registro con digestos fijados; el retroceso = política de cambio + umbral de retroceso + modelo antiguo en segundos.

**Type:** Learn
**Languages:** Python (stdlib, toy canary-progression simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 21 (A/B Testing)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Distinguir entre el modo sombra (comparación de impacto cero), canario (trafico en vivo progresivo) y A/B (comparación confirmada por estabilidad).
- Enumerar cinco métricas canarias específicas del LLM (latencia, coste/solicitud, error/rechazo, distribución de longitud de salida, retroalimentación del usuario).
- Explicar por qué el no determinismo de la LLM (hasta el 15%) cambia lo que significa "estable" en un despliegue.
- Diseñar un camino de retroceso que tome segundos (invertir la política) y no horas (redistribuir).

## El problema

En 24 horas, el costo ha aumentado un 40%, el número de usuarios ha aumentado un 8%, tres boletos de clientes reportan "respuestas extrañas".

Cada pieza de eso era evitable. El modo sombra habría alcanzado el 40% de aumento de costos antes de que cualquier usuario lo viera. Canary se habría detenido en el 10% cuando se movieron los pulgares hacia abajo. La retroceso de la bandera de política habría tomado 30 segundos. La disciplina es lo que llena la brecha entre "las evaluaciones fuera de línea se ven bien" y "los usuarios reales están felices".

## El concepto

### Modo de sombra

El candidato recibe las mismas solicitudes que la producción; las salidas se registran, no se devuelven a los usuarios. Cero impacto del usuario.

- Contenido de la producción (diferencia con la producción).
- Cuentas de tokens (delta de costo).
- La latencia.
- Rechazo y error.

Captura: aumento de costos, regresión de longitud, cambios obvios de rechazo, errores difíciles. NO captura: los usuarios del delta percibirían calidad.

### Despliegue de las Canarias

Progresividad del tráfico con puertas. Progreso típico: 1% → 10% → 25% → 50% → 75% → 100%. Puerta en 5 métricas en cada paso:

1. **Latency percentiles** P50, P95, P99. Infracción: el canario tiene P99 > 1,5 veces el valor de referencia.
2. **Cost per request** mezclado. incumplimiento: > 20% por encima del límite de referencia.
3. **Error / refusal rate**5xx más rechazos explícitos.
4. **Output length distribution** media + P99. incumplimiento: cambio de distribución.
5. **User-feedback rate** pulgares hacia abajo / presentación de boletos.

### El no determinismo es la nueva variación

Las entradas idénticas producen resultados no idénticos.

- No asociatividad de la GPU FP (el orden de reducción de puntos flotantes varía según el lote).
- Varianza de tamaño de lote (el mismo pedido en un lote de 128 vs lote de 16).
- Muestreo (temperatura > 0).

Medido: hasta un 15% de variación de precisión en ejecución a ejecución en conjuntos de evaluaciones idénticos. "Stable" en un despliegue significa que las métricas están dentro de la variación esperada, no idénticas a la línea de base.

### El costo es variable

Un modelo mejor del 20% puede ser 3 veces más caro por llamada. El costo/solicitud es una de las cinco puertas.

### El Rollback es el arma

- Bandera de política (sistema de banderas de características): porcentaje de cambio en configuración; toma segundos.
- Pinning de modelo (digest de registro): el modelo pegado no se actualiza automáticamente.
- Repetición = revertir la bandera + fijar el digesto fijado a la anterior.

Si su pila requiere de redistribuir para volver a rodar, arregle eso antes de rodar.

### Equipamiento

**Argo Rollouts**- ¿ Qué ?**Flagger** Controller de entrega progresiva Kubernetes. Integrado con el enrutamiento ponderado Istio/Linkerd.

**Istio weighted routing** División del tráfico a nivel de red de servicio.

**KServe / Seldon Core** modelo que sirve con canario incorporado.

**Feature flags**LaunchDarkly, Flagsmith, Unleash, Flip de nivel de política, no hay redistribución.

### Cadencia de las métricas

Las puertas de Canary se revisan cada 5-15 minutos dependiendo del volumen de tráfico. 1% de 1,000 req/min (10 req/min para el canario) da 50-150 puntos de datos por ventana de 5-15 minutos  suficiente para la latencia pero ruidoso para la retroalimentación del usuario. 10% da ~10x más.

### El paso A/B es opcional.

Si el nuevo modelo es claramente diferente (comportamiento diferente, curva de costos diferente, tono diferente), A/B prueba a 50% después de que canary pasa. Si es sólo una versión mejorada del mismo comportamiento, salte al 100% cuando canary gates pasan. Mejorado significa que la evaluación fuera de línea mostró la ganancia.

### Números que debes recordar

- Progresón canaria: 1% → 10% → 25% → 50% → 75% → 100%.
- Topo de no determinismo: hasta un 15% de variación entre entradas en función de las entradas idénticas.
- Cinco métricas canarias: latencia, coste, error/rechazo, duración de salida, retroalimentación del usuario.
- Por ejemplo, el precio de la empresa de la empresa de la empresa de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de la marca de marca de la marca de la marca de marca de la marca de marca de la marca de marca de la marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de marca de
- Repetición: segundos, no horas.

```figure
i4-canary-ramp
```

## Usalo

`code/main.py`Simula un despliegue canario con regresiones inyectadas.

## Envío

Esta lección produce`outputs/skill-rollout-runbook.md`. Dado el modelo candidato, el nivel de referencia y la tolerancia al riesgo, diseña un plan de sombra→canario→100%.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Inyectar una regresión del 25% de costos. ¿En qué etapa se detiene el canario?
2. Su nuevo modelo tiene un aumento de 3% de precisión fuera de línea pero el costo/solicitud es +18%. ¿Es un barco?
3. Diseñe un retroceso que dure menos de 60 segundos de extremo a extremo.
4. No determinismo muestra ±7% en su evaluación.
5. El modo sombra tiene un aumento de 40% antes de canario.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Shadow mode | "duplicate to new" | Zero-impact send-to-candidate for logging |
| Canary | "progressive traffic" | Gradual user-exposed rollout with gates |
| Gates | "rollout checks" | Metric thresholds that block progression |
| Non-determinism | "LLM variance" | Irreducible run-to-run differences |
| Policy flag | "flag flip rollback" | Config-level rollback, seconds not hours |
| Model pin | "registry digest" | Immutable reference to a model version |
| Argo Rollouts | "K8s progressive" | Kubernetes-native canary/rollback controller |
| KServe | "inference K8s" | Model serving with canary primitives |
| Istio weighted | "mesh split" | Service-mesh traffic splitter |

## Leer más

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
